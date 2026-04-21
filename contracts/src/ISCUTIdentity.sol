// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISCUTIdentity — SCUT Identity Interface v1
/// @notice Any contract that implements this interface is a valid SCUT
///         identity registry. See SPEC.md §4 for the full specification.
/// @dev EIP-165 interface id: 0x6fe513d9
interface ISCUTIdentity {
    /// @notice Returns a URI pointing to a JSON document conforming to
    ///         SII document schema v1 for the given token.
    /// @dev MUST revert if the tokenId does not exist.
    /// @dev MUST return the empty string if the tokenId exists but no SII
    ///      document is registered for it.
    function scutIdentityURI(uint256 tokenId) external view returns (string memory);

    /// @notice The major SII version this contract supports. v1 = 1.
    function scutVersion() external pure returns (uint8);

    /// @notice EIP-165-style flag: true if this contract implements SII v1.
    function supportsSCUTIdentity() external pure returns (bool);
}
