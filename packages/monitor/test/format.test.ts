import { describe, expect, it } from 'vitest';
import { truncateAgentRef, truncateAgentId } from '../src/format.js';

describe('truncateAgentRef', () => {
  it('keeps chain id and token id intact, elides the middle of the contract', () => {
    const full =
      'scut://8453/0x6d34D47c5F863131A8D052Ca4C51Cd6A0F62Fe17/2';
    expect(truncateAgentRef(full)).toBe('scut://8453/0x6d34…Fe17/2');
  });

  it('handles a lowercase contract address identically', () => {
    const full =
      'scut://8453/0x6d34d47c5f863131a8d052ca4c51cd6a0f62fe17/42';
    expect(truncateAgentRef(full)).toBe('scut://8453/0x6d34…fe17/42');
  });

  it('leaves long token ids alone — the token id is the distinguishing field', () => {
    const full =
      'scut://8453/0x6d34D47c5F863131A8D052Ca4C51Cd6A0F62Fe17/123456789';
    expect(truncateAgentRef(full)).toBe('scut://8453/0x6d34…Fe17/123456789');
  });

  it('falls back to hex truncation for non-scut identifiers', () => {
    expect(truncateAgentRef('0xa3f1c42d81b5e9f3')).toBe('0xa3f1c42d…');
  });

  it('preserves a short display-name identifier unchanged', () => {
    expect(truncateAgentRef('alice')).toBe('alice');
  });
});

describe('truncateAgentId (legacy)', () => {
  it('keeps the legacy 0x hex truncation behavior', () => {
    expect(truncateAgentId('0xa3f1c42d81b5e9f3')).toBe('0xa3f1c42d…');
  });
});
