import React, { useMemo } from 'react';
import { Box } from 'ink';
import type { RevealTarget, StreamEntry } from '../types.js';
import { RevealBox } from './RevealBox.js';
import { useRevealClock } from './useRevealClock.js';

export interface RevealOverlayProps {
  reveal: RevealTarget;
  entry: StreamEntry;
  onDone: () => void;
}

export function RevealOverlay({
  reveal,
  entry,
  onDone,
}: RevealOverlayProps): React.ReactElement {
  const { phase, progress } = useRevealClock(true, onDone);
  const cipher = useMemo(() => entry.envelope.ciphertext, [entry.envelope.ciphertext]);

  return (
    <Box>
      <RevealBox
        cipher={cipher}
        plain={reveal.plaintext}
        from={entry.envelope.from}
        to={entry.envelope.to}
        phase={phase}
        progress={progress}
      />
    </Box>
  );
}
