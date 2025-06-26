const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Simple deployment test...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📋 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

  // Test 1: Deploy DemetraToken with minimal parameters
  console.log("\n🧪 Test 1: DemetraToken with name + symbol only");
  try {
    const TokenFactory = await ethers.getContractFactory("DemetraToken");
    console.log("✅ Factory loaded");

    // Try with just name and symbol
    const token = await TokenFactory.deploy("Test Token", "TEST");
    await token.waitForDeployment();

    const tokenAddr = await token.getAddress();
    console.log("✅ SUCCESS: DemetraToken deployed to:", tokenAddr);
    console.log(
      "🔗 BaseScan:",
      `https://sepolia.basescan.org/address/${tokenAddr}`
    );

    return { success: true, address: tokenAddr };
  } catch (error1) {
    console.log("❌ Test 1 failed:", error1.message);

    // Test 2: Try with no parameters
    console.log("\n🧪 Test 2: DemetraToken with no parameters");
    try {
      const TokenFactory = await ethers.getContractFactory("DemetraToken");
      const token = await TokenFactory.deploy();
      await token.waitForDeployment();

      const tokenAddr = await token.getAddress();
      console.log("✅ SUCCESS: DemetraToken deployed to:", tokenAddr);
      console.log(
        "🔗 BaseScan:",
        `https://sepolia.basescan.org/address/${tokenAddr}`
      );

      return { success: true, address: tokenAddr };
    } catch (error2) {
      console.log("❌ Test 2 failed:", error2.message);

      // Test 3: Try with 3 parameters
      console.log("\n🧪 Test 3: DemetraToken with name + symbol + supply");
      try {
        const TokenFactory = await ethers.getContractFactory("DemetraToken");
        const token = await TokenFactory.deploy(
          "Test Token",
          "TEST",
          ethers.parseEther("1000000")
        );
        await token.waitForDeployment();

        const tokenAddr = await token.getAddress();
        console.log("✅ SUCCESS: DemetraToken deployed to:", tokenAddr);
        console.log(
          "🔗 BaseScan:",
          `https://sepolia.basescan.org/address/${tokenAddr}`
        );

        return { success: true, address: tokenAddr };
      } catch (error3) {
        console.log("❌ Test 3 failed:", error3.message);

        console.log(
          "\n💡 All tests failed. The issue is with DemetraToken constructor."
        );
        console.log("📋 Debug steps:");
        console.log(
          "1. Check: grep -A 10 'constructor' contracts/DemetraToken.sol"
        );
        console.log("2. Verify the exact parameters expected");
        console.log("3. Make sure contract compiles correctly");

        return { success: false, error: "Constructor parameter mismatch" };
      }
    }
  }
}

main()
  .then((result) => {
    if (result.success) {
      console.log("\n🎉 At least one deployment succeeded!");
      console.log("📝 Use this pattern for the full deployment");
    } else {
      console.log("\n❌ All deployment attempts failed");
      console.log("🔍 Check your DemetraToken constructor definition");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Unexpected error:", error);
    process.exit(1);
  });
