// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DemetraToken.sol";
import "./ProposalManager.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VotingStrategies
 * @dev Implementa le strategie di voto miste per la DAO Demetra
 * Combina democrazia diretta, liquida e consenso per diversi tipi di decisioni
 */
contract VotingStrategies is AccessControl, ReentrancyGuard {
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    
    DemetraToken public immutable demetraToken;
    ProposalManager public immutable proposalManager;
    
    // Struttura per tracciare deleghe per categoria
    struct CategoryDelegation {
        address delegate;
        bool active;
        uint256 fromBlock;
    }
    
    // Categorie di proposte per democrazia liquida
    enum ProposalCategory {
        STRATEGIC,      // Decisioni strategiche (partnership, nuove collezioni)
        OPERATIONAL,    // Decisioni operative (marketing, processi)
        TECHNICAL,      // Decisioni tecniche (aggiornamenti, parametri)
        GOVERNANCE      // Modifiche alla governance stessa
    }
    
    // Mapping per deleghe per categoria: delegator => category => delegation info
    mapping(address => mapping(ProposalCategory => CategoryDelegation)) public categoryDelegations;
    
    // Mapping per tracciare i voti delegati per categoria
    mapping(address => mapping(ProposalCategory => uint256)) public categoryDelegatedVotes;
    
    // Mapping per tracciare le proposte e le loro categorie
    mapping(uint256 => ProposalCategory) public proposalCategories;
    
    // Parametri per le diverse strategie
    struct StrategyParameters {
        uint256 directQuorum;           // Quorum per democrazia diretta
        uint256 directThreshold;        // Soglia approvazione democrazia diretta
        uint256 liquidQuorum;           // Quorum per democrazia liquida
        uint256 liquidThreshold;        // Soglia approvazione democrazia liquida
        uint256 consensusQuorum;        // Quorum per consenso
        uint256 consensusThreshold;     // Soglia approvazione consenso (supermajority)
        uint256 votingPeriodDirect;     // Periodo votazione democrazia diretta
        uint256 votingPeriodLiquid;     // Periodo votazione democrazia liquida
        uint256 votingPeriodConsensus;  // Periodo votazione consenso (più lungo)
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
    
    /**
     * @dev Costruttore
     * @param _demetraToken Indirizzo del token di governance
     * @param _proposalManager Indirizzo del gestore proposte
     * @param admin Indirizzo dell'amministratore
     */
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
        
        // Inizializza parametri predefiniti
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
     * @dev Delega voti per una specifica categoria
     * @param category Categoria della proposta
     * @param delegatee Indirizzo a cui delegare
     */
    function delegateForCategory(
        ProposalCategory category,
        address delegatee
    ) external {
        require(delegatee != address(0), "VotingStrategies: cannot delegate to zero address");
        require(delegatee != msg.sender, "VotingStrategies: cannot delegate to self");
        
        address currentDelegate = categoryDelegations[msg.sender][category].delegate;
        
        // Rimuovi delega precedente se esiste
        if (currentDelegate != address(0) && categoryDelegations[msg.sender][category].active) {
            _removeCategoryDelegation(msg.sender, currentDelegate, category);
        }
        
        // Crea nuova delega
        categoryDelegations[msg.sender][category] = CategoryDelegation({
            delegate: delegatee,
            active: true,
            fromBlock: block.number
        });
        
        uint256 delegatorBalance = demetraToken.balanceOf(msg.sender);
        if (delegatorBalance > 0) {
            categoryDelegatedVotes[delegatee][category] += delegatorBalance;
        }
        
        emit CategoryDelegated(msg.sender, delegatee, category);
    }
    
    /**
     * @dev Revoca delega per una categoria specifica
     * @param category Categoria per cui revocare la delega
     */
    function revokeCategoryDelegation(ProposalCategory category) external {
        address currentDelegate = categoryDelegations[msg.sender][category].delegate;
        require(currentDelegate != address(0), "VotingStrategies: no active delegation for category");
        
        _removeCategoryDelegation(msg.sender, currentDelegate, category);
        
        emit CategoryDelegationRevoked(msg.sender, currentDelegate, category);
    }
    
    /**
     * @dev Categorizza una proposta (solo DAO)
     * @param proposalId ID della proposta
     * @param category Categoria assegnata
     */
    function categorizeProposal(
        uint256 proposalId,
        ProposalCategory category
    ) external onlyRole(DAO_ROLE) {
        proposalCategories[proposalId] = category;
        emit ProposalCategorized(proposalId, category);
    }
    
    /**
     * @dev Vota per una proposta utilizzando la strategia appropriata
     * @param proposalId ID della proposta
     * @param choice Scelta del voto
     */
    function vote(
        uint256 proposalId,
        ProposalManager.VoteChoice choice
    ) external nonReentrant {
        require(demetraToken.balanceOf(msg.sender) > 0, "VotingStrategies: no voting power");
        
        // Ottieni informazioni sulla proposta
        (,,,,,, ProposalManager.VotingStrategy strategy,) = proposalManager.getProposal(proposalId);
        
        uint256 votingPower = _calculateVotingPower(msg.sender, proposalId, strategy);
        require(votingPower > 0, "VotingStrategies: no voting power available");
        
        // Invia il voto al ProposalManager
        proposalManager.castVote(proposalId, msg.sender, choice, votingPower);
        
        emit VoteCastWithStrategy(proposalId, msg.sender, choice, votingPower, strategy);
    }
    
    /**
     * @dev Calcola il potere di voto per un utente su una proposta specifica
     * @param voter Indirizzo del votante
     * @param proposalId ID della proposta
     * @param strategy Strategia di voto della proposta
     * @return Il potere di voto totale
     */
    function _calculateVotingPower(
        address voter,
        uint256 proposalId,
        ProposalManager.VotingStrategy strategy
    ) internal view returns (uint256) {
        uint256 baseVotingPower = demetraToken.balanceOf(voter);
        
        if (strategy == ProposalManager.VotingStrategy.DIRECT) {
            // Democrazia diretta: solo i propri token
            return baseVotingPower;
            
        } else if (strategy == ProposalManager.VotingStrategy.LIQUID) {
            // Democrazia liquida: token + deleghe per categoria
            ProposalCategory category = proposalCategories[proposalId];
            uint256 delegatedPower = categoryDelegatedVotes[voter][category];
            return baseVotingPower + delegatedPower;
            
        } else if (strategy == ProposalManager.VotingStrategy.CONSENSUS) {
            // Consenso: tutti hanno peso uguale indipendentemente dai token
            return baseVotingPower > 0 ? 1 : 0;
            
        } else {
            // Default: democrazia diretta
            return baseVotingPower;
        }
    }
    
    /**
     * @dev Rimuove una delega per categoria
     */
    function _removeCategoryDelegation(
        address delegator,
        address delegatee,
        ProposalCategory category
    ) internal {
        uint256 delegatorBalance = demetraToken.balanceOf(delegator);
        
        if (delegatorBalance > 0) {
            categoryDelegatedVotes[delegatee][category] -= delegatorBalance;
        }
        
        categoryDelegations[delegator][category].active = false;
    }
    
    /**
     * @dev Ottieni il potere di voto attuale per una strategia specifica
     * @param voter Indirizzo del votante
     * @param strategy Strategia di voto
     * @param category Categoria (per democrazia liquida)
     * @return Il potere di voto
     */
    function getCurrentVotingPower(
        address voter,
        ProposalManager.VotingStrategy strategy,
        ProposalCategory category
    ) external view returns (uint256) {
        uint256 baseVotingPower = demetraToken.balanceOf(voter);
        
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
     * @dev Verifica se un utente ha delegato per una categoria specifica
     */
    function hasCategoryDelegation(
        address delegator,
        ProposalCategory category
    ) external view returns (bool) {
        return categoryDelegations[delegator][category].active;
    }
    
    /**
     * @dev Ottieni il delegato per una categoria specifica
     */
    function getCategoryDelegate(
        address delegator,
        ProposalCategory category
    ) external view returns (address) {
        return categoryDelegations[delegator][category].delegate;
    }
    
    /**
     * @dev Ottieni i voti delegati per una categoria
     */
    function getCategoryDelegatedVotes(
        address delegate,
        ProposalCategory category
    ) external view returns (uint256) {
        return categoryDelegatedVotes[delegate][category];
    }
    
    /**
     * @dev Ottieni la categoria di una proposta
     */
    function getProposalCategory(uint256 proposalId) external view returns (ProposalCategory) {
        return proposalCategories[proposalId];
    }
    
    /**
     * @dev Aggiorna i parametri della strategia (solo admin)
     */
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
    
    /**
     * @dev Ottieni i parametri attuali delle strategie
     */
    function getStrategyParameters() external view returns (StrategyParameters memory) {
        return strategyParams;
    }
    
    /**
     * @dev Suggerisci parametri ottimali per una proposta basati sulla strategia
     * @param strategy Strategia di voto
     * @return quorum e threshold suggeriti
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
            // Default a democrazia diretta
            return (strategyParams.directQuorum, strategyParams.directThreshold, strategyParams.votingPeriodDirect);
        }
    }
}