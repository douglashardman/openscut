import type { ScutUri } from '@openscut/core';

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
 *
 * Agent mapping (per Doug, April 21):
 *   token 1 — Alice's assistant (A in S1, S2, S3, S4, S5)
 *   token 2 — Bob's assistant   (B in S1, S3)
 *   token 3 — Delivery service  (B in S2)
 *   token 4 — HVAC service      (B in S4)
 *   token 5 — Kitchen contractor (B in S5)
 *
 * All five are minted on the OpenSCUTRegistry on Base mainnet at
 * 0x199b48E27a28881502b251B0068F388Ce750feff, tokens 1-5, with SII
 * documents served at https://openscut.ai/registry/{1..5}.json.
 */

export const DEMO_REGISTRY_ADDRESS = '0x199b48e27a28881502b251b0068f388ce750feff';
export const DEMO_CHAIN_ID = 8453;

function demoRef(tokenId: number): ScutUri {
  return `scut://${DEMO_CHAIN_ID}/${DEMO_REGISTRY_ADDRESS}/${tokenId}`;
}

export const AGENT_REFS = {
  ALICE: demoRef(1),
  BOB: demoRef(2),
  DELIVERY: demoRef(3),
  HVAC: demoRef(4),
  CONTRACTOR: demoRef(5),
} as const;

export type Role = 'A' | 'B';

export interface ScenarioTurn {
  fromRole: Role;
  body: string;
  sendOffsetMs: number;
}

export interface Scenario {
  id: number;
  label: string;
  a: { ref: ScutUri };
  b: { ref: ScutUri };
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
    a: { ref: AGENT_REFS.ALICE },
    b: { ref: AGENT_REFS.BOB },
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
    a: { ref: AGENT_REFS.ALICE },
    b: { ref: AGENT_REFS.DELIVERY },
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
    a: { ref: AGENT_REFS.ALICE },
    b: { ref: AGENT_REFS.BOB },
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
    a: { ref: AGENT_REFS.ALICE },
    b: { ref: AGENT_REFS.HVAC },
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
    a: { ref: AGENT_REFS.ALICE },
    b: { ref: AGENT_REFS.CONTRACTOR },
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
    const from = turn.fromRole === 'A' ? s.a.ref : s.b.ref;
    const to = turn.fromRole === 'A' ? s.b.ref : s.a.ref;
    return {
      at_ms_from_start: s.revealAtMsFromStart,
      match: { from, to },
      scenario_id: s.id,
    };
  });
}
