/**
 * RevealBox spike — standalone.
 *
 * Run with: pnpm --filter scut-monitor run spike
 *
 * Hardcoded Scenario 1 envelope. Runs the expand → decrypt → hold →
 * re-encrypt → collapse cycle in a loop. No relay, no SSE, no keyring,
 * no store. Just the visual.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, render, Text } from 'ink';
import { randomBytes } from 'node:crypto';

const BOX_WIDTH = 60;
const BOX_LINES = 5;

const SCENARIO_PLAINTEXT =
  'My user is meeting yours Thursday at 2 PM. Sharing her recent emails on the project and the three questions she wants to cover. Can you brief yours ahead of the call?';

const FROM_ID = '0xa3f1c42d81b5e9f3';
const TO_ID = '0x7b2ed88f12ac40e6';

const PHASES = {
  approach: 400,
  expand: 400,
  morphToPlain: 800,
  hold: 2500,
  morphToCipher: 800,
  collapse: 400,
  rest: 1200,
} as const;

type Phase = keyof typeof PHASES;

const PHASE_ORDER: readonly Phase[] = [
  'approach',
  'expand',
  'morphToPlain',
  'hold',
  'morphToCipher',
  'collapse',
  'rest',
];

function realisticCiphertext(plaintext: string): string {
  // XChaCha20-Poly1305 ciphertext ≈ plaintext_bytes + 16-byte tag, then base64.
  const plainBytes = Buffer.from(plaintext, 'utf-8').length;
  const cipherBytes = plainBytes + 16;
  return randomBytes(cipherBytes).toString('base64');
}

function wrapLines(text: string, width: number, lines: number): string[] {
  const chunks: string[] = [];
  let rest = text;
  for (let i = 0; i < lines; i++) {
    chunks.push(rest.slice(0, width).padEnd(width, ' '));
    rest = rest.slice(width);
  }
  return chunks;
}

function useAnimationFrame(fps = 30, enabled = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), Math.round(1000 / fps));
    return () => clearInterval(id);
  }, [fps, enabled]);
  return tick;
}

function usePhaseClock(initial: Phase = 'approach'): {
  phase: Phase;
  progress: number;
  cycleCount: number;
} {
  const [phase, setPhase] = useState<Phase>(initial);
  const [cycleCount, setCycleCount] = useState(0);
  const startedAtRef = useRef<number>(Date.now());
  const tick = useAnimationFrame(30);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [phase]);

  const elapsed = Date.now() - startedAtRef.current;
  const duration = PHASES[phase];
  const progress = Math.min(1, elapsed / duration);

  useEffect(() => {
    if (progress >= 1) {
      const idx = PHASE_ORDER.indexOf(phase);
      const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length]!;
      setPhase(next);
      if (next === 'approach') setCycleCount((c) => c + 1);
    }
    // re-evaluated each animation tick via `tick` dependency below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { phase, progress, cycleCount };
}

interface RevealBoxProps {
  cipher: string;
  plain: string;
  phase: Phase;
  progress: number;
}

function buildTransitions(length: number, seed: number): number[] {
  // Left-to-right drift with jitter; stable per cycle.
  const out = new Array<number>(length);
  let rand = seed;
  for (let i = 0; i < length; i++) {
    rand = (rand * 1664525 + 1013904223) >>> 0;
    const jitter = (rand / 0xffffffff) * 0.35;
    out[i] = Math.min(1, (i / length) * 0.65 + jitter);
  }
  return out;
}

function RevealBox({ cipher, plain, phase, progress }: RevealBoxProps): React.ReactElement {
  const cipherLines = useMemo(() => wrapLines(cipher, BOX_WIDTH, BOX_LINES), [cipher]);
  const plainLines = useMemo(() => wrapLines(plain, BOX_WIDTH, BOX_LINES), [plain]);
  const total = BOX_WIDTH * BOX_LINES;
  const transitions = useMemo(() => buildTransitions(total, cipher.length), [total, cipher]);

  let displayed: string[];
  let label: string;
  let labelColor: 'cyan' | 'green' | 'yellow' = 'cyan';

  switch (phase) {
    case 'approach':
    case 'expand':
      displayed = cipherLines;
      label = 'ENCRYPTED PAYLOAD';
      labelColor = 'cyan';
      break;
    case 'morphToPlain':
      displayed = morph(cipherLines, plainLines, transitions, progress);
      label = progress > 0.7 ? 'DECRYPTED PAYLOAD' : 'DECRYPTING…';
      labelColor = 'yellow';
      break;
    case 'hold':
      displayed = plainLines;
      label = 'DECRYPTED PAYLOAD';
      labelColor = 'green';
      break;
    case 'morphToCipher':
      displayed = morph(plainLines, cipherLines, transitions, progress);
      label = progress > 0.7 ? 'ENCRYPTED PAYLOAD' : 'RE-ENCRYPTING…';
      labelColor = 'yellow';
      break;
    case 'collapse':
    case 'rest':
    default:
      displayed = cipherLines;
      label = 'ENCRYPTED PAYLOAD';
      labelColor = 'cyan';
      break;
  }

  const collapsed = phase === 'rest';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={labelColor} paddingX={1} width={BOX_WIDTH + 4}>
      <Box justifyContent="space-between">
        <Text color={labelColor} bold>
          {label}
        </Text>
        <Text color="gray">{`${FROM_ID.slice(0, 10)}… → ${TO_ID.slice(0, 10)}…`}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {collapsed ? (
          <Text color="gray" dimColor>
            {cipherLines[0]?.trim().slice(0, BOX_WIDTH - 6)}…
          </Text>
        ) : (
          displayed.map((line, i) => {
            const cipherLine = cipherLines[i] ?? '';
            const isFullCipher = line === cipherLine;
            const isFullPlain = line === (plainLines[i] ?? '');
            const color = isFullCipher ? 'cyan' : isFullPlain ? 'green' : 'yellow';
            return (
              <Text key={`reveal-line-${i}`} color={color}>
                {line}
              </Text>
            );
          })
        )}
      </Box>
    </Box>
  );
}

function morph(
  from: string[],
  to: string[],
  transitions: number[],
  progress: number,
): string[] {
  const width = BOX_WIDTH;
  const out: string[] = [];
  for (let line = 0; line < BOX_LINES; line++) {
    const fromLine = from[line] ?? ''.padEnd(width, ' ');
    const toLine = to[line] ?? ''.padEnd(width, ' ');
    let row = '';
    for (let col = 0; col < width; col++) {
      const i = line * width + col;
      const t = transitions[i] ?? 1;
      row += progress >= t ? toLine[col] ?? ' ' : fromLine[col] ?? ' ';
    }
    out.push(row);
  }
  return out;
}

const STREAM_LINES: readonly string[] = [
  '[10:14:22.103]  0x4d9c… → 0xc1a8…   412 B  sig✓  xChaCha20+Ed25519',
  '[10:14:22.447]  0x9f73… → 0xe2b1…   508 B  sig✓  xChaCha20+Ed25519',
  '[10:14:22.892]  0xc1a8… → 0x4d9c…   489 B  sig✓  xChaCha20+Ed25519',
  '[10:14:23.015]  0xe2b1… → 0x9f73…   573 B  sig✓  xChaCha20+Ed25519',
  '[10:14:23.201]  0xa3f1… → 0x7b2e…   212 B  sig✓  xChaCha20+Ed25519',
];

function StreamBackground({ dim }: { dim: boolean }): React.ReactElement {
  return (
    <Box flexDirection="column">
      {STREAM_LINES.map((l, i) => (
        <Text key={`stream-${i}`} color="gray" dimColor={dim}>
          {l}
        </Text>
      ))}
    </Box>
  );
}

function Spike(): React.ReactElement {
  const { phase, progress, cycleCount } = usePhaseClock();
  const cipher = useMemo(() => realisticCiphertext(SCENARIO_PLAINTEXT), []);

  const dim = phase !== 'rest';

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="whiteBright">
          scut-monitor · RevealBox spike · cycle {cycleCount + 1}
        </Text>
        <Text color="gray">phase={phase} · progress={progress.toFixed(2)} · ctrl+c to quit</Text>
      </Box>
      <StreamBackground dim={dim} />
      <Box marginTop={1}>
        <RevealBox cipher={cipher} plain={SCENARIO_PLAINTEXT} phase={phase} progress={progress} />
      </Box>
    </Box>
  );
}

render(<Spike />);
