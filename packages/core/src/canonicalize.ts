import canonicalizeLib from 'canonicalize';

export function canonicalizeToString(value: unknown): string {
  const out = canonicalizeLib(value);
  if (typeof out !== 'string') {
    throw new Error('canonicalize returned non-string output');
  }
  return out;
}

export function canonicalizeToBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalizeToString(value));
}
