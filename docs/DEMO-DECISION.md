# SCUT Demo: Decision Document

**Status:** LOCKED — terminal-of-blobs with reveal animation
**Captured:** April 20, 2026
**Locked:** April 21, 2026 (RevealBox spike signed off)
**Demo deadline:** Sunday April 26, 2026, 8 PM EDT
**Recording target:** Sunday morning, Sony ZV-E10

---

## Status (locked April 21, 2026)

The demo direction is **locked: terminal-of-blobs with reveal animation (Concept 2 below)**. Doug approved the RevealBox spike mid-session on April 21 and greenlit building the full monitor around it. The animation itself is locked; the code paths around it can change.

Remaining work: scenario recording pass Saturday, final timing tune on Peter, record Sunday morning.

---

## Purpose of This Document

Captures all the demo thinking done on April 20, before the build started April 21. Sections 1-3 are preserved as the decision history. Decisions taken mid-session (April 21) are reflected in the "Status" block above and the resolved open questions at the bottom.

---

## Thesis

SCUT is the messaging layer for the agent economy. Not a compliance tool. Not an incident-response feature. Infrastructure that agents use to talk to each other privately and verifiably, the same way email is infrastructure humans use to talk to each other.

The demo must land that thesis in 60 seconds. Not "look at this security feature." Rather: "this is how agents are going to communicate by default."

---

## Three Demo Concepts Considered

> **LOCKED:** Concept 2 (terminal-of-blobs with reveal animation) is the direction. Concepts 1 and 3 are retained below as decision history.

### Concept 1: Slack-based incident response

**Frame:** Two Claude-powered agents in a Slack channel working an incident together. Human observer in the thread. When sensitive data needs to pass between agents, they use SCUT off-channel.

**Pros:**
- Familiar surface (Slack)
- Human anchor in the scene
- Clear compliance story
- Safer floor (harder to confuse the viewer)

**Cons:**
- Ceiling is lower
- Tells a narrow story (compliance)
- Requires Slack integration build or high-fidelity mockup
- Doesn't match what SCUT actually is

**Status:** Not used. Dropped as a fallback after the RevealBox spike was approved on April 21. Slack surface will not be built this week.

### Concept 2: Terminal-of-blobs with reveal animations (LOCKED)

**Frame:** A terminal streams real SCUT envelopes in real time. Periodically, the stream pauses, one envelope expands, its ciphertext visibly decrypts into readable plaintext for 2-3 seconds, then re-encrypts back to ciphertext and collapses back into the stream.

**Pros:**
- Shows what SCUT actually is (infrastructure, not a feature)
- Visually striking and cinematic
- The expand/decrypt/collapse animation teaches encryption without narration
- Multiple overlays let us show breadth of use cases
- Build scope is smaller than Slack (no Slack bot integration needed)
- The monitor tool becomes a shippable product artifact

**Cons:**
- Abstract; requires viewer to interpret what they're seeing in first 10 seconds
- No human in frame (could feel sterile)
- Production quality must be high to land

**Status:** LOCKED on April 21, 2026. RevealBox spike approved by Doug; the morph texture, 65/35 drift, 2.5s hold, and 800ms morph durations are signed off. Full monitor built around the spike the same afternoon. Saturday will verify the dim level on Peter and tune if needed; animation itself is locked.

### Concept 3: Hybrid

Slack visible on one half of the screen, live SCUT terminal on the other. Agents visibly work in Slack, exchange encrypted messages via SCUT in the terminal, return to Slack with results.

**Pros:** Combines the floor of Slack with some of the ceiling of terminal.

**Cons:** Busier frame, harder to focus attention, requires both Slack mockup AND terminal polish.

**Status:** Not used. Dropped with Concept 1 after the RevealBox spike was approved on April 21.

---

## Current Lead: Terminal-of-Blobs

### Visual grammar

1. **Default state:** terminal scrolling with envelope lines. Each line is one envelope. Format:
   ```
   [14:32:08.441] 0xa3f1... → 0x7b2e...  847B  sig✓  xChaCha20+Ed25519
   ```

2. **Reveal trigger:** stream pauses. Selected envelope stays at 100% opacity. Everything else dims to 30%. Subtle frame around the selected line.

3. **Expansion:** envelope grows vertically. A box appears showing ciphertext as base64. Labeled "ENCRYPTED PAYLOAD."

4. **Decryption animation:** ciphertext dissolves/morphs into plaintext. Box relabels to "DECRYPTED PAYLOAD." Message is readable for 2-3 seconds.

5. **Re-encryption:** plaintext morphs back into ciphertext. Reverse of decryption animation.

6. **Collapse:** expanded box shrinks back to a single line. Opacity returns to 100% across the stream. Stream resumes.

The expand/decrypt/collapse cycle takes 10-12 seconds per reveal.

### 60-second timeline

