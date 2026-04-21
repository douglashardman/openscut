import type { RelayEvent } from './types.js';

export interface SseSubscribeOptions {
  url: string;
  token: string;
  signal?: AbortSignal;
  onEvent: (event: RelayEvent) => void;
  onError?: (err: Error) => void;
  fetchImpl?: typeof fetch;
}

/**
 * Subscribe to a relay's /scut/v1/events endpoint.
 *
 * Handles multi-chunk SSE frames. Ignores heartbeat comments (lines
 * starting with `:`). Calls onEvent for every data frame that parses
 * as JSON with a known `kind`.
 *
 * Returns a promise that resolves when the stream ends (cleanly or by
 * abort). Errors surface through onError; callers typically log and
 * reconnect on their own cadence.
 */
export async function subscribeToEvents(opts: SseSubscribeOptions): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${opts.url.replace(/\/$/, '')}/scut/v1/events`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: {
        authorization: `Bearer ${opts.token}`,
        accept: 'text/event-stream',
      },
      signal: opts.signal,
    });
  } catch (err) {
    opts.onError?.(err as Error);
    return;
  }
  if (!res.ok || !res.body) {
    opts.onError?.(new Error(`SSE connect failed: ${res.status} ${res.statusText}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = frame
          .split('\n')
          .filter((line) => !line.startsWith(':'))
          .find((line) => line.startsWith('data: '));
        if (!dataLine) continue;
        try {
          const parsed = JSON.parse(dataLine.slice(6)) as RelayEvent;
          if (
            parsed.kind === 'envelope_received' ||
            parsed.kind === 'envelope_acked' ||
            parsed.kind === 'envelope_expired'
          ) {
            opts.onEvent(parsed);
          }
        } catch (err) {
          opts.onError?.(err as Error);
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      opts.onError?.(err as Error);
    }
  }
}
