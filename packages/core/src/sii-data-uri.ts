import type { SiiDocument } from './types.js';

const PREFIX = 'data:application/json;base64,';

/**
 * Encode an SII document as a `data:application/json;base64,...` URI
 * suitable for storage in the on-chain `scutIdentityURI` slot.
 *
 * The URI _is_ the document. There is no second hop. Resolvers decode
 * directly from the URI without contacting any hosting infrastructure.
 */
export function encodeSiiDocumentToDataUri(doc: SiiDocument): string {
  const json = JSON.stringify(doc);
  const b64 = Buffer.from(json, 'utf-8').toString('base64');
  return PREFIX + b64;
}

/**
 * Inverse of {@link encodeSiiDocumentToDataUri}. Returns the parsed
 * JSON without schema validation; callers that need validated SII
 * documents should run the result through their schema validator.
 */
export function decodeSiiDocumentFromDataUri(uri: string): unknown {
  if (!uri.startsWith(PREFIX)) {
    if (uri.startsWith('data:')) {
      const comma = uri.indexOf(',');
      if (comma < 0) throw new Error('malformed data: URI');
      const header = uri.slice(5, comma);
      const payload = uri.slice(comma + 1);
      const text = header.includes(';base64')
        ? Buffer.from(payload, 'base64').toString('utf-8')
        : decodeURIComponent(payload);
      return JSON.parse(text);
    }
    throw new Error(`expected data: URI, got ${uri.slice(0, 16)}...`);
  }
  const text = Buffer.from(uri.slice(PREFIX.length), 'base64').toString('utf-8');
  return JSON.parse(text);
}
