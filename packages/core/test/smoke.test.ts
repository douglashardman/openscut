import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, VERSION } from '../src/index.js';

describe('@openscut/core smoke', () => {
  it('exports a version', () => {
    expect(VERSION).toBe('0.1.0');
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