- **0:00-0:08** Stream establishes. No overlays. Viewer reads "encrypted agent traffic." Intrigue builds.
- **0:08-0:20** First envelope cycle (Scenario 1).
- **0:20-0:24** Stream resumes.
- **0:24-0:36** Second envelope cycle (Scenario 2).
- **0:36-0:40** Stream resumes.
- **0:40-0:52** Third envelope cycle (Scenario 3).
- **0:52-1:00** Stream continues under closing text overlay.

---

## Scenarios (Locked Choices)

Three mundane, uncontroversial, universally relatable conversations. The boringness is the point. "This is default behavior, not edge cases."

### Scenario 1: Meeting prep between two assistants

```
0xa3f1... → 0x7b2e...

"My user is meeting yours Thursday at 2 PM. Sharing her
recent emails on the project and the three questions
she wants to cover. Can you brief yours ahead of the call?"
```

```
0x7b2e... → 0xa3f1...

"Received. Mine is in heads-down mode until tomorrow.
I'll prep him an hour before. Sharing his current thinking
on the three questions so yours has my read."
```

### Scenario 2: Package delivery coordination

```
0x4d9c... → 0xc1a8...

"My user's package is arriving today but she's not home
until 6 PM. Building requires signature. Can your driver
use the 6 PM window instead of 2 PM?"
```

```
0xc1a8... → 0x4d9c...

"Rescheduling to 6-8 PM. Driver will have the signature
device. Alternate: we can hold at Station 47 for pickup
tomorrow if she's delayed."
```

### Scenario 3: Playdate coordination

```
0x9f73... → 0xe2b1...

"Mine would like yours over Saturday 1-4 PM at our house.
Sending address. No allergies on our side. Can yours
handle drop-off and pickup?"
```

```
0xe2b1... → 0x9f73...

"Works for him. Drop off at 1, pick up at 4. Flagging:
peanut allergy, and her user asked for no screens.
Snacks from the safe list attached."
```

### Why these three

- **Professional, logistical, personal** — covers three different principal types
- **Universally relatable** — everyone has had these experiences
- **Clearly private data** — emails, home addresses, child's allergies, schedules
- **Zero controversy** — no trading, no medical decisions, no high-stakes judgment calls
- **Boringly plausible** — the point is to normalize the future, not shock the viewer

---

## Closing Overlay (Draft)

```
Agents coordinating meetings, deliveries, and playdates.
347 encrypted messages in 60 seconds.

Every message end-to-end encrypted.
Every message cryptographically signed.
None routed through a central service.

This is the messaging layer for the agent economy.
SCUT. openscut.ai
```

Juxtaposition of "playdates" with "cryptographic signing" is the rhetorical payoff. Mundane content, serious infrastructure. That's the thesis.

---

## Production Options

### Option A: Pure After Effects / Premiere
Screen-record real SCUT relay. Add animations in post.

**Pro:** Total control. **Con:** Feels like a video, not a demo. Judges are engineers; they can spot composites.

### Option B: Real TUI tool that does the animation live (PREFERRED)
Build `scut-monitor` as a real terminal tool that connects to a relay, streams envelopes, and has a reveal animation when you have the key. Record one take of it running.

**Pro:** Genuine. The tool becomes a real product artifact. **Con:** More build cost.

### Option C: Hybrid
Real terminal output captured, lightly enhanced in post.

**Pro:** Authentic with polish. **Con:** Still requires both the tool build and editing.

**Current lead:** Option B. If Garfield is ahead of schedule Thursday, this is achievable. If behind, fall back to Option C or even Option A.

---

## Build Implications

### What the terminal demo requires that the Slack demo did not

- **`scut-monitor` TUI.** Connects to relay log, renders envelopes with nice formatting, has reveal animation. This is the key new build.
- **Multiple agent pairs with canned scenarios.** At least 3 pairs (6 agents total) running scripted conversations on a timer to generate realistic traffic during the recording window.
- **Scenario orchestration script.** Runs all agents in parallel, produces realistic-looking traffic.

### What the terminal demo does NOT require

- No Slack integration
- No admin portal
- No end-user CLI (agents use library directly)
- No multi-relay failover
- No on-chain identity document lookup for the demo (can mock the resolver to a local registry)
- No key rotation UI
- No IPFS hosting (use HTTPS metadata URIs or just mock)

### Net effect on Garfield's scope

Smaller build than the Slack demo required. Sophistication concentrated in one place: `scut-monitor`. That becomes the demo and a shippable product.

---

## Revised Garfield Daily Plan (draft, for Friday review)

### Tuesday (Day 1): Foundation
- Repo scaffold, monorepo, CI
- Core crypto in `@openscut/core`: encrypt/decrypt/sign/verify
- Unit tests for crypto round-trips and tamper detection
- Envelope format and types

### Wednesday (Day 2): Protocol + Relay
- Relay daemon (Fastify + SQLite)
- Push/pickup/ack/capabilities endpoints
- Local identity registry (mock resolver for demo)
- End-to-end: two CLI processes exchange one encrypted message

