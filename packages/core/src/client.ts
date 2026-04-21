import { buildAckAuthorization, buildPickupAuthorization } from './auth-header.js';
import { buildEnvelope, openEnvelope, type OpenedEnvelope } from './envelope.js';
import type { Envelope, ScutUri, SiiDocument } from './types.js';

export interface ResolverClient {
  resolve(ref: ScutUri): Promise<SiiDocument>;
}

export class HttpResolverClient implements ResolverClient {
  constructor(private readonly baseUrl: string) {}

  async resolve(ref: ScutUri): Promise<SiiDocument> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/scut/v1/resolve?ref=${encodeURIComponent(ref)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.status === 404) throw new ScutClientError(`ref ${ref} not found`, 'not_found');
    if (!res.ok) throw new ScutClientError(`resolver returned ${res.status}`, 'resolver_error');
    const body = (await res.json()) as { document: SiiDocument };
    return body.document;
  }
}

export class ScutClientError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'not_found'
      | 'resolver_error'
      | 'relay_error'
      | 'no_relays'
      | 'all_relays_failed',
  ) {
    super(message);
    this.name = 'ScutClientError';
  }
}

export interface ScutClientOptions {
  /** This client's scut:// URI, used as the envelope `from` field. */
  agentRef: ScutUri;
  signingPrivateKey: string;
  signingPublicKey: string;
  encryptionPrivateKey: string;
  encryptionPublicKey: string;
  resolver: ResolverClient;
  /** Explicit relay override for the sender's own inbox. If omitted, the client
   *  resolves its own SII document and uses its relay list. */
  relays?: readonly string[];
  fetchImpl?: typeof fetch;
}

export interface SendResult {
  envelopeId: string;
  relay: string;
  storedAt: string;
  idempotent: boolean;
}

export class ScutClient {
  private readonly fetch: typeof fetch;

  constructor(private readonly opts: ScutClientOptions) {
    this.fetch = opts.fetchImpl ?? fetch;
  }

  async send(params: { to: ScutUri; body: string; ttlSeconds?: number }): Promise<SendResult> {
    const recipientDoc = await this.opts.resolver.resolve(params.to);
    if (recipientDoc.relays.length === 0) {
      throw new ScutClientError('recipient has no relays', 'no_relays');
    }
    const envelope = await buildEnvelope({
      from: this.opts.agentRef,
      to: params.to,
      body: params.body,
      senderSigningPrivateKey: this.opts.signingPrivateKey,
      recipientEncryptionPublicKey: recipientDoc.keys.encryption.publicKey,
      ttlSeconds: params.ttlSeconds,
    });

    const sorted = [...recipientDoc.relays].sort((a, b) => a.priority - b.priority);
    const attempts: Array<{ relay: string; status: number; body: string }> = [];
    for (const relay of sorted) {
      const url = this.relayUrl(relay.host, '/scut/v1/push');
      const res = await this.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      if (res.status === 202) {
        const body = (await res.json()) as {
          stored_at: string;
          envelope_id: string;
          idempotent: boolean;
        };
        return {
          envelopeId: body.envelope_id,
          relay: relay.host,
          storedAt: body.stored_at,
          idempotent: body.idempotent,
        };
      }
      attempts.push({ relay: relay.host, status: res.status, body: await res.text() });
      if (res.status === 409) break;
    }
    throw new ScutClientError(
      `push failed across ${attempts.length} relay(s): ${JSON.stringify(attempts)}`,
      'all_relays_failed',
    );
  }

  async receive(params: { since?: Date } = {}): Promise<OpenedEnvelope[]> {
    const inbox = this.opts.relays ?? (await this.ownRelays());
    if (inbox.length === 0) {
      throw new ScutClientError('no relays configured for this client', 'no_relays');
    }

    const seen = new Set<string>();
    const opened: OpenedEnvelope[] = [];
    for (const host of inbox) {
      const envelopes = await this.pickupFrom(host, params.since);
      for (const envelope of envelopes) {
        if (seen.has(envelope.envelope_id)) continue;
        seen.add(envelope.envelope_id);
        try {
          const senderDoc = await this.opts.resolver.resolve(envelope.from);
          const msg = await openEnvelope({
            envelope,
            recipientEncryptionPrivateKey: this.opts.encryptionPrivateKey,
            senderSigningPublicKey: senderDoc.keys.signing.publicKey,
          });
          opened.push(msg);
        } catch {
          // drop envelopes that fail verification; the dedupe set still
          // includes them so they will not be re-attempted this call
        }
      }
    }
    return opened;
  }

  async ack(envelopeIds: readonly string[], options: { relayHost?: string } = {}): Promise<string[]> {
    if (envelopeIds.length === 0) return [];
    const inbox = options.relayHost
      ? [options.relayHost]
      : this.opts.relays ?? (await this.ownRelays());
    const dropped = new Set<string>();
    const authorization = await buildAckAuthorization({
      agentId: this.opts.agentRef,
      signingPrivateKey: this.opts.signingPrivateKey,
      envelopeIds,
    });
    for (const host of inbox) {
      const url = this.relayUrl(host, '/scut/v1/ack');
      const res = await this.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization },
        body: JSON.stringify({ envelope_ids: envelopeIds }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { dropped: string[] };
      for (const id of body.dropped) dropped.add(id);
    }
    return [...dropped];
  }

  private async pickupFrom(host: string, since?: Date): Promise<Envelope[]> {
    const authorization = await buildPickupAuthorization({
      agentId: this.opts.agentRef,
      signingPrivateKey: this.opts.signingPrivateKey,
    });
    const query = new URLSearchParams({ for: this.opts.agentRef });
    if (since) query.set('since', since.toISOString());
    const url = this.relayUrl(host, `/scut/v1/pickup?${query.toString()}`);
    const res = await this.fetch(url, { headers: { authorization } });
    if (!res.ok) return [];
    const body = (await res.json()) as { envelopes: Envelope[] };
    return body.envelopes;
  }

  private async ownRelays(): Promise<string[]> {
    const doc = await this.opts.resolver.resolve(this.opts.agentRef);
    return [...doc.relays]
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.host);
  }

  private relayUrl(host: string, path: string): string {
    if (host.startsWith('http://') || host.startsWith('https://')) {
      return `${host.replace(/\/$/, '')}${path}`;
    }
    return `https://${host}${path}`;
  }
}
