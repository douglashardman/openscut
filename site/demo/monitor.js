/**
 * Fake-monitor animation for openscut.ai/demo.
 *
 * Renders a scrolling stream of synthetic SCUT envelope lines plus
 * periodic reveal cycles. Reveal timings and per-character morph
 * algorithm mirror packages/monitor/src/phases.ts exactly. None of
 * the envelopes shown here correspond to real on-chain agents;
 * addresses and ciphertext are generated client-side for visual
 * purposes only. A small caption in the reveal box signals this.
 */
(() => {
  'use strict';

  // ---------- Configuration ----------

  const PHASES = {
    approach: 400,
    expand: 400,
    morphToPlain: 800,
    hold: 2500,
    morphToCipher: 800,
    collapse: 400,
    rest: 1200,
  };

  const BOX_WIDTH = 60;
  const BOX_LINES = 5;

  const STREAM_MAX_LINES = 22;
  const STREAM_INTERVAL_MIN = 280;
  const STREAM_INTERVAL_MAX = 780;

  const REVEAL_INTERVAL_MS = 8800; // between cycles, after one finishes

  // ---------- Agent pool ----------
  // None of these correspond to real registered agents. Varied chain
  // ids and contract addresses so the stream reads as broad network
  // traffic, not a single test harness.

  const AGENT_POOL = [
    'scut://8453/0x6d34D47c3b9a4A6a1f02f0EEa0F62Fe179A2C1d4/7',
    'scut://8453/0x6d34D47c3b9a4A6a1f02f0EEa0F62Fe179A2C1d4/18',
    'scut://8453/0x2C0b1BF9BeC2c07c4e9cCf8e0De5f38dC8F4923c/3',
    'scut://8453/0x2C0b1BF9BeC2c07c4e9cCf8e0De5f38dC8F4923c/41',
    'scut://8453/0xAb3a019aB5D0e55b31f73D8c5e26D8A9c18C7E12/2',
    'scut://8453/0xAb3a019aB5D0e55b31f73D8c5e26D8A9c18C7E12/88',
    'scut://8453/0xF31d7a1c18a4e9D23b3fE77e52b3C40a6B8D7a93/12',
    'scut://8453/0xF31d7a1c18a4e9D23b3fE77e52b3C40a6B8D7a93/97',
    'scut://8453/0x4Cd1c6F8f2D8c2b5E01d8C7b3B9c7f2D8F9a1e23/5',
    'scut://8453/0x4Cd1c6F8f2D8c2b5E01d8C7b3B9c7f2D8F9a1e23/201',
    'scut://8453/0x9E7bA83c1D4F5c2a3e8f7B9d1C4e2a5B8f3D6c7A/14',
    'scut://1/0xC3a9d1B8F2e4A7d5C6B9f3E8a1d7c2b5F4e6a8d3/23',
    'scut://1/0xC3a9d1B8F2e4A7d5C6B9f3E8a1d7c2b5F4e6a8d3/56',
    'scut://1/0x5a8F7d2c6b3E9a1D4f7e2B8c5d1a9f6E3b8d4c7A/8',
    'scut://137/0x8b4F6c2E7a3D9f1B5c8e4a7d2F6b9c3E1a4d8f7B/31',
    'scut://137/0x8b4F6c2E7a3D9f1B5c8e4a7d2F6b9c3E1a4d8f7B/119',
    'scut://42161/0xE1f4D8c2B9a7F3e6D1c4B8a5F2e9d7C3b6a1F4e8/2',
    'scut://42161/0xE1f4D8c2B9a7F3e6D1c4B8a5F2e9d7C3b6a1F4e8/44',
    'scut://8453/0x7F2d8B4c1E9a3F6d2B8e4c7A1f5D9b3E6c2a8F4d/67',
    'scut://8453/0xD4a9C1f7B3e5A2d8F6c1E4b7A9f2D5e8c3B1a6F9/11',
  ];

  // ---------- Reveal scenarios ----------
  // Three locked conversations from CLAUDE.md. Same content that a
  // recorded demo would use. Distinct from/to pairs per scenario,
  // all drawn from the pool but avoiding the 5 real demo agents.

  const SCENARIOS = [
    {
      from: AGENT_POOL[0],
      to: AGENT_POOL[2],
      plaintext:
        'My user is meeting yours Thursday at 2 PM. Sharing her recent ' +
        'emails on the project and the three questions she wants to cover. ' +
        'Can you brief yours ahead of the call?',
    },
    {
      from: AGENT_POOL[4],
      to: AGENT_POOL[6],
      plaintext:
        'My user’s package is arriving today but she’s not home ' +
        'until 6 PM. Building requires signature. Can your driver use the ' +
        '6 PM window instead of 2 PM?',
    },
    {
      from: AGENT_POOL[8],
      to: AGENT_POOL[10],
      plaintext:
        'Mine would like yours over Saturday 1–4 PM at our house. ' +
        'Sending address. No allergies on our side. Can yours handle ' +
        'drop-off and pickup?',
    },
  ];

  // ---------- Morph algorithm (port of packages/monitor/src/phases.ts) ----------

  function buildTransitions(length, seed) {
    const out = new Array(length);
    let rand = seed >>> 0;
    for (let i = 0; i < length; i++) {
      rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0;
      const jitter = (rand / 0xffffffff) * 0.35;
      out[i] = Math.min(1, (i / length) * 0.65 + jitter);
    }
    return out;
  }

  function wrapLines(text, width, lines) {
    const out = [];
    let rest = text;
    for (let i = 0; i < lines; i++) {
      out.push(rest.slice(0, width).padEnd(width, ' '));
      rest = rest.slice(width);
    }
    return out;
  }

  function morphFrame(fromLines, toLines, transitions, progress, width, lineCount) {
    const out = [];
    for (let line = 0; line < lineCount; line++) {
      const fromLine = fromLines[line] || '';
      const toLine = toLines[line] || '';
      let row = '';
      for (let col = 0; col < width; col++) {
        const idx = line * width + col;
        const t = transitions[idx] != null ? transitions[idx] : 1;
        row += progress >= t ? (toLine[col] || ' ') : (fromLine[col] || ' ');
      }
      out.push(row);
    }
    return out;
  }

  // ---------- Helpers ----------

  const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function fakeBase64(length) {
    let out = '';
    for (let i = 0; i < length; i++) {
      out += BASE64[Math.floor(Math.random() * BASE64.length)];
    }
    return out;
  }

  function hashSeed(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) >>> 0;
    }
    return h || 1;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min));
  }

  function truncateAgentRef(uri) {
    const m = /^scut:\/\/(\d+)\/(0x[a-fA-F0-9]{40})\/(.+)$/.exec(uri);
    if (!m) return uri;
    return 'scut://' + m[1] + '/' + m[2].slice(0, 6) + '…' + m[2].slice(-4) + '/' + m[3];
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 100) return kb.toFixed(1) + ' KiB';
    return Math.round(kb) + ' KiB';
  }

  function formatClock(ms) {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ff = String(d.getMilliseconds()).padStart(3, '0');
    return hh + ':' + mm + ':' + ss + '.' + ff;
  }

  function escapeText(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---------- Envelope generation ----------

  function makeRandomEnvelope() {
    let from = pick(AGENT_POOL);
    let to = pick(AGENT_POOL);
    while (to === from) to = pick(AGENT_POOL);
    return {
      ts: Date.now(),
      from,
      to,
      size: randInt(180, 820),
      scenario: false,
    };
  }

  function makeScenarioEnvelope(scenario) {
    return {
      ts: Date.now(),
      from: scenario.from,
      to: scenario.to,
      size: randInt(240, 520),
      scenario: true,
    };
  }

  // ---------- DOM ----------

  const streamEl = document.getElementById('stream');
  const revealWrapEl = document.getElementById('reveal-wrap');
  const footCountEl = document.getElementById('foot-count');
  const footKeysEl = document.getElementById('foot-keys');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let envelopeCount = 0;

  function renderLineHTML(env) {
    const ts = formatClock(env.ts);
    const from = truncateAgentRef(env.from);
    const to = truncateAgentRef(env.to);
    const size = formatSize(env.size).padStart(8, ' ');
    const addrClass = env.scenario ? 'addr addr-scenario' : 'addr';
    return (
      '<span class="ts">[' + escapeText(ts) + ']</span>  ' +
      '<span class="' + addrClass + '">' + escapeText(from) + '</span>' +
      '<span class="arrow">→</span>' +
      '<span class="' + addrClass + '">' + escapeText(to) + '</span>  ' +
      '<span class="size">' + escapeText(size) + '</span>  ' +
      '<span class="sig">sig✓</span>  ' +
      '<span class="suite">xChaCha20+Ed25519</span>  ' +
      '<span class="status-ok">✓</span>'
    );
  }

  function addStreamLine(env) {
    const el = document.createElement('div');
    el.className = env.scenario ? 'line scenario' : 'line';
    el.innerHTML = renderLineHTML(env);
    streamEl.appendChild(el);
    while (streamEl.childElementCount > STREAM_MAX_LINES) {
      streamEl.removeChild(streamEl.firstElementChild);
    }
    requestAnimationFrame(() => el.classList.add('visible'));
    envelopeCount++;
    footCountEl.textContent = envelopeCount.toLocaleString();
  }

  // ---------- Stream loop ----------

  function scheduleStreamTick() {
    const delay = randInt(STREAM_INTERVAL_MIN, STREAM_INTERVAL_MAX);
    setTimeout(() => {
      addStreamLine(makeRandomEnvelope());
      scheduleStreamTick();
    }, delay);
  }

  function prefillStream(count) {
    // Seed with dated timestamps so the first render looks lived-in.
    const now = Date.now();
    for (let i = count - 1; i >= 0; i--) {
      const env = makeRandomEnvelope();
      env.ts = now - i * randInt(200, 700);
      addStreamLine(env);
    }
  }

  // ---------- Reveal loop ----------

  function phaseAnimate(box, phaseName, tick) {
    return new Promise((resolve) => {
      box.className = 'reveal-box visible phase-' + phaseName;
      const duration = PHASES[phaseName];
      const start = performance.now();
      function step(now) {
        const progress = Math.min(1, (now - start) / duration);
        tick(progress);
        if (progress < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  async function doReveal(scenario) {
    // Slip the scenario envelope into the stream so viewers see the
    // address pair appear before the reveal box.
    const scenarioEnv = makeScenarioEnvelope(scenario);
    addStreamLine(scenarioEnv);

    const cipher = fakeBase64(BOX_WIDTH * BOX_LINES);
    const cipherLines = wrapLines(cipher, BOX_WIDTH, BOX_LINES);
    const plainLines = wrapLines(scenario.plaintext, BOX_WIDTH, BOX_LINES);
    const transitions = buildTransitions(BOX_WIDTH * BOX_LINES, hashSeed(cipher));

    const box = document.createElement('div');
    box.className = 'reveal-box phase-approach';
    box.innerHTML =
      '<div class="reveal-header">' +
      '<span class="reveal-label">ENCRYPTED PAYLOAD</span>' +
      '<span class="reveal-addrs">' +
      escapeText(truncateAgentRef(scenario.from)) +
      '  →  ' +
      escapeText(truncateAgentRef(scenario.to)) +
      '</span>' +
      '</div>' +
      '<pre class="reveal-content"></pre>' +
      '<div class="reveal-caption">scenario content for illustration. live envelopes are encrypted end-to-end.</div>';
    revealWrapEl.appendChild(box);
    const contentEl = box.querySelector('.reveal-content');
    const labelEl = box.querySelector('.reveal-label');
    streamEl.classList.add('dimmed');

    contentEl.textContent = cipherLines.join('\n');

    // Approach: box fades in at cipher color, label unchanged.
    requestAnimationFrame(() => box.classList.add('visible'));
    await sleep(PHASES.approach);

    // Expand: hold cipher state for a beat.
    box.className = 'reveal-box visible phase-expand';
    await sleep(PHASES.expand);

    // MorphToPlain: per-character transition cipher -> plain.
    await phaseAnimate(box, 'morphToPlain', (progress) => {
      const frame = morphFrame(
        cipherLines,
        plainLines,
        transitions,
        progress,
        BOX_WIDTH,
        BOX_LINES,
      );
      contentEl.textContent = frame.join('\n');
      labelEl.textContent = progress > 0.7 ? 'DECRYPTED PAYLOAD' : 'DECRYPTING…';
    });

    // Hold: plaintext visible.
    box.className = 'reveal-box visible phase-hold';
    labelEl.textContent = 'DECRYPTED PAYLOAD';
    contentEl.textContent = plainLines.join('\n');
    await sleep(PHASES.hold);

    // MorphToCipher: per-character transition plain -> cipher.
    await phaseAnimate(box, 'morphToCipher', (progress) => {
      const frame = morphFrame(
        plainLines,
        cipherLines,
        transitions,
        progress,
        BOX_WIDTH,
        BOX_LINES,
      );
      contentEl.textContent = frame.join('\n');
      labelEl.textContent = progress > 0.7 ? 'ENCRYPTED PAYLOAD' : 'RE-ENCRYPTING…';
    });

    // Collapse: cipher state, border dims.
    box.className = 'reveal-box visible phase-collapse';
    labelEl.textContent = 'ENCRYPTED PAYLOAD';
    contentEl.textContent = cipherLines.join('\n');
    await sleep(PHASES.collapse);

    // Remove.
    box.classList.remove('visible');
    streamEl.classList.remove('dimmed');
    await sleep(250);
    box.remove();

    // Rest before next reveal.
    await sleep(PHASES.rest);
  }

  async function revealLoop() {
    // Let the stream build up first.
    await sleep(3200);
    let idx = 0;
    // Infinite loop cycling through the three scenarios.
    while (true) {
      const scenario = SCENARIOS[idx % SCENARIOS.length];
      try {
        await doReveal(scenario);
      } catch (e) {
        // Defensive: if the DOM vanishes or a paint stalls, skip.
        console.warn('reveal failed, continuing', e);
      }
      await sleep(REVEAL_INTERVAL_MS);
      idx++;
    }
  }

  // ---------- Static snapshot for reduced-motion users ----------

  function renderStaticSnapshot() {
    // Populate the stream with ~12 static lines and show one reveal
    // box frozen in the "hold" (plaintext) state. No animation, no
    // loop. Conveys the idea without motion.
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const env = makeRandomEnvelope();
      env.ts = now - i * 800;
      addStreamLine(env);
    }
    // Pick the first scenario for the frozen reveal.
    const scenario = SCENARIOS[0];
    const cipher = fakeBase64(BOX_WIDTH * BOX_LINES);
    const plainLines = wrapLines(scenario.plaintext, BOX_WIDTH, BOX_LINES);
    const box = document.createElement('div');
    box.className = 'reveal-box visible phase-hold';
    box.innerHTML =
      '<div class="reveal-header">' +
      '<span class="reveal-label">DECRYPTED PAYLOAD</span>' +
      '<span class="reveal-addrs">' +
      escapeText(truncateAgentRef(scenario.from)) +
      '  →  ' +
      escapeText(truncateAgentRef(scenario.to)) +
      '</span>' +
      '</div>' +
      '<pre class="reveal-content"></pre>' +
      '<div class="reveal-caption">scenario content for illustration. live envelopes are encrypted end-to-end.</div>';
    const contentEl = box.querySelector('.reveal-content');
    contentEl.textContent = plainLines.join('\n');
    revealWrapEl.appendChild(box);
    streamEl.classList.add('dimmed');
    footKeysEl.textContent = '3';
  }

  // ---------- Boot ----------

  if (reducedMotion) {
    renderStaticSnapshot();
    return;
  }

  prefillStream(10);
  scheduleStreamTick();
  revealLoop();
})();
