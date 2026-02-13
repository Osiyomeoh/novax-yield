// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PoolToken
 * @dev ERC-20 token representing shares in a Novax Yield pool
 * @notice Minted when users invest, burned when they withdraw
 */
contract PoolToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    address public poolManager; // NovaxPoolManager contract

    constructor(
        string memory name,
        string memory symbol,
        address _poolManager
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, _poolManager);
        _grantRole(BURNER_ROLE, _poolManager);
        poolManager = _poolManager;
    }

    /**
     * @notice Mint pool tokens (only by pool manager)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burn pool tokens (only by pool manager)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address from, uint256 amount) public override onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /**
     * @notice Update pool manager address
     * @param _poolManager New pool manager address
     */
    function setPoolManager(address _poolManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_poolManager != address(0), "Invalid address");
        _revokeRole(MINTER_ROLE, poolManager);
        _revokeRole(BURNER_ROLE, poolManager);
        poolManager = _poolManager;
        _grantRole(MINTER_ROLE, _poolManager);
        _grantRole(BURNER_ROLE, _poolManager);
    }
}

