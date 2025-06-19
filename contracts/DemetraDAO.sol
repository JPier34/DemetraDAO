// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DemetraToken.sol";
import "./ProposalManager.sol";
import "./VotingStrategies.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DemetraDAO
 * @dev Contratto principale della DAO Demetra per calzature sostenibili
 * Orchestratore di tutti i componenti del sistema di governance
 */
contract DemetraDAO is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    
    // Contratti collegati
    DemetraToken public immutable demetraToken;
    ProposalManager public immutable proposalManager;
    VotingStrategies public immutable votingStrategies;
    
    // Configurazione vendita token
    bool public tokenSaleActive;
    uint256 public tokenPrice; // Prezzo in wei per token
    uint256 public constant MIN_PURCHASE = 1 ether; // Minimo 1 token
    uint256 public constant MAX_PURCHASE = 10000 ether; // Massimo 10,000 token per transazione
    uint256 public maxTotalSupply; // Supply massima dei token
    
    // Membri della DAO
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
    
    // Treasury della DAO
    uint256 public treasuryBalance;
    mapping(address => uint256) public tokenBalances; // Balance di altri token ERC20
    
    // Statistiche
    uint256 public totalProposalsCreated;
    uint256 public totalVotesCast;
    uint256 public totalFundsRaised;
    
    // Eventi
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event MemberJoined(address indexed member, uint256 tokensOwned);
    event TokenSaleStatusChanged(bool active);
    event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer);
    event TreasuryDeposit(address indexed from, uint256 amount);
    event TreasuryWithdrawal(address indexed to, uint256 amount, string reason);
    event EmergencyPause(address indexed admin);
    event EmergencyUnpause(address indexed admin);
    
    /**
     * @dev Costruttore della DAO
     * @param tokenName Nome del token di governance
     * @param tokenSymbol Simbolo del token
     * @param _tokenPrice Prezzo iniziale del token in wei
     * @param _maxTotalSupply Supply massima dei token
     * @param admin Indirizzo dell'amministratore iniziale
     */
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
        
        // Deploy dei contratti collegati
        demetraToken = new DemetraToken(tokenName, tokenSymbol, address(this));
        proposalManager = new ProposalManager(address(this));
        votingStrategies = new VotingStrategies(
            address(demetraToken),
            address(proposalManager),
            address(this)
        );
        
        // Configurazione iniziale
        tokenPrice = _tokenPrice;
        maxTotalSupply = _maxTotalSupply;
        tokenSaleActive = true;
        
        // Setup ruoli
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);
        
        // Aggiungi admin come primo membro
        _addMember(admin, 0);
    }
    
    /**
     * @dev Permette agli utenti di acquistare token della DAO
     */
    function purchaseTokens() external payable nonReentrant whenNotPaused {
        require(tokenSaleActive, "DemetraDAO: token sale not active");
        require(msg.value >= MIN_PURCHASE * tokenPrice, "DemetraDAO: purchase below minimum");
        require(msg.value <= MAX_PURCHASE * tokenPrice, "DemetraDAO: purchase above maximum");
        
        uint256 tokensToMint = msg.value / tokenPrice;
        require(tokensToMint > 0, "DemetraDAO: insufficient payment for tokens");
        
        uint256 newTotalSupply = demetraToken.totalSupply() + tokensToMint;
        require(newTotalSupply <= maxTotalSupply, "DemetraDAO: would exceed max supply");
        
        // Mint token
        demetraToken.mint(msg.sender, tokensToMint);
        
        // Aggiungi come membro se non lo è già
        if (!members[msg.sender].isActive) {
            _addMember(msg.sender, tokensToMint);
        } else {
            members[msg.sender].tokensOwned += tokensToMint;
        }
        
        // Aggiorna treasury
        treasuryBalance += msg.value;
        totalFundsRaised += msg.value;
        
        emit TokensPurchased(msg.sender, tokensToMint, msg.value);
    }
    
    /**
     * @dev Disabilita la vendita di token (solo admin)
     */
    function disableTokenSale() external onlyRole(ADMIN_ROLE) {
        require(tokenSaleActive, "DemetraDAO: token sale already disabled");
        tokenSaleActive = false;
        emit TokenSaleStatusChanged(false);
    }
    
    /**
     * @dev Riattiva la vendita di token (solo admin)
     */
    function enableTokenSale() external onlyRole(ADMIN_ROLE) {
        require(!tokenSaleActive, "DemetraDAO: token sale already active");
        tokenSaleActive = true;
        emit TokenSaleStatusChanged(true);
    }
    
    /**
     * @dev Crea una nuova proposta
     * @param title Titolo della proposta
     * @param description Descrizione dettagliata
     * @param strategy Strategia di voto da utilizzare
     * @param category Categoria per democrazia liquida
     * @param actions Array di azioni da eseguire (opzionale)
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
        
        // Ottieni parametri suggeriti per la strategia
        (uint256 quorum, uint256 threshold, uint256 votingPeriod) = 
            votingStrategies.getSuggestedParameters(strategy);
        
        // Crea snapshot per la votazione
        uint256 snapshotId = demetraToken.snapshot();
        
        // Crea la proposta
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
        
        // Categorizza la proposta se è per democrazia liquida
        if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            votingStrategies.categorizeProposal(proposalId, category);
        }
        
        // Aggiorna statistiche
        members[msg.sender].proposalsCreated++;
        totalProposalsCreated++;
        
        emit ProposalSubmitted(proposalId, msg.sender);
        
        return proposalId;
    }
    
    /**
     * @dev Vota per una proposta
     * @param proposalId ID della proposta
     * @param choice Scelta del voto
     */
    function vote(
        uint256 proposalId,
        ProposalManager.VoteChoice choice
    ) external nonReentrant whenNotPaused {
        require(members[msg.sender].isActive, "DemetraDAO: only members can vote");
        require(!proposalManager.hasVoted(proposalId, msg.sender), "DemetraDAO: already voted");
        
        // Delega il voto al contratto VotingStrategies
        votingStrategies.vote(proposalId, choice);
        
        // Aggiorna statistiche
        members[msg.sender].votesParticipated++;
        totalVotesCast++;
    }
    
    /**
     * @dev Finalizza una proposta
     * @param proposalId ID della proposta da finalizzare
     */
    function finalizeProposal(uint256 proposalId) external nonReentrant {
        uint256 totalSupply = demetraToken.totalSupply();
        proposalManager.finalizeProposal(proposalId, totalSupply);
    }
    
    /**
     * @dev Esegue una proposta approvata
     * @param proposalId ID della proposta da eseguire
     */
    function executeProposal(uint256 proposalId) external onlyRole(ADMIN_ROLE) nonReentrant {
        bool success = proposalManager.executeProposal(proposalId);
        require(success, "DemetraDAO: proposal execution failed");
    }
    
    /**
     * @dev Deposita ETH nel treasury
     */
    function depositToTreasury() external payable {
        require(msg.value > 0, "DemetraDAO: deposit must be positive");
        treasuryBalance += msg.value;
        emit TreasuryDeposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Preleva dal treasury (solo treasurer)
     * @param to Destinatario del prelievo
     * @param amount Importo da prelevare
     * @param reason Motivazione del prelievo
     */
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
    
    /**
     * @dev Deposita token ERC20 nel treasury
     * @param token Indirizzo del token
     * @param amount Quantità da depositare
     */
    function depositTokenToTreasury(
        address token,
        uint256 amount
    ) external nonReentrant {
        require(token != address(0), "DemetraDAO: invalid token address");
        require(amount > 0, "DemetraDAO: deposit amount must be positive");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[token] += amount;
    }
    
    /**
     * @dev Preleva token ERC20 dal treasury (solo treasurer)
     * @param token Indirizzo del token
     * @param to Destinatario
     * @param amount Quantità da prelevare
     * @param reason Motivazione
     */
    function withdrawTokenFromTreasury(
        address token,
        address to,
        uint256 amount,
        string memory reason
    ) external onlyRole(TREASURER_ROLE) nonReentrant {
        require(token != address(0), "DemetraDAO: invalid token address");
        require(to != address(0), "DemetraDAO: cannot withdraw to zero address");
        require(amount > 0, "DemetraDAO: withdrawal amount must be positive");
        require(amount <= tokenBalances[token], "DemetraDAO: insufficient token balance");
        require(bytes(reason).length > 0, "DemetraDAO: reason required");
        
        tokenBalances[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
    }
    
    /**
     * @dev Pausa di emergenza (solo admin)
     */
    function emergencyPause() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender);
    }
    
    /**
     * @dev Rimuove pausa di emergenza (solo admin)
     */
    function emergencyUnpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }
    
    /**
     * @dev Aggiorna il prezzo del token (solo admin)
     * @param newPrice Nuovo prezzo in wei
     */
    function updateTokenPrice(uint256 newPrice) external onlyRole(ADMIN_ROLE) {
        require(newPrice > 0, "DemetraDAO: price must be positive");
        tokenPrice = newPrice;
    }
    
    // Funzioni di lettura
    
    /**
     * @dev Verifica se un indirizzo è membro attivo
     */
    function isMember(address account) external view returns (bool) {
        return members[account].isActive;
    }
    
    /**
     * @dev Ottieni informazioni su un membro
     */
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
    
    /**
     * @dev Ottieni statistiche generali della DAO
     */
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
    
    /**
     * @dev Calcola il costo per acquistare una quantità di token
     */
    function calculateTokenCost(uint256 tokenAmount) external view returns (uint256) {
        return tokenAmount * tokenPrice;
    }

    /**
     * @dev Aggiunge un nuovo membro alla DAO
     * @param account Indirizzo del nuovo membro
     * @param tokensOwned Quantità di token posseduti dal nuovo membro
     */

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

    /**
     * @dev Fallback function per ricevere ETH
     */
    receive() external payable {
        treasuryBalance += msg.value;
        emit TreasuryDeposit(msg.sender, msg.value);
    }

    /**
     * @dev Fallback function in caso venga chiamata una funzione non esistente
     */
    fallback() external payable {
        treasuryBalance += msg.value;
        emit TreasuryDeposit(msg.sender, msg.value);
    }
}
