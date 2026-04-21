# OpenSCUT Contracts

Solidity implementations of the SCUT Identity Interface (SII), plus the reference registry `OpenSCUTRegistry`.

## Contents

- `src/ISCUTIdentity.sol` — SII v1 interface. Any contract that implements these three functions is a valid SCUT identity registry. See [`spec/SPEC.md` §4](../spec/SPEC.md).
- `src/OpenSCUTRegistry.sol` — Reference SII contract. Minimal ERC-721 with permissionless mint and per-token SII document URI. Token ids start at 1.
- `test/OpenSCUTRegistry.t.sol` — Foundry unit tests. 19 cases covering mint, update, ownership, interface IDs.
- `script/Deploy.s.sol` — Deployment script for Base mainnet / testnet.

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
