import { describe, expect, it } from 'vitest';
import { revealScriptFromScenarios, SCENARIOS } from '../src/scenarios.js';

describe('SCENARIOS fixture', () => {
  it('contains exactly 5 scenarios with unique ids', () => {
    expect(SCENARIOS).toHaveLength(5);
    const ids = new Set(SCENARIOS.map((s) => s.id));
    expect(ids.size).toBe(5);
  });

  it('has unique agent ids across all scenarios', () => {
    const allIds = SCENARIOS.flatMap((s) => [s.a.id, s.b.id]);
    expect(new Set(allIds).size).toBe(allIds.length);
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
      const expectedFrom = turn.fromRole === 'A' ? scenario.a.id : scenario.b.id;
      const expectedTo = turn.fromRole === 'A' ? scenario.b.id : scenario.a.id;
      expect(script[i]!.match.from).toBe(expectedFrom);
      expect(script[i]!.match.to).toBe(expectedTo);
      expect(script[i]!.at_ms_from_start).toBe(scenario.revealAtMsFromStart);
    }
  });
});
