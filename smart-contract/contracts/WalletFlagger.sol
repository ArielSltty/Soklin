// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title WalletFlagger
 * @dev Smart contract for flagging and managing high-risk wallets on-chain
 * @author Soklin Project
 * 
 * Features:
 * - Flag suspicious wallets with reputation scores
 * - Multi-level risk categorization
 * - Time-based flagging with expiration
 * - Admin and automated system roles
 * - Event logging for transparency
 * - Batch operations for efficiency
 */
contract WalletFlagger {
    
    // Enums
    enum RiskLevel { 
        LOW,        // 0 - Normal wallet
        MEDIUM,     // 1 - Suspicious activity
        HIGH,       // 2 - High risk
        CRITICAL    // 3 - Confirmed fraud
    }
    
    // Structs
    struct WalletFlag {
        bool isFlagged;
        RiskLevel riskLevel;
        uint256 reputationScore;
        uint256 flaggedAt;
        uint256 expiresAt;
        address flaggedBy;
        string reason;
    }
    
    // State Variables
    address public owner;
    address public soklinBackend;
    
    mapping(address => WalletFlag) public flaggedWallets;
    mapping(address => bool) public authorizedFlaggers;
    mapping(RiskLevel => uint256) public riskLevelThresholds;
    
    address[] public allFlaggedWallets;
    
    // Constants
    uint256 public constant DEFAULT_FLAG_DURATION = 30 days;
    uint256 public constant MAX_FLAG_DURATION = 365 days;
    uint256 public constant MIN_REPUTATION_SCORE = 0;
    uint256 public constant MAX_REPUTATION_SCORE = 100;
    
    // Events
    event WalletFlagged(
        address indexed wallet,
        RiskLevel riskLevel,
        uint256 reputationScore,
        uint256 expiresAt,
        address flaggedBy,
        string reason
    );
    
    event WalletUnflagged(address indexed wallet, address unflaggedBy);
    event RiskLevelUpdated(address indexed wallet, RiskLevel newRiskLevel);
    event BackendUpdated(address indexed oldBackend, address indexed newBackend);
    event FlaggerAuthorized(address indexed flagger, bool authorized);
    event EmergencyPaused(bool paused);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "WalletFlagger: caller is not owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            msg.sender == owner || 
            msg.sender == soklinBackend || 
            authorizedFlaggers[msg.sender],
            "WalletFlagger: not authorized"
        );
        _;
    }
    
    modifier notFlagged(address wallet) {
        require(!flaggedWallets[wallet].isFlagged, "WalletFlagger: wallet already flagged");
        _;
    }
    
    modifier isFlagged(address wallet) {
        require(flaggedWallets[wallet].isFlagged, "WalletFlagger: wallet not flagged");
        _;
    }
    
    modifier validRiskLevel(RiskLevel riskLevel) {
        require(uint(riskLevel) <= uint(RiskLevel.CRITICAL), "WalletFlagger: invalid risk level");
        _;
    }
    
    modifier validReputationScore(uint256 score) {
        require(score >= MIN_REPUTATION_SCORE && score <= MAX_REPUTATION_SCORE, "WalletFlagger: invalid reputation score");
        _;
    }
    
    // Constructor
    constructor() {
        owner = msg.sender;
        soklinBackend = msg.sender;
        
        // Initialize risk level thresholds (reputation scores)
        riskLevelThresholds[RiskLevel.LOW] = 70;      // 70-100: Low risk
        riskLevelThresholds[RiskLevel.MEDIUM] = 50;   // 50-69: Medium risk  
        riskLevelThresholds[RiskLevel.HIGH] = 30;     // 30-49: High risk
        riskLevelThresholds[RiskLevel.CRITICAL] = 0;  // 0-29: Critical risk
        
        // Authorize deployer initially
        authorizedFlaggers[msg.sender] = true;
    }
    
    /**
     * @dev Flag a wallet with specified risk level and reputation score
     * @param wallet The wallet address to flag
     * @param reputationScore The calculated reputation score (0-100)
     * @param reason Reason for flagging
     */
    function flagWallet(
        address wallet,
        uint256 reputationScore,
        string calldata reason
    ) 
        external 
        onlyAuthorized
        notFlagged(wallet)
        validReputationScore(reputationScore)
    {
        RiskLevel riskLevel = _calculateRiskLevel(reputationScore);
        uint256 expiresAt = block.timestamp + _calculateFlagDuration(riskLevel);
        
        flaggedWallets[wallet] = WalletFlag({
            isFlagged: true,
            riskLevel: riskLevel,
            reputationScore: reputationScore,
            flaggedAt: block.timestamp,
            expiresAt: expiresAt,
            flaggedBy: msg.sender,
            reason: reason
        });
        
        allFlaggedWallets.push(wallet);
        
        emit WalletFlagged(
            wallet,
            riskLevel,
            reputationScore,
            expiresAt,
            msg.sender,
            reason
        );
    }
    
    /**
     * @dev Batch flag multiple wallets (gas efficient)
     * @param wallets Array of wallet addresses to flag
     * @param reputationScores Array of reputation scores
     * @param reasons Array of reasons for flagging
     */
    function batchFlagWallets(
        address[] calldata wallets,
        uint256[] calldata reputationScores,
        string[] calldata reasons
    ) 
        external 
        onlyAuthorized
    {
        require(
            wallets.length == reputationScores.length && 
            wallets.length == reasons.length,
            "WalletFlagger: array length mismatch"
        );
        
        for (uint256 i = 0; i < wallets.length; i++) {
            if (!flaggedWallets[wallets[i]].isFlagged) {
                _flagSingleWallet(wallets[i], reputationScores[i], reasons[i]);
            }
        }
    }
    
    /**
     * @dev Unflag a wallet manually
     * @param wallet The wallet address to unflag
     */
    function unflagWallet(address wallet) 
        external 
        onlyAuthorized 
        isFlagged(wallet)
    {
        _unflagWallet(wallet);
    }
    
    /**
     * @dev Batch unflag multiple wallets
     * @param wallets Array of wallet addresses to unflag
     */
    function batchUnflagWallets(address[] calldata wallets) 
        external 
        onlyAuthorized
    {
        for (uint256 i = 0; i < wallets.length; i++) {
            if (flaggedWallets[wallets[i]].isFlagged) {
                _unflagWallet(wallets[i]);
            }
        }
    }
    
    /**
     * @dev Update risk level of a flagged wallet
     * @param wallet The wallet address to update
     * @param newRiskLevel New risk level
     */
    function updateRiskLevel(address wallet, RiskLevel newRiskLevel) 
        external 
        onlyAuthorized 
        isFlagged(wallet)
        validRiskLevel(newRiskLevel)
    {
        flaggedWallets[wallet].riskLevel = newRiskLevel;
        flaggedWallets[wallet].expiresAt = block.timestamp + _calculateFlagDuration(newRiskLevel);
        
        emit RiskLevelUpdated(wallet, newRiskLevel);
    }
    
    /**
     * @dev Check if a wallet is currently flagged (including expiration)
     * @param wallet The wallet address to check
     * @return bool True if wallet is actively flagged
     */
    function isWalletFlagged(address wallet) external view returns (bool) {
        return _isWalletFlagged(wallet);
    }
    
    /**
     * @dev Internal function to check if a wallet is currently flagged (including expiration)
     * @param wallet The wallet address to check
     * @return bool True if wallet is actively flagged
     */
    function _isWalletFlagged(address wallet) internal view returns (bool) {
        WalletFlag memory flag = flaggedWallets[wallet];
        if (!flag.isFlagged) return false;
        if (block.timestamp > flag.expiresAt) return false;
        return true;
    }
    
    /**
     * @dev Get detailed flag information for a wallet
     * @param wallet The wallet address
     * @return WalletFlag struct with all flag details
     */
    function getWalletFlag(address wallet) 
        external 
        view 
        returns (WalletFlag memory) 
    {
        return flaggedWallets[wallet];
    }
    
    /**
     * @dev Get all flagged wallet addresses
     * @return Array of all flagged wallet addresses
     */
    function getAllFlaggedWallets() external view returns (address[] memory) {
        return allFlaggedWallets;
    }
    
    /**
     * @dev Get count of currently active flagged wallets
     * @return count Number of active flagged wallets
     */
    function getActiveFlaggedCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < allFlaggedWallets.length; i++) {
            if (_isWalletFlagged(allFlaggedWallets[i])) {
                count++;
            }
        }
    }
    
    /**
     * @dev Clean up expired flags (anyone can call to maintain state)
     */
    function cleanupExpiredFlags() external {
        for (uint256 i = 0; i < allFlaggedWallets.length; i++) {
            address wallet = allFlaggedWallets[i];
            if (flaggedWallets[wallet].isFlagged && block.timestamp > flaggedWallets[wallet].expiresAt) {
                _unflagWallet(wallet);
            }
        }
    }
    
    // Admin Functions
    
    /**
     * @dev Update the Soklin backend address
     * @param newBackend New backend address
     */
    function updateSoklinBackend(address newBackend) external onlyOwner {
        require(newBackend != address(0), "WalletFlagger: invalid backend address");
        address oldBackend = soklinBackend;
        soklinBackend = newBackend;
        
        emit BackendUpdated(oldBackend, newBackend);
    }
    
    /**
     * @dev Authorize or deauthorize a flagger address
     * @param flagger Address to update authorization
     * @param authorized True to authorize, false to deauthorize
     */
    function setFlaggerAuthorization(address flagger, bool authorized) external onlyOwner {
        authorizedFlaggers[flagger] = authorized;
        emit FlaggerAuthorized(flagger, authorized);
    }
    
    /**
     * @dev Update risk level thresholds
     * @param riskLevel The risk level to update
     * @param threshold New threshold value
     */
    function updateRiskThreshold(RiskLevel riskLevel, uint256 threshold) 
        external 
        onlyOwner 
        validRiskLevel(riskLevel)
        validReputationScore(threshold)
    {
        riskLevelThresholds[riskLevel] = threshold;
    }
    
    // Internal Functions
    
    function _flagSingleWallet(
        address wallet,
        uint256 reputationScore,
        string memory reason
    ) 
        internal 
    {
        RiskLevel riskLevel = _calculateRiskLevel(reputationScore);
        uint256 expiresAt = block.timestamp + _calculateFlagDuration(riskLevel);
        
        flaggedWallets[wallet] = WalletFlag({
            isFlagged: true,
            riskLevel: riskLevel,
            reputationScore: reputationScore,
            flaggedAt: block.timestamp,
            expiresAt: expiresAt,
            flaggedBy: msg.sender,
            reason: reason
        });
        
        allFlaggedWallets.push(wallet);
        
        emit WalletFlagged(
            wallet,
            riskLevel,
            reputationScore,
            expiresAt,
            msg.sender,
            reason
        );
    }
    
    function _unflagWallet(address wallet) internal {
        delete flaggedWallets[wallet];
        emit WalletUnflagged(wallet, msg.sender);
    }
    
    function _calculateRiskLevel(uint256 reputationScore) 
        internal 
        view 
        returns (RiskLevel) 
    {
        if (reputationScore >= riskLevelThresholds[RiskLevel.LOW]) {
            return RiskLevel.LOW;
        } else if (reputationScore >= riskLevelThresholds[RiskLevel.MEDIUM]) {
            return RiskLevel.MEDIUM;
        } else if (reputationScore >= riskLevelThresholds[RiskLevel.HIGH]) {
            return RiskLevel.HIGH;
        } else {
            return RiskLevel.CRITICAL;
        }
    }
    
    function _calculateFlagDuration(RiskLevel riskLevel) 
        internal 
        pure 
        returns (uint256) 
    {
        if (riskLevel == RiskLevel.CRITICAL) {
            return 365 days; // 1 year for critical risks
        } else if (riskLevel == RiskLevel.HIGH) {
            return 180 days; // 6 months for high risks
        } else if (riskLevel == RiskLevel.MEDIUM) {
            return 90 days;  // 3 months for medium risks
        } else {
            return 30 days;  // 1 month for low risks
        }
    }
    
    // Utility function to check contract version
    function getVersion() external pure returns (string memory) {
        return "WalletFlagger v1.0.0";
    }
    
    // Emergency function to transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "WalletFlagger: invalid owner address");
        owner = newOwner;
    }
}