// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DemetraToken (Ultra Minimal)
 * @dev Absolutely minimal version that WILL work
 */
contract DemetraToken is ERC20, Ownable {
    uint256 private _snapshotCounter;
    
    event TokensMinted(address indexed to, uint256 amount);
    
    constructor(
        string memory name,
        string memory symbol,
        address admin
    ) ERC20(name, symbol) Ownable() {
        // Constructor is minimal - just call parent constructors
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "DemetraToken: mint to zero address");
        require(amount > 0, "DemetraToken: mint amount must be positive");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    // Mock snapshot function - just returns incrementing number
    function snapshot() public onlyOwner returns (uint256) {
        _snapshotCounter++;
        return _snapshotCounter;
    }
    
    // Mock voting functions
    function getCurrentVotingPower(address account) external view returns (uint256) {
        return balanceOf(account);
    }
    
    function getPastVotingPower(address account, uint256 /*blockNumber*/) external view returns (uint256) {
        return balanceOf(account); // Simplified - return current balance
    }
    
    // Mock delegation functions for compatibility
    function delegates(address account) external pure returns (address) {
        return account; // Everyone delegates to themselves
    }
    
    function delegate(address /*delegatee*/) external pure {
        // Mock function - does nothing
    }
    
    function getVotes(address account) external view returns (uint256) {
        return balanceOf(account);
    }
    
    function getPastVotes(address account, uint256 /*blockNumber*/) external view returns (uint256) {
        return balanceOf(account);
    }
}