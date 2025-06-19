// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DemetraToken
 * @dev Token ERC-20 per la governance della DAO Demetra
 * Supporta snapshot per votazioni e sistema di deleghe per democrazia liquida
 */
contract DemetraToken is ERC20, ERC20Snapshot, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
    
    // Struttura per tracciare le deleghe
    struct Delegation {
        address delegate;
        uint256 fromBlock;
        bool active;
    }
    
    // Mapping per le deleghe: delegator => delegate info
    mapping(address => Delegation) public delegations;
    
    // Mapping per tracciare i voti delegati: delegate => total delegated votes
    mapping(address => uint256) public delegatedVotes;
    
    // Mapping per tracciare i checkpoints dei voti
    mapping(address => mapping(uint256 => uint256)) public checkpoints;
    mapping(address => uint256) public numCheckpoints;
    
    // Eventi
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    event TokensMinted(address indexed to, uint256 amount);
    
    /**
     * @dev Costruttore del token
     * @param name Nome del token
     * @param symbol Simbolo del token
     * @param admin Indirizzo dell'amministratore iniziale
     */
    constructor(
        string memory name,
        string memory symbol,
        address admin
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(SNAPSHOT_ROLE, admin);
    }
    
    /**
     * @dev Crea nuovi token - solo per indirizzi con MINTER_ROLE
     * @param to Destinatario dei token
     * @param amount Quantità di token da creare
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) nonReentrant {
        require(to != address(0), "DemetraToken: mint to zero address");
        require(amount > 0, "DemetraToken: mint amount must be positive");
        
        _mint(to, amount);
        _updateDelegatedVotes(to, 0, amount);
        
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Crea uno snapshot - solo per indirizzi con SNAPSHOT_ROLE
     * @return L'ID dello snapshot creato
     */
    function snapshot() public onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        return _snapshot();
    }
    
    /**
     * @dev Delega i propri voti a un altro indirizzo
     * @param delegatee L'indirizzo a cui delegare i voti
     */
    function delegate(address delegatee) public {
        require(delegatee != address(0), "DemetraToken: delegate to zero address");
        require(delegatee != msg.sender, "DemetraToken: cannot delegate to self");
        
        address currentDelegate = delegations[msg.sender].delegate;
        
        // Se già aveva una delega attiva, la rimuove
        if (currentDelegate != address(0) && delegations[msg.sender].active) {
            _removeDelegation(msg.sender, currentDelegate);
        }
        
        // Crea la nuova delega
        delegations[msg.sender] = Delegation({
            delegate: delegatee,
            fromBlock: block.number,
            active: true
        });
        
        uint256 delegatorBalance = balanceOf(msg.sender);
        if (delegatorBalance > 0) {
            delegatedVotes[delegatee] += delegatorBalance;
            _writeCheckpoint(delegatee, delegatedVotes[delegatee]);
        }
        
        emit DelegateChanged(msg.sender, currentDelegate, delegatee);
        emit DelegateVotesChanged(delegatee, delegatedVotes[delegatee] - delegatorBalance, delegatedVotes[delegatee]);
    }
    
    /**
     * @dev Revoca la delega corrente
     */
    function revokeDelegation() public {
        address currentDelegate = delegations[msg.sender].delegate;
        require(currentDelegate != address(0), "DemetraToken: no active delegation");
        
        _removeDelegation(msg.sender, currentDelegate);
        
        emit DelegateChanged(msg.sender, currentDelegate, address(0));
    }
    
    /**
     * @dev Restituisce il numero di voti attuali per un indirizzo (incluse deleghe)
     * @param account L'indirizzo di cui calcolare i voti
     * @return Il numero totale di voti
     */
    function getCurrentVotes(address account) external view returns (uint256) {
        return balanceOf(account) + delegatedVotes[account];
    }
    
    /**
     * @dev Restituisce i voti di un indirizzo a un blocco specifico
     * @param account L'indirizzo di cui calcolare i voti
     * @param blockNumber Il numero del blocco
     * @return Il numero di voti al blocco specificato
     */
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "DemetraToken: block not yet mined");
        
        uint256 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return balanceOf(account);
        }
        
        // Controlla il checkpoint più recente
        if (checkpoints[account][nCheckpoints - 1] <= blockNumber) {
            return balanceOf(account) + delegatedVotes[account];
        }
        
        // Controlla il checkpoint più vecchio
        if (checkpoints[account][0] > blockNumber) {
            return balanceOf(account);
        }
        
        // Ricerca binaria
        uint256 lower = 0;
        uint256 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2;
            if (checkpoints[account][center] == blockNumber) {
                return balanceOf(account) + delegatedVotes[account];
            } else if (checkpoints[account][center] < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        
        return balanceOf(account) + delegatedVotes[account];
    }
    
    /**
     * @dev Verifica se un indirizzo ha una delega attiva
     */
    function hasActiveDelegation(address account) external view returns (bool) {
        return delegations[account].active;
    }
    
    /**
     * @dev Restituisce l'indirizzo del delegato per un account
     */
    function getDelegate(address account) external view returns (address) {
        return delegations[account].delegate;
    }
    
    // Funzioni interne
    
    /**
     * @dev Rimuove una delega esistente
     */
    function _removeDelegation(address delegator, address delegatee) internal {
        uint256 delegatorBalance = balanceOf(delegator);
        
        if (delegatorBalance > 0) {
            delegatedVotes[delegatee] -= delegatorBalance;
            _writeCheckpoint(delegatee, delegatedVotes[delegatee]);
        }
        
        delegations[delegator].active = false;
        
        emit DelegateVotesChanged(delegatee, delegatedVotes[delegatee] + delegatorBalance, delegatedVotes[delegatee]);
    }
    
    /**
     * @dev Aggiorna i voti delegati quando ci sono trasferimenti
     */
    function _updateDelegatedVotes(address account, uint256 oldBalance, uint256 newBalance) internal {
        address delegatee = delegations[account].delegate;
        
        if (delegatee != address(0) && delegations[account].active) {
            uint256 balanceDiff = newBalance > oldBalance ? newBalance - oldBalance : oldBalance - newBalance;
            
            if (newBalance > oldBalance) {
                delegatedVotes[delegatee] += balanceDiff;
            } else {
                delegatedVotes[delegatee] -= balanceDiff;
            }
            
            _writeCheckpoint(delegatee, delegatedVotes[delegatee]);
            emit DelegateVotesChanged(delegatee, delegatedVotes[delegatee], delegatedVotes[delegatee]);
        }
    }
    
    /**
     * @dev Scrive un checkpoint per i voti
     */
    function _writeCheckpoint(address delegatee, uint256 newVotes) internal {
        uint256 nCheckpoints = numCheckpoints[delegatee];
        
        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1] == block.number) {
            checkpoints[delegatee][nCheckpoints - 1] = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = newVotes;
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }
    }
    
    // Override necessari per compatibilità con snapshot
    
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
        
        // Aggiorna i voti delegati per trasferimenti
        if (from != address(0)) {
            _updateDelegatedVotes(from, balanceOf(from), balanceOf(from) - amount);
        }
        if (to != address(0)) {
            _updateDelegatedVotes(to, balanceOf(to), balanceOf(to) + amount);
        }
    }
    
    /**
     * @dev Supporta le interfacce ERC165
     */
    /**
     * @dev Verifica se il contratto supporta una determinata interfaccia (ERC165)
     * @param interfaceId L'identificatore dell'interfaccia
     * @return True se l'interfaccia è supportata, false altrimenti
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}