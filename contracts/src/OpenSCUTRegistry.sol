// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {ISCUTIdentity} from "./ISCUTIdentity.sol";

/// @title OpenSCUTRegistry
/// @notice Reference implementation of the SCUT Identity Interface (SII) as
///         an ERC-721 contract with permissionless mint. Anyone may register
///         an agent identity by minting a token with an SII document URI.
/// @dev Token ids start at 1 so the first-minted agent gets a clean
///      scut://<chain>/<contract>/1 address.
contract OpenSCUTRegistry is ERC721, ISCUTIdentity {
    // SII v1 EIP-165 interface id. Computed off-chain and verified in the
    // OpenSCUTRegistryTest suite against a live cross-implementation.
    bytes4 private constant _SCUT_IDENTITY_INTERFACE_ID = 0x6fe513d9;

    uint256 private _nextTokenId = 1;
    mapping(uint256 => string) private _identityURIs;

    event SCUTIdentityRegistered(uint256 indexed tokenId, address indexed owner, string uri);
    event SCUTIdentityUpdated(uint256 indexed tokenId, string uri);

    error URIEmpty();
    error NotOwner();

    constructor() ERC721("OpenSCUT Registry", "SCUT") {}

    /// @notice Mint a new SCUT identity token to `to`, setting its SII
    ///         document URI. Permissionless: any caller may mint for any
    ///         address. The caller pays gas; the returned token is owned
    ///         by `to`.
    /// @param to The address that will own the new token.
    /// @param identityURI The URI of the SII document for this agent.
    /// @return tokenId The newly-minted token id.
    function mint(address to, string calldata identityURI) external returns (uint256 tokenId) {
        if (bytes(identityURI).length == 0) revert URIEmpty();
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _identityURIs[tokenId] = identityURI;
        emit SCUTIdentityRegistered(tokenId, to, identityURI);
    }

    /// @notice Update the SII document URI for a token you own. Used when
    ///         the agent's keys, relays, or capabilities change.
    function updateIdentityURI(uint256 tokenId, string calldata newURI) external {
        if (bytes(newURI).length == 0) revert URIEmpty();
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        _identityURIs[tokenId] = newURI;
        emit SCUTIdentityUpdated(tokenId, newURI);
    }

    // ---- ISCUTIdentity ----

    /// @inheritdoc ISCUTIdentity
    function scutIdentityURI(uint256 tokenId) external view returns (string memory) {
        // ownerOf reverts with ERC721NonexistentToken if the token is unminted,
        // which satisfies the SII MUST-revert contract.
        ownerOf(tokenId);
        return _identityURIs[tokenId];
    }

    /// @inheritdoc ISCUTIdentity
    function scutVersion() external pure returns (uint8) {
        return 1;
    }

    /// @inheritdoc ISCUTIdentity
    function supportsSCUTIdentity() external pure returns (bool) {
        return true;
    }

    // ---- ERC165 ----

    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        return interfaceId == _SCUT_IDENTITY_INTERFACE_ID || super.supportsInterface(interfaceId);
    }
}
