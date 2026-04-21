import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RelayConfig } from '../config.js';
import type { RelayEventBus, RelayEvent } from '../events.js';

export interface EventsDeps {
  config: RelayConfig;
  bus: RelayEventBus;
}

// v1: single relay-wide bearer token configured at boot, passed by trusted
// operators to monitor clients. v2 will move to per-subscriber revocable
// tokens with scope (agent filter, rate limits, expiry).
export function registerEventsRoute(app: FastifyInstance, deps: EventsDeps): void {
  app.get('/scut/v1/events', async (req, reply) => handleEvents(req, reply, deps));
}

async function handleEvents(
  req: FastifyRequest,
  reply: FastifyReply,
  deps: EventsDeps,
): Promise<FastifyReply | void> {
  const auth = req.headers.authorization;
  const expected = `Bearer ${deps.config.events.token}`;
  if (!auth || auth !== expected) {
    return reply.code(401).send({ error: 'events endpoint requires Bearer token' });
  }

  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const writeEvent = (event: RelayEvent): void => {
    res.write(`event: ${event.kind}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = deps.bus.subscribe(writeEvent);

  res.write(`: connected at ${new Date().toISOString()}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, deps.config.events.heartbeatSeconds * 1000);
  heartbeat.unref();

  const cleanup = (): void => {
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) res.end();
  };

  req.raw.on('close', cleanup);
  req.raw.on('aborted', cleanup);
}
