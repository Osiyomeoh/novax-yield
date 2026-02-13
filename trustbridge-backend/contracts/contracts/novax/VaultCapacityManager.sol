// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Forward declarations
interface INovaxStakingVault {
    function getVaultStatus() external view returns (uint256, uint256, uint256, uint256);
}

interface INovaxPoolManager {
    // Add any needed pool manager functions here if needed
}

/**
 * @title VaultCapacityManager
 * @dev Manages dynamic capacity caps and waitlist for staking vault
 * @notice Prevents over-capitalization and ensures high utilization rates
 * 
 * Key Features:
 * - Dynamic capacity cap based on 30-day deal volume
 * - Waitlist for excess stakers
 * - Auto-promotion from waitlist when capacity increases
 * - Utilization-based APY adjustments
 * - Temporary DeFi deployment for waitlist funds
 */
contract VaultCapacityManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    address public stakingVault; // NovaxStakingVault address
    address public poolManager; // NovaxPoolManager address
    IERC20 public nvxToken;
    IERC20 public usdcToken;

    // Capacity management
    uint256 public capacityMultiplier = 3; // Cap = deal volume × 3
    uint256 public currentCapacity; // Current maximum vault size
    uint256 public lastCapacityUpdate; // Last time capacity was updated
    uint256 public capacityUpdateInterval = 30 days; // Update capacity every 30 days
    uint256 public utilizationThreshold = 80; // 80% utilization target (basis points)

    // Deal volume tracking (30-day rolling)
    uint256[] public dealVolumes; // Historical deal volumes
    uint256[] public dealVolumeTimestamps; // Timestamps for each volume entry
    uint256 public constant DEAL_VOLUME_WINDOW = 30 days;

    // Waitlist management
    struct WaitlistEntry {
        address staker;
        uint256 amount;
        uint256 joinedAt;
        uint256 tempApyBps; // Temporary APY while on waitlist (e.g., 300 = 3%)
        bool active;
    }

    WaitlistEntry[] public waitlist;
    mapping(address => uint256) public waitlistPosition; // staker => index in waitlist
    mapping(address => bool) public isOnWaitlist;

    uint256 public waitlistTempApyBps = 300; // 3% APY for waitlist (DeFi yield)
    uint256 public waitlistFundsDeployed; // Total waitlist funds deployed to DeFi

    // Utilization tracking
    uint256 public totalDeployedCapital; // Capital deployed to receivables
    uint256 public totalStakedCapital; // Total staked in vault

    // Events
    event CapacityUpdated(uint256 oldCapacity, uint256 newCapacity, uint256 dealVolume, uint256 timestamp);
    event StakerAddedToWaitlist(address indexed staker, uint256 amount, uint256 position, uint256 timestamp);
    event StakerPromotedFromWaitlist(address indexed staker, uint256 amount, uint256 timestamp);
    event UtilizationUpdated(uint256 deployed, uint256 staked, uint256 utilizationBps, uint256 timestamp);
    event WaitlistFundsDeployed(uint256 amount, address defiProtocol, uint256 timestamp);
    event WaitlistFundsWithdrawn(uint256 amount, address defiProtocol, uint256 timestamp);

    constructor(
        address _stakingVault,
        address _poolManager,
        address _nvxToken,
        address _usdcToken,
        uint256 _initialCapacity
    ) {
        require(_stakingVault != address(0), "Invalid staking vault");
        require(_poolManager != address(0), "Invalid pool manager");
        // NVX token can be zero if not deployed yet
        require(_usdcToken != address(0), "Invalid USDC token");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        stakingVault = _stakingVault;
        poolManager = _poolManager;
        nvxToken = IERC20(_nvxToken);
        usdcToken = IERC20(_usdcToken);

        currentCapacity = _initialCapacity;
        lastCapacityUpdate = block.timestamp;
    }

    /**
     * @notice Record deal volume for capacity calculation
     * @param _dealAmount Deal amount in USDC (6 decimals)
     */
    function recordDealVolume(uint256 _dealAmount) external {
        // Allow pool manager to call this
        require(
            hasRole(OPERATOR_ROLE, msg.sender) || msg.sender == poolManager,
            "Not authorized"
        );
        require(_dealAmount > 0, "Deal amount must be > 0");

        // Remove old entries (older than 30 days)
        uint256 cutoffTime = block.timestamp - DEAL_VOLUME_WINDOW;
        uint256 validCount = 0;
        for (uint256 i = 0; i < dealVolumes.length; i++) {
            if (dealVolumeTimestamps[i] >= cutoffTime) {
                dealVolumes[validCount] = dealVolumes[i];
                dealVolumeTimestamps[validCount] = dealVolumeTimestamps[i];
                validCount++;
            }
        }

        // Resize arrays
        uint256 oldLength = dealVolumes.length;
        for (uint256 i = validCount; i < oldLength; i++) {
            dealVolumes.pop();
            dealVolumeTimestamps.pop();
        }

        // Add new entry
        dealVolumes.push(_dealAmount);
        dealVolumeTimestamps.push(block.timestamp);

        // Auto-update capacity if interval passed
        if (block.timestamp >= lastCapacityUpdate + capacityUpdateInterval) {
            updateCapacity();
        }
    }

    /**
     * @notice Update vault capacity based on 30-day deal volume
     */
    function updateCapacity() public {
        uint256 totalDealVolume = 0;
        uint256 cutoffTime = block.timestamp - DEAL_VOLUME_WINDOW;

        // Sum all deals in last 30 days
        for (uint256 i = 0; i < dealVolumes.length; i++) {
            if (dealVolumeTimestamps[i] >= cutoffTime) {
                totalDealVolume += dealVolumes[i];
            }
        }

        uint256 oldCapacity = currentCapacity;
        currentCapacity = totalDealVolume * capacityMultiplier;

        lastCapacityUpdate = block.timestamp;

        emit CapacityUpdated(oldCapacity, currentCapacity, totalDealVolume, block.timestamp);

        // Try to promote waitlist stakers if capacity increased
        if (currentCapacity > oldCapacity) {
            _tryPromoteFromWaitlist();
        }
    }

    /**
     * @notice Check if staking is available (vault not full)
     * @param _amount Amount to stake
     * @return available Whether staking is available
     * @return shouldWaitlist Whether should be added to waitlist
     */
    function canStake(uint256 _amount) external view returns (bool available, bool shouldWaitlist) {
        // Get current staked from vault
        (uint256 currentStaked,,,) = INovaxStakingVault(stakingVault).getVaultStatus();
        uint256 afterStake = currentStaked + _amount;

        if (afterStake <= currentCapacity) {
            return (true, false); // Can stake directly
        } else if (currentStaked < currentCapacity) {
            // Partial capacity available
            uint256 availableSpace = currentCapacity - currentStaked;
            if (_amount <= availableSpace) {
                return (true, false); // Can stake partially
            } else {
                return (false, true); // Need waitlist for excess
            }
        } else {
            return (false, true); // Vault full, need waitlist
        }
    }

    /**
     * @notice Add staker to waitlist
     * @param _staker Staker address
     * @param _amount Amount to stake
     */
    function addToWaitlist(address _staker, uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        require(_staker != address(0), "Invalid staker address");
        require(_amount > 0, "Amount must be > 0");
        require(!isOnWaitlist[_staker], "Already on waitlist");

        waitlist.push(WaitlistEntry({
            staker: _staker,
            amount: _amount,
            joinedAt: block.timestamp,
            tempApyBps: waitlistTempApyBps,
            active: true
        }));

        uint256 position = waitlist.length - 1;
        waitlistPosition[_staker] = position;
        isOnWaitlist[_staker] = true;

        emit StakerAddedToWaitlist(_staker, _amount, position, block.timestamp);
    }

    /**
     * @notice Promote stakers from waitlist when capacity increases
     */
    function _tryPromoteFromWaitlist() internal {
        (uint256 currentStaked,,,) = INovaxStakingVault(stakingVault).getVaultStatus();
        uint256 availableSpace = currentCapacity > currentStaked ? currentCapacity - currentStaked : 0;

        if (availableSpace == 0) return;

        // Promote waitlist stakers in order (FIFO)
        for (uint256 i = 0; i < waitlist.length && availableSpace > 0; i++) {
            WaitlistEntry storage entry = waitlist[i];
            if (!entry.active) continue;

            if (entry.amount <= availableSpace) {
                // Can promote fully
                _promoteStaker(i, entry.amount);
                availableSpace -= entry.amount;
            } else {
                // Can promote partially
                uint256 promoteAmount = availableSpace;
                entry.amount -= promoteAmount;
                _promoteStaker(i, promoteAmount);
                availableSpace = 0;
            }
        }
    }

    /**
     * @notice Promote a staker from waitlist
     * @param _waitlistIndex Index in waitlist array
     * @param _amount Amount to promote
     */
    function _promoteStaker(uint256 _waitlistIndex, uint256 _amount) internal {
        WaitlistEntry storage entry = waitlist[_waitlistIndex];
        require(entry.active, "Entry not active");
        require(entry.amount >= _amount, "Insufficient waitlist amount");

        entry.amount -= _amount;
        if (entry.amount == 0) {
            entry.active = false;
            isOnWaitlist[entry.staker] = false;
            delete waitlistPosition[entry.staker];
        }

        emit StakerPromotedFromWaitlist(entry.staker, _amount, block.timestamp);
    }

    /**
     * @notice Manually promote stakers from waitlist (admin function)
     * @param _count Number of stakers to promote
     */
    function promoteFromWaitlist(uint256 _count) external onlyRole(ADMIN_ROLE) {
        uint256 promoted = 0;
        for (uint256 i = 0; i < waitlist.length && promoted < _count; i++) {
            WaitlistEntry storage entry = waitlist[i];
            if (entry.active) {
                (uint256 currentStaked,,,) = INovaxStakingVault(stakingVault).getVaultStatus();
                uint256 availableSpace = currentCapacity > currentStaked ? currentCapacity - currentStaked : 0;
                
                if (availableSpace > 0) {
                    uint256 promoteAmount = entry.amount <= availableSpace ? entry.amount : availableSpace;
                    _promoteStaker(i, promoteAmount);
                    promoted++;
                }
            }
        }
    }

    /**
     * @notice Update utilization tracking
     * @param _deployedCapital Capital deployed to receivables
     */
    function updateUtilization(uint256 _deployedCapital) external onlyRole(OPERATOR_ROLE) {
        totalDeployedCapital = _deployedCapital;
        (totalStakedCapital,,,) = INovaxStakingVault(stakingVault).getVaultStatus();

        uint256 utilizationBps = totalStakedCapital > 0
            ? (totalDeployedCapital * 10000) / totalStakedCapital
            : 0;

        emit UtilizationUpdated(totalDeployedCapital, totalStakedCapital, utilizationBps, block.timestamp);
    }

    /**
     * @notice Get current utilization rate
     * @return utilizationBps Utilization in basis points (e.g., 8000 = 80%)
     */
    function getUtilization() external view returns (uint256 utilizationBps) {
        (uint256 staked,,,) = INovaxStakingVault(stakingVault).getVaultStatus();
        if (staked == 0) return 0;
        return (totalDeployedCapital * 10000) / staked;
    }

    /**
     * @notice Get waitlist information
     * @return totalWaitlist Total amount on waitlist
     * @return waitlistCount Number of active waitlist entries
     */
    function getWaitlistInfo() external view returns (uint256 totalWaitlist, uint256 waitlistCount) {
        for (uint256 i = 0; i < waitlist.length; i++) {
            if (waitlist[i].active) {
                totalWaitlist += waitlist[i].amount;
                waitlistCount++;
            }
        }
    }

    /**
     * @notice Get staker's waitlist position
     * @param _staker Staker address
     * @return position Position in waitlist (0 = first, -1 if not on waitlist)
     * @return amount Amount on waitlist
     */
    function getWaitlistPosition(address _staker) external view returns (int256 position, uint256 amount) {
        if (!isOnWaitlist[_staker]) {
            return (-1, 0);
        }

        uint256 index = waitlistPosition[_staker];
        WaitlistEntry memory entry = waitlist[index];
        
        // Calculate position (how many active entries before this one)
        position = 0;
        for (uint256 i = 0; i < index; i++) {
            if (waitlist[i].active) {
                position++;
            }
        }

        amount = entry.amount;
    }

    /**
     * @notice Set capacity multiplier
     * @param _multiplier New multiplier (e.g., 3 = 3x deal volume)
     */
    function setCapacityMultiplier(uint256 _multiplier) external onlyRole(ADMIN_ROLE) {
        require(_multiplier > 0 && _multiplier <= 10, "Invalid multiplier");
        capacityMultiplier = _multiplier;
        updateCapacity();
    }

    /**
     * @notice Set waitlist temporary APY
     * @param _apyBps APY in basis points (e.g., 300 = 3%)
     */
    function setWaitlistTempApy(uint256 _apyBps) external onlyRole(ADMIN_ROLE) {
        require(_apyBps <= 1000, "APY cannot exceed 10%");
        waitlistTempApyBps = _apyBps;
    }

    /**
     * @notice Set capacity update interval
     * @param _interval New interval in seconds
     */
    function setCapacityUpdateInterval(uint256 _interval) external onlyRole(ADMIN_ROLE) {
        require(_interval >= 1 days, "Interval too short");
        capacityUpdateInterval = _interval;
    }

    /**
     * @notice Emergency: Remove from waitlist
     * @param _staker Staker address
     */
    function removeFromWaitlist(address _staker) external onlyRole(ADMIN_ROLE) {
        require(isOnWaitlist[_staker], "Not on waitlist");
        uint256 index = waitlistPosition[_staker];
        waitlist[index].active = false;
        isOnWaitlist[_staker] = false;
        delete waitlistPosition[_staker];
    }

    /**
     * @notice Get vault status
     * @return capacity Current capacity
     * @return staked Current staked amount
     * @return available Available space
     * @return utilizationBps Utilization in basis points
     * @return waitlistTotal Total on waitlist
     */
    function getVaultStatus() external view returns (
        uint256 capacity,
        uint256 staked,
        uint256 available,
        uint256 utilizationBps,
        uint256 waitlistTotal
    ) {
        capacity = currentCapacity;
        (staked,,,) = INovaxStakingVault(stakingVault).getVaultStatus();
        available = capacity > staked ? capacity - staked : 0;
        utilizationBps = staked > 0 ? (totalDeployedCapital * 10000) / staked : 0;
        
        for (uint256 i = 0; i < waitlist.length; i++) {
            if (waitlist[i].active) {
                waitlistTotal += waitlist[i].amount;
            }
        }
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}