### Thursday (Day 3): Monitor Tool
- `scut-monitor` TUI
- Connects to relay's event stream
- Renders envelopes in scrolling stream
- Expand/decrypt/collapse animation on selected envelope
- Key configuration so it can reveal traffic it has keys for
- This is the critical new build. Budget most of Thursday here.

### Friday (Day 4): Agent Scenarios + Infrastructure
- Write 3 agent pair scripts (6 agents total) that run the three scenarios on a timer
- Deploy relay to DigitalOcean droplet at relay.openscut.ai
- Dry-run the demo flow end-to-end
- **Friday evening: revisit this doc, make final demo call**

### Saturday (Day 5): Polish + Pull-Ahead
- Tune `scut-monitor` animation timing
- Polish envelope formatting, colors, readability
- Landing page at openscut.ai
- README, docs, getting-started guide
- Dress rehearsal recording
- `/ultrareview` pass with full review

### Sunday (Day 6): Record + Ship
- Single-take recording on Sony ZV-E10
- Minor post-production if needed
- Submit to Cerebral Valley by 8 PM EDT
- Blog writeup published

---

## Open Questions (RESOLVED April 21, 2026)

1. **Option A/B/C production decision.** Resolved: Option B (real TUI tool that does the animation live). `scut-monitor` renders envelopes via SSE from the relay, decrypts with a keyring file, and drives a scripted reveal sequence. Recording is a single take off Peter.
2. **Scenario swaps.** Resolved: three CLAUDE.md scenarios ship verbatim; two additional drafts (doctor appointment rescheduling, contractor scheduling) added in `packages/agents/src/scenarios.ts` for a total of 5 scenarios. Doug reviews the two drafts before the Saturday dress rehearsal.
3. **Slack fallback.** Resolved: not used. Slack surface is not being built this week. If something catastrophic happens to the terminal demo Saturday, we ship a simpler screencapture of a single send/receive pair instead.
4. **Length.** Resolved: ~60-65 seconds, accommodating 5 reveals (one per scenario) at ~12 s between reveals. Not hackathon-gated so not hard-capped.
5. **Audio.** Resolved: no voiceover, no music. Terminal keystrokes and the natural sound of the MacBook fan. Reconfirm after Saturday dress rehearsal.

---

## Non-Goals for the Demo

Things explicitly out of scope for the video, regardless of which concept wins:

- **No explanation of ERC-8004.** Agent IDs appear as hex addresses. Viewer doesn't need to know they're on-chain.
- **No wallet prompts or Etherscan shots.** Nothing that screams "crypto project."
- **No token or payment references.** This is not a crypto pitch.
- **No voiceover.** If a judge can't understand the demo without narration, the demo has failed.
- **No marketing speak.** Terminal output and minimal text overlays only.
- **No OpenPub references in the video.** SCUT stands alone. OpenPub is a separate project.
- **No OpenClaw references.** Claude Code judges may or may not be warm to it. Keep out of this video.
- **No Anthropic logo or Claude-specific branding in the visuals.** The agents are just agents. Let the judges infer they're Claude-powered.

---

## If the Demo Fails to Land

Fallback plan if Saturday's dry run shows the terminal demo is not working:

1. **First fallback (24-hour pivot):** Slack demo. Pre-recorded Slack session + live SCUT terminal composited. Requires a Slack mockup (Figma or HTML), but no actual Slack bot build.
2. **Second fallback (12-hour pivot):** Pure terminal with no reveal animation. Just the stream and text overlays describing what's happening. Cheaper but less impactful.
3. **Third fallback (6-hour pivot):** Straight narrative video. Screen-record a terminal with one send, one receive. Add voiceover explaining the protocol. Loses the "show don't tell" but guaranteed to land something.

Make the fallback decision Friday night at the latest. Do not let the demo concept block submission.

---

## Key Principles for the Friday Decision

1. **The demo is not the product. The product is not the demo.** Pick what communicates fastest, not what shows the most features.
2. **Authenticity beats polish.** Real traffic, real agents, real crypto. Judges will respect genuine over glossy.
3. **Read it in the first 10 seconds.** If the viewer can't tell what they're watching in 10 seconds, switch concepts.
4. **Shippable > perfect.** Submit something mid-polish over nothing at all. The demo is a ship-date gate, not a quality gate.
5. **The closing overlay is the landing.** Regardless of which concept wins, the closing text is where the thesis gets stated clearly. Spend time on those lines.

---

## Document Metadata

- **Version:** 1.0 (LOCKED)
- **Locked on:** April 21, 2026
- **Next review:** Saturday April 25, 2026 (dress rehearsal on Peter, tune dim + timing)
- **Author:** Doug Hardman + Guppi, April 20, 2026
- **Lock record:** RevealBox spike approved; 5 scenarios queued; monitor built around the locked animation the same afternoon
- **Related documents:**
  - `spec/SPEC.md` (protocol specification)
  - `CLAUDE.md` (builder agent context)
  - `packages/agents/src/scenarios.ts` (demo scenarios, 1-3 locked, 4-5 draft)
