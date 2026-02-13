// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing purposes with faucet functionality
 * @notice 6 decimals like real USDC
 */
contract MockUSDC is ERC20, Ownable {
    // Faucet parameters
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**6; // 1000 USDC per request
    uint256 public constant FAUCET_COOLDOWN = 1 days; // 1 day cooldown between requests
    mapping(address => uint256) public lastFaucetRequest; // User => last request timestamp
    
    // Faucet limits
    uint256 public maxFaucetPerDay = 10000 * 10**6; // Max 10,000 USDC per day per user
    mapping(address => uint256) public dailyFaucetAmount; // User => amount claimed today
    mapping(address => uint256) public lastFaucetDay; // User => last faucet day
    
    event FaucetUsed(address indexed user, uint256 amount, uint256 timestamp);
    
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        // Mint 1,000,000 USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10**6);
    }

    /**
     * @notice Mint tokens (for testing)
     * @param to Address to mint to
     * @param amount Amount to mint (6 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Get test USDC from faucet
     * @dev Users can request test USDC once per day
     */
    function faucet() external {
        address user = msg.sender;
        uint256 currentTime = block.timestamp;
        uint256 currentDay = currentTime / 1 days;
        
        // Reset daily amount if it's a new day
        if (lastFaucetDay[user] != currentDay) {
            dailyFaucetAmount[user] = 0;
            lastFaucetDay[user] = currentDay;
        }
        
        // Check cooldown
        require(
            currentTime >= lastFaucetRequest[user] + FAUCET_COOLDOWN,
            "Faucet cooldown not expired"
        );
        
        // Check daily limit
        require(
            dailyFaucetAmount[user] + FAUCET_AMOUNT <= maxFaucetPerDay,
            "Daily faucet limit exceeded"
        );
        
        // Update tracking
        lastFaucetRequest[user] = currentTime;
        dailyFaucetAmount[user] += FAUCET_AMOUNT;
        
        // Mint tokens
        _mint(user, FAUCET_AMOUNT);
        
        emit FaucetUsed(user, FAUCET_AMOUNT, currentTime);
    }
    
    /**
     * @notice Set max faucet amount per day
     * @param _maxAmount New max amount (6 decimals)
     */
    function setMaxFaucetPerDay(uint256 _maxAmount) external onlyOwner {
        maxFaucetPerDay = _maxAmount;
    }
    
    /**
     * @notice Get user's faucet status
     * @param _user User address
     * @return canRequest Whether user can request now
     * @return timeUntilNextRequest Seconds until next request available
     * @return dailyAmountRemaining Remaining daily amount available
     */
    function getFaucetStatus(address _user) external view returns (
        bool canRequest,
        uint256 timeUntilNextRequest,
        uint256 dailyAmountRemaining
    ) {
        uint256 currentTime = block.timestamp;
        uint256 currentDay = currentTime / 1 days;
        
        // Reset daily amount if it's a new day
        uint256 userDailyAmount = dailyFaucetAmount[_user];
        if (lastFaucetDay[_user] != currentDay) {
            userDailyAmount = 0;
        }
        
        uint256 timeSinceLastRequest = currentTime - lastFaucetRequest[_user];
        bool cooldownExpired = timeSinceLastRequest >= FAUCET_COOLDOWN;
        bool underDailyLimit = userDailyAmount + FAUCET_AMOUNT <= maxFaucetPerDay;
        
        canRequest = cooldownExpired && underDailyLimit;
        timeUntilNextRequest = cooldownExpired ? 0 : FAUCET_COOLDOWN - timeSinceLastRequest;
        dailyAmountRemaining = maxFaucetPerDay > userDailyAmount 
            ? maxFaucetPerDay - userDailyAmount 
            : 0;
    }

    /**
     * @notice Get decimals (6 like real USDC)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

