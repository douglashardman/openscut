import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalizeToBytes, canonicalizeToString } from '../src/canonicalize.js';

const fixturesPath = fileURLToPath(new URL('./fixtures/jcs-vectors.json', import.meta.url));
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8')) as Array<{
  name: string;
  input: unknown;
  expected: string;
}>;

describe('JCS canonicalization (RFC 8785)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      expect(canonicalizeToString(fixture.input)).toBe(fixture.expected);
    });
  }

  it('produces identical bytes when key order differs in input', () => {
    const a = canonicalizeToBytes({ c: 3, a: 1, b: 2 });
    const b = canonicalizeToBytes({ b: 2, c: 3, a: 1 });
    const c = canonicalizeToBytes({ a: 1, b: 2, c: 3 });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(b).equals(Buffer.from(c))).toBe(true);
  });

  it('is deterministic across repeated invocations', () => {
    const input = { hello: 'world', n: 42, arr: [1, 2, 3] };
    const first = canonicalizeToString(input);
    for (let i = 0; i < 100; i++) {
      expect(canonicalizeToString(input)).toBe(first);
    }
  });
});
