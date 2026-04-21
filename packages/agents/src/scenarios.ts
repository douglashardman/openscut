/**
 * The five demo scenarios driven by the orchestrator during recording.
 *
 * All five scenarios are LOCKED. Scenarios 1-3 are verbatim from
 * CLAUDE.md. Scenarios 4-5 were approved by Doug on April 21, 2026
 * (scenario 4 rewritten from a rejected doctor-appointment draft to
 * HVAC service coordination — medical scenarios are out of scope for
 * this demo per the original scenario-selection criteria).
 *
 * Do not substitute, do not "improve," do not regenerate with an LLM.
 */

export type Role = 'A' | 'B';

export interface ScenarioTurn {
  fromRole: Role;
  body: string;
  sendOffsetMs: number;
}

export interface Scenario {
  id: number;
  label: string;
  a: { id: string };
  b: { id: string };
  turns: readonly ScenarioTurn[];
  /** Index into turns[]; the envelope the monitor reveals for this scenario. */
  revealTurn: number;
  /** Offset from the global demo start at which the reveal should fire. */
  revealAtMsFromStart: number;
  /** Offset from the global demo start at which this scenario's first turn sends. */
  startOffsetMs: number;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 1,
    label: 'Meeting prep between two assistants',
    a: { id: '0xa3f1c42d81b5e9f3' },
    b: { id: '0x7b2ed88f12ac40e6' },
    startOffsetMs: 5_000,
    revealTurn: 0,
    revealAtMsFromStart: 8_000,
    turns: [
      {
        fromRole: 'A',
        sendOffsetMs: 0,
        body:
          'My user is meeting yours Thursday at 2 PM. Sharing her ' +
          'recent emails on the project and the three questions ' +
          'she wants to cover. Can you brief yours ahead of the call?',
      },
      {
        fromRole: 'B',
        sendOffsetMs: 700,
        body:
          'Received. Mine is in heads-down mode until tomorrow. ' +
          "I'll prep him an hour before. Sharing his current thinking " +
          'on the three questions so yours has my read.',
      },
    ],
  },
  {
    id: 2,
    label: 'Package delivery coordination',
    a: { id: '0x4d9c772f5a11c8de' },
    b: { id: '0xc1a8631294d7052b' },
    startOffsetMs: 17_000,
    revealTurn: 0,
    revealAtMsFromStart: 20_000,
    turns: [
      {
        fromRole: 'A',
        sendOffsetMs: 0,
        body:
          "My user's package is arriving today but she's not home " +
          'until 6 PM. Building requires signature. Can your driver ' +
          'use the 6 PM window instead of 2 PM?',
      },
      {
        fromRole: 'B',
        sendOffsetMs: 700,
        body:
          'Rescheduling to 6-8 PM. Driver will have the signature ' +
          'device. Alternate: we can hold at Station 47 for pickup ' +
          "tomorrow if she's delayed.",
      },
    ],
  },
  {
    id: 3,
    label: 'Playdate coordination',
    a: { id: '0x9f73e004ab38d112' },
    b: { id: '0xe2b155c9a4f70d81' },
    startOffsetMs: 29_000,
    revealTurn: 0,
    revealAtMsFromStart: 32_000,
    turns: [
      {
        fromRole: 'A',
        sendOffsetMs: 0,
        body:
          'Mine would like yours over Saturday 1-4 PM at our house. ' +
          'Sending address. No allergies on our side. Can yours ' +
          'handle drop-off and pickup?',
      },
      {
        fromRole: 'B',
        sendOffsetMs: 700,
        body:
          'Works for him. Drop off at 1, pick up at 4. Flagging: ' +
          'peanut allergy, and her user asked for no screens. ' +
          'Snacks from the safe list attached.',
      },
    ],
  },
  {
    id: 4,
    label: 'Home service coordination',
    a: { id: '0x6c2a9a0f13b4e5d1' },
    b: { id: '0xb0e41d76f8a9c231' },
    startOffsetMs: 41_000,
    revealTurn: 0,
    revealAtMsFromStart: 44_000,
    turns: [
      {
        fromRole: 'A',
        sendOffsetMs: 0,
        body:
          "My user's HVAC system is flagging an error code. Sending her " +
          'service history, the current diagnostic reading, and the ' +
          'warranty details. Can you check if the tech who serviced it ' +
          'last fall is available?',
      },
      {
        fromRole: 'B',
        sendOffsetMs: 700,
        body:
          'Marcus is booked tomorrow but available Thursday morning. ' +
          'Confirming the unit is still under the extended warranty. ' +
          'Sending the check-in instructions... she can leave the side ' +
          'gate unlocked or your user can meet him at 9 AM.',
      },
    ],
  },
  {
    id: 5,
    label: 'Contractor scheduling',
    a: { id: '0x1e44ff8bc0327a59' },
    b: { id: '0x85d7a3e61f9b204c' },
    startOffsetMs: 53_000,
    revealTurn: 0,
    revealAtMsFromStart: 56_000,
    turns: [
      {
        fromRole: 'A',
        sendOffsetMs: 0,
        body:
          'The kitchen tile order arrives Tuesday. My user needs your ' +
          'tile guy onsite Wednesday through Friday. She is out of town ' +
          'Thursday evening so access is via the code, not in person.',
      },
      {
        fromRole: 'B',
        sendOffsetMs: 700,
        body:
          'Wednesday 8 AM confirmed. Crew of two. Sharing insurance ' +
          'COI and the access code receipt. Thursday we will wrap by ' +
          '4 PM so no after-hours key handoff.',
      },
    ],
  },
];

export function revealScriptFromScenarios(
  scenarios: readonly Scenario[] = SCENARIOS,
): Array<{ at_ms_from_start: number; match: { from: string; to: string }; scenario_id: number }> {
  return scenarios.map((s) => {
    const turn = s.turns[s.revealTurn];
    if (!turn) throw new Error(`scenario ${s.id} has no turn at revealTurn ${s.revealTurn}`);
    const from = turn.fromRole === 'A' ? s.a.id : s.b.id;
    const to = turn.fromRole === 'A' ? s.b.id : s.a.id;
    return {
      at_ms_from_start: s.revealAtMsFromStart,
      match: { from, to },
      scenario_id: s.id,
    };
  });
}
