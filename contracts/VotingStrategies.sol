// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./DemetraToken.sol";
import "./ProposalManager.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

/**
 * @title VotingStrategies
 * @dev CENTRALIZES all voting logic for the Demetra DAO
 * Responsible for: voting power calculation, delegations, vote execution
 */
contract VotingStrategies is AccessControl, ReentrancyGuard {
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    
    DemetraToken public immutable demetraToken;
    ProposalManager public immutable proposalManager;
    
    // Struttura per deleghe per categoria
    struct CategoryDelegation {
        address delegate;
        bool active;
        uint256 fromBlock;
    }
    
    // Proposal categories for liquid democracy
    enum ProposalCategory {
        GENERAL,        // 0 - General category (default)
        STRATEGIC,      // 1 - Strategic decisions
        OPERATIONAL,    // 2 - Operational decisions
        TECHNICAL,      // 3 - Technical decisions
        GOVERNANCE      // 4 - Governance changes
    }
    
    // Mapping for category-based delegations
    mapping(address => mapping(ProposalCategory => CategoryDelegation)) public categoryDelegations;
    
    // Mapping for delegated votes per category
    mapping(address => mapping(ProposalCategory => uint256)) public categoryDelegatedVotes;
    
    // Mapping for proposal categories
    mapping(uint256 => ProposalCategory) public proposalCategories;
    
    // Parameters for strategies
    struct StrategyParameters {
        uint256 directQuorum;
        uint256 directThreshold;
        uint256 liquidQuorum;
        uint256 liquidThreshold;
        uint256 consensusQuorum;
        uint256 consensusThreshold;
        uint256 votingPeriodDirect;
        uint256 votingPeriodLiquid;
        uint256 votingPeriodConsensus;
    }
    
    StrategyParameters public strategyParams;
    
    // Eventi
    event CategoryDelegated(
        address indexed delegator,
        address indexed delegate,
        ProposalCategory indexed category
    );
    
    event CategoryDelegationRevoked(
        address indexed delegator,
        address indexed delegate,
        ProposalCategory indexed category
    );
    
    event VoteCastWithStrategy(
        uint256 indexed proposalId,
        address indexed voter,
        ProposalManager.VoteChoice choice,
        uint256 votingPower,
        ProposalManager.VotingStrategy strategy
    );
    
    event ProposalCategorized(
        uint256 indexed proposalId,
        ProposalCategory indexed category
    );
    
    constructor(
        address _demetraToken,
        address _proposalManager,
        address admin
    ) {
        require(_demetraToken != address(0), "VotingStrategies: token address cannot be zero");
        require(_proposalManager != address(0), "VotingStrategies: proposal manager address cannot be zero");
        require(admin != address(0), "VotingStrategies: admin address cannot be zero");
        
        demetraToken = DemetraToken(_demetraToken);
        proposalManager = ProposalManager(_proposalManager);
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DAO_ROLE, admin);
        
        // Default strategy parameters (on a scale of 10.000)
        strategyParams = StrategyParameters({
            directQuorum: 3000,        // 30%
            directThreshold: 6000,     // 60%
            liquidQuorum: 2000,        // 20%
            liquidThreshold: 5000,     // 50%
            consensusQuorum: 4000,     // 40%
            consensusThreshold: 7500,  // 75%
            votingPeriodDirect: 7 days,
            votingPeriodLiquid: 3 days,
            votingPeriodConsensus: 14 days
        });
    }
    
    /**
     * @dev MAIN VOTE FUNCTION - called by DemetraDAO
     * Handles voting logic based on the strategy and calculates effective voting power
     */
    function vote(
        uint256 proposalId,
        address voter,
        ProposalManager.VoteChoice choice
    ) external onlyRole(DAO_ROLE) nonReentrant {
        console.log("VotingStrategies.vote called for proposal %s by voter %s", proposalId, voter);
        
        // Verify if the voter has voting power
        uint256 baseVotingPower = demetraToken.getVotes(voter);
        console.log("Base voting power for voter %s: %s", voter, baseVotingPower);
        require(baseVotingPower > 0, "VotingStrategies: no voting power");
        
        // Get proposal details
        (, , , , , , ProposalManager.VotingStrategy strategy, ) = proposalManager.getProposal(proposalId);
        console.log("Proposal %s uses strategy: %s", proposalId, uint256(strategy));
        
        // Calculate effective voting power based on the strategy
        uint256 effectiveVotingPower = _calculateEffectiveVotingPower(voter, proposalId, strategy);
        console.log("Effective voting power calculated: %s", effectiveVotingPower);
        
        // Execute vote by ProposalManager
        proposalManager.castVote(proposalId, voter, choice, effectiveVotingPower);
        
        emit VoteCastWithStrategy(proposalId, voter, choice, effectiveVotingPower, strategy);
    }
    
    /**
     * @dev Calculate effective voting power based for each strategy  
     */
    function _calculateEffectiveVotingPower(
        address voter,
        uint256 proposalId,
        ProposalManager.VotingStrategy strategy
    ) internal view returns (uint256) {
        uint256 baseVotingPower = demetraToken.getVotes(voter);
        console.log("Calculating effective voting power for voter %s with base power %s", voter, baseVotingPower);
        
        if (strategy == ProposalManager.VotingStrategy.DIRECT) {
            console.log("Using DIRECT strategy - returning base power: %s", baseVotingPower);
            return baseVotingPower;
            
        } else if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            ProposalCategory category = proposalCategories[proposalId];
            uint256 categoryDelegatedPower = categoryDelegatedVotes[voter][category];
            uint256 totalPower = baseVotingPower + categoryDelegatedPower;
            console.log("Using LIQUID strategy - base: %s, delegated: %s, total: %s", 
                       baseVotingPower, categoryDelegatedPower, totalPower);
            return totalPower;
            
        } else if (strategy == ProposalManager.VotingStrategy.CONSENSUS) {
            // In consensus strategy, we return 1 if the voter has any voting power
            uint256 consensusPower = baseVotingPower > 0 ? 1 : 0;
            console.log("Using CONSENSUS strategy - returning: %s", consensusPower);
            return consensusPower;
            
        } else {
            console.log("Unknown strategy, defaulting to base power: %s", baseVotingPower);
            return baseVotingPower;
        }
    }
    
    /**
     * @dev Delegate votes for a specific category
     */
    function delegateForCategory(
        ProposalCategory category,
        address delegatee
    ) external {
        require(delegatee != address(0), "VotingStrategies: cannot delegate to zero address");
        require(delegatee != msg.sender, "VotingStrategies: cannot delegate to self");
        
        address currentDelegate = categoryDelegations[msg.sender][category].delegate;
        
        // Remove delegation if already exists
        if (currentDelegate != address(0) && categoryDelegations[msg.sender][category].active) {
            _removeCategoryDelegation(msg.sender, currentDelegate, category);
        }
        
        // Create new delegation
        categoryDelegations[msg.sender][category] = CategoryDelegation({
            delegate: delegatee,
            active: true,
            fromBlock: block.number
        });
        
        // Actualize delegated votes
        uint256 delegatorVotingPower = demetraToken.getVotes(msg.sender);
        if (delegatorVotingPower > 0) {
            categoryDelegatedVotes[delegatee][category] += delegatorVotingPower;
        }
        
        emit CategoryDelegated(msg.sender, delegatee, category);
    }
    
    /**
     * @dev Revoke delegation for a specific category
     */
    function revokeCategoryDelegation(ProposalCategory category) external {
        address currentDelegate = categoryDelegations[msg.sender][category].delegate;
        require(currentDelegate != address(0), "VotingStrategies: no active delegation for category");
        require(categoryDelegations[msg.sender][category].active, "VotingStrategies: delegation not active");
        
        _removeCategoryDelegation(msg.sender, currentDelegate, category);
        
        emit CategoryDelegationRevoked(msg.sender, currentDelegate, category);
    }
    
    /**
     * @dev Categorize a proposal
     */
    function categorizeProposal(
        uint256 proposalId,
        ProposalCategory category
    ) external onlyRole(DAO_ROLE) {
        proposalCategories[proposalId] = category;
        emit ProposalCategorized(proposalId, category);
    }
    
    /**
     * @dev Remove a delegation for a specific category
     */
    function _removeCategoryDelegation(
        address delegator,
        address delegatee,
        ProposalCategory category
    ) internal {
        uint256 delegatorVotingPower = demetraToken.getVotes(delegator);
        
        // Remove delegated votes from the delegatee
        if (delegatorVotingPower > 0 && categoryDelegatedVotes[delegatee][category] >= delegatorVotingPower) {
            categoryDelegatedVotes[delegatee][category] -= delegatorVotingPower;
        }
        
        // Desable delegation
        categoryDelegations[delegator][category].active = false;
        categoryDelegations[delegator][category].delegate = address(0);
    }
    
    // Reading functions
    
    /**
     * @dev Get actual power for each voting strategy
     */
    function getCurrentVotingPower(
        address voter,
        ProposalManager.VotingStrategy strategy,
        ProposalCategory category
    ) external view returns (uint256) {
        uint256 baseVotingPower = demetraToken.getVotes(voter);
        
        if (strategy == ProposalManager.VotingStrategy.DIRECT) {
            return baseVotingPower;
        } else if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            return baseVotingPower + categoryDelegatedVotes[voter][category];
        } else if (strategy == ProposalManager.VotingStrategy.CONSENSUS) {
            return baseVotingPower > 0 ? 1 : 0;
        } else {
            return baseVotingPower;
        }
    }
    
    /**
     * @dev Get past voting power
     */
    function getPastVotingPower(
        address voter,
        uint256 blockNumber,
        ProposalManager.VotingStrategy strategy,
        ProposalCategory /*category*/
    ) external view returns (uint256) {
        uint256 basePastVotingPower = demetraToken.getPastVotes(voter, blockNumber);
        
        if (strategy == ProposalManager.VotingStrategy.DIRECT) {
            return basePastVotingPower;
        } else if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            return basePastVotingPower;
        } else if (strategy == ProposalManager.VotingStrategy.CONSENSUS) {
            return basePastVotingPower > 0 ? 1 : 0;
        } else {
            return basePastVotingPower;
        }
    }
    
    function getCategoryDelegate(
        address delegator,
        ProposalCategory category
    ) external view returns (address) {
        if (categoryDelegations[delegator][category].active) {
            return categoryDelegations[delegator][category].delegate;
        }
        return address(0);
    }
    
    function getCategoryDelegatedVotes(
        address delegate,
        ProposalCategory category
    ) external view returns (uint256) {
        return categoryDelegatedVotes[delegate][category];
    }
    
    function getProposalCategory(uint256 proposalId) external view returns (ProposalCategory) {
        return proposalCategories[proposalId];
    }
    
    function hasCategoryDelegation(
        address delegator,
        ProposalCategory category
    ) external view returns (bool) {
        return categoryDelegations[delegator][category].active;
    }
    
    /**
     * @dev Suggest optimal parameters for a given voting strategy
     */
    function getSuggestedParameters(ProposalManager.VotingStrategy strategy) 
        external 
        view 
        returns (uint256 quorum, uint256 threshold, uint256 votingPeriod) 
    {
        if (strategy == ProposalManager.VotingStrategy.DIRECT) {
            return (strategyParams.directQuorum, strategyParams.directThreshold, strategyParams.votingPeriodDirect);
        } else if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            return (strategyParams.liquidQuorum, strategyParams.liquidThreshold, strategyParams.votingPeriodLiquid);
        } else if (strategy == ProposalManager.VotingStrategy.CONSENSUS) {
            return (strategyParams.consensusQuorum, strategyParams.consensusThreshold, strategyParams.votingPeriodConsensus);
        } else {
            return (strategyParams.directQuorum, strategyParams.directThreshold, strategyParams.votingPeriodDirect);
        }
    }
    
    function getStrategyParameters() external view returns (StrategyParameters memory) {
        return strategyParams;
    }
    
    // Admin functions
    
    function updateStrategyParameters(
        uint256 directQuorum,
        uint256 directThreshold,
        uint256 liquidQuorum,
        uint256 liquidThreshold,
        uint256 consensusQuorum,
        uint256 consensusThreshold,
        uint256 votingPeriodDirect,
        uint256 votingPeriodLiquid,
        uint256 votingPeriodConsensus
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(directQuorum <= 5000, "VotingStrategies: direct quorum too high");
        require(directThreshold >= 5000 && directThreshold <= 10000, "VotingStrategies: invalid direct threshold");
        require(liquidQuorum <= 5000, "VotingStrategies: liquid quorum too high");
        require(liquidThreshold >= 5000 && liquidThreshold <= 10000, "VotingStrategies: invalid liquid threshold");
        require(consensusQuorum <= 5000, "VotingStrategies: consensus quorum too high");
        require(consensusThreshold >= 6000 && consensusThreshold <= 10000, "VotingStrategies: invalid consensus threshold");
        
        strategyParams = StrategyParameters({
            directQuorum: directQuorum,
            directThreshold: directThreshold,
            liquidQuorum: liquidQuorum,
            liquidThreshold: liquidThreshold,
            consensusQuorum: consensusQuorum,
            consensusThreshold: consensusThreshold,
            votingPeriodDirect: votingPeriodDirect,
            votingPeriodLiquid: votingPeriodLiquid,
            votingPeriodConsensus: votingPeriodConsensus
        });
    }
}