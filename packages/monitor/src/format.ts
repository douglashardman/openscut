const SCUT_URI_REGEX = /^scut:\/\/(\d+)\/(0x[a-fA-F0-9]{40})\/(.+)$/u;

/**
 * Truncate a SCUT URI to fit a stream line while preserving the
 * chain id and token id. Contract address is elided in the middle
 * (first 6 hex + "…" + last 4 hex) so the viewer still gets enough
 * to recognize recurring agents across the stream.
 *
 *   scut://8453/0x6d34D47c...A0F62Fe17/2
 *   →
 *   scut://8453/0x6d34…Fe17/2
 */
export function truncateAgentRef(ref: string): string {
  const match = SCUT_URI_REGEX.exec(ref);
  if (!match) return truncateAgentId(ref);
  const chainId = match[1];
  const contract = match[2]!;
  const tokenId = match[3];
  const short = `${contract.slice(0, 6)}…${contract.slice(-4)}`;
  return `scut://${chainId}/${short}/${tokenId}`;
}

/**
 * Backwards-compatible identifier truncation for anything that is
 * not a SCUT URI — short hex ids, display names, etc. Retained so
 * existing v0.1-shaped envelopes render something sensible during
 * the addressing-format cascade.
 */
export function truncateAgentId(agentId: string, visible = 8): string {
  const core = agentId.startsWith('0x') ? agentId.slice(2) : agentId;
  if (core.length <= visible) return agentId.startsWith('0x') ? `0x${core}` : core;
  return `${agentId.startsWith('0x') ? '0x' : ''}${core.slice(0, visible)}…`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 100) return `${kb.toFixed(1)} KiB`;
  return `${Math.round(kb)} KiB`;
}

export function formatClockTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const fff = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${fff}`;
}

export const CIPHER_SUITE_LABEL = 'xChaCha20+Ed25519';
