// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OpenSCUTRegistry} from "../src/OpenSCUTRegistry.sol";

/// @notice Mints five demo agent identity tokens to MINT_TO on a
///         previously-deployed OpenSCUTRegistry. Token URIs are
///         pulled from env vars TOKEN_URI_1 .. TOKEN_URI_5, so the
///         script can be re-run if we ever need to regenerate keys
///         or change hosting.
/// @dev Run with:
///        cd contracts
///        REGISTRY_ADDRESS=0x... \
///        MINT_TO=0x... \
///        TOKEN_URI_1=https://openscut.ai/registry/1.json \
///        TOKEN_URI_2=https://openscut.ai/registry/2.json \
///        TOKEN_URI_3=https://openscut.ai/registry/3.json \
///        TOKEN_URI_4=https://openscut.ai/registry/4.json \
///        TOKEN_URI_5=https://openscut.ai/registry/5.json \
///        forge script script/MintDemoAgents.s.sol:MintDemoAgentsScript \
///          --rpc-url base \
///          --account scut-deployer \
///          --broadcast
contract MintDemoAgentsScript is Script {
    function run() external {
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        address mintTo = vm.envAddress("MINT_TO");

        string[5] memory uris = [
            vm.envString("TOKEN_URI_1"),
            vm.envString("TOKEN_URI_2"),
            vm.envString("TOKEN_URI_3"),
            vm.envString("TOKEN_URI_4"),
            vm.envString("TOKEN_URI_5")
        ];

        OpenSCUTRegistry registry = OpenSCUTRegistry(registryAddress);

        console2.log("OpenSCUTRegistry:", registryAddress);
        console2.log("  mint recipient:", mintTo);
        console2.log("  chainId:       ", block.chainid);

        vm.startBroadcast();
        for (uint256 i = 0; i < 5; i++) {
            uint256 tokenId = registry.mint(mintTo, uris[i]);
            console2.log("minted tokenId=", tokenId);
            console2.log("  uri:", uris[i]);
        }
        vm.stopBroadcast();
    }
}
