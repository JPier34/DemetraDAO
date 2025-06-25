const { expect } = require("chai");
const { ethers } = require("hardhat");

// Load Hardhat matchers
require("@nomicfoundation/hardhat-chai-matchers");

describe("DemetraDAO - Complete Requirements Test", function () {
  let demetraDAO: {
    waitForDeployment: () => any;
    demetraToken: () => any;
    proposalManager: () => any;
    votingStrategies: () => any;
    calculateTokenCost: (arg0: any) => any;
    isMember: (arg0: any) => any;
    totalMembers: () => any;
    connect: (arg0: any) => {
      (): any;
      new (): any;
      purchaseTokens: { (arg0: { value: any }): any; new (): any };
      createProposal: {
        (
          arg0: string,
          arg1: string,
          arg2: number,
          arg3: number,
          arg4: never[]
        ): any;
        new (): any;
      };
      vote: { (arg0: number, arg1: number): any; new (): any };
    };
    getMemberInfo: (arg0: any) => any;
    treasuryBalance: () => any;
    getDAOStats: () => any;
    interface: {
      parseLog: (arg0: any) => { (): any; new (): any; args: any[] };
    };
    finalizeProposal: (arg0: any) => any;
    canVote: (arg0: any, arg1: any) => any;
    disableTokenSale: () => any;
    enableTokenSale: () => any;
  };
  let demetraToken: {
    balanceOf: (arg0: any) => any;
    connect: (arg0: any) => {
      (): any;
      new (): any;
      delegate: { (arg0: any): any; new (): any };
    };
    getVotes: (arg0: any) => any;
  };
  let proposalManager: {
    DAO_ROLE: () => any;
    hasRole: (arg0: any, arg1: any) => any;
    grantRole: (arg0: any, arg1: any) => any;
    getProposal: (arg0: number) => any;
    hasVoted: (arg0: number, arg1: any) => any;
  };
  let votingStrategies: any;
  let owner,
    addr1: { getAddress: () => any },
    addr2: { getAddress: () => any },
    addr3: { getAddress: () => any },
    addr4: { getAddress: () => any };

  const VotingStrategy = {
    DIRECT: 0,
    LIQUID: 1,
    REPRESENTATIVE: 2,
    CONSENSUS: 3,
  };

  const ProposalCategory = {
    GENERAL: 0,
    STRATEGIC: 1,
    OPERATIONAL: 2,
    TECHNICAL: 3,
    GOVERNANCE: 4,
  };

  // Configuration parameters
  const TOKEN_NAME = "Demetra Governance Token";
  const TOKEN_SYMBOL = "DMTR";
  const TOKEN_PRICE = ethers.parseEther("0.001"); // 0.001 ETH per token (was 0.01)
  const MAX_SUPPLY = ethers.parseEther("1000000"); // 1M max tokens

  beforeEach(async function () {
    // Setup accounts
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // Deploy DemetraDAO
    const DemetraDAOFactory = await ethers.getContractFactory("DemetraDAO");
    demetraDAO = await DemetraDAOFactory.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_PRICE,
      MAX_SUPPLY,
      await owner.getAddress()
    );
    await demetraDAO.waitForDeployment();

    // Get linked contracts
    const demetraTokenAddr = await demetraDAO.demetraToken();
    const proposalManagerAddr = await demetraDAO.proposalManager();
    const votingStrategiesAddr = await demetraDAO.votingStrategies();

    demetraToken = await ethers.getContractAt("DemetraToken", demetraTokenAddr);
    proposalManager = await ethers.getContractAt(
      "ProposalManager",
      proposalManagerAddr
    );
    votingStrategies = await ethers.getContractAt(
      "VotingStrategies",
      votingStrategiesAddr
    );

    // Ensure VotingStrategies has necessary permissions
    const DAO_ROLE = await proposalManager.DAO_ROLE();
    const hasRole = await proposalManager.hasRole(
      DAO_ROLE,
      votingStrategiesAddr
    );
    if (!hasRole) {
      await proposalManager.grantRole(DAO_ROLE, votingStrategiesAddr);
    }
  });

  describe("1. Test Share Purchase and Member Creation", function () {
    it("Share purchase should work correctly and create new members", async function () {
      console.log("\n=== TEST 1: SHARE PURCHASE AND MEMBER CREATION ===");

      // Define token quantities to purchase
      const tokens1 = ethers.parseEther("100"); // 100 tokens for addr1
      const tokens2 = ethers.parseEther("50"); // 50 tokens for addr2
      const tokens3 = ethers.parseEther("30"); // 30 tokens for addr3

      // Calculate costs
      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      console.log("Calculated costs:");
      console.log(
        `  ${ethers.formatEther(tokens1)} tokens = ${ethers.formatEther(
          cost1
        )} ETH`
      );
      console.log(
        `  ${ethers.formatEther(tokens2)} tokens = ${ethers.formatEther(
          cost2
        )} ETH`
      );
      console.log(
        `  ${ethers.formatEther(tokens3)} tokens = ${ethers.formatEther(
          cost3
        )} ETH`
      );

      // Verify initial state - no one is a member except owner
      expect(await demetraDAO.isMember(await addr1.getAddress())).to.be.false;
      expect(await demetraDAO.isMember(await addr2.getAddress())).to.be.false;
      expect(await demetraDAO.isMember(await addr3.getAddress())).to.be.false;
      expect(await demetraDAO.totalMembers()).to.equal(1n); // Only owner

      // addr1 purchases tokens
      console.log("\naddr1 purchasing tokens...");
      await expect(demetraDAO.connect(addr1).purchaseTokens({ value: cost1 }))
        .to.emit(demetraDAO, "TokensPurchased")
        .withArgs(await addr1.getAddress(), tokens1, cost1)
        .and.to.emit(demetraDAO, "MemberJoined")
        .withArgs(await addr1.getAddress(), tokens1);

      // addr2 purchases tokens
      console.log("addr2 purchasing tokens...");
      await expect(demetraDAO.connect(addr2).purchaseTokens({ value: cost2 }))
        .to.emit(demetraDAO, "TokensPurchased")
        .withArgs(await addr2.getAddress(), tokens2, cost2)
        .and.to.emit(demetraDAO, "MemberJoined")
        .withArgs(await addr2.getAddress(), tokens2);

      // addr3 purchases tokens
      console.log("addr3 purchasing tokens...");
      await expect(demetraDAO.connect(addr3).purchaseTokens({ value: cost3 }))
        .to.emit(demetraDAO, "TokensPurchased")
        .withArgs(await addr3.getAddress(), tokens3, cost3)
        .and.to.emit(demetraDAO, "MemberJoined")
        .withArgs(await addr3.getAddress(), tokens3);

      // Verify that all became members
      expect(await demetraDAO.isMember(await addr1.getAddress())).to.be.true;
      expect(await demetraDAO.isMember(await addr2.getAddress())).to.be.true;
      expect(await demetraDAO.isMember(await addr3.getAddress())).to.be.true;
      expect(await demetraDAO.totalMembers()).to.equal(4n); // owner + 3 new

      // Verify tokens received
      expect(await demetraToken.balanceOf(await addr1.getAddress())).to.equal(
        tokens1
      );
      expect(await demetraToken.balanceOf(await addr2.getAddress())).to.equal(
        tokens2
      );
      expect(await demetraToken.balanceOf(await addr3.getAddress())).to.equal(
        tokens3
      );

      // Verify member information
      const member1 = await demetraDAO.getMemberInfo(await addr1.getAddress());
      const member2 = await demetraDAO.getMemberInfo(await addr2.getAddress());
      const member3 = await demetraDAO.getMemberInfo(await addr3.getAddress());

      expect(member1.isActive).to.be.true;
      expect(member1.tokensOwned).to.equal(tokens1);
      expect(member2.isActive).to.be.true;
      expect(member2.tokensOwned).to.equal(tokens2);
      expect(member3.isActive).to.be.true;
      expect(member3.tokensOwned).to.equal(tokens3);

      // Verify updated treasury
      const expectedTreasury = cost1 + cost2 + cost3;
      expect(await demetraDAO.treasuryBalance()).to.equal(expectedTreasury);

      console.log(
        "✅ Share purchase and member creation test completed successfully"
      );
    });
  });

  describe("2. Test Decision Proposals", function () {
    beforeEach(async function () {
      // Setup members with tokens for proposal tests
      const tokens = ethers.parseEther("1000");
      const cost = await demetraDAO.calculateTokenCost(tokens);
      await demetraDAO.connect(addr1).purchaseTokens({ value: cost });
      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
    });

    it("Decision proposals should work correctly", async function () {
      console.log("\n=== TEST 2: DECISION PROPOSALS ===");

      // Verify initial state
      const initialStats = await demetraDAO.getDAOStats();
      expect(initialStats._totalProposalsCreated).to.equal(0n);

      // Create first proposal
      console.log("Creating first proposal...");
      const title1 = "Platform Improvement Proposal";
      const description1 = "Proposal to update the platform with new features";

      await expect(
        demetraDAO.connect(addr1).createProposal(
          title1,
          description1,
          0, // DIRECT strategy
          0, // GENERAL category
          []
        )
      ).to.emit(demetraDAO, "ProposalSubmitted");

      // Create second proposal
      console.log("Creating second proposal...");
      const title2 = "Strategic Partnership Proposal";
      const description2 = "Proposal for partnership with industry leader";

      await expect(
        demetraDAO.connect(addr1).createProposal(
          title2,
          description2,
          0, // DIRECT strategy
          1, // STRATEGIC category
          []
        )
      ).to.emit(demetraDAO, "ProposalSubmitted");

      // Verify proposals were created
      const updatedStats = await demetraDAO.getDAOStats();
      expect(updatedStats._totalProposalsCreated).to.equal(2n);

      // Verify first proposal details
      const proposal1 = await proposalManager.getProposal(1);
      expect(proposal1[0]).to.equal(await addr1.getAddress()); // proposer
      expect(proposal1[1]).to.equal(title1); // title
      expect(proposal1[2]).to.equal(description1); // description
      expect(proposal1[6]).to.equal(0); // DIRECT strategy

      // Verify second proposal details
      const proposal2 = await proposalManager.getProposal(2);
      expect(proposal2[0]).to.equal(await addr1.getAddress()); // proposer
      expect(proposal2[1]).to.equal(title2); // title
      expect(proposal2[2]).to.equal(description2); // description
      expect(proposal2[6]).to.equal(0); // DIRECT strategy

      // Verify updated member statistics
      const memberInfo = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      expect(memberInfo.proposalsCreated).to.equal(2n);

      console.log("✅ Proposal creation test completed successfully");
    });

    it("Should not allow proposals from non-members", async function () {
      await expect(
        demetraDAO
          .connect(addr4)
          .createProposal(
            "Unauthorized Proposal",
            "This proposal should not be accepted",
            0,
            0,
            []
          )
      ).to.be.revertedWith("DemetraDAO: only members can create proposals");
    });

    it("Should not allow proposals without sufficient tokens", async function () {
      // addr2 becomes member but with few tokens
      const fewTokens = ethers.parseEther("50"); // Less than minimum required (100)
      const cost = await demetraDAO.calculateTokenCost(fewTokens);
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost });

      await expect(
        demetraDAO
          .connect(addr2)
          .createProposal(
            "Proposal with Insufficient Tokens",
            "This proposal should not be accepted",
            0,
            0,
            []
          )
      ).to.be.revertedWith("DemetraDAO: insufficient tokens to propose");
    });
  });

  describe("3. Test Weighted Voting System", function () {
    let proposalId;
    let tokens1: bigint, tokens2: bigint, tokens3: bigint;

    beforeEach(async function () {
      // Setup members with different tokens to test weighted voting
      tokens1 = ethers.parseEther("1000"); // 1000 tokens = 1000 votes
      tokens2 = ethers.parseEther("500"); // 500 tokens = 500 votes
      tokens3 = ethers.parseEther("200"); // 200 tokens = 200 votes

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      // Delegate voting power (required for ERC20Votes)
      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Create proposal for testing
      const tx = await demetraDAO.connect(addr1).createProposal(
        "Weighted Voting Test Proposal",
        "Proposal to test weighted voting system",
        0, // DIRECT strategy
        0, // GENERAL category
        []
      );

      // Extract proposal ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = demetraDAO.interface.parseLog(event);
        proposalId = parsed.args[0];
      } else {
        proposalId = 1n;
      }
    });

    it("Weighted voting system should work correctly", async function () {
      console.log("\n=== TEST 3: WEIGHTED VOTING SYSTEM ===");

      // Verify voting power before voting
      const power1 = await demetraToken.getVotes(await addr1.getAddress());
      const power2 = await demetraToken.getVotes(await addr2.getAddress());
      const power3 = await demetraToken.getVotes(await addr3.getAddress());

      console.log("Verified voting power:");
      console.log(`  addr1: ${ethers.formatEther(power1)} votes`);
      console.log(`  addr2: ${ethers.formatEther(power2)} votes`);
      console.log(`  addr3: ${ethers.formatEther(power3)} votes`);

      expect(power1).to.equal(tokens1); // tokens1 is already in wei
      expect(power2).to.equal(tokens2); // tokens2 is already in wei
      expect(power3).to.equal(tokens3); // tokens3 is already in wei

      // Verify voting power through VotingStrategies
      const strategicPower1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        0,
        0 // DIRECT strategy, GENERAL category
      );
      const strategicPower2 = await votingStrategies.getCurrentVotingPower(
        await addr2.getAddress(),
        0,
        0
      );
      const strategicPower3 = await votingStrategies.getCurrentVotingPower(
        await addr3.getAddress(),
        0,
        0
      );

      expect(strategicPower1).to.equal(tokens1);
      expect(strategicPower2).to.equal(tokens2);
      expect(strategicPower3).to.equal(tokens3);

      console.log("✅ Weighted voting power correctly verified");
    });

    it("Votes should be proportional to tokens owned", async function () {
      console.log("\nVerifying vote-token proportionality...");

      const addr1Tokens = await demetraToken.balanceOf(
        await addr1.getAddress()
      );
      const addr1Votes = await demetraToken.getVotes(await addr1.getAddress());
      const addr2Tokens = await demetraToken.balanceOf(
        await addr2.getAddress()
      );
      const addr2Votes = await demetraToken.getVotes(await addr2.getAddress());

      expect(addr1Votes).to.equal(addr1Tokens);
      expect(addr2Votes).to.equal(addr2Tokens);

      // addr1 has 1000 tokens, addr2 has 500 tokens => 2:1 ratio
      expect(addr1Votes / addr2Votes).to.equal(addr1Tokens / addr2Tokens);

      console.log("✅ Vote-token proportionality verified");
    });
  });

  describe("4. Test Decision Voting", function () {
    let proposalId: number;

    beforeEach(async function () {
      // Setup for voting test
      const tokens1 = ethers.parseEther("1000");
      const tokens2 = ethers.parseEther("500");
      const tokens3 = ethers.parseEther("300");

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Create proposal
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Voting Test Proposal",
          "Proposal to test voting system",
          0,
          0,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      proposalId = event ? demetraDAO.interface.parseLog(event).args[0] : 1n;
    });

    it("Voting should work correctly with vote recording", async function () {
      console.log("\n=== TEST 4: DECISION VOTING ===");

      // Verify initial state
      expect(
        await proposalManager.hasVoted(proposalId, await addr1.getAddress())
      ).to.be.false;
      expect(
        await proposalManager.hasVoted(proposalId, await addr2.getAddress())
      ).to.be.false;
      expect(
        await proposalManager.hasVoted(proposalId, await addr3.getAddress())
      ).to.be.false;

      // addr1 votes FOR (1000 votes)
      console.log("addr1 voting FOR...");
      await expect(
        demetraDAO.connect(addr1).vote(proposalId, 1) // VoteChoice.FOR
      )
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr1.getAddress());

      // addr2 votes AGAINST (500 votes)
      console.log("addr2 voting AGAINST...");
      await expect(
        demetraDAO.connect(addr2).vote(proposalId, 2) // VoteChoice.AGAINST
      )
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr2.getAddress());

      // addr3 ABSTAINS (300 votes)
      console.log("addr3 abstaining...");
      await expect(
        demetraDAO.connect(addr3).vote(proposalId, 0) // VoteChoice.ABSTAIN
      )
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr3.getAddress());

      // Verify everyone has voted
      expect(
        await proposalManager.hasVoted(proposalId, await addr1.getAddress())
      ).to.be.true;
      expect(
        await proposalManager.hasVoted(proposalId, await addr2.getAddress())
      ).to.be.true;
      expect(
        await proposalManager.hasVoted(proposalId, await addr3.getAddress())
      ).to.be.true;

      // Verify updated member statistics
      const member1 = await demetraDAO.getMemberInfo(await addr1.getAddress());
      const member2 = await demetraDAO.getMemberInfo(await addr2.getAddress());
      const member3 = await demetraDAO.getMemberInfo(await addr3.getAddress());

      expect(member1.votesParticipated).to.equal(1n);
      expect(member2.votesParticipated).to.equal(1n);
      expect(member3.votesParticipated).to.equal(1n);

      // Verify DAO statistics
      const daoStats = await demetraDAO.getDAOStats();
      expect(daoStats._totalVotesCast).to.equal(3n);

      console.log("✅ Voting completed and recorded correctly");
    });

    it("Should not allow double voting", async function () {
      // First vote
      await demetraDAO.connect(addr1).vote(proposalId, 1);

      // Second vote attempt should fail
      await expect(
        demetraDAO.connect(addr1).vote(proposalId, 2)
      ).to.be.revertedWith("DemetraDAO: already voted");

      console.log("✅ Double voting prevention verified");
    });
  });

  describe("5. Test Decision Approval by Majority", function () {
    let proposalId: number;

    beforeEach(async function () {
      // Setup with more members for majority test
      const tokens1 = ethers.parseEther("1000"); // 55.6% of votes
      const tokens2 = ethers.parseEther("400"); // 22.2% of votes
      const tokens3 = ethers.parseEther("400"); // 22.2% of votes

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Create proposal
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Majority Test Proposal",
          "Proposal to test majority approval",
          0,
          0,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      proposalId = event ? demetraDAO.interface.parseLog(event).args[0] : 1n;
    });

    it("Decision with majority should be approved", async function () {
      console.log("\n=== TEST 5: MAJORITY APPROVAL ===");

      // Scenario: addr1 (1000 votes) and addr2 (400 votes) vote FOR = 1400 votes
      //          addr3 (400 votes) votes AGAINST = 400 votes
      //          Result: 77.8% FOR > 60% threshold => APPROVED

      console.log("Voting for majority...");
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      // Advance time beyond voting period
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // +7 days +1 second
      await ethers.provider.send("evm_mine");

      // Finalize proposal
      console.log("Finalizing proposal...");
      await demetraDAO.finalizeProposal(proposalId);

      // Verify proposal was approved
      const proposal = await proposalManager.getProposal(proposalId);
      const state = proposal[7]; // proposal state

      // ProposalState.SUCCEEDED = 2 (updated from correct order)
      expect(state).to.equal(2); // Should be SUCCEEDED

      console.log("✅ Proposal approved by majority verified");
    });
  });

  describe("6. Test Decision and Voting Registry", function () {
    it("Decision registry should be maintained correctly", async function () {
      console.log("\n=== TEST 6: DECISION AND VOTING REGISTRY ===");

      // Setup members
      const tokens = ethers.parseEther("1000");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());

      // Create multiple proposals
      console.log("Creating multiple proposals...");
      await demetraDAO
        .connect(addr1)
        .createProposal("Proposal 1", "Description 1", 0, 0, []);
      await demetraDAO
        .connect(addr1)
        .createProposal("Proposal 2", "Description 2", 0, 0, []);
      await demetraDAO
        .connect(addr2)
        .createProposal("Proposal 3", "Description 3", 0, 0, []);

      // Vote on multiple proposals
      console.log("Voting on multiple proposals...");
      await demetraDAO.connect(addr1).vote(1, 1); // FOR on proposal 1
      await demetraDAO.connect(addr2).vote(1, 1); // FOR on proposal 1

      await demetraDAO.connect(addr1).vote(2, 2); // AGAINST on proposal 2
      await demetraDAO.connect(addr2).vote(2, 1); // FOR on proposal 2

      await demetraDAO.connect(addr1).vote(3, 0); // ABSTAIN on proposal 3
      await demetraDAO.connect(addr2).vote(3, 2); // AGAINST on proposal 3

      // Verify global statistics registry
      const daoStats = await demetraDAO.getDAOStats();
      expect(daoStats._totalProposalsCreated).to.equal(3n);
      expect(daoStats._totalVotesCast).to.equal(6n); // 2 members x 3 proposals

      // Verify individual statistics registry
      const member1Stats = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      const member2Stats = await demetraDAO.getMemberInfo(
        await addr2.getAddress()
      );

      expect(member1Stats.proposalsCreated).to.equal(2n); // addr1 created 2 proposals
      expect(member1Stats.votesParticipated).to.equal(3n); // addr1 voted 3 times
      expect(member2Stats.proposalsCreated).to.equal(1n); // addr2 created 1 proposal
      expect(member2Stats.votesParticipated).to.equal(3n); // addr2 voted 3 times

      // Verify proposal details in registry
      const proposal1 = await proposalManager.getProposal(1);
      const proposal2 = await proposalManager.getProposal(2);
      const proposal3 = await proposalManager.getProposal(3);

      expect(proposal1[1]).to.equal("Proposal 1");
      expect(proposal2[1]).to.equal("Proposal 2");
      expect(proposal3[1]).to.equal("Proposal 3");

      // Verify vote status
      expect(await proposalManager.hasVoted(1, await addr1.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(2, await addr1.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(3, await addr1.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(1, await addr2.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(2, await addr2.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(3, await addr2.getAddress())).to.be
        .true;

      console.log("✅ Decision and voting registry maintained correctly");
    });
  });

  describe("7. Test Voting Restrictions without Shares", function () {
    let proposalId: number;

    beforeEach(async function () {
      // Setup: only addr1 has tokens, addr4 has none
      const tokens = ethers.parseEther("1000");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost });
      await demetraToken.connect(addr1).delegate(await addr1.getAddress());

      // Create proposal
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Restriction Test Proposal",
          "Proposal to test voting restrictions",
          0,
          0,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      proposalId = event ? demetraDAO.interface.parseLog(event).args[0] : 1n;
    });

    it("Should not be possible to vote without owning shares", async function () {
      console.log("\n=== TEST 7: VOTING RESTRICTIONS WITHOUT SHARES ===");

      // Verify addr4 is not a member
      expect(await demetraDAO.isMember(await addr4.getAddress())).to.be.false;

      // Verify addr4 has no tokens
      expect(await demetraToken.balanceOf(await addr4.getAddress())).to.equal(
        0
      );

      // Verify addr4 has no voting power
      expect(await demetraToken.getVotes(await addr4.getAddress())).to.equal(0);

      // Voting attempt from addr4 should fail
      console.log("Attempting vote from non-member...");
      await expect(
        demetraDAO.connect(addr4).vote(proposalId, 1)
      ).to.be.revertedWith("DemetraDAO: only members can vote");

      // Verify with canVote function
      const canVoteResult = await demetraDAO.canVote(
        await addr4.getAddress(),
        proposalId
      );
      expect(canVoteResult[0]).to.be.false; // cannot vote
      expect(canVoteResult[1]).to.equal("Not a member"); // reason

      console.log("✅ Voting restriction without shares verified");
    });

    it("Should not be possible to vote with tokens but without voting power", async function () {
      // addr2 purchases tokens but doesn't delegate (so voting power = 0)
      const tokens = ethers.parseEther("500");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr2).purchaseTokens({ value: cost });

      // Verify addr2 is member and has tokens
      expect(await demetraDAO.isMember(await addr2.getAddress())).to.be.true;
      expect(await demetraToken.balanceOf(await addr2.getAddress())).to.equal(
        tokens
      );

      // But has no voting power (didn't delegate)
      expect(await demetraToken.getVotes(await addr2.getAddress())).to.equal(0);

      // Verify with canVote function
      const canVoteResult = await demetraDAO.canVote(
        await addr2.getAddress(),
        proposalId
      );
      expect(canVoteResult[0]).to.be.false; // cannot vote
      expect(canVoteResult[1]).to.equal("No voting power"); // reason

      // Vote should fail at VotingStrategies level
      await expect(
        demetraDAO.connect(addr2).vote(proposalId, 1)
      ).to.be.revertedWith("VotingStrategies: no voting power");

      console.log("✅ Voting restriction without voting power verified");
    });

    it("Should allow voting only for those who own shares AND have voting power", async function () {
      // addr3 purchases tokens AND delegates (so has voting power)
      const tokens = ethers.parseEther("300");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr3).purchaseTokens({ value: cost });
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Verify required conditions
      expect(await demetraDAO.isMember(await addr3.getAddress())).to.be.true;
      expect(await demetraToken.balanceOf(await addr3.getAddress())).to.equal(
        tokens
      );
      expect(await demetraToken.getVotes(await addr3.getAddress())).to.equal(
        tokens
      );

      // Verify with canVote function
      const canVoteResult = await demetraDAO.canVote(
        await addr3.getAddress(),
        proposalId
      );
      expect(canVoteResult[0]).to.be.true; // can vote
      expect(canVoteResult[1]).to.equal("Can vote"); // reason

      // Vote should succeed
      await expect(demetraDAO.connect(addr3).vote(proposalId, 1))
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr3.getAddress());

      // Verify vote was recorded
      expect(
        await proposalManager.hasVoted(proposalId, await addr3.getAddress())
      ).to.be.true;

      console.log(
        "✅ Voting allowed only with shares and voting power verified"
      );
    });
  });

  describe("8. Test Complete Proposal Lifecycle", function () {
    it("Complete test: creation, voting, approval and execution", async function () {
      console.log("\n=== TEST 8: COMPLETE PROPOSAL LIFECYCLE ===");

      // === PHASE 1: MEMBER SETUP ===
      console.log("Phase 1: Member setup...");
      const tokens1 = ethers.parseEther("600"); // 60% of votes
      const tokens2 = ethers.parseEther("250"); // 25% of votes
      const tokens3 = ethers.parseEther("150"); // 15% of votes
      // Total: 1000 tokens

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // === PHASE 2: PROPOSAL CREATION ===
      console.log("Phase 2: Proposal creation...");
      const tx = await demetraDAO.connect(addr1).createProposal(
        "Important Strategic Proposal",
        "Proposal to implement new growth strategy",
        0, // DIRECT strategy
        1, // STRATEGIC category
        [] // no actions for now
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      const proposalId = event
        ? demetraDAO.interface.parseLog(event).args[0]
        : 1n;

      // Verify proposal created
      const proposal = await proposalManager.getProposal(proposalId);
      expect(proposal[1]).to.equal("Important Strategic Proposal");

      // === PHASE 3: VOTING ===
      console.log("Phase 3: Voting...");

      // addr1 (600 votes) votes FOR
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR

      // addr2 (250 votes) votes FOR
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR

      // addr3 (150 votes) votes AGAINST
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      // Expected result: 850 votes FOR vs 150 AGAINST = 85% approval

      // === PHASE 4: FINALIZATION ===
      console.log("Phase 4: Finalization...");

      // Advance time beyond voting period
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      // Finalize proposal
      await demetraDAO.finalizeProposal(proposalId);

      // === PHASE 5: VERIFY APPROVAL ===
      console.log("Phase 5: Verify approval...");

      const finalProposal = await proposalManager.getProposal(proposalId);
      const finalState = finalProposal[7];

      // Should be SUCCEEDED (2) since 85% > 60% threshold
      expect(finalState).to.equal(2);

      // === PHASE 6: VERIFY FINAL REGISTRY ===
      console.log("Phase 6: Verify final registry...");

      // Updated DAO statistics
      const finalStats = await demetraDAO.getDAOStats();
      expect(finalStats._totalProposalsCreated).to.equal(1n);
      expect(finalStats._totalVotesCast).to.equal(3n);
      expect(finalStats._totalMembers).to.equal(4n); // owner + 3 new members

      // Updated member statistics
      const member1Final = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      const member2Final = await demetraDAO.getMemberInfo(
        await addr2.getAddress()
      );
      const member3Final = await demetraDAO.getMemberInfo(
        await addr3.getAddress()
      );

      expect(member1Final.proposalsCreated).to.equal(1n);
      expect(member1Final.votesParticipated).to.equal(1n);
      expect(member2Final.votesParticipated).to.equal(1n);
      expect(member3Final.votesParticipated).to.equal(1n);

      console.log("✅ Complete proposal lifecycle verified successfully");
      console.log("   - Proposal created ✓");
      console.log("   - Voting completed ✓");
      console.log("   - Majority approval ✓");
      console.log("   - Registry updated ✓");
    });
  });

  describe("9. Test Edge Cases and Validations", function () {
    it("Should handle edge cases correctly", async function () {
      console.log("\n=== TEST 9: EDGE CASES AND VALIDATIONS ===");

      // Test disabled token sale
      await demetraDAO.disableTokenSale();

      await expect(
        demetraDAO.connect(addr1).purchaseTokens({
          value: await demetraDAO.calculateTokenCost(ethers.parseEther("100")),
        })
      ).to.be.revertedWith("DemetraDAO: token sale not active");

      // Re-enable sale
      await demetraDAO.enableTokenSale();

      // Test minimum and maximum purchase
      const minTokens = ethers.parseEther("1");
      const maxTokens = ethers.parseEther("10000");

      // Valid minimum purchase
      await expect(
        demetraDAO.connect(addr1).purchaseTokens({
          value: await demetraDAO.calculateTokenCost(minTokens),
        })
      ).to.not.be.reverted;

      // Valid maximum purchase
      await expect(
        demetraDAO.connect(addr2).purchaseTokens({
          value: await demetraDAO.calculateTokenCost(maxTokens),
        })
      ).to.not.be.reverted;

      // Test that existing member gets updated (not duplicated)
      const membersBefore = await demetraDAO.totalMembers();

      await demetraDAO.connect(addr1).purchaseTokens({
        value: await demetraDAO.calculateTokenCost(ethers.parseEther("100")),
      });

      const membersAfter = await demetraDAO.totalMembers();
      expect(membersAfter).to.equal(membersBefore); // Should not increase

      // But tokens should be updated
      const member1Info = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      const expectedTokens = minTokens + ethers.parseEther("100"); // 1 + 100 = 101 tokens
      expect(member1Info.tokensOwned).to.equal(expectedTokens);

      console.log("✅ Edge cases handled correctly");
    });
  });

  describe("10. Test Final Statistics and Reporting", function () {
    it("Should provide complete and accurate statistics", async function () {
      console.log("\n=== TEST 10: FINAL STATISTICS AND REPORTING ===");

      // Setup complex scenario with multiple actions
      const scenarios = [
        { addr: addr1, tokens: ethers.parseEther("500") },
        { addr: addr2, tokens: ethers.parseEther("300") },
        { addr: addr3, tokens: ethers.parseEther("200") },
      ];

      let totalFundsExpected = 0n;

      // Multiple purchases
      for (const scenario of scenarios) {
        const cost = await demetraDAO.calculateTokenCost(scenario.tokens);
        totalFundsExpected += cost;

        await demetraDAO.connect(scenario.addr).purchaseTokens({ value: cost });
        await demetraToken
          .connect(scenario.addr)
          .delegate(await scenario.addr.getAddress());
      }

      // Create multiple proposals
      await demetraDAO
        .connect(addr1)
        .createProposal("Prop 1", "Desc 1", 0, 0, []);
      await demetraDAO
        .connect(addr2)
        .createProposal("Prop 2", "Desc 2", 0, 0, []);

      // Multiple votes
      await demetraDAO.connect(addr1).vote(1, 1); // Prop 1: FOR
      await demetraDAO.connect(addr2).vote(1, 2); // Prop 1: AGAINST
      await demetraDAO.connect(addr3).vote(1, 0); // Prop 1: ABSTAIN

      await demetraDAO.connect(addr1).vote(2, 2); // Prop 2: AGAINST
      await demetraDAO.connect(addr2).vote(2, 1); // Prop 2: FOR
      // addr3 doesn't vote on Prop 2

      // Verify complete final statistics
      const finalStats = await demetraDAO.getDAOStats();

      console.log("Final DAO Statistics:");
      console.log(`  Total members: ${finalStats._totalMembers}`);
      console.log(`  Proposals created: ${finalStats._totalProposalsCreated}`);
      console.log(`  Total votes: ${finalStats._totalVotesCast}`);
      console.log(
        `  Funds raised: ${ethers.formatEther(
          finalStats._totalFundsRaised
        )} ETH`
      );
      console.log(
        `  Treasury balance: ${ethers.formatEther(
          finalStats._treasuryBalance
        )} ETH`
      );
      console.log(
        `  Token supply: ${ethers.formatEther(finalStats._tokenSupply)}`
      );
      console.log(`  Token sale active: ${finalStats._tokenSaleActive}`);

      // Statistics verification
      expect(finalStats._totalMembers).to.equal(4n); // owner + 3 new
      expect(finalStats._totalProposalsCreated).to.equal(2n);
      expect(finalStats._totalVotesCast).to.equal(5n); // 3 + 2 votes
      expect(finalStats._totalFundsRaised).to.equal(totalFundsExpected);
      expect(finalStats._treasuryBalance).to.equal(totalFundsExpected);
      expect(finalStats._tokenSupply).to.equal(
        scenarios[0].tokens + scenarios[1].tokens + scenarios[2].tokens
      ); // Direct sum of tokens in wei
      expect(finalStats._tokenSaleActive).to.be.true;

      // Verify detailed individual statistics
      const members = [
        { addr: await addr1.getAddress(), expectedProps: 1, expectedVotes: 2 },
        { addr: await addr2.getAddress(), expectedProps: 1, expectedVotes: 2 },
        { addr: await addr3.getAddress(), expectedProps: 0, expectedVotes: 1 },
      ];

      for (const member of members) {
        const info = await demetraDAO.getMemberInfo(member.addr);
        console.log(`Member ${member.addr}:`);
        console.log(`  Proposals created: ${info.proposalsCreated}`);
        console.log(`  Votes participated: ${info.votesParticipated}`);
        console.log(`  Tokens owned: ${ethers.formatEther(info.tokensOwned)}`);

        expect(info.proposalsCreated).to.equal(member.expectedProps);
        expect(info.votesParticipated).to.equal(member.expectedVotes);
        expect(info.isActive).to.be.true;
      }

      console.log("✅ All tests completed successfully!");
      console.log("✅ DAO system fully functional and verified");
    });
  });

  describe("11. Test Complete Governance Strategies", function () {
    let proposalId;

    beforeEach(async function () {
      // Setup members with different tokens
      const tokens = [
        { user: addr1, amount: ethers.parseEther("1000") }, // 40%
        { user: addr2, amount: ethers.parseEther("800") }, // 32%
        { user: addr3, amount: ethers.parseEther("700") }, // 28%
      ];

      for (const token of tokens) {
        const cost = await demetraDAO.calculateTokenCost(token.amount);
        await demetraDAO.connect(token.user).purchaseTokens({ value: cost });
        await demetraToken
          .connect(token.user)
          .delegate(await token.user.getAddress());
      }
    });

    it("Strategy 1: DIRECT DEMOCRACY - Token-weighted voting", async function () {
      console.log("\n=== TEST DIRECT DEMOCRACY ===");

      // Create proposal with DIRECT strategy
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Direct Democracy Proposal",
          "Direct democracy test - 1 token = 1 vote",
          VotingStrategy.DIRECT,
          ProposalCategory.GENERAL,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verify voting power = tokens owned
      const power1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.DIRECT,
        ProposalCategory.GENERAL
      );
      const power2 = await votingStrategies.getCurrentVotingPower(
        await addr2.getAddress(),
        VotingStrategy.DIRECT,
        ProposalCategory.GENERAL
      );

      console.log(`Holly voting power: ${ethers.formatEther(power1)} votes`);
      console.log(`Tom voting power: ${ethers.formatEther(power2)} votes`);

      expect(power1).to.equal(ethers.parseEther("1000"));
      expect(power2).to.equal(ethers.parseEther("800"));

      // Vote: Holly (1000) + Tom (800) = 1800 FOR vs Benji (700) AGAINST
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      console.log("Result: 1800 FOR vs 700 AGAINST (72% approval)");
      console.log("✅ Direct democracy: vote weight proportional to tokens");
    });

    it("Strategy 2: LIQUID DEMOCRACY - Category delegation", async function () {
      console.log("\n=== TEST LIQUID DEMOCRACY ===");

      // Benji delegates his TECHNICAL votes to Holly (the expert)
      console.log("Benji delegates TECHNICAL votes to Holly...");
      await votingStrategies
        .connect(addr3)
        .delegateForCategory(
          ProposalCategory.TECHNICAL,
          await addr1.getAddress()
        );

      // Verify active delegation
      const delegate = await votingStrategies.getCategoryDelegate(
        await addr3.getAddress(),
        ProposalCategory.TECHNICAL
      );
      expect(delegate).to.equal(await addr1.getAddress());

      // Create TECHNICAL proposal with LIQUID strategy
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Liquid Technical Proposal",
          "Technical upgrade - with category delegation",
          VotingStrategy.LIQUID,
          ProposalCategory.TECHNICAL,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verify voting power with delegation
      const HollyPowerLiquid = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.LIQUID,
        ProposalCategory.TECHNICAL
      );
      const BenjiDelegatedVotes =
        await votingStrategies.getCategoryDelegatedVotes(
          await addr1.getAddress(),
          ProposalCategory.TECHNICAL
        );

      console.log(
        `Holly base power: ${ethers.formatEther(
          ethers.parseEther("1000")
        )} votes`
      );
      console.log(
        `Benji delegated to Holly: ${ethers.formatEther(
          BenjiDelegatedVotes
        )} votes`
      );
      console.log(
        `Holly total power: ${ethers.formatEther(HollyPowerLiquid)} votes`
      );

      // Holly should have 1000 (her own) + 700 (delegated from Benji) = 1700
      expect(HollyPowerLiquid).to.equal(ethers.parseEther("1700"));

      // Vote with liquid democracy
      await demetraDAO.connect(addr1).vote(proposalId, 1); // Holly: 1700 votes FOR
      await demetraDAO.connect(addr2).vote(proposalId, 2); // Tom: 800 votes AGAINST
      // Benji doesn't vote (has delegated)

      console.log("Liquid Result: 1700 FOR vs 800 AGAINST (68% approval)");
      console.log("✅ Liquid democracy: category delegation functional");
    });

    it("Strategy 3: CONSENSUS - One member, one vote", async function () {
      console.log("\n=== TEST CONSENSUS ===");

      // Create proposal with CONSENSUS strategy
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Consensus Proposal",
          "Critical decision - requires 75% consensus",
          VotingStrategy.CONSENSUS,
          ProposalCategory.GOVERNANCE,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verify voting power = 1 for all (regardless of tokens)
      const consensusPower1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.CONSENSUS,
        ProposalCategory.GOVERNANCE
      );
      const consensusPower2 = await votingStrategies.getCurrentVotingPower(
        await addr2.getAddress(),
        VotingStrategy.CONSENSUS,
        ProposalCategory.GOVERNANCE
      );
      const consensusPower3 = await votingStrategies.getCurrentVotingPower(
        await addr3.getAddress(),
        VotingStrategy.CONSENSUS,
        ProposalCategory.GOVERNANCE
      );

      console.log(`Holly consensus power: ${consensusPower1} vote`);
      console.log(`Tom consensus power: ${consensusPower2} vote`);
      console.log(`Benji consensus power: ${consensusPower3} vote`);

      expect(consensusPower1).to.equal(1); // 1 vote regardless of tokens
      expect(consensusPower2).to.equal(1);
      expect(consensusPower3).to.equal(1);

      // Test 1: Only 2/3 members vote FOR (66.7% < 75% required)
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      // Finalize proposal
      await ethers.provider.send("evm_increaseTime", [14 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      await demetraDAO.finalizeProposal(proposalId);

      const proposal = await proposalManager.getProposal(proposalId);
      const proposalState = proposal[7]; // Assuming index 7 is the state, as in other tests
      expect(proposalState).to.equal(4); // FAILED - doesn't reach 75%

      console.log(
        "Consensus Result: 2 FOR vs 1 AGAINST (66.7% < 75% required)"
      );
      console.log("✅ Consensus: 75% supermajority requirement functional");
    });

    it("Strategy 4: REPRESENTATIVE - Representative election", async function () {
      console.log("\n=== TEST REPRESENTATIVE DEMOCRACY ===");

      // For now base implementation similar to direct
      // But structure ready for extension with representative election

      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Representative Proposal",
          "Test representative democracy - base implementation",
          VotingStrategy.REPRESENTATIVE,
          ProposalCategory.STRATEGIC,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verify voting power (base implementation = direct)
      const reprPower1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.REPRESENTATIVE,
        ProposalCategory.STRATEGIC
      );

      expect(reprPower1).to.equal(ethers.parseEther("1000"));

      console.log("✅ Representative democracy: structure implemented");
      console.log("   (Ready for extension with representative election)");
    });

    it("Comparative Test: Same decision with 4 different strategies", async function () {
      console.log("\n=== COMPARATIVE STRATEGY TEST ===");

      const strategies = [
        {
          name: "DIRECT",
          strategy: VotingStrategy.DIRECT,
          category: ProposalCategory.GENERAL,
        },
        {
          name: "LIQUID",
          strategy: VotingStrategy.LIQUID,
          category: ProposalCategory.TECHNICAL,
        },
        {
          name: "REPRESENTATIVE",
          strategy: VotingStrategy.REPRESENTATIVE,
          category: ProposalCategory.STRATEGIC,
        },
        {
          name: "CONSENSUS",
          strategy: VotingStrategy.CONSENSUS,
          category: ProposalCategory.GOVERNANCE,
        },
      ];

      const results = [];

      for (let i = 0; i < strategies.length; i++) {
        const strat = strategies[i];

        // Create identical proposal with different strategy
        const tx = await demetraDAO
          .connect(addr1)
          .createProposal(
            `Decision ${strat.name}`,
            "Same decision tested with different strategies",
            strat.strategy,
            strat.category,
            []
          );

        const receipt = await tx.wait();
        const event = receipt.logs.find((log: any) => {
          try {
            const parsed = demetraDAO.interface.parseLog(log);
            return parsed?.name === "ProposalSubmitted";
          } catch {
            return false;
          }
        });
        const propId = demetraDAO.interface.parseLog(event).args[0];

        // Always same vote: Holly+Tom FOR, Benji AGAINST
        await demetraDAO.connect(addr1).vote(propId, 1);
        await demetraDAO.connect(addr2).vote(propId, 1);
        await demetraDAO.connect(addr3).vote(propId, 2);

        // Calculate voting power for strategy
        const power1 = await votingStrategies.getCurrentVotingPower(
          await addr1.getAddress(),
          strat.strategy,
          strat.category
        );
        const power2 = await votingStrategies.getCurrentVotingPower(
          await addr2.getAddress(),
          strat.strategy,
          strat.category
        );
        const power3 = await votingStrategies.getCurrentVotingPower(
          await addr3.getAddress(),
          strat.strategy,
          strat.category
        );

        const totalFor = power1 + power2;
        const totalAgainst = power3;
        const percentage = (totalFor * 100n) / (totalFor + totalAgainst);

        results.push({
          strategy: strat.name,
          votesFor: totalFor,
          votesAgainst: totalAgainst,
          percentage: percentage.toString(),
        });

        console.log(
          `${strat.name}: ${totalFor} FOR vs ${totalAgainst} AGAINST (${percentage}%)`
        );
      }

      console.log("\n📊 Comparative Results:");
      results.forEach((r) => {
        console.log(`  ${r.strategy}: ${r.percentage}% approval`);
      });

      // Verify strategies give different results
      expect(results[0].votesFor).to.not.equal(results[3].votesFor); // DIRECT ≠ CONSENSUS

      console.log("✅ All 4 strategies implemented and functional!");
    });
  });
});
