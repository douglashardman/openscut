# openscut.ai Site Spec

**Status:** Files committed in `site/`. Deployed to apex. Monitor demo added at `/demo`.
**Author:** Garfield
**Last updated:** 2026-04-23
**Target:** `openscut.ai` apex, existing droplet, Caddy-served

---

## 1. What this is

Static site for the `openscut.ai` apex — explainer, reference links to live infrastructure, a simple envelope-flow animation on the homepage, and a separate `/demo` page with a live-monitor-style animation that loops through the three reveal scenarios from `CLAUDE.md`.

Shippable as static files over Caddy. No build step. No framework. No JavaScript on the homepage; one small self-contained script on `/demo`.

## 2. Repo layout

All deployable files live in `site/` in this repo. Simon (or whoever handles the deploy) pulls directly from there; no extraction from markdown required.

```
site/
├── index.html              # homepage
├── style.css               # shared homepage styles
├── demo.svg                # embedded Alice→relay→Bob animation on homepage
└── demo/
    ├── index.html          # "live monitor" page
    ├── monitor.css         # demo-page styles (self-contained)
    └── monitor.js          # stream + reveal animation logic
```

Icons (`favicon.svg`, `og-image.png`, etc.) already live at the droplet webroot from the previous deploy. Not tracked here; not changed by this spec.

## 3. Design tokens

Matching OpenPub's palette, with the gold accent swapped for muted purple.

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#0a0a0a` | Page background |
| `--bg-1` | `#141414` | Card/panel surfaces |
| `--bg-2` | `#1e1e1e` | Elevated surfaces, code blocks |
| `--border` | `#27272a` | Panel borders, dividers |
| `--text-0` | `#f5f5f5` | Headings |
| `--text-1` | `#d4d4d8` | Body |
| `--text-2` | `#9ca3af` | Secondary |
| `--text-3` | `#52525b` | Footer, tertiary |
| `--accent` | `#9e8cc2` | Primary accent — muted purple |
| `--accent-bright` | `#b8a7da` | Hover |
| (`--cipher`/`--morph`/`--plain`) | `#7dd3fc` / `#facc15` / `#86efac` | Reveal-box border colors, demo page only |

Fonts: `Inter, system-ui, sans-serif` for body, `JetBrains Mono, monospace` for all code, labels, and headings in terminal-like surfaces.

**Tuning:** `--accent` is one CSS variable in both stylesheets. Alternates if `#9e8cc2` reads off: `#a78bfa` (cooler/more saturated), `#b39ddb` (softer lavender), `#8b7bb8` (darker/more desaturated).

## 4. Homepage (`site/index.html`)

Single scroll, in this order:

1. **Hero** — `OpenSCUT`, tagline, lede, primary CTA (spec) + secondary CTA (GitHub).
2. **Animated demo (SVG)** — `demo.svg`, Alice → relay → Bob, payload locked until it reaches Bob. Below it: a "See SCUT on the wire →" link to `/demo`.
3. **Three-up** — Encrypted · Decentralized · Agent-native.
4. **How it works** — Resolve → Encrypt → Relay → Decrypt, four numbered steps.
5. **SII** — one paragraph + two BaseScan links (OpenSCUTRegistry, OpenPubSCUTAdapter).
6. **Live today** — links to `relay.openscut.ai`, `resolver.openscut.ai`, the registry on Base, the demo agent token list, the source repo.
7. **Get started** — clone-and-build instructions. Notes that npm packages ship next week.
8. **Spec** — link to `v0.2.0` on GitHub.
9. **Footer** — attribution, source link, Bobiverse line. TODO comment in HTML where the day-one blog post link will be appended once Doug publishes it.

## 5. `/demo` page (`site/demo/index.html`)

A "live monitor" animation that runs in the browser. Visually mimics what a screen recording of `scut-monitor` would look like, but rendered web-native so it scales crisply, stays lightweight, and can be iframe-embedded later.

### What it shows

- Scrolling stream of envelope lines in the same format as the real monitor:
  `[HH:MM:SS.mmm]  scut://8453/0x6d34…Fe17/7 → scut://8453/0x2C0b…923c/3    248 B  sig✓  xChaCha20+Ed25519  ✓`
