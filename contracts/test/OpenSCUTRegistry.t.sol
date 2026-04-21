// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {OpenSCUTRegistry} from "../src/OpenSCUTRegistry.sol";

contract OpenSCUTRegistryTest is Test {
    OpenSCUTRegistry internal registry;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    bytes4 private constant SCUT_INTERFACE_ID = 0x6fe513d9;
    bytes4 private constant ERC721_INTERFACE_ID = 0x80ac58cd;
    bytes4 private constant ERC165_INTERFACE_ID = 0x01ffc9a7;

    event SCUTIdentityRegistered(uint256 indexed tokenId, address indexed owner, string uri);
    event SCUTIdentityUpdated(uint256 indexed tokenId, string uri);

    function setUp() public {
        registry = new OpenSCUTRegistry();
    }

    function test_supportsSCUTIdentity_returnsTrue() public view {
        assertTrue(registry.supportsSCUTIdentity());
    }

    function test_scutVersion_isOne() public view {
        assertEq(registry.scutVersion(), 1);
    }

    function test_supportsInterface_SII() public view {
        assertTrue(registry.supportsInterface(SCUT_INTERFACE_ID));
    }

    function test_supportsInterface_ERC721() public view {
        assertTrue(registry.supportsInterface(ERC721_INTERFACE_ID));
    }

    function test_supportsInterface_ERC165() public view {
        assertTrue(registry.supportsInterface(ERC165_INTERFACE_ID));
    }

    function test_supportsInterface_RandomIdIsFalse() public view {
        assertFalse(registry.supportsInterface(0xdeadbeef));
    }

    function test_interfaceId_XorMatches() public pure {
        bytes4 a = bytes4(keccak256("scutIdentityURI(uint256)"));
        bytes4 b = bytes4(keccak256("scutVersion()"));
        bytes4 c = bytes4(keccak256("supportsSCUTIdentity()"));
        assertEq(a ^ b ^ c, SCUT_INTERFACE_ID);
    }

    function test_mint_firstTokenIsId1() public {
        uint256 tokenId = registry.mint(alice, "ipfs://bafy...alice");
        assertEq(tokenId, 1);
        assertEq(registry.ownerOf(1), alice);
    }

    function test_mint_sequentialTokenIds() public {
        assertEq(registry.mint(alice, "ipfs://a"), 1);
        assertEq(registry.mint(bob, "ipfs://b"), 2);
        assertEq(registry.mint(alice, "ipfs://c"), 3);
    }

    function test_mint_emitsRegisteredEvent() public {
        vm.expectEmit(true, true, true, true);
        emit SCUTIdentityRegistered(1, alice, "ipfs://bafy...alice");
        registry.mint(alice, "ipfs://bafy...alice");
    }

    function test_mint_rejectsEmptyURI() public {
        vm.expectRevert(OpenSCUTRegistry.URIEmpty.selector);
        registry.mint(alice, "");
    }

    function test_scutIdentityURI_returnsRegisteredValue() public {
        registry.mint(alice, "ipfs://bafy...alice");
        assertEq(registry.scutIdentityURI(1), "ipfs://bafy...alice");
    }

    function test_scutIdentityURI_revertsForNonexistentToken() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, uint256(1))
        );
        registry.scutIdentityURI(1);
    }

    function test_updateIdentityURI_byOwner() public {
        registry.mint(alice, "ipfs://old");
        vm.expectEmit(true, true, false, true);
        emit SCUTIdentityUpdated(1, "ipfs://new");
        vm.prank(alice);
        registry.updateIdentityURI(1, "ipfs://new");
        assertEq(registry.scutIdentityURI(1), "ipfs://new");
    }

    function test_updateIdentityURI_byNonOwner_reverts() public {
        registry.mint(alice, "ipfs://old");
        vm.expectRevert(OpenSCUTRegistry.NotOwner.selector);
        vm.prank(bob);
        registry.updateIdentityURI(1, "ipfs://attacker");
    }

    function test_updateIdentityURI_rejectsEmpty() public {
        registry.mint(alice, "ipfs://old");
        vm.expectRevert(OpenSCUTRegistry.URIEmpty.selector);
        vm.prank(alice);
        registry.updateIdentityURI(1, "");
    }

    function test_updateIdentityURI_revertsForNonexistent() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, uint256(42))
        );
        vm.prank(alice);
        registry.updateIdentityURI(42, "ipfs://whatever");
    }

    function test_mint_permissionless_anyoneCanMintForAnyone() public {
        // Bob mints a token owned by Alice. No allowlist, no fee.
        vm.prank(bob);
        uint256 tokenId = registry.mint(alice, "ipfs://alice-doc");
        assertEq(registry.ownerOf(tokenId), alice);
    }

    function test_name_and_symbol() public view {
        assertEq(registry.name(), "OpenSCUT Registry");
        assertEq(registry.symbol(), "SCUT");
    }
}
