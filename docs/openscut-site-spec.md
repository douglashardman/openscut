# openscut.ai Site Spec

**Status:** Ready for Simon to deploy
**Author:** Garfield
**Date:** 2026-04-23
**Target:** `openscut.ai` apex, existing droplet, Caddy-served
**Deliverable:** drop-in HTML + CSS + SVG. Copy the three files in §6 onto the droplet, point Caddy at them, done.

---

## 1. Goal

Replace the current minimal placeholder at `openscut.ai` with a proper single-page explainer site before `2200.ai` starts driving traffic back to SCUT.

This is a ship-this-week build, not a design sprint. The spec commits to being shippable in a single Caddy restart. A later polish pass can upgrade the animation to something rendered, add a docs section, etc.

## 2. Stack decision

Plain static HTML + CSS + SVG. No framework, no build step, no bundler, no JavaScript unless required for interaction (none is required in this spec). The whole site is three files:

```
site/
├── index.html
├── style.css
└── demo.svg
```

Plus the existing `favicon.ico` and `og-image.png` on the droplet, which stay as-is.

Rationale: a framework-backed site is a ~1 week commitment (build config, deploy pipeline, hydration debugging). A static site is a ~1 hour commitment. The content is durable; the delivery mechanism can be upgraded later without changing the content.

## 3. Design tokens

Matching OpenPub's palette, with the gold accent swapped for muted purple per Doug.

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#0a0a0a` | Page background |
| `--bg-1` | `#141414` | Card/panel surfaces |
| `--bg-2` | `#1e1e1e` | Elevated surfaces, code blocks |
| `--border` | `#27272a` | Panel borders, dividers |
| `--text-0` | `#f5f5f5` | Headings, emphasized text |
| `--text-1` | `#d4d4d8` | Body text |
| `--text-2` | `#9ca3af` | Secondary text, captions |
| `--text-3` | `#52525b` | Footer, tertiary |
| `--accent` | `#9e8cc2` | Primary accent — muted purple |
| `--accent-dim` | `#9e8cc233` | Accent at 20% alpha for subtle washes |
| `--accent-bright` | `#b8a7da` | Hover/active state |
| `--mono` | `'JetBrains Mono', ui-monospace, monospace` | All code, nav, labels |
| `--sans` | `'Inter', system-ui, -apple-system, sans-serif` | Body prose |

Layout: max-width ~960px, single column, generous vertical spacing (6–8rem between major sections), section headings in JetBrains Mono prefixed with numeric labels (`01 //`, `02 //`, etc.) to match OpenPub's visual register.

**Tune points for Doug:** `--accent` is the one subjective call. If the muted purple reads too cool or too grey in practice, adjust the single variable. Candidates if `#9e8cc2` misses: `#a78bfa` (cooler, more saturated), `#b39ddb` (softer lavender), `#8b7bb8` (darker, more desaturated).

## 4. Page structure

Single scroll, sections stacked top to bottom:

1. **Hero** — name, one-line definition, primary + secondary CTA.
2. **Animated demo** — SVG + CSS loop. Alice → relay → Bob. Payload locked at relay, unlocked at Bob.
3. **Three-up value** — Encrypted · Decentralized · Agent-native.
4. **How it works** — 4 numbered steps with inline diagrams.
5. **SII (identity layer)** — one-paragraph explainer + two BaseScan links.
6. **Reference implementations** — live endpoints, contract on Base, demo agent registry.
7. **Get started** — clone the repo, read the spec. Note that npm packages are next.
8. **Spec** — link to v0.2.0 on GitHub, visible version tag.
9. **Footer** — attribution, source link, Bobiverse line.

Each section is independently skippable. Nav is not required at this scale (8 short sections on a single scroll). If Simon wants a sticky top bar linking to sections, that's fine to add, but the spec ships without one.

## 5. Copy

Full copy for each section, ready to paste.

### Hero
- **H1:** `OpenSCUT`
- **Subhead:** `An open protocol for encrypted agent-to-agent messaging.`
- **Lede paragraph:** `End-to-end encrypted. On-chain identity. Permissionless relay mesh. Built for how agents actually communicate, not retrofitted from human tools.`
- **Primary CTA:** `Read the Spec →` linking to `https://github.com/douglashardman/openscut/blob/main/spec/SPEC.md`
- **Secondary CTA:** `View on GitHub` linking to `https://github.com/douglashardman/openscut`

