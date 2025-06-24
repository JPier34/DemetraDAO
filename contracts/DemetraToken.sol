// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DemetraToken
 * @dev Token ERC-20 DAO for Demetra governance (OpenZeppelin v4)
 */
contract DemetraToken is AccessControl, ReentrancyGuard, ERC20, ERC20Snapshot, ERC20Permit, ERC20Votes {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
    
    // adding more events
    event TokensMinted(address indexed to, uint256 amount);
    
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
    
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) nonReentrant {
        require(to != address(0), "DemetraToken: mint to zero address");
        require(amount > 0, "DemetraToken: mint amount must be positive");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    function snapshot() public onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        return _snapshot();
    }
    
    function hasActiveDelegation(address account) external view returns (bool) {
        return delegates(account) != address(0);
    }
    
    function getDelegate(address account) external view returns (address) {
        return delegates(account);
    }
    
    function getCurrentVotingPower(address account) external view returns (uint256) {
        return getVotes(account);
    }
    
    function getPastVotingPower(address account, uint256 blockNumber) external view returns (uint256) {
        return getPastVotes(account, blockNumber);
    }
    
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
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}