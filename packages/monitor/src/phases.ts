/**
 * Reveal animation timings and morph algorithm.
 *
 * These values are LOCKED. Do not change as part of surrounding-code
 * changes; they were validated against the spike and signed off on
 * Day 2. Any tuning happens Saturday per CLAUDE.md.
 */

export const PHASES = {
  approach: 400,
  expand: 400,
  morphToPlain: 800,
  hold: 2500,
  morphToCipher: 800,
  collapse: 400,
  rest: 1200,
} as const;

export type Phase = keyof typeof PHASES;

export const PHASE_ORDER: readonly Phase[] = [
  'approach',
  'expand',
  'morphToPlain',
  'hold',
  'morphToCipher',
  'collapse',
  'rest',
];

export const TOTAL_CYCLE_MS: number = PHASE_ORDER.reduce(
  (acc, phase) => acc + PHASES[phase],
  0,
);

export const BOX_WIDTH = 60;
export const BOX_LINES = 5;

/**
 * Per-character transition times for the morph. Each character at
 * position i in [0, length) transitions at time t_i ∈ [0, 1] with a
 * left-to-right drift plus jitter, so the morph reads as an organic
 * wave rather than a sharp frontier or pure noise.
 *
 * Parameters match the spike (65% position bias, 35% jitter).
 */
export function buildTransitions(length: number, seed: number): number[] {
  const out = new Array<number>(length);
  let rand = seed >>> 0;
  for (let i = 0; i < length; i++) {
    rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0;
    const jitter = (rand / 0xffffffff) * 0.35;
    out[i] = Math.min(1, (i / length) * 0.65 + jitter);
  }
  return out;
}

export function wrapLines(text: string, width: number, lines: number): string[] {
  const out: string[] = [];
  let rest = text;
  for (let i = 0; i < lines; i++) {
    out.push(rest.slice(0, width).padEnd(width, ' '));
    rest = rest.slice(width);
  }
  return out;
}

export function morphFrame(
  from: readonly string[],
  to: readonly string[],
  transitions: readonly number[],
  progress: number,
  width = BOX_WIDTH,
  lineCount = BOX_LINES,
): string[] {
  const out: string[] = [];
  for (let line = 0; line < lineCount; line++) {
    const fromLine = from[line] ?? '';
    const toLine = to[line] ?? '';
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
