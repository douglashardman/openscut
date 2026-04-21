# OpenSCUT Contracts

Solidity implementations of the SCUT Identity Interface (SII), plus the reference registry `OpenSCUTRegistry`.

## Live deployment

`OpenSCUTRegistry` is deployed on **Base mainnet** (chainId 8453) at:

```
0x199b48E27a28881502b251B0068F388Ce750feff
```

- Source verified on BaseScan: https://basescan.org/address/0x199b48e27a28881502b251b0068f388ce750feff#code
- Deployment metadata: [`deployments/base-mainnet.json`](deployments/base-mainnet.json)
- Tokens 1-5 are the five demo agents for the OpenSCUT v1 terminal demo. Their SII documents live at `https://openscut.ai/registry/{1..5}.json`.

## Contents

- `src/ISCUTIdentity.sol` — SII v1 interface. Any contract that implements these three functions is a valid SCUT identity registry. See [`spec/SPEC.md` §4](../spec/SPEC.md).
- `src/OpenSCUTRegistry.sol` — Reference SII contract. Minimal ERC-721 with permissionless mint and per-token SII document URI. Token ids start at 1.
- `test/OpenSCUTRegistry.t.sol` — Foundry unit tests. 19 cases covering mint, update, ownership, interface IDs.
- `script/Deploy.s.sol` — Deployment script for Base mainnet / testnet.
- `script/MintDemoAgents.s.sol` — Mints the five demo tokens against a deployed registry. Takes `REGISTRY_ADDRESS`, `MINT_TO`, and `TOKEN_URI_1`..`TOKEN_URI_5` from env.

## One-time setup

`lib/` is gitignored. Install the Solidity dependencies once after cloning:

```
cd contracts
forge install --no-git foundry-rs/forge-std openzeppelin/openzeppelin-contracts
```

## Build and test

```
forge build
forge test -vv
```

## Deployment

```
export BASE_RPC_URL=https://mainnet.base.org
export BASESCAN_API_KEY=...   # for --verify

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url base \
  --account <your-keystore-account> \
  --broadcast \
  --verify
```

The deployer pays gas. The constructor takes no arguments. After deployment, record the address in [`deployments/base-mainnet.json`](deployments/) and commit.

## Interface id

SII v1 EIP-165 interface id: `0x6fe513d9`

Computed as `bytes4(keccak256("scutIdentityURI(uint256)")) ^ bytes4(keccak256("scutVersion()")) ^ bytes4(keccak256("supportsSCUTIdentity()"))`.

Cross-verified against OpenPub's SII adapter at `0xb3Da467Df97930928DbB2DeB7DFb80B44628C881` on Base mainnet: `supportsInterface(0x6fe513d9)` returns `true`.
