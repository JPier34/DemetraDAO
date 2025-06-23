import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // viaIR: true,
    },
  },
  networks: {
    hardhat: {
      blockGasLimit: 30000000,
      gas: 30000000,
      gasPrice: 1000000000, // 1 gwei
      accounts: {
        count: 20,
        accountsBalance: "100000000000000000000000000000000000",
      },
    },
  }, // 100,000 ETH per account
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
};

export default config;
