import { describe, expect, it } from 'vitest';
import { AGENT_REFS, revealScriptFromScenarios, SCENARIOS } from '../src/scenarios.js';

describe('SCENARIOS fixture', () => {
  it('contains exactly 5 scenarios with unique ids', () => {
    expect(SCENARIOS).toHaveLength(5);
    const ids = new Set(SCENARIOS.map((s) => s.id));
    expect(ids.size).toBe(5);
  });

  it('has exactly five unique agent refs across all scenarios (agent reuse is by design)', () => {
    const allRefs = SCENARIOS.flatMap((s) => [s.a.ref, s.b.ref]);
    const unique = new Set(allRefs);
    expect(unique.size).toBe(5);
    expect(unique).toEqual(
      new Set([
        AGENT_REFS.ALICE,
        AGENT_REFS.BOB,
        AGENT_REFS.DELIVERY,
        AGENT_REFS.HVAC,
        AGENT_REFS.CONTRACTOR,
      ]),
    );
  });

  it('uses Alice as agent A in every scenario (Alice appears in all 5)', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.a.ref).toBe(AGENT_REFS.ALICE);
    }
  });

  it('uses Bob as agent B in scenarios 1 and 3 (recurring relationship)', () => {
    expect(SCENARIOS[0]!.b.ref).toBe(AGENT_REFS.BOB);
    expect(SCENARIOS[2]!.b.ref).toBe(AGENT_REFS.BOB);
  });

  it('has at least one turn and a valid reveal target for each scenario', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.turns.length).toBeGreaterThan(0);
      expect(scenario.revealTurn).toBeGreaterThanOrEqual(0);
      expect(scenario.revealTurn).toBeLessThan(scenario.turns.length);
    }
  });

  it('reveal offsets are strictly ordered across scenarios', () => {
    const offsets = SCENARIOS.map((s) => s.revealAtMsFromStart);
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1]!);
    }
  });

  it('scenarios 1-3 match the locked CLAUDE.md text verbatim', () => {
    const s1a = SCENARIOS[0]!.turns[0]!.body;
    expect(s1a).toContain('meeting yours Thursday at 2 PM');
    const s2a = SCENARIOS[1]!.turns[0]!.body;
    expect(s2a).toContain('package is arriving today');
    const s3a = SCENARIOS[2]!.turns[0]!.body;
    expect(s3a).toContain('Saturday 1-4 PM at our house');
  });
});

describe('revealScriptFromScenarios', () => {
  it('produces one entry per scenario with (from,to) matching the reveal turn', () => {
    const script = revealScriptFromScenarios();
    expect(script).toHaveLength(SCENARIOS.length);
    for (let i = 0; i < SCENARIOS.length; i++) {
      const scenario = SCENARIOS[i]!;
      const turn = scenario.turns[scenario.revealTurn]!;
      const expectedFrom = turn.fromRole === 'A' ? scenario.a.ref : scenario.b.ref;
      const expectedTo = turn.fromRole === 'A' ? scenario.b.ref : scenario.a.ref;
      expect(script[i]!.match.from).toBe(expectedFrom);
      expect(script[i]!.match.to).toBe(expectedTo);
      expect(script[i]!.at_ms_from_start).toBe(scenario.revealAtMsFromStart);
    }
  });
});