### Animated demo caption
Below the SVG, small text:
> `Relays route the envelope. Only the recipient can read the payload.`

### Three-up
- **Encrypted** · `XChaCha20-Poly1305 payloads. X25519 key agreement. Ed25519 signatures. Signal-grade end-to-end encryption. Relays never see plaintext.`
- **Decentralized** · `Identity is on-chain. Any ERC-8004 contract implementing the SII interface works. No central registry, no platform lock-in.`
- **Agent-native** · `Designed for agent-to-agent communication from the ground up. Not email for robots. Built for how agents actually work.`

### How it works
Four numbered steps, each with a small icon or diagram glyph:

1. **Resolve** — `Alice's agent looks up Bob's public key from the on-chain registry.`
2. **Encrypt** — `Alice encrypts the payload to Bob's X25519 key and signs the envelope with her Ed25519 key.`
3. **Relay** — `The envelope travels through a relay. The relay sees routing metadata. It cannot read the payload.`
4. **Decrypt** — `Bob's agent verifies the signature, then decrypts with its private key.`

### SII
Heading: `04 // Identity, natively`

Paragraph:
> `In SCUT, identity and encryption are the same thing. The key that proves who an agent is, on-chain, is the same key that decrypts messages for that agent. SII — the SCUT Identity Interface — is an implementation-agnostic Solidity interface that any ERC-8004 contract can implement. The resolver reads from any SII-compliant contract. There is no privileged registry.`

Two links, mono font, displayed as labeled addresses:

- `OpenSCUTRegistry` → `https://basescan.org/address/0x199b48E27a28881502b251B0068F388Ce750feff`
- `OpenPubSCUTAdapter` → `https://basescan.org/address/0xb3Da467Df97930928DbB2DeB7DFb80B44628C881`

### Reference implementations
Heading: `05 // Live today`

List with monospace labels:

- `relay.openscut.ai` → production relay, accepting envelopes. Links to `https://relay.openscut.ai/capabilities`
- `resolver.openscut.ai` → production resolver for SII-compliant contracts. Links to `https://resolver.openscut.ai/health` (or equivalent endpoint Simon confirms).
- `OpenSCUTRegistry on Base` → links to the BaseScan address above.
- `Demo agents registered on-chain` → links to the registry contract's token list on BaseScan.
- `Source` → `https://github.com/douglashardman/openscut`

### Get started
Heading: `06 // Get started`

Short note:
> `npm packages and the scut CLI ship next week. For now, clone the repo to read the spec and run the reference relay locally:`

Code block:
```
git clone https://github.com/douglashardman/openscut.git
cd openscut
pnpm install
pnpm -r build
```

Below:
> `Full getting-started instructions in the repo README.`

### Spec
Heading: `07 // Spec`

Short note:
> `The SCUT v0.2.0 specification is the source of truth for the protocol. It defines the envelope format, the wire protocol, the identity interface, and the resolver contract. The spec is a living document.`

Button:
- `Read the Spec (v0.2.0) →` linking to the SPEC.md file on GitHub.

### Footer
Simple, three lines in small text:

- Line 1: `Built by [@DougHardman](https://mrdoug.com) · [Source on GitHub](https://github.com/douglashardman/openscut)`
- Line 2 (italic, muted): `Named in homage to Dennis E. Taylor's Bobiverse, where SCUT stands for Subspace Communications Utility Transfer. Bill invented it. Garfield perfected it. All the Bobs use it.`

**Deferred for Simon:** add a third footer line linking to the day-one SCUT blog post on mrdoug.com once Doug publishes it. TODO marker in the HTML flags the insertion point.

## 6. Files

All three files complete and ready to deploy.

### `index.html`

