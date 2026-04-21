import { getSodium } from './sodium.js';

export async function toBase64(bytes: Uint8Array): Promise<string> {
  const s = await getSodium();
  return s.to_base64(bytes, s.base64_variants.ORIGINAL);
}

export async function fromBase64(text: string): Promise<Uint8Array> {
  const s = await getSodium();
  return s.from_base64(text, s.base64_variants.ORIGINAL);
}
