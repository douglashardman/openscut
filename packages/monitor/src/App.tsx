import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Box, Text } from 'ink';
import type { ResolverClient } from '@openscut/core';
import { RevealOverlay } from './components/RevealOverlay.js';
import { Stream } from './components/Stream.js';
import type { Keyring } from './keyring.js';
import { Orchestrator, type OrchestratorMode } from './orchestrator.js';
import { subscribeToEvents } from './sse.js';
import { MonitorStore } from './store.js';

export interface AppOptions {
  relayUrl: string;
  eventsToken: string;
  keyring: Keyring;
  resolver: ResolverClient;
  mode: OrchestratorMode;
}

export function App({ opts }: { opts: AppOptions }): React.ReactElement {
  const store = useMemo(() => new MonitorStore(), []);
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    store.getSnapshot,
    store.getSnapshot,
  );

  useEffect(() => {
    const controller = new AbortController();
    void subscribeToEvents({
      url: opts.relayUrl,
      token: opts.eventsToken,
      signal: controller.signal,
      onEvent: (event) => {
        if (event.kind === 'envelope_received') {
          store.addEnvelope(
            event.envelope,
            Date.parse(event.received_at),
            opts.keyring.holdsKeyFor(event.envelope.to),
          );
        } else if (event.kind === 'envelope_acked') {
          store.markAcked(event.envelope_ids, Date.now());
        } else if (event.kind === 'envelope_expired') {
          store.markExpired(event.envelope_id);
        }
      },
      onError: () => {
        /* swallow: operator sees a stale stream; reconnect policy TBD */
      },
    });
    return () => controller.abort();
  }, [opts.relayUrl, opts.eventsToken, opts.keyring, store]);

  useEffect(() => {
    const orch = new Orchestrator(
      { store, keyring: opts.keyring, resolver: opts.resolver },
      opts.mode,
    );
    return orch.start();
  }, [store, opts.keyring, opts.resolver, opts.mode]);

  const revealEntry = snapshot.reveal
    ? snapshot.entries.find((e) => e.envelope.envelope_id === snapshot.reveal!.envelopeId) ?? null
    : null;

  const receivedCount = snapshot.entries.length;
  const revealedCount = snapshot.entries.filter((e) => e.revealedAt !== null).length;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="whiteBright">
          scut-monitor · {opts.relayUrl}
        </Text>
        <Text color="gray">
          {`envelopes=${receivedCount}  revealed=${revealedCount}  mode=${opts.mode.kind}`}
        </Text>
      </Box>
      <Stream
        entries={snapshot.entries}
        revealedEnvelopeId={snapshot.reveal?.envelopeId ?? null}
        dim={Boolean(snapshot.reveal)}
      />
      {snapshot.reveal && revealEntry && (
        <Box marginTop={1}>
          <RevealOverlay
            reveal={snapshot.reveal}
            entry={revealEntry}
            onDone={() => store.endReveal()}
          />
        </Box>
      )}
    </Box>
  );
}
