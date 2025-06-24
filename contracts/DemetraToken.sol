// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DemetraToken
 * @dev Token ERC-20 per la governance della DAO Demetra
 * Supporta snapshot per votazioni e sistema di deleghe tramite ERC20Votes
 */
contract DemetraToken is ERC20, ERC20Snapshot, ERC20Votes, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
    
    // Eventi aggiuntivi
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
    ) ERC20(name, symbol) ERC20Permit(name) {
        require(admin != address(0), "DemetraToken: admin cannot be zero address");
        
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
     * @dev Verifica se un indirizzo ha una delega attiva
     * Utilizza il sistema di deleghe di ERC20Votes
     */
    function hasActiveDelegation(address account) external view returns (bool) {
        return delegates(account) != address(0);
    }
    
    /**
     * @dev Restituisce l'indirizzo del delegato per un account
     * Utilizza il sistema di deleghe di ERC20Votes
     */
    function getDelegate(address account) external view returns (address) {
        return delegates(account);
    }
    
    /**
     * @dev Restituisce il voting power corrente di un account
     * Include sia i token posseduti che quelli delegati
     */
    function getCurrentVotingPower(address account) external view returns (uint256) {
        return getVotes(account);
    }
    
    /**
     * @dev Restituisce il voting power di un account a un blocco specifico
     */
    function getPastVotingPower(address account, uint256 blockNumber) external view returns (uint256) {
        return getPastVotes(account, blockNumber);
    }
    
    // Override necessari per la compatibilità tra le estensioni
    
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
    
    /**
     * @dev Supporta le interfacce ERC165
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