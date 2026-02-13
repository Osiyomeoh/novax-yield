// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NVXToken
 * @dev Governance token for Novax Yield platform with deflationary burn mechanism
 * @notice NVX (Novax Yield) token for platform governance and incentives
 */
contract NVXToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant BURN_RATE_BPS = 100; // 1% burn on transfers (100 basis points)
    uint256 public constant BURN_RATE_DENOMINATOR = 10000;

    // Excluded addresses from burn (e.g., exchange, staking contracts)
    mapping(address => bool) public burnExempt;

    // Total burned tokens
    uint256 public totalBurned;

    event TokensBurned(address indexed from, uint256 amount);
    event BurnExemptUpdated(address indexed account, bool exempt);

    constructor() ERC20("Novax Yield", "NVX") {
        // Grant DEFAULT_ADMIN_ROLE to deployer (who can then grant other roles)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Grant MINTER_ROLE to deployer
        _grantRole(MINTER_ROLE, msg.sender);
        // Grant BURNER_ROLE to deployer
        _grantRole(BURNER_ROLE, msg.sender);
        
        // Exclude zero address and this contract from burn
        burnExempt[address(0)] = true;
        burnExempt[address(this)] = true;
    }

    /**
     * @notice Mint tokens (for governance rewards, staking, etc.)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens (for fee burns, etc.)
     * @param amount Amount to burn
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from an address (for fee burns, etc.)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address from, uint256 amount) public override {
        super.burnFrom(from, amount);
        totalBurned += amount;
        emit TokensBurned(from, amount);
    }

    /**
     * @notice Set burn exemption for an address
     * @param account Address to set exemption for
     * @param exempt Whether address is exempt from burn
     */
    function setBurnExempt(address account, bool exempt) external onlyRole(DEFAULT_ADMIN_ROLE) {
        burnExempt[account] = exempt;
        emit BurnExemptUpdated(account, exempt);
    }

    /**
     * @notice Pause token transfers
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause token transfers
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Override _update to implement burn on transfer
     * @param from Address tokens are transferred from
     * @param to Address tokens are transferred to
     * @param value Amount of tokens transferred
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        // Only apply burn on transfers (not mints or burns)
        if (from != address(0) && to != address(0) && !burnExempt[from] && !burnExempt[to]) {
            uint256 burnAmount = (value * BURN_RATE_BPS) / BURN_RATE_DENOMINATOR;
            if (burnAmount > 0) {
                // Burn 1% of the transfer
                super._update(from, address(0), burnAmount);
                totalBurned += burnAmount;
                emit TokensBurned(from, burnAmount);
                
                // Transfer remaining amount (99%)
                value -= burnAmount;
            }
        }
        
        super._update(from, to, value);
    }
}

