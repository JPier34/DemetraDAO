// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./DemetraToken.sol";
import "./ProposalManager.sol";
import "./VotingStrategies.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DemetraDAO (used as a coordinator between contracts)
 * @dev Coordinator that uses EXISTING deployed contracts
 */
contract DemetraDAO is Ownable {
    // Use existing deployed contracts
    DemetraToken public immutable demetraToken;
    ProposalManager public immutable proposalManager;
    VotingStrategies public immutable votingStrategies;

    uint256 public constant TOKEN_PRICE = 0.001 ether;

    // Simplified member tracking
    mapping(address => bool) public members;
    mapping(address => uint256) public memberTokens;
    mapping(address => uint256) public memberProposals;
    mapping(address => uint256) public memberVotes;
    mapping(address => uint256) public memberJoinedAt;
    uint256 public totalMembers;

    // Treasury
    uint256 public treasuryBalance;
    uint256 public totalProposalsCreated;
    uint256 public totalVotesCast;
    uint256 public totalFundsRaised;

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event MemberJoined(address indexed member, uint256 tokensOwned);
    event ProposalSubmitted(
        uint256 indexed proposalId,
        address indexed proposer
    );
    event VoteRecorded(uint256 indexed proposalId, address indexed voter);

    constructor(
        address _token,
        address _proposals,
        address _voting,
        address _admin
    ) Ownable() {
        require(_token != address(0), "Invalid token");
        require(_proposals != address(0), "Invalid proposals");
        require(_voting != address(0), "Invalid voting");

        demetraToken = DemetraToken(_token);
        proposalManager = ProposalManager(_proposals);
        votingStrategies = VotingStrategies(_voting);

        // Add admin as first member
        members[_admin] = true;
        memberJoinedAt[_admin] = block.timestamp;
        totalMembers = 1;
        emit MemberJoined(_admin, 0);
    }

    function purchaseTokens() external payable {
        require(tokenSaleActive, "Token sale disabled");
        uint256 tokensToMint = (msg.value * 1 ether) / TOKEN_PRICE;
        require(tokensToMint >= 1 ether, "Below minimum");
        require(tokensToMint <= 10000 ether, "Above maximum");

        // Mint tokens via existing contract
        demetraToken.mint(msg.sender, tokensToMint);

        // Handle membership
        if (!members[msg.sender]) {
            members[msg.sender] = true;
            memberJoinedAt[msg.sender] = block.timestamp;
            totalMembers++;
            emit MemberJoined(msg.sender, tokensToMint);
        }

        memberTokens[msg.sender] += tokensToMint;
        treasuryBalance += msg.value;
        totalFundsRaised += msg.value;

        emit TokensPurchased(msg.sender, tokensToMint, msg.value);
    }

    function createProposal(
        string memory title,
        string memory description,
        ProposalManager.VotingStrategy strategy,
        VotingStrategies.ProposalCategory category,
        ProposalManager.ProposalAction[] memory actions
    ) external returns (uint256) {
        require(members[msg.sender], "Only members");
        require(
            demetraToken.balanceOf(msg.sender) >= 100 ether,
            "Need 100+ tokens"
        );

        // Get parameters from voting strategies
        (
            uint256 quorum,
            uint256 threshold,
            uint256 votingPeriod
        ) = votingStrategies.getSuggestedParameters(strategy);

        uint256 snapshotId = demetraToken.snapshot();

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

        if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            votingStrategies.categorizeProposal(proposalId, category);
        }

        memberProposals[msg.sender]++;
        totalProposalsCreated++;

        emit ProposalSubmitted(proposalId, msg.sender);
        return proposalId;
    }

    function vote(
        uint256 proposalId,
        ProposalManager.VoteChoice choice
    ) external {
        require(members[msg.sender], "Only members");
        require(
            !proposalManager.hasVoted(proposalId, msg.sender),
            "Already voted"
        );

        votingStrategies.vote(proposalId, msg.sender, choice);

        memberVotes[msg.sender]++;
        totalVotesCast++;

        emit VoteRecorded(proposalId, msg.sender);
    }

    function finalizeProposal(uint256 proposalId) external {
        proposalManager.finalizeProposal(
            proposalId,
            demetraToken.totalSupply()
        );
    }

    function canVote(
        address voter,
        uint256 proposalId
    ) external view returns (bool, string memory) {
        if (!members[voter]) return (false, "Not a member");
        if (proposalManager.hasVoted(proposalId, voter))
            return (false, "Already voted");
        if (demetraToken.getVotes(voter) == 0)
            return (false, "No voting power");
        return (true, "Can vote");
    }

    // View functions for compatibility
    function isMember(address account) external view returns (bool) {
        return members[account];
    }

    function getMemberInfo(
        address member
    )
        external
        view
        returns (
            bool isActive,
            uint256 joinedAt,
            uint256 tokensOwned,
            uint256 proposalsCreated,
            uint256 votesParticipated
        )
    {
        return (
            members[member],
            memberJoinedAt[member],
            memberTokens[member],
            memberProposals[member],
            memberVotes[member]
        );
    }

    function getDAOStats()
        external
        view
        returns (
            uint256 _totalMembers,
            uint256 _totalProposalsCreated,
            uint256 _totalVotesCast,
            uint256 _totalFundsRaised,
            uint256 _treasuryBalance,
            uint256 _tokenSupply,
            bool _tokenSaleActive
        )
    {
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

    function calculateTokenCost(
        uint256 tokenAmount
    ) external pure returns (uint256) {
        return (tokenAmount * TOKEN_PRICE) / 1 ether;
    }

    // Admin functions
    bool public tokenSaleActive = true;

    function disableTokenSale() external onlyOwner {
        tokenSaleActive = false;
    }

    function enableTokenSale() external onlyOwner {
        tokenSaleActive = true;
    }

    // Treasury functions
    function withdrawFromTreasury(
        address payable to,
        uint256 amount,
        string memory /*reason*/
    ) external onlyOwner {
        require(amount <= treasuryBalance, "Insufficient funds");
        treasuryBalance -= amount;
        to.transfer(amount);
    }

    receive() external payable {
        treasuryBalance += msg.value;
    }
}
