// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OpenSCUTRegistry} from "../src/OpenSCUTRegistry.sol";

/// @notice Deployment script for OpenSCUTRegistry.
/// @dev Run with:
///        forge script script/Deploy.s.sol:DeployScript \
///          --rpc-url base \
///          --account <your-keystore-account> \
///          --broadcast \
///          --verify
///      The deployer account pays gas. No constructor arguments.
///      Verify requires BASESCAN_API_KEY in env.
contract DeployScript is Script {
    function run() external returns (OpenSCUTRegistry registry) {
        vm.startBroadcast();
        registry = new OpenSCUTRegistry();
        vm.stopBroadcast();

        console2.log("OpenSCUTRegistry deployed at:", address(registry));
        console2.log("  name:   ", registry.name());
        console2.log("  symbol: ", registry.symbol());
        console2.log("  chainId:", block.chainid);
    }
}
