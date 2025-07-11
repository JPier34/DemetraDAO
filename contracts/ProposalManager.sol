// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ProposalManager
 * @dev Handles proposal creation, voting, execution, and management in the DAO.
 */
contract ProposalManager is AccessControl, ReentrancyGuard {
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // Counter manuale per proposal IDs
    uint256 private _proposalIdCounter;

    // Enumerazioni - IMPORTANTE: ordine coerente con altri contratti
    enum ProposalState {
        Pending, // 0 - Proposal created but not yet active
        Active, // 1 - Voting in progress
        Succeeded, // 2 - Approved but not executed (was 4, now 2)
        Executed, // 3 - Approved and executed
        Failed, // 4 - Rejected or expired (was 2, now 4)
        Cancelled // 5 - Cancelled by administrator
    }

    enum VotingStrategy {
        DIRECT, // 0 - Direct democracy
        LIQUID, // 1 - Liquid democracy
        REPRESENTATIVE, // 2 - Representative democracy
        CONSENSUS // 3 - Consensus
    }

    enum VoteChoice {
        ABSTAIN, // 0 - Abstain
        FOR, // 1 - Favor
        AGAINST // 2 - Contrary
    }

    // Struttura per le azioni eseguibili
    struct ProposalAction {
        address target;
        uint256 value;
        bytes data;
        string description;
    }

    // Struttura principale della proposta
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 snapshotId;
        VotingStrategy strategy;
        uint256 quorumRequired;
        uint256 approvalThreshold;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        ProposalState state;
        ProposalAction[] actions;
        mapping(address => bool) hasVoted;
        mapping(address => VoteChoice) votes;
    }

    // Storage
    mapping(uint256 => Proposal) private proposals;
    uint256[] public proposalsList;

    // Conf Parameters
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;
    uint256 public constant MIN_QUORUM = 1000; // 10% in basis points
    uint256 public constant MAX_QUORUM = 5000; // 50% in basis points

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        VotingStrategy strategy,
        uint256 startTime,
        uint256 endTime
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        uint256 votingPower
    );

    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event ProposalStateChanged(
        uint256 indexed proposalId,
        ProposalState newState
    );

    constructor(address admin) {
        require(
            admin != address(0),
            "ProposalManager: admin cannot be zero address"
        );
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DAO_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
    }

    function createProposal(
        address proposer,
        string memory title,
        string memory description,
        uint256 votingPeriod,
        VotingStrategy strategy,
        uint256 quorum,
        uint256 threshold,
        ProposalAction[] memory actions,
        uint256 snapshotId
    ) external onlyRole(DAO_ROLE) nonReentrant returns (uint256) {
        require(
            proposer != address(0),
            "ProposalManager: proposer cannot be zero address"
        );
        require(
            bytes(title).length > 0,
            "ProposalManager: title cannot be empty"
        );
        require(
            votingPeriod >= MIN_VOTING_PERIOD,
            "ProposalManager: voting period too short"
        );
        require(
            votingPeriod <= MAX_VOTING_PERIOD,
            "ProposalManager: voting period too long"
        );
        require(
            quorum >= MIN_QUORUM && quorum <= MAX_QUORUM,
            "ProposalManager: invalid quorum"
        );
        require(
            threshold >= 5000 && threshold <= 10000,
            "ProposalManager: invalid threshold"
        );

        _proposalIdCounter++;
        uint256 proposalId = _proposalIdCounter;

        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = proposer;
        proposal.title = title;
        proposal.description = description;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;
        proposal.snapshotId = snapshotId;
        proposal.strategy = strategy;
        proposal.quorumRequired = quorum;
        proposal.approvalThreshold = threshold;
        proposal.state = ProposalState.Active;

        // Adds the actions to the proposal
        for (uint256 i = 0; i < actions.length; i++) {
            proposal.actions.push(actions[i]);
        }

        proposalsList.push(proposalId);

        emit ProposalCreated(
            proposalId,
            proposer,
            title,
            strategy,
            proposal.startTime,
            proposal.endTime
        );

        return proposalId;
    }

    function castVote(
        uint256 proposalId,
        address voter,
        VoteChoice choice,
        uint256 votingPower
    ) external onlyRole(DAO_ROLE) nonReentrant {
        require(
            voter != address(0),
            "ProposalManager: voter cannot be zero address"
        );
        require(
            votingPower > 0,
            "ProposalManager: voting power must be positive"
        );

        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProposalManager: proposal does not exist");
        require(
            proposal.state == ProposalState.Active,
            "ProposalManager: proposal not active"
        );
        require(
            block.timestamp <= proposal.endTime,
            "ProposalManager: voting period ended"
        );
        require(
            !proposal.hasVoted[voter],
            "ProposalManager: voter already voted"
        );

        // Register the vote
        proposal.hasVoted[voter] = true;
        proposal.votes[voter] = choice;

        // Actualize the vote counts
        if (choice == VoteChoice.FOR) {
            proposal.forVotes += votingPower;
        } else if (choice == VoteChoice.AGAINST) {
            proposal.againstVotes += votingPower;
        } else if (choice == VoteChoice.ABSTAIN) {
            proposal.abstainVotes += votingPower;
        }

        emit VoteCast(proposalId, voter, choice, votingPower);
    }

    function finalizeProposal(
        uint256 proposalId,
        uint256 totalSupply
    ) external onlyRole(DAO_ROLE) nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProposalManager: proposal does not exist");
        require(
            proposal.state == ProposalState.Active,
            "ProposalManager: proposal not active"
        );
        require(
            block.timestamp > proposal.endTime,
            "ProposalManager: voting period not ended"
        );

        uint256 totalVotes = proposal.forVotes +
            proposal.againstVotes +
            proposal.abstainVotes;
        uint256 quorumNeeded = (totalSupply * proposal.quorumRequired) / 10000;

        // Verifying quorum
        if (totalVotes < quorumNeeded) {
            proposal.state = ProposalState.Failed;
            emit ProposalStateChanged(proposalId, ProposalState.Failed);
            return;
        }

        // Verifying approvals following the strategy
        bool approved = false;

        if (
            proposal.strategy == VotingStrategy.DIRECT ||
            proposal.strategy == VotingStrategy.LIQUID
        ) {
            // Simple majority (liquid democracy)
            uint256 decisiveVotes = proposal.forVotes + proposal.againstVotes;
            if (decisiveVotes > 0) {
                uint256 approvalPercentage = (proposal.forVotes * 10000) /
                    decisiveVotes;
                approved = approvalPercentage >= proposal.approvalThreshold;
            }
        } else if (proposal.strategy == VotingStrategy.REPRESENTATIVE) {
            // Representative democracy: treshold required
            uint256 approvalPercentage = (proposal.forVotes * 10000) /
                totalVotes;
            approved = approvalPercentage >= proposal.approvalThreshold;
        } else if (proposal.strategy == VotingStrategy.CONSENSUS) {
            // Consensus: everybody agree (100%)
            approved = (proposal.forVotes > 0) && (proposal.againstVotes == 0);
        }

        proposal.state = approved
            ? ProposalState.Succeeded
            : ProposalState.Failed;
        emit ProposalStateChanged(proposalId, proposal.state);
    }

    function executeProposal(
        uint256 proposalId
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (bool success) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProposalManager: proposal does not exist");
        require(
            proposal.state == ProposalState.Succeeded,
            "ProposalManager: proposal not approved"
        );

        proposal.state = ProposalState.Executed;

        // Executes actions
        for (uint256 i = 0; i < proposal.actions.length; i++) {
            ProposalAction memory action = proposal.actions[i];

            (bool actionSuccess, ) = action.target.call{value: action.value}(
                action.data
            );
            if (!actionSuccess) {
                // If failure, revert
                proposal.state = ProposalState.Succeeded; // Back to previous state
                return false;
            }
        }

        emit ProposalExecuted(proposalId);
        emit ProposalStateChanged(proposalId, ProposalState.Executed);

        return true;
    }

    function cancelProposal(
        uint256 proposalId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProposalManager: proposal does not exist");
        require(
            proposal.state == ProposalState.Active,
            "ProposalManager: cannot cancel non-active proposal"
        );

        proposal.state = ProposalState.Cancelled;

        emit ProposalCancelled(proposalId);
        emit ProposalStateChanged(proposalId, ProposalState.Cancelled);
    }

    // Reading functions

    function getProposalState(
        uint256 proposalId
    ) external view returns (ProposalState) {
        require(
            proposals[proposalId].id != 0,
            "ProposalManager: proposal does not exist"
        );
        return proposals[proposalId].state;
    }

    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (
            address proposer,
            string memory title,
            string memory description,
            uint256 startTime,
            uint256 endTime,
            bool executed,
            VotingStrategy strategy,
            ProposalState state
        )
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProposalManager: proposal does not exist");

        return (
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.state == ProposalState.Executed,
            proposal.strategy,
            proposal.state
        );
    }

    function getProposalVotes(
        uint256 proposalId
    )
        external
        view
        returns (
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 quorumRequired,
            uint256 approvalThreshold
        )
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProposalManager: proposal does not exist");

        return (
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.quorumRequired,
            proposal.approvalThreshold
        );
    }

    function hasVoted(
        uint256 proposalId,
        address voter
    ) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    function getVotes(
        uint256 proposalId,
        address voter
    ) external view returns (VoteChoice) {
        require(
            proposals[proposalId].hasVoted[voter],
            "ProposalManager: voter has not voted"
        );
        return proposals[proposalId].votes[voter];
    }

    function getProposalActionsCount(
        uint256 proposalId
    ) external view returns (uint256) {
        return proposals[proposalId].actions.length;
    }

    function getProposalAction(
        uint256 proposalId,
        uint256 actionIndex
    )
        external
        view
        returns (
            address target,
            uint256 value,
            bytes memory data,
            string memory description
        )
    {
        require(
            actionIndex < proposals[proposalId].actions.length,
            "ProposalManager: action index out of bounds"
        );

        ProposalAction storage action = proposals[proposalId].actions[
            actionIndex
        ];
        return (action.target, action.value, action.data, action.description);
    }

    function getProposalCount() external view returns (uint256) {
        return _proposalIdCounter;
    }

    function getProposalsList() external view returns (uint256[] memory) {
        return proposalsList;
    }
}
