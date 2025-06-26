const { ethers } = require("hardhat");

async function main() {
  console.log(
    "🚀 Deploying DemetraDAO to Base Sepolia (Large Contract Support)...\n"
  );

  const [deployer] = await ethers.getSigners();
  console.log("📋 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  Need Base Sepolia ETH from:");
    console.log("   • https://portal.cdp.coinbase.com/products/faucet");
    console.log("   • https://www.alchemy.com/faucets/base-sepolia");
    return;
  }

  // Check contract size
  console.log("\n🔍 Checking contract compatibility...");
  const DemetraDAOFactory = await ethers.getContractFactory("DemetraDAO");
  const bytecodeSize = (DemetraDAOFactory.bytecode.length - 2) / 2;
  console.log(`📊 DemetraDAO bytecode: ${bytecodeSize.toLocaleString()} bytes`);
  console.log(`📊 Base Sepolia limit: ~49,152 bytes`);

  if (bytecodeSize <= 49152) {
    console.log("✅ Contract fits within Base Sepolia limits!");
  } else {
    console.log("⚠️  Contract large but Base should still support it");
  }

  // Deploy parameters
  const TOKEN_NAME = "Demetra Governance Token";
  const TOKEN_SYMBOL = "DMTR";
  const TOKEN_PRICE = ethers.parseEther("0.001");
  const MAX_SUPPLY = ethers.parseEther("1000000");

  console.log("\n📊 Deployment Parameters:");
  console.log(`  Token Name: ${TOKEN_NAME}`);
  console.log(`  Token Symbol: ${TOKEN_SYMBOL}`);
  console.log(`  Token Price: ${ethers.formatEther(TOKEN_PRICE)} ETH`);
  console.log(`  Max Supply: ${ethers.formatEther(MAX_SUPPLY)} tokens`);

  console.log("\n🏗️  Deploying DemetraDAO on Base Sepolia...");

  try {
    const demetraDAO = await DemetraDAOFactory.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_PRICE,
      MAX_SUPPLY,
      deployer.address,
      {
        gasLimit: 10000000, // 10M gas - Base può gestirlo
        gasPrice: ethers.parseUnits("1", "gwei"), // 1 gwei - molto economico su Base
      }
    );

    console.log("⏳ Waiting for deployment confirmation...");
    await demetraDAO.waitForDeployment();

    const daoAddress = await demetraDAO.getAddress();
    console.log("✅ DemetraDAO deployed to:", daoAddress);

    // Get deployment costs
    const deployTx = demetraDAO.deploymentTransaction();
    if (deployTx) {
      const receipt = await deployTx.wait();
      console.log(`💰 Gas used: ${receipt.gasUsed.toLocaleString()}`);
      console.log(
        `💰 Gas price: ${ethers.formatUnits(deployTx.gasPrice, "gwei")} gwei`
      );
      const cost = receipt.gasUsed * deployTx.gasPrice;
      console.log(`💰 Total cost: ${ethers.formatEther(cost)} ETH`);
    }

    // Get internal contract addresses
    console.log("\n🔗 Getting internal contract addresses...");
    const tokenAddr = await demetraDAO.demetraToken();
    const proposalManagerAddr = await demetraDAO.proposalManager();
    const votingStrategiesAddr = await demetraDAO.votingStrategies();

    const contracts = {
      demetraDAO: daoAddress,
      demetraToken: tokenAddr,
      proposalManager: proposalManagerAddr,
      votingStrategies: votingStrategiesAddr,
    };

    console.log("\n📋 Contract Addresses:");
    console.log(`  DemetraDAO: ${contracts.demetraDAO}`);
    console.log(`  DemetraToken: ${contracts.demetraToken}`);
    console.log(`  ProposalManager: ${contracts.proposalManager}`);
    console.log(`  VotingStrategies: ${contracts.votingStrategies}`);

    console.log("\n🔗 BaseScan Links:");
    Object.entries(contracts).forEach(([name, addr]) => {
      console.log(`  ${name}: https://sepolia.basescan.org/address/${addr}`);
    });

    // Quick verification
    console.log("\n🔍 Quick verification...");
    const totalMembers = await demetraDAO.totalMembers();
    const tokenSaleActive = await demetraDAO.tokenSaleActive();
    const treasuryBalance = await demetraDAO.treasuryBalance();

    console.log("✅ Deployment verification:");
    console.log(`  Total members: ${totalMembers}`);
    console.log(`  Token sale active: ${tokenSaleActive}`);
    console.log(
      `  Treasury balance: ${ethers.formatEther(treasuryBalance)} ETH`
    );

    // Save deployment info
    const deploymentInfo = {
      network: "base-sepolia",
      chainId: 84532,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts,
      basescanLinks: Object.fromEntries(
        Object.entries(contracts).map(([name, addr]) => [
          name,
          `https://sepolia.basescan.org/address/${addr}`,
        ])
      ),
      contractSize: `${bytecodeSize.toLocaleString()} bytes`,
      deploymentCost: deployTx
        ? ethers.formatEther(receipt.gasUsed * deployTx.gasPrice)
        : "unknown",
    };

    // Save to file
    const fs = require("fs");
    const path = require("path");

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, "base-sepolia.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log(`\n📁 Deployment info saved to: ${deploymentFile}`);
    console.log("\n🎉 Base Sepolia deployment successful!");

    console.log("\n📋 Next steps:");
    console.log("1. Visit BaseScan links above to verify contracts");
    console.log("2. Update README.md with Base Sepolia addresses");
    console.log("3. Test DAO functionality on Base network");
    console.log("\n💡 Base advantages:");
    console.log("   • Large contract support (48KB+)");
    console.log("   • Very low gas costs");
    console.log("   • Fast confirmations");
    console.log("   • Ethereum-compatible");

    return contracts;
  } catch (error) {
    console.error("\n❌ Base deployment failed:", error.message);

    if (error.message.includes("initcode is too big")) {
      console.log("💡 Even Base can't handle this contract size.");
      console.log("Try Arbitrum or Optimism which have even higher limits.");
    }

    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Base Sepolia deployment completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Base deployment failed:", error);
    process.exit(1);
  });
