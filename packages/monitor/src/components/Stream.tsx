import React from 'react';
import { Box, Text } from 'ink';
import type { StreamEntry } from '../types.js';
import { EnvelopeLine } from './EnvelopeLine.js';

export interface StreamProps {
  entries: readonly StreamEntry[];
  revealedEnvelopeId: string | null;
  dim: boolean;
  visibleCount?: number;
}

export function Stream({
  entries,
  revealedEnvelopeId,
  dim,
  visibleCount = 18,
}: StreamProps): React.ReactElement {
  const slice = entries.slice(-visibleCount);

  if (slice.length === 0) {
    return (
      <Box>
        <Text color="gray" dimColor>
          waiting for envelopes…
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {slice.map((entry) => (
        <EnvelopeLine
          key={entry.envelope.envelope_id}
          entry={entry}
          dim={dim}
          highlighted={entry.envelope.envelope_id === revealedEnvelopeId}
        />
      ))}
    </Box>
  );
}