```html
<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenSCUT — An open protocol for encrypted agent-to-agent messaging</title>
  <meta name="description" content="An open protocol for encrypted agent-to-agent messaging. End-to-end encrypted, on-chain identity, permissionless relay mesh." />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://openscut.ai" />
  <meta property="og:title" content="OpenSCUT — An open protocol for encrypted agent-to-agent messaging" />
  <meta property="og:description" content="End-to-end encrypted. On-chain identity. Permissionless relay mesh." />
  <meta property="og:image" content="https://openscut.ai/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@DougHardman" />
  <meta name="twitter:title" content="OpenSCUT" />
  <meta name="twitter:description" content="An open protocol for encrypted agent-to-agent messaging." />
  <meta name="twitter:image" content="https://openscut.ai/og-image.png" />

  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" href="/favicon.ico" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <main>

    <!-- HERO -->
    <section class="hero">
      <h1>OpenSCUT</h1>
      <p class="subhead">An open protocol for encrypted agent-to-agent messaging.</p>
      <p class="lede">End-to-end encrypted. On-chain identity. Permissionless relay mesh. Built for how agents actually communicate, not retrofitted from human tools.</p>
      <div class="cta-row">
        <a class="cta-primary" href="https://github.com/douglashardman/openscut/blob/main/spec/SPEC.md">Read the Spec →</a>
        <a class="cta-secondary" href="https://github.com/douglashardman/openscut">View on GitHub</a>
      </div>
    </section>

    <!-- ANIMATED DEMO -->
    <section class="demo">
      <div class="demo-frame">
        <object type="image/svg+xml" data="/demo.svg" aria-label="Animated diagram: a message travels from Alice's agent through a relay to Bob's agent. The payload is locked at the relay and unlocked at Bob's end."></object>
      </div>
      <p class="demo-caption">Relays route the envelope. Only the recipient can read the payload.</p>
    </section>

    <!-- THREE-UP -->
    <section class="three-up">
      <h2 class="section-label">01 // What it is</h2>
      <div class="three-up-grid">
        <div class="card">
          <h3>Encrypted</h3>
          <p>XChaCha20-Poly1305 payloads. X25519 key agreement. Ed25519 signatures. Signal-grade end-to-end encryption. Relays never see plaintext.</p>
        </div>
        <div class="card">
          <h3>Decentralized</h3>
          <p>Identity is on-chain. Any ERC-8004 contract implementing the SII interface works. No central registry, no platform lock-in.</p>
        </div>
        <div class="card">
          <h3>Agent-native</h3>
          <p>Designed for agent-to-agent communication from the ground up. Not email for robots. Built for how agents actually work.</p>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="how">
      <h2 class="section-label">02 // How it works</h2>
      <ol class="steps">
        <li>
          <span class="step-num">01</span>
          <div>
            <h3>Resolve</h3>
            <p>Alice's agent looks up Bob's public key from the on-chain registry.</p>
          </div>
        </li>
        <li>
          <span class="step-num">02</span>
          <div>
            <h3>Encrypt</h3>
            <p>Alice encrypts the payload to Bob's X25519 key and signs the envelope with her Ed25519 key.</p>
          </div>
        </li>
        <li>
          <span class="step-num">03</span>
          <div>
            <h3>Relay</h3>
            <p>The envelope travels through a relay. The relay sees routing metadata. It cannot read the payload.</p>
          </div>
        </li>
        <li>
          <span class="step-num">04</span>
          <div>
            <h3>Decrypt</h3>
            <p>Bob's agent verifies the signature, then decrypts with its private key.</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- SII -->
    <section class="sii">
      <h2 class="section-label">03 // Identity, natively</h2>
      <p>In SCUT, identity and encryption are the same thing. The key that proves who an agent is, on-chain, is the same key that decrypts messages for that agent. SII &mdash; the SCUT Identity Interface &mdash; is an implementation-agnostic Solidity interface that any ERC-8004 contract can implement. The resolver reads from any SII-compliant contract. There is no privileged registry.</p>
      <ul class="contract-list">
        <li>
          <span class="contract-label">OpenSCUTRegistry</span>
          <a class="contract-addr" href="https://basescan.org/address/0x199b48E27a28881502b251B0068F388Ce750feff">0x199b48E2&hellip;750feff</a>
        </li>
        <li>
          <span class="contract-label">OpenPubSCUTAdapter</span>
          <a class="contract-addr" href="https://basescan.org/address/0xb3Da467Df97930928DbB2DeB7DFb80B44628C881">0xb3Da467D&hellip;628C881</a>
        </li>
      </ul>
    </section>

    <!-- REFERENCE IMPLEMENTATIONS -->
    <section class="live">
      <h2 class="section-label">04 // Live today</h2>
      <ul class="live-list">
        <li>
          <a href="https://relay.openscut.ai/capabilities"><code>relay.openscut.ai</code></a>
          <span>Production relay, accepting envelopes.</span>
        </li>
        <li>
          <a href="https://resolver.openscut.ai/health"><code>resolver.openscut.ai</code></a>
          <span>Production resolver for SII-compliant contracts.</span>
        </li>
        <li>
          <a href="https://basescan.org/address/0x199b48E27a28881502b251B0068F388Ce750feff"><code>OpenSCUTRegistry</code></a>
          <span>Reference SII contract on Base mainnet.</span>
        </li>
        <li>
          <a href="https://basescan.org/token/0x199b48E27a28881502b251B0068F388Ce750feff"><code>Demo agents</code></a>
          <span>Five agents registered on-chain for testing.</span>
        </li>
        <li>
          <a href="https://github.com/douglashardman/openscut"><code>Source</code></a>
          <span>MIT-licensed monorepo.</span>
        </li>
      </ul>
    </section>

    <!-- GET STARTED -->
    <section class="start">
      <h2 class="section-label">05 // Get started</h2>
      <p>npm packages and the <code>scut</code> CLI ship next week. For now, clone the repo to read the spec and run the reference relay locally:</p>
      <pre><code>git clone https://github.com/douglashardman/openscut.git
cd openscut
pnpm install
pnpm -r build</code></pre>
      <p class="muted">Full getting-started instructions in the repo README.</p>
    </section>

    <!-- SPEC -->
    <section class="spec">
      <h2 class="section-label">06 // Spec</h2>
      <p>The SCUT <strong>v0.2.0</strong> specification is the source of truth for the protocol. It defines the envelope format, the wire protocol, the identity interface, and the resolver contract. The spec is a living document.</p>
      <a class="cta-primary" href="https://github.com/douglashardman/openscut/blob/main/spec/SPEC.md">Read the Spec (v0.2.0) →</a>
    </section>

    <!-- FOOTER -->
    <footer>
      <p>
        Built by <a href="https://mrdoug.com">@DougHardman</a>
        &nbsp;·&nbsp;
        <a href="https://github.com/douglashardman/openscut">Source on GitHub</a>
        <!-- TODO (Simon): append blog post link once Doug publishes on mrdoug.com -->
      </p>
      <p class="bobiverse">
        Named in homage to Dennis E. Taylor's Bobiverse, where SCUT stands for Subspace Communications Utility Transfer. Bill invented it. Garfield perfected it. All the Bobs use it.
      </p>
    </footer>

  </main>
</body>
</html>
```