- 20-agent synthetic pool with varied chain ids (Base mostly, some Ethereum, Polygon, Arbitrum) and varied tokenIds. None correspond to the 5 real demo agents; addresses are illustrative.
- Every ~16 seconds a reveal cycle plays. Cycles through three scenarios in rotation: meeting prep / package delivery / playdate (exact content from `CLAUDE.md` §"The three locked scenarios").
- Reveal timing + per-character morph algorithm match `packages/monitor/src/phases.ts` exactly (total 6.5s cycle: approach → expand → morphToPlain → hold → morphToCipher → collapse → rest).
- Header shows a LIVE pulse and `scut-monitor · relay.openscut.ai`. Footer shows a rolling envelope count.
- Small caption under each reveal: `scenario content for illustration. live envelopes are encrypted end-to-end.` — so no one confuses the on-screen content for real traffic.

### Accessibility

`prefers-reduced-motion: reduce` disables the loop and renders a static snapshot: prefilled stream, one reveal box frozen in the plaintext "hold" state, no animation.

### Embedding

The page is self-contained and framable via `<iframe src="/demo" style="border:0" ...>`. No parent-page CSS needed. Future: can embed into the homepage hero as a second visual if we want it there.

## 6. Deployment

### Currently live state

As of 2026-04-23, `openscut.ai`, `openscut.ai/style.css`, and `openscut.ai/demo.svg` are live and serving the contents of `site/index.html`, `site/style.css`, and `site/demo.svg` respectively. Caddy is the webserver. The `/demo` tree is new in this update and needs to be deployed alongside.

### What the deploy looks like

1. Pull latest from `origin/main` on the droplet.
2. Sync `site/*` to the Caddy webroot (whatever path the apex vhost currently uses). Preserve existing favicon/og-image files.
3. Reload Caddy (`sudo systemctl reload caddy`). Reload suffices — no Caddy config changes are required for the `/demo` subdirectory; static file serving handles subpaths automatically.
4. Smoke test:
   ```
   curl -sI https://openscut.ai/ | head
   curl -sI https://openscut.ai/style.css | head
   curl -sI https://openscut.ai/demo.svg | head
   curl -sI https://openscut.ai/demo/ | head
   curl -sI https://openscut.ai/demo/monitor.css | head
   curl -sI https://openscut.ai/demo/monitor.js | head
   ```
   All should return HTTP 200. Content-types should be `text/html`, `text/css`, `image/svg+xml`, `text/html`, `text/css`, and `application/javascript` (or `text/javascript`).

### Caddy reference

The apex vhost config isn't in `ops/caddy/Caddyfile` (that file only covers `relay.openscut.ai` and `resolver.openscut.ai`). Whatever currently serves the apex is the right place — no changes required. If a from-scratch vhost is ever needed:

```
openscut.ai {
  root * /var/www/openscut
  file_server
  encode gzip zstd
  header {
    Cache-Control "public, max-age=3600"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

### Testing locally

```
cd site
python3 -m http.server 8765
# visit http://localhost:8765/ and http://localhost:8765/demo/
```

## 7. Follow-ups (deferred)

Order by decreasing impact:

1. **Day-one blog post link.** Add to the footer once Doug publishes on mrdoug.com. HTML has a TODO comment marking the insertion point.
2. **Accent color tuning.** `#9e8cc2` is the first draft; tune live if it reads off.
3. **og-image refresh.** Current image is from the v0.1.0 placeholder. Regenerate in the muted-purple palette. Non-blocking.
4. **Sticky top nav.** Skipped for v1. Only add if Doug wants section jumps.
5. **Embed `/demo` animation on the homepage hero.** Option once the `/demo` page is validated.
6. **Demo-agent BaseScan link behavior.** Currently points at the token-list view for the registry contract. Verify it renders useful content; if not, switch to the contract page.

## 8. Not covered here

- `app.openscut.ai` (Epic 2 — client apps).
- `openscut.ai/validate`, `/resolve`, `/envelope` (Epic 3 — web validators).
- `status.openscut.ai` (Epic 3 — Simon's lane).
- Analytics. None should be added without a decision from Doug.

## 9. Deploy handoff

Garfield produces and commits the files. Doug routes the update to Simon for the actual deploy. If the pattern changes later (Garfield deploys directly via the `garfield` SSH account documented in `docs/DEPLOYMENT.md`), this section gets updated. For now: ask Doug, don't push to the droplet without explicit go-ahead.

---

*Questions to Doug, not to Simon. If something is ambiguous, Garfield will clarify.*
