export function truncateAgentId(agentId: string, visible = 8): string {
  const core = agentId.startsWith('0x') ? agentId.slice(2) : agentId;
  if (core.length <= visible) return `0x${core}`;
  return `0x${core.slice(0, visible)}…`;
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