### `style.css`

```css
:root {
  --bg-0: #0a0a0a;
  --bg-1: #141414;
  --bg-2: #1e1e1e;
  --border: #27272a;
  --text-0: #f5f5f5;
  --text-1: #d4d4d8;
  --text-2: #9ca3af;
  --text-3: #52525b;
  --accent: #9e8cc2;
  --accent-dim: #9e8cc233;
  --accent-bright: #b8a7da;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --sans: 'Inter', system-ui, -apple-system, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  background: var(--bg-0);
  color: var(--text-1);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 5rem 1.5rem 3rem;
}

section { padding: 4rem 0; }

a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
a:hover {
  color: var(--accent-bright);
  border-bottom-color: var(--accent-bright);
}

code, pre, .mono, .section-label, .step-num, .contract-addr, .contract-label {
  font-family: var(--mono);
}

.section-label {
  font-family: var(--mono);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-2);
  letter-spacing: 0.02em;
  margin-bottom: 2rem;
  text-transform: none;
}

/* -------- HERO -------- */
.hero { padding-top: 1rem; padding-bottom: 6rem; }
.hero h1 {
  font-family: var(--mono);
  font-size: clamp(2.5rem, 7vw, 4.5rem);
  font-weight: 700;
  color: var(--text-0);
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
}
.hero .subhead {
  font-size: clamp(1.1rem, 2.5vw, 1.5rem);
  color: var(--text-1);
  font-weight: 500;
  margin-bottom: 1.5rem;
  max-width: 40ch;
}
.hero .lede {
  font-size: 1.0625rem;
  color: var(--text-2);
  max-width: 56ch;
  margin-bottom: 2.5rem;
}

.cta-row { display: flex; gap: 1rem; flex-wrap: wrap; }
.cta-primary, .cta-secondary {
  display: inline-block;
  padding: 0.75rem 1.25rem;
  font-family: var(--mono);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.cta-primary {
  background: var(--accent);
  color: var(--bg-0);
  border-color: var(--accent);
}
.cta-primary:hover {
  background: var(--accent-bright);
  border-color: var(--accent-bright);
  color: var(--bg-0);
}
.cta-secondary {
  background: transparent;
  color: var(--text-1);
  border-color: var(--border);
}
.cta-secondary:hover {
  background: var(--bg-1);
  color: var(--text-0);
  border-color: var(--accent);
}

/* -------- DEMO -------- */
.demo { padding: 2rem 0 4rem; }
.demo-frame {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2rem 1rem;
  display: flex;
  justify-content: center;
}
.demo-frame object { width: 100%; max-width: 800px; height: auto; }
.demo-caption {
  text-align: center;
  font-family: var(--mono);
  font-size: 0.8125rem;
  color: var(--text-2);
  margin-top: 1.25rem;
}

/* -------- THREE-UP -------- */
.three-up-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}
.card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.5rem;
}
.card h3 {
  font-family: var(--mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.625rem;
  letter-spacing: 0.01em;
}
.card p { color: var(--text-2); font-size: 0.9375rem; }

/* -------- HOW IT WORKS -------- */
.steps { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
.steps li {
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  gap: 1.25rem;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  align-items: center;
}
.step-num {
  font-family: var(--mono);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.02em;
}
.steps h3 {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-0);
  margin-bottom: 0.25rem;
}
.steps p { color: var(--text-2); font-size: 0.9375rem; }

/* -------- SII -------- */
.sii p {
  max-width: 70ch;
  color: var(--text-1);
  margin-bottom: 1.5rem;
}
.contract-list { list-style: none; display: flex; flex-direction: column; gap: 0.625rem; }
.contract-list li {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: 0.875rem;
}
.contract-label {
  color: var(--text-2);
  min-width: 14rem;
}
.contract-addr {
  color: var(--accent);
  word-break: break-all;
}

/* -------- LIVE TODAY -------- */
.live-list { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
.live-list li {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: 0.9375rem;
}
.live-list li a {
  min-width: 14rem;
  display: inline-block;
}
.live-list li code {
  background: transparent;
  color: var(--accent);
  font-size: 0.875rem;
}
.live-list li span { color: var(--text-2); }

/* -------- GET STARTED -------- */
.start pre {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  overflow-x: auto;
  margin: 1.25rem 0;
}
.start pre code {
  font-size: 0.875rem;
  color: var(--text-1);
  line-height: 1.7;
}
.start .muted { color: var(--text-3); font-size: 0.875rem; }

/* -------- SPEC -------- */
.spec p { color: var(--text-1); max-width: 66ch; margin-bottom: 1.5rem; }
.spec strong { color: var(--text-0); font-weight: 600; }

/* -------- FOOTER -------- */
footer {
  margin-top: 4rem;
  padding: 2.5rem 0 3rem;
  border-top: 1px solid var(--border);
  font-size: 0.8125rem;
  color: var(--text-3);
}
footer p { margin-bottom: 0.75rem; }
footer a { color: var(--text-2); }
footer a:hover { color: var(--accent); border-bottom-color: var(--accent); }
footer .bobiverse { font-style: italic; color: var(--text-3); max-width: 70ch; line-height: 1.6; }

/* -------- RESPONSIVE -------- */
@media (max-width: 640px) {
  main { padding: 3rem 1.25rem 2rem; }
  section { padding: 3rem 0; }
  .steps li { grid-template-columns: 2.5rem 1fr; gap: 0.75rem; padding: 1rem 1.25rem; }
  .contract-list li { flex-direction: column; gap: 0.25rem; }
  .contract-label { min-width: 0; }
  .live-list li { flex-direction: column; gap: 0.25rem; }
  .live-list li a { min-width: 0; }
}
```

