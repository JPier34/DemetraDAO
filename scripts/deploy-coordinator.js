const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying DemetraDAO using existing contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📋 Deployer:", deployer.address);

  // Existing deployed contracts (latest batch)
  const EXISTING_CONTRACTS = {
    demetraToken: "0x2c7e59Af42DA4D9C8Fcb08413cbbf12B8f0b97a5",
    proposalManager: "0xaf39f2A932c54B8dAaC21Ac5d877302E8c7252e9",
    votingStrategies: "0x88a02Dbca28eE4dB12a22b1F8C02ab32Ba264827",
  };

  console.log("🔗 Using existing contracts:");
  console.log(`   Token: ${EXISTING_CONTRACTS.demetraToken}`);
  console.log(`   Proposals: ${EXISTING_CONTRACTS.proposalManager}`);
  console.log(`   Voting: ${EXISTING_CONTRACTS.votingStrategies}`);

  try {
    console.log("\n🏗️  Deploying DemetraDAO...");

    const CoordinatorFactory = await ethers.getContractFactory("DemetraDAO");
    const coordinatorBytecode = (CoordinatorFactory.bytecode.length - 2) / 2;
    console.log(
      `📊 DemetraDAO size: ${coordinatorBytecode.toLocaleString()} bytes`
    );

    const coordinator = await CoordinatorFactory.deploy(
      EXISTING_CONTRACTS.demetraToken,
      EXISTING_CONTRACTS.proposalManager,
      EXISTING_CONTRACTS.votingStrategies,
      deployer.address,
      {
        gasLimit: 3000000,
        gasPrice: ethers.parseUnits("1.5", "gwei"),
      }
    );

    console.log("⏳ Waiting for deployment...");
    await coordinator.waitForDeployment();

    const coordinatorAddress = await coordinator.getAddress();
    console.log(`✅ DemetraDAO deployed at: ${coordinatorAddress}`);

    // Get deployment stats - FIX: declare receipt outside if block
    const coordinatorTx = coordinator.deploymentTransaction();
    let receipt = null;
    let gasUsed = "unknown";
    let deploymentCost = "unknown";

    if (coordinatorTx) {
      receipt = await coordinatorTx.wait();
      gasUsed = receipt.gasUsed.toString();
      deploymentCost = ethers.formatEther(
        receipt.gasUsed * coordinatorTx.gasPrice
      );

      console.log(`⛽ Gas used: ${receipt.gasUsed.toLocaleString()}`);
      console.log(`💰 Cost: ${deploymentCost} ETH`);
    }

    // Test basic functionality
    console.log("\n🧪 Testing coordinator functionality...");

    const stats = await coordinator.getDAOStats();
    console.log(`👥 Total members: ${stats._totalMembers}`);
    console.log(
      `💰 Treasury: ${ethers.formatEther(stats._treasuryBalance)} ETH`
    );
    console.log(
      `🪙 Token supply: ${ethers.formatEther(stats._tokenSupply)} DMTR`
    );

    const testCost = await coordinator.calculateTokenCost(
      ethers.parseEther("100")
    );
    console.log(`💡 Cost for 100 tokens: ${ethers.formatEther(testCost)} ETH`);

    // Test that we can access the external contracts
    console.log("\n🔗 Testing external contract access...");
    const tokenContract = await ethers.getContractAt(
      "DemetraToken",
      EXISTING_CONTRACTS.demetraToken
    );
    const tokenName = await tokenContract.name();
    const tokenSymbol = await tokenContract.symbol();
    console.log(`📋 Connected to: ${tokenName} (${tokenSymbol})`);

    console.log("\n🎉 SUCCESS: DemetraDAO deployed and functional!");

    // BaseScan links
    console.log("\n🔗 BaseScan Links:");
    console.log(
      `  Coordinator: https://sepolia.basescan.org/address/${coordinatorAddress}`
    );
    console.log(
      `  Token: https://sepolia.basescan.org/address/${EXISTING_CONTRACTS.demetraToken}`
    );
    console.log(
      `  Proposals: https://sepolia.basescan.org/address/${EXISTING_CONTRACTS.proposalManager}`
    );
    console.log(
      `  Voting: https://sepolia.basescan.org/address/${EXISTING_CONTRACTS.votingStrategies}`
    );

    // Complete DAO system summary
    console.log("\n📋 COMPLETE DAO SYSTEM DEPLOYED:");
    console.log("==========================================");
    console.log(`✅ DemetraToken: ${EXISTING_CONTRACTS.demetraToken}`);
    console.log(`✅ ProposalManager: ${EXISTING_CONTRACTS.proposalManager}`);
    console.log(`✅ VotingStrategies: ${EXISTING_CONTRACTS.votingStrategies}`);
    console.log(`✅ DemetraDAO: ${coordinatorAddress}`);

    // Save deployment info - FIX: use the properly scoped variables
    const deploymentInfo = {
      network: "base-sepolia",
      chainId: 84532,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      deploymentType: "coordinator-with-existing-contracts",
      contracts: {
        coordinator: coordinatorAddress,
        existingToken: EXISTING_CONTRACTS.demetraToken,
        existingProposals: EXISTING_CONTRACTS.proposalManager,
        existingVoting: EXISTING_CONTRACTS.votingStrategies,
      },
      basescanLinks: {
        coordinator: `https://sepolia.basescan.org/address/${coordinatorAddress}`,
        token: `https://sepolia.basescan.org/address/${EXISTING_CONTRACTS.demetraToken}`,
        proposals: `https://sepolia.basescan.org/address/${EXISTING_CONTRACTS.proposalManager}`,
        voting: `https://sepolia.basescan.org/address/${EXISTING_CONTRACTS.votingStrategies}`,
      },
      coordinatorSize: coordinatorBytecode,
      gasUsed: gasUsed,
      deploymentCost: deploymentCost,
    };

    // Save to file
    const fs = require("fs");
    const path = require("path");

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(
      deploymentsDir,
      "base-sepolia-coordinator.json"
    );
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log(`\n📁 Deployment info saved to: ${deploymentFile}`);

    return coordinatorAddress;
  } catch (error) {
    console.error("❌ DemetraDAO deployment failed:", error.message);
    throw error;
  }
}

main()
  .then((address) => {
    console.log(`\n🎉 COMPLETE DAO SYSTEM READY!`);
    console.log(`📋 Coordinator: ${address}`);
    console.log(`\n💡 Next steps:`);
    console.log(`1. Test token purchase: coordinator.purchaseTokens()`);
    console.log(`2. Create test proposal with coordinator.createProposal()`);
    console.log(`3. Vote using coordinator.vote()`);
    console.log(`4. Build frontend interface`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
