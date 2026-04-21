import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { BOX_LINES, BOX_WIDTH, buildTransitions, morphFrame, wrapLines } from '../phases.js';
import type { Phase } from '../phases.js';
import { truncateAgentId } from '../format.js';

export interface RevealBoxProps {
  cipher: string;
  plain: string;
  from: string;
  to: string;
  phase: Phase;
  progress: number;
}

/**
 * Presentational component for the reveal animation. Receives the
 * current phase and progress from the parent; owns no timers.
 *
 * Animation parameters are imported from phases.ts and are LOCKED.
 */
export function RevealBox({ cipher, plain, from, to, phase, progress }: RevealBoxProps): React.ReactElement {
  const cipherLines = useMemo(() => wrapLines(cipher, BOX_WIDTH, BOX_LINES), [cipher]);
  const plainLines = useMemo(() => wrapLines(plain, BOX_WIDTH, BOX_LINES), [plain]);
  const total = BOX_WIDTH * BOX_LINES;
  const transitions = useMemo(() => buildTransitions(total, cipher.length), [total, cipher]);

  let displayed: readonly string[];
  let label: string;
  let borderColor: 'cyan' | 'green' | 'yellow' | 'gray' = 'cyan';

  switch (phase) {
    case 'approach':
    case 'expand':
      displayed = cipherLines;
      label = 'ENCRYPTED PAYLOAD';
      borderColor = 'cyan';
      break;
    case 'morphToPlain':
      displayed = morphFrame(cipherLines, plainLines, transitions, progress);
      label = progress > 0.7 ? 'DECRYPTED PAYLOAD' : 'DECRYPTING…';
      borderColor = 'yellow';
      break;
    case 'hold':
      displayed = plainLines;
      label = 'DECRYPTED PAYLOAD';
      borderColor = 'green';
      break;
    case 'morphToCipher':
      displayed = morphFrame(plainLines, cipherLines, transitions, progress);
      label = progress > 0.7 ? 'ENCRYPTED PAYLOAD' : 'RE-ENCRYPTING…';
      borderColor = 'yellow';
      break;
    case 'collapse':
      displayed = cipherLines;
      label = 'ENCRYPTED PAYLOAD';
      borderColor = 'gray';
      break;
    case 'rest':
    default:
      displayed = cipherLines;
      label = 'ENCRYPTED PAYLOAD';
      borderColor = 'cyan';
      break;
  }

  if (phase === 'rest') {
    return <Box />;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      width={BOX_WIDTH + 4}
    >
      <Box justifyContent="space-between">
        <Text color={borderColor} bold>
          {label}
        </Text>
        <Text color="gray">
          {`${truncateAgentId(from)} → ${truncateAgentId(to)}`}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {displayed.map((line, i) => {
          const cipherLine = cipherLines[i] ?? '';
          const isFullCipher = line === cipherLine;
          const isFullPlain = line === (plainLines[i] ?? '');
          const color = isFullCipher ? 'cyan' : isFullPlain ? 'green' : 'yellow';
          return (
            <Text key={`reveal-line-${i}`} color={color}>
              {line}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