### `demo.svg`

Standalone SVG with embedded CSS. When `prefers-reduced-motion` is set, the animation freezes at a mid-flight frame.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" role="img" aria-labelledby="demo-title demo-desc">
  <title id="demo-title">SCUT envelope flow</title>
  <desc id="demo-desc">A message travels from Alice's agent through a relay to Bob's agent. The payload is locked while the envelope is in transit and at the relay, and is unlocked only when it reaches Bob.</desc>

  <defs>
    <style>
      .bg        { fill: #141414; }
      .node      { fill: #1e1e1e; stroke: #27272a; stroke-width: 1.5; }
      .node-accent { fill: #9e8cc2; }
      .line      { stroke: #27272a; stroke-width: 1.5; stroke-dasharray: 4 4; fill: none; }
      .label     { font-family: 'JetBrains Mono', monospace; font-size: 13px; fill: #d4d4d8; }
      .label-dim { font-family: 'JetBrains Mono', monospace; font-size: 11px; fill: #9ca3af; }
      .envelope  { fill: #1e1e1e; stroke: #9e8cc2; stroke-width: 1.5; }
      .lock      { fill: #9e8cc2; }
      .unlock    { fill: #b8a7da; opacity: 0; }

      /* 8-second loop: move packet left to right, with lock open at the end. */
      @keyframes travel {
        0%    { transform: translateX(0); }
        100%  { transform: translateX(520px); }
      }
      @keyframes payload-lock {
        0%, 75%  { opacity: 1; }
        85%, 100% { opacity: 0; }
      }
      @keyframes payload-unlock {
        0%, 75%  { opacity: 0; }
        85%, 100% { opacity: 1; }
      }
      @keyframes relay-pulse {
        0%, 100% { opacity: 0.7; }
        50%      { opacity: 1; }
      }

      #packet { animation: travel 8s cubic-bezier(0.45, 0, 0.55, 1) infinite; transform-origin: 0 0; }
      #lock-icon { animation: payload-lock 8s linear infinite; }
      #unlock-icon { animation: payload-unlock 8s linear infinite; }
      #relay-ring { animation: relay-pulse 2s ease-in-out infinite; transform-origin: 400px 120px; }

      @media (prefers-reduced-motion: reduce) {
        #packet, #lock-icon, #unlock-icon, #relay-ring { animation: none; }
        #packet { transform: translateX(180px); }
      }
    </style>
  </defs>

  <!-- Background -->
  <rect class="bg" width="800" height="240" rx="6"/>

  <!-- Dashed transit line -->
  <line class="line" x1="140" y1="120" x2="660" y2="120"/>

  <!-- Alice node -->
  <g>
    <circle class="node" cx="120" cy="120" r="34"/>
    <text class="label" x="120" y="125" text-anchor="middle">A</text>
    <text class="label-dim" x="120" y="180" text-anchor="middle">Alice's agent</text>
  </g>

  <!-- Relay node -->
  <g>
    <circle id="relay-ring" class="node" cx="400" cy="120" r="42" fill="none" stroke="#9e8cc2" stroke-width="1"/>
    <circle class="node" cx="400" cy="120" r="34"/>
    <text class="label" x="400" y="117" text-anchor="middle">R</text>
    <text class="label-dim" x="400" y="135" text-anchor="middle">relay</text>
    <text class="label-dim" x="400" y="180" text-anchor="middle">routes envelope</text>
  </g>

  <!-- Bob node -->
  <g>
    <circle class="node" cx="680" cy="120" r="34"/>
    <text class="label" x="680" y="125" text-anchor="middle">B</text>
    <text class="label-dim" x="680" y="180" text-anchor="middle">Bob's agent</text>
  </g>

  <!-- Envelope packet (starts at x=140, travels to x=660 via keyframe translate) -->
  <g id="packet">
    <g transform="translate(140, 104)">
      <rect class="envelope" x="0" y="0" width="64" height="32" rx="3"/>
      <!-- Header/from stripe, always visible -->
      <line x1="0" y1="12" x2="64" y2="12" stroke="#9e8cc2" stroke-width="1" opacity="0.4"/>
      <text class="label-dim" x="4" y="9" font-size="7">from: A</text>
      <!-- Payload slot: either locked or unlocked icon visible -->
      <g id="lock-icon" transform="translate(32, 22)">
        <rect x="-5" y="-4" width="10" height="7" rx="1" class="lock"/>
        <path d="M -3 -4 Q -3 -8 0 -8 Q 3 -8 3 -4" fill="none" stroke="#9e8cc2" stroke-width="1"/>
      </g>
      <g id="unlock-icon" transform="translate(32, 22)">
        <rect x="-5" y="-4" width="10" height="7" rx="1" class="unlock"/>
        <path d="M -3 -4 Q -3 -8 0 -8 Q 3 -10 5 -7" fill="none" stroke="#b8a7da" stroke-width="1" opacity="0"/>
        <text class="label-dim" x="0" y="2" text-anchor="middle" font-size="6" fill="#b8a7da">hi</text>
      </g>
    </g>
  </g>

</svg>
```

## 7. Deployment (for Simon)

### Current state
- `openscut.ai` apex is served from the droplet with Caddy.
- Existing `index.html` is an inline-styled placeholder. Replace it.
- `/spec` path is presumably already mapped somewhere; verify it still works after deploying the new index (it should — this spec doesn't touch that route).
- `favicon-*.png`, `apple-touch-icon.png`, `favicon.ico`, `og-image.png` already live at the droplet root. Keep them.

### Steps
1. Place `index.html`, `style.css`, and `demo.svg` at the Caddy site root for `openscut.ai`.
2. Verify `/spec` still routes correctly (no change needed if it does).
3. Reload Caddy: `sudo systemctl reload caddy`.
4. Confirm:
   - `curl -sI https://openscut.ai | head` returns HTTP 200.
   - `curl -s https://openscut.ai/style.css | head` returns CSS.
   - `curl -s https://openscut.ai/demo.svg | head` returns SVG.
   - `/capabilities` and `/health` links resolve (relay + resolver).

### Caddy snippet reference
Nothing special required; Caddy defaults will serve the three files with correct MIME types and HTTPS. A sample block if you're starting from scratch:

```
openscut.ai {
  root * /var/www/openscut
  file_server
  encode gzip
  header {
    Cache-Control "public, max-age=3600"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

If the current Caddyfile already routes `openscut.ai` to a root directory, just drop the three files there and reload.

### DNS
No changes required. `openscut.ai` apex already points at the droplet.

### Testing locally before deploy
Any static server works:
```
cd site
python3 -m http.server 8000
# visit http://localhost:8000
```

## 8. Follow-ups and open items

These are deliberately deferred. None of them block the ship.

1. **Blog post link in footer.** Doug will publish a day-one SCUT post on mrdoug.com. Simon adds the link next to the existing footer items. The HTML has a TODO comment marking the insertion point.
2. **og-image.png refresh.** Current image is from the v0.1.0 placeholder. A new one matching the muted-purple palette is a nice-to-have, not required for ship.
3. **Accent color tuning.** `--accent: #9e8cc2` is a first draft. Review live; swap the variable if it reads off.
4. **Sticky top nav.** Skipped for v1. If Doug wants section jumps, one line of flex in `<main>` handles it.
5. **Upgraded animation.** Current SVG is CSS-keyframe-driven and loops cleanly. A later polish pass could replace it with a rendered animation or an interactive canvas. Not needed for credibility; don't block on it.
6. **Demo agents BaseScan link.** Currently points at the registry's token list. Verify the link works; if BaseScan doesn't render a token list for ERC-721 the way expected, swap to the contract page and annotate "agents are minted as tokens; click Read Contract."

## 9. What this spec does not cover

- App at `app.openscut.ai` (Epic 2 deliverable, separate spec later).
- Validator pages at `openscut.ai/validate` etc. (Epic 3 deliverable, separate spec later).
- Status page at `status.openscut.ai` (Epic 3 deliverable, Simon's lane anyway).
- Any backend or dynamic content.
- Analytics or tracking. None should be added.

---

*End of spec. Questions to Doug, not to Simon. If something is ambiguous, Garfield will clarify.*
