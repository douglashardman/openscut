import { describe, expect, it } from 'vitest';
import {
  decodeSiiDocumentFromDataUri,
  encodeSiiDocumentToDataUri,
  type SiiDocument,
} from '../src/index.js';

const sample: SiiDocument = {
  siiVersion: 1,
  agentRef: {
    chainId: 8453,
    contract: '0x199b48e27a28881502b251b0068f388ce750feff',
    tokenId: '42',
  },
  keys: {
    signing: { algorithm: 'ed25519', publicKey: 'AAAA' },
    encryption: { algorithm: 'x25519', publicKey: 'BBBB' },
  },
  relays: [{ host: 'relay.openscut.ai', priority: 0, protocols: ['https'] }],
  capabilities: [],
};

describe('sii-data-uri', () => {
  it('round-trips an SII document through encode/decode', () => {
    const uri = encodeSiiDocumentToDataUri(sample);
    expect(uri.startsWith('data:application/json;base64,')).toBe(true);
    const decoded = decodeSiiDocumentFromDataUri(uri);
    expect(decoded).toEqual(sample);
  });

  it('handles percent-encoded data: URIs as well as base64', () => {
    const json = JSON.stringify(sample);
    const percentUri = 'data:application/json,' + encodeURIComponent(json);
    const decoded = decodeSiiDocumentFromDataUri(percentUri);
    expect(decoded).toEqual(sample);
  });

  it('throws on non-data URIs', () => {
    expect(() => decodeSiiDocumentFromDataUri('https://example.com/doc.json')).toThrow();
    expect(() => decodeSiiDocumentFromDataUri('ipfs://Qm...')).toThrow();
  });
});
