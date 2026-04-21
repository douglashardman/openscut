import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runScenario, startDemoStack, type DemoHandles } from '../src/orchestrator.js';
import { SCENARIOS } from '../src/scenarios.js';

describe('demo stack', () => {
  let stack: DemoHandles;

  beforeEach(async () => {
    stack = await startDemoStack({
      eventsToken: 'demo-test-token',
      scenarios: [SCENARIOS[0]!],
    });
  });

  afterEach(async () => {
    await stack.close();
  });

  it('boots with a pair of agents registered in the resolver', () => {
    expect(stack.agents).toHaveLength(2);
    expect(stack.agents.map((a) => a.role).sort()).toEqual(['A', 'B']);
  });

  it('runs a scenario end-to-end and produces both envelopes on the relay', async () => {
    const [a, b] = stack.agents;
    const scenario = {
      ...SCENARIOS[0]!,
      startOffsetMs: 0,
      turns: SCENARIOS[0]!.turns.map((t) => ({ ...t, sendOffsetMs: t.sendOffsetMs })),
    };
    await runScenario(scenario, { A: a!, B: b! }, Date.now());
    const received = await b!.client.receive();
    const receivedByA = await a!.client.receive();
    const allBodies = [...received.map((m) => m.body), ...receivedByA.map((m) => m.body)];
    expect(allBodies).toContain(scenario.turns[0]!.body);
    expect(allBodies).toContain(scenario.turns[1]!.body);
  });

  it('emits envelope_received events for each send', async () => {
    const controller = new AbortController();
    const events: Array<{ kind: string; envelope?: { envelope_id: string } }> = [];
    const res = await fetch(`${stack.relay.baseUrl}/scut/v1/events`, {
      headers: { authorization: `Bearer ${stack.eventsToken}` },
      signal: controller.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const pump = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = frame.split('\n').find((l) => l.startsWith('data: '));
            if (line) events.push(JSON.parse(line.slice(6)));
          }
        }
      } catch {
        /* aborted */
      }
    })();

    try {
      const [a, b] = stack.agents;
      const scenario = {
        ...SCENARIOS[0]!,
        startOffsetMs: 0,
        turns: SCENARIOS[0]!.turns.map((t) => ({ ...t, sendOffsetMs: t.sendOffsetMs })),
      };
      await runScenario(scenario, { A: a!, B: b! }, Date.now());

      const deadline = Date.now() + 2000;
      while (
        events.filter((e) => e.kind === 'envelope_received').length < 2 &&
        Date.now() < deadline
      ) {
        await new Promise((r) => setTimeout(r, 20));
      }
      const received = events.filter((e) => e.kind === 'envelope_received');
      expect(received.length).toBe(2);
    } finally {
      controller.abort();
      await pump;
    }
  });
});
