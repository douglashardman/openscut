import type { AgentRef, ScutUri } from './types.js';

const SCUT_URI_REGEX = /^scut:\/\/(\d+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/u;

/**
 * Parse a scut://<chainId>/<contract>/<tokenId> URI per SPEC §4.6.
 * Contract is normalized to lowercase. Returns null on any parse
 * failure so callers can surface a 400 instead of crashing.
 */
export function parseScutUri(uri: string): AgentRef | null {
  const match = SCUT_URI_REGEX.exec(uri);
  if (!match) return null;
  return {
    chainId: Number(match[1]),
    contract: match[2]!.toLowerCase(),
    tokenId: match[3]!,
  };
}

export function formatScutUri(ref: AgentRef): ScutUri {
  return `scut://${ref.chainId}/${ref.contract.toLowerCase()}/${ref.tokenId}`;
}

export function isScutUri(value: string): boolean {
  return SCUT_URI_REGEX.test(value);
}
