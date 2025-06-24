// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./DemetraToken.sol";
import "./ProposalManager.sol";
import "./VotingStrategies.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title DemetraDAO
 * @dev DAO contract for the handling of proposals, voting, and token management.
 */
contract DemetraDAO is AccessControl, ReentrancyGuard, Pausable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    
    // Contracts related
    DemetraToken public immutable demetraToken;
    ProposalManager public immutable proposalManager;
    VotingStrategies public immutable votingStrategies;
    
    // Token sale config
    bool public tokenSaleActive;
    uint256 public tokenPrice;
    uint256 public constant MIN_PURCHASE = 1 ether;
    uint256 public constant MAX_PURCHASE = 10000 ether;
    uint256 public maxTotalSupply;
    
    // Members
    struct Member {
        bool isActive;
        uint256 joinedAt;
        uint256 tokensOwned;
        uint256 proposalsCreated;
        uint256 votesParticipated;
    }
    
    mapping(address => Member) public members;
    address[] public membersList;
    uint256 public totalMembers;
    
    // Treasury
    uint256 public treasuryBalance;
    
    // Stats
    uint256 public totalProposalsCreated;
    uint256 public totalVotesCast;
    uint256 public totalFundsRaised;
    
    // Essential events
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event MemberJoined(address indexed member, uint256 tokensOwned);
    event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer);
    event VoteRecorded(uint256 indexed proposalId, address indexed voter);
    event TokenSaleStatusChanged(bool active);
    event TreasuryDeposit(address indexed from, uint256 amount);
    event TreasuryWithdrawal(address indexed to, uint256 amount, string reason);
    event EmergencyPause(address indexed admin);
    event EmergencyUnpause(address indexed admin);
    
    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint256 _tokenPrice,
        uint256 _maxTotalSupply,
        address admin
    ) {
        require(_tokenPrice > 0, "DemetraDAO: token price must be positive");
        require(_maxTotalSupply > 0, "DemetraDAO: max supply must be positive");
        require(admin != address(0), "DemetraDAO: admin cannot be zero address");
        
        // Related contracts deploy 
        demetraToken = new DemetraToken(tokenName, tokenSymbol, address(this));
        proposalManager = new ProposalManager(address(this));
        votingStrategies = new VotingStrategies(
            address(demetraToken),
            address(proposalManager),
            address(this)
        );
        
        // Config
        tokenPrice = _tokenPrice;
        maxTotalSupply = _maxTotalSupply;
        tokenSaleActive = true;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);
        
        // Grant DAO_ROLE to VotingStrategies
        bytes32 DAO_ROLE = keccak256("DAO_ROLE");
        proposalManager.grantRole(DAO_ROLE, address(votingStrategies));
        
        // Adds admin as first member
        _addMember(admin, 0);
    }
    
    /**
     * @dev  Purchasing token/s
     */
    function purchaseTokens() external payable nonReentrant whenNotPaused {
        require(tokenSaleActive, "DemetraDAO: token sale not active");
        
        uint256 tokensToMint = (msg.value * 1 ether) / tokenPrice;
        require(tokensToMint >= MIN_PURCHASE, "DemetraDAO: purchase below minimum");
        require(tokensToMint <= MAX_PURCHASE, "DemetraDAO: purchase above maximum");
        require(tokensToMint > 0, "DemetraDAO: insufficient payment");
        require(msg.value % tokenPrice == 0, "DemetraDAO: send exact amount");
        
        uint256 newTotalSupply = demetraToken.totalSupply() + tokensToMint;
        require(newTotalSupply <= maxTotalSupply, "DemetraDAO: would exceed max supply");
        
        // Mint token
        demetraToken.mint(msg.sender, tokensToMint);
        
        // Membership handling
        if (!members[msg.sender].isActive) {
            _addMember(msg.sender, tokensToMint);
        } else {
            members[msg.sender].tokensOwned += tokensToMint;
        }
        
        // Actualize treasury
        treasuryBalance += msg.value;
        totalFundsRaised += msg.value;
        
        emit TokensPurchased(msg.sender, tokensToMint, msg.value);
    }
    
    /**
     * @dev Proposal creation
     */
    function createProposal(
        string memory title,
        string memory description,
        ProposalManager.VotingStrategy strategy,
        VotingStrategies.ProposalCategory category,
        ProposalManager.ProposalAction[] memory actions
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(members[msg.sender].isActive, "DemetraDAO: only members can create proposals");
        require(demetraToken.balanceOf(msg.sender) >= 100 ether, "DemetraDAO: insufficient tokens to propose");
        
        // Get parameters
        (uint256 quorum, uint256 threshold, uint256 votingPeriod) = 
            votingStrategies.getSuggestedParameters(strategy);
        
        // Create snapshot
        uint256 snapshotId = demetraToken.snapshot();
        
        // Create proposal
        uint256 proposalId = proposalManager.createProposal(
            msg.sender,
            title,
            description,
            votingPeriod,
            strategy,
            quorum,
            threshold,
            actions,
            snapshotId
        );
        
        // Categorize if necessary
        if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            votingStrategies.categorizeProposal(proposalId, category);
        }
        
        // Actualize stats
        members[msg.sender].proposalsCreated++;
        totalProposalsCreated++;
        
        emit ProposalSubmitted(proposalId, msg.sender);
        return proposalId;
    }
    
    /**
     * @dev Voting
     */
    function vote(
        uint256 proposalId,
        ProposalManager.VoteChoice choice
    ) external nonReentrant whenNotPaused {
        require(members[msg.sender].isActive, "DemetraDAO: only members can vote");
        require(!proposalManager.hasVoted(proposalId, msg.sender), "DemetraDAO: already voted");
        
        // Delegate to VotingStrategies
        votingStrategies.vote(proposalId, msg.sender, choice);
        
        // Actualize stats
        members[msg.sender].votesParticipated++;
        totalVotesCast++;
        
        emit VoteRecorded(proposalId, msg.sender);
    }
    
    /**
     * @dev Finalize proposal
     */
    function finalizeProposal(uint256 proposalId) external nonReentrant {
        uint256 totalSupply = demetraToken.totalSupply();
        proposalManager.finalizeProposal(proposalId, totalSupply);
    }
    
    /**
     * @dev Check if a voter can vote on a proposal
     */
    function canVote(address voter, uint256 proposalId) external view returns (bool, string memory) {
        if (!members[voter].isActive) {
            return (false, "Not a member");
        }
        if (proposalManager.hasVoted(proposalId, voter)) {
            return (false, "Already voted");
        }
        if (demetraToken.getVotes(voter) == 0) {
            return (false, "No voting power");
        }
        return (true, "Can vote");
    }
    
    // Treasury simplified
    
    function depositToTreasury() external payable {
        require(msg.value > 0, "DemetraDAO: deposit must be positive");
        treasuryBalance += msg.value;
        emit TreasuryDeposit(msg.sender, msg.value);
    }
    
    function withdrawFromTreasury(
        address payable to,
        uint256 amount,
        string memory reason
    ) external onlyRole(TREASURER_ROLE) nonReentrant {
        require(to != address(0), "DemetraDAO: cannot withdraw to zero address");
        require(amount > 0, "DemetraDAO: withdrawal amount must be positive");
        require(amount <= treasuryBalance, "DemetraDAO: insufficient treasury balance");
        require(bytes(reason).length > 0, "DemetraDAO: reason required");
        
        treasuryBalance -= amount;
        to.transfer(amount);
        
        emit TreasuryWithdrawal(to, amount, reason);
    }
    
    // Reading functions
    
    function isMember(address account) external view returns (bool) {
        return members[account].isActive;
    }
    
    function getMemberInfo(address member) external view returns (
        bool isActive,
        uint256 joinedAt,
        uint256 tokensOwned,
        uint256 proposalsCreated,
        uint256 votesParticipated
    ) {
        Member storage memberInfo = members[member];
        return (
            memberInfo.isActive,
            memberInfo.joinedAt,
            memberInfo.tokensOwned,
            memberInfo.proposalsCreated,
            memberInfo.votesParticipated
        );
    }
    
    function getDAOStats() external view returns (
        uint256 _totalMembers,
        uint256 _totalProposalsCreated,
        uint256 _totalVotesCast,
        uint256 _totalFundsRaised,
        uint256 _treasuryBalance,
        uint256 _tokenSupply,
        bool _tokenSaleActive
    ) {
        return (
            totalMembers,
            totalProposalsCreated,
            totalVotesCast,
            totalFundsRaised,
            treasuryBalance,
            demetraToken.totalSupply(),
            tokenSaleActive
        );
    }
    
    function calculateTokenCost(uint256 tokenAmount) external view returns (uint256) {
        return (tokenAmount * tokenPrice) / 1 ether; //always checks types for tests
    }
    
    // Admin functions
    
    function disableTokenSale() external onlyRole(ADMIN_ROLE) {
        tokenSaleActive = false;
        emit TokenSaleStatusChanged(false);
    }
    
    function enableTokenSale() external onlyRole(ADMIN_ROLE) {
        tokenSaleActive = true;
        emit TokenSaleStatusChanged(true);
    }
    
    function updateTokenPrice(uint256 newPrice) external onlyRole(ADMIN_ROLE) {
        require(newPrice > 0, "DemetraDAO: price must be positive");
        tokenPrice = newPrice;
    }
    
    function emergencyPause() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender);
    }
    
    function emergencyUnpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }
    
    // Internal functions
    
    function _addMember(address account, uint256 tokensOwned) internal {
        require(account != address(0), "DemetraDAO: invalid address");
        require(!members[account].isActive, "DemetraDAO: already a member");

        members[account] = Member({
            isActive: true,
            joinedAt: block.timestamp,
            tokensOwned: tokensOwned,
            proposalsCreated: 0,
            votesParticipated: 0
        });

        membersList.push(account);
        totalMembers++;

        emit MemberJoined(account, tokensOwned);
    }
    
    // Fallback to get ETH
    receive() external payable {
        treasuryBalance += msg.value;
        emit TreasuryDeposit(msg.sender, msg.value);
    }
}