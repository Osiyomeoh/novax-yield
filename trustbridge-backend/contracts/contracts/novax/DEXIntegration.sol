// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DEXIntegration
 * @dev Interface for DEX integration (Uniswap V2/V3, SushiSwap, etc.)
 * @notice Handles USDC to NVX swaps via DEX
 */
interface IDEXRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

/**
 * @title DEXIntegration
 * @dev Contract for integrating with DEX for USDC → NVX swaps
 * @notice Supports multiple DEX routers (Uniswap V2, SushiSwap, etc.)
 */
contract DEXIntegration is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public usdcToken;       // USDC token (6 decimals)
    IERC20 public nvxToken;          // NVX token (18 decimals)
    address public dexRouter;       // DEX router address (Uniswap V2, SushiSwap, etc.)
    address public wxtzToken;      // Wrapped XTZ token address (for routing)

    uint256 public slippageToleranceBps = 300; // 3% slippage tolerance
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    // Statistics
    uint256 public totalSwapped;           // Total USDC swapped
    uint256 public totalNVXReceived;        // Total NVX received
    uint256 public totalSwaps;              // Number of swaps executed

    // Events
    event SwapExecuted(
        address indexed caller,
        uint256 usdcAmount,
        uint256 nvxAmount,
        uint256 slippage,
        uint256 timestamp
    );

    event DEXRouterUpdated(address oldRouter, address newRouter);
    event SlippageToleranceUpdated(uint256 oldTolerance, uint256 newTolerance);

    constructor(
        address _usdcToken,
        address _nvxToken,
        address _dexRouter,
        address _wxtzToken
    ) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_nvxToken != address(0), "Invalid NVX address");
        require(_dexRouter != address(0), "Invalid DEX router");
        require(_wxtzToken != address(0), "Invalid WXTZ address");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        usdcToken = IERC20(_usdcToken);
        nvxToken = IERC20(_nvxToken);
        dexRouter = _dexRouter;
        wxtzToken = _wxtzToken;

        // Approve DEX router to spend USDC
        // Note: Using forceApprove for max approval (safeApprove is deprecated)
        usdcToken.forceApprove(_dexRouter, type(uint256).max);
    }

    /**
     * @notice Swap USDC for NVX via DEX
     * @param _usdcAmount Amount of USDC to swap (6 decimals)
     * @param _minNVXAmount Minimum NVX amount to receive (18 decimals)
     * @return nvxAmount Amount of NVX received
     */
    function swapUSDCForNVX(uint256 _usdcAmount, uint256 _minNVXAmount)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 nvxAmount)
    {
        require(_usdcAmount > 0, "Amount must be > 0");
        require(_minNVXAmount > 0, "Min amount must be > 0");

        // Transfer USDC from caller
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcAmount);

        // Get expected output amount
        address[] memory path = new address[](3);
        path[0] = address(usdcToken);  // USDC
        path[1] = wxtzToken;           // WXTZ (intermediate)
        path[2] = address(nvxToken);    // NVX

        uint256[] memory amounts = IDEXRouter(dexRouter).getAmountsOut(_usdcAmount, path);
        uint256 expectedNVX = amounts[2];

        // Calculate minimum with slippage tolerance
        uint256 minWithSlippage = (expectedNVX * (BASIS_POINTS_DENOMINATOR - slippageToleranceBps)) / BASIS_POINTS_DENOMINATOR;
        require(_minNVXAmount <= minWithSlippage, "Min amount too high");

        // Execute swap
        uint256 balanceBefore = nvxToken.balanceOf(address(this));
        IDEXRouter(dexRouter).swapExactTokensForTokens(
            _usdcAmount,
            _minNVXAmount,
            path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );
        uint256 balanceAfter = nvxToken.balanceOf(address(this));
        nvxAmount = balanceAfter - balanceBefore;

        require(nvxAmount >= _minNVXAmount, "Insufficient NVX received");

        // Update statistics
        totalSwapped += _usdcAmount;
        totalNVXReceived += nvxAmount;
        totalSwaps++;

        // Calculate actual slippage
        uint256 slippage = expectedNVX > nvxAmount 
            ? ((expectedNVX - nvxAmount) * BASIS_POINTS_DENOMINATOR) / expectedNVX
            : 0;

        emit SwapExecuted(msg.sender, _usdcAmount, nvxAmount, slippage, block.timestamp);

        return nvxAmount;
    }

    /**
     * @notice Get expected NVX amount for USDC amount
     * @param _usdcAmount Amount of USDC (6 decimals)
     * @return expectedNVX Expected NVX amount (18 decimals)
     */
    function getExpectedNVXAmount(uint256 _usdcAmount) external view returns (uint256 expectedNVX) {
        address[] memory path = new address[](3);
        path[0] = address(usdcToken);
        path[1] = wxtzToken;
        path[2] = address(nvxToken);

        uint256[] memory amounts = IDEXRouter(dexRouter).getAmountsOut(_usdcAmount, path);
        return amounts[2];
    }

    /**
     * @notice Get minimum NVX amount with slippage
     * @param _usdcAmount Amount of USDC (6 decimals)
     * @return minNVX Minimum NVX amount (18 decimals)
     */
    function getMinNVXAmount(uint256 _usdcAmount) external view returns (uint256 minNVX) {
        uint256 expected = this.getExpectedNVXAmount(_usdcAmount);
        return (expected * (BASIS_POINTS_DENOMINATOR - slippageToleranceBps)) / BASIS_POINTS_DENOMINATOR;
    }

    /**
     * @notice Transfer NVX to recipient
     * @param _recipient Recipient address
     * @param _amount Amount of NVX to transfer
     */
    function transferNVX(address _recipient, uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        nvxToken.safeTransfer(_recipient, _amount);
    }

    /**
     * @notice Set DEX router address
     */
    function setDEXRouter(address _newRouter) external onlyRole(ADMIN_ROLE) {
        require(_newRouter != address(0), "Invalid router");
        
        // Revoke old approval
        usdcToken.forceApprove(dexRouter, 0);
        
        address oldRouter = dexRouter;
        dexRouter = _newRouter;
        
        // Approve new router
        usdcToken.forceApprove(_newRouter, type(uint256).max);
        
        emit DEXRouterUpdated(oldRouter, _newRouter);
    }

    /**
     * @notice Set slippage tolerance
     */
    function setSlippageTolerance(uint256 _toleranceBps) external onlyRole(ADMIN_ROLE) {
        require(_toleranceBps <= 1000, "Tolerance must be <= 10%");
        uint256 oldTolerance = slippageToleranceBps;
        slippageToleranceBps = _toleranceBps;
        emit SlippageToleranceUpdated(oldTolerance, _toleranceBps);
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw tokens
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20 token = IERC20(_token);
        token.safeTransfer(msg.sender, _amount);
    }
}

