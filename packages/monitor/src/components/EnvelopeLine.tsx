import React from 'react';
import { Text } from 'ink';
import type { StreamEntry } from '../types.js';
import { CIPHER_SUITE_LABEL, formatClockTime, formatSize, truncateAgentId } from '../format.js';

export interface EnvelopeLineProps {
  entry: StreamEntry;
  dim?: boolean;
  highlighted?: boolean;
}

export function EnvelopeLine({
  entry,
  dim = false,
  highlighted = false,
}: EnvelopeLineProps): React.ReactElement {
  const ts = formatClockTime(entry.receivedAt);
  const from = truncateAgentId(entry.envelope.from);
  const to = truncateAgentId(entry.envelope.to);
  const size = formatSize(entry.sizeBytes).padStart(8, ' ');
  const sig = 'sig✓';
  const statusGlyph =
    entry.status === 'acked' ? '✓' : entry.status === 'expired' ? '✗' : ' ';

  const color = dim ? 'gray' : highlighted ? 'whiteBright' : 'white';
  const content = `[${ts}]  ${from} → ${to}  ${size}  ${sig}  ${CIPHER_SUITE_LABEL}  ${statusGlyph}`;

  return (
    <Text color={color} dimColor={dim} bold={highlighted}>
      {content}
    </Text>
  );
}
