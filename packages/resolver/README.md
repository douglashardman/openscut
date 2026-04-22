# `scut-resolver`

> Resolver daemon for the SCUT protocol. Maps a `scut://` URI to the agent's SII document.

`scut-resolver` is a stateless HTTP service that answers one question: given a `scut://<chainId>/<contract>/<tokenId>` URI, what is the agent's current SII identity document?

It has two backends, chosen at boot:

- **`sii`** — queries any SII-compliant contract on the configured chain, fetches the `scutIdentityURI` return, validates the document, and returns it.
- **`json-file`** — reads from a local JSON file. Useful for dev, CI, and disaster-recovery fallback if the chain is unreachable.

## Install

```
npm install -g scut-resolver
scut-resolver --config /etc/scut-resolver.yaml
```

Or via the workspace:

```
pnpm --filter scut-resolver run start
```

Node 20 or newer.

## Endpoint

```
GET /scut/v1/resolve?ref=<scut_uri>[&fresh=1]
```

`ref` is a URL-encoded `scut://` URI. The response:

```json
{
  "ref": "scut://8453/0x199b.../1",
  "document": { "siiVersion": 1, "agentRef": {...}, "keys": {...}, ... },
  "fetched_at": "2026-04-22T...",
  "source": "registry",
  "cache_ttl_seconds": 300
}
```

The resolver caches results by `ref` for `cache_ttl_seconds`. Add `?fresh=1` to bypass the cache and force a live fetch.

### Error shapes

| Status | Cause |
|---|---|
| `400` | `ref` missing, `ref` malformed, or `chainId` not in the resolver's configured support matrix |
| `404` | Contract returned the empty string or reverted with a nonexistent-token error |
| `502` | Upstream RPC or fetch failure |

## Configuration

Selectable via environment variables.

### Common

| Variable | Default | Purpose |
|---|---|---|
| `SCUT_RESOLVER_HOST` | `0.0.0.0` | Listen host |
| `SCUT_RESOLVER_PORT` | `8444` | Listen port |
| `SCUT_RESOLVER_CACHE_TTL_SECONDS` | `300` | Cache TTL for resolved documents |
| `SCUT_RESOLVER_REGISTRY_BACKEND` | `json-file` | `json-file` or `sii` |
| `SCUT_RESOLVER_LOG` | (unset) | `silent` to suppress logs (tests) |

### `sii` backend

| Variable | Default | Purpose |
|---|---|---|
| `SCUT_RESOLVER_CONTRACT_ADDRESS` | (required for `sii`) | Default contract when a bare token id is supplied instead of a full `scut://` URI |
| `SCUT_RESOLVER_CHAIN_ID` | `8453` | EIP-155 chain id (Base mainnet). The resolver rejects `?ref=` values whose chain id does not match. |
| `SCUT_RESOLVER_BASE_RPC_URL` | `https://mainnet.base.org` | JSON-RPC endpoint |
| `SCUT_RESOLVER_IPFS_GATEWAY` | `https://ipfs.io/ipfs/` | Gateway for `ipfs://` SII document URIs |

Example `sii` config against Base mainnet:

```
SCUT_RESOLVER_REGISTRY_BACKEND=sii
SCUT_RESOLVER_CHAIN_ID=8453
SCUT_RESOLVER_CONTRACT_ADDRESS=0x199b48E27a28881502b251B0068F388Ce750feff
SCUT_RESOLVER_BASE_RPC_URL=https://mainnet.base.org
```

### `json-file` backend

| Variable | Purpose |
|---|---|
| `SCUT_RESOLVER_REGISTRY_PATH` | (required) JSON file mapping `scut://` URI → SII document |

The JSON file is keyed by the canonical `scut://` URI; each value is a full SII document (SPEC §4.3). Example:

```json
{
  "scut://8453/0x.../1": { "siiVersion": 1, "agentRef": {...}, ... },
  "scut://8453/0x.../2": { "siiVersion": 1, "agentRef": {...}, ... }
}
```

The file is validated on load; bad documents, missing required fields, or mismatched `agentRef` / key pairings reject the load. The resolver reloads the file on mtime change so operators can edit identities without bouncing the service.

## Behavior

1. On request: parse `ref` per SPEC §4.6. Reject malformed refs with `400`.
2. Check cache keyed on the full `ref`.
3. On cache miss (or `?fresh=1`): query the backend.
   - `sii`: call `scutIdentityURI(tokenId)` on the contract via the chain's RPC. Fetch the returned URI (scheme determines fetch: `ipfs://` via gateway, `https://` directly, `data:` inline-decoded). Validate against the SII document schema. Verify the document's `agentRef` matches the lookup triple — rejects mix-ups where one contract's tokenId points at another's document.
   - `json-file`: look up by `ref` in the loaded map.
4. Cache with configured TTL.
5. Return.

## Security

- Resolvers hold no private keys.
- A malicious resolver can return doctored documents with the attacker's public keys; clients doing high-value sends should verify via multiple resolvers or direct chain reads. SPEC §13.3 gotcha #5.
- The resolver's `?ref=` chain support matrix is a configuration concern: an `sii` resolver configured for Base mainnet rejects a `scut://1/.../N` (Ethereum mainnet) lookup with `400`, not `502`. Operators who want to support multiple chains run one resolver per chain behind a router of their choice.

## Public resolver

`resolver.openscut.ai` is operated by the OpenSCUT project as a public good, configured for Base mainnet by default. It reads from both `OpenSCUTRegistry` and OpenPub's SII adapter. Clients default to it but can configure any resolver.

## Related

- Spec: [`spec/SPEC.md`](../../spec/SPEC.md) §4 (SII), §6.6 (resolver API), §12 (resolver service)
- `scut-relay`: [../relay/README.md](../relay/README.md)
- Reference contract: [../../contracts/README.md](../../contracts/README.md)

## License

MIT.
