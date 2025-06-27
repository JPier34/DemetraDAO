require("@nomicfoundation/hardhat-toolbox");
require("@typechain/hardhat");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
              yulDetails: {
                stackAllocation: true,
                optimizerSteps: "dhfoDgvulfnTUtnIf",
              },
            },
          },
          viaIR: true,
        },
      },
    ],
  },

  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20, // More account for testing
        accountsBalance: "100000000000000000000000", // 100,000 ETH for each account
      },
      gas: 30000000,
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      gas: 30000000,
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true,
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      gas: 15000000, // 15M gas limit
      gasPrice: 1000000000, // 1 gwei - molto economico
      timeout: 120000,
    },

    // Optimism Sepolia - Alternative
    optimismSepolia: {
      url: "https://sepolia.optimism.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155420,
      gas: 15000000,
      gasPrice: 1000000000,
    },

    // Arbitrum Sepolia - Alternative
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 421614,
      gas: 20000000,
      gasPrice: 1000000000,
    },
  },

  etherscan: {
    apikey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
    },
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    externalArtifacts: ["externalArtifacts/*.json"],
    dontOverrideCompile: false,
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20, // gwei
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    excludeContracts: ["test/", "mock/"],
  },

  mocha: {
    timeout: 60000, // 60 seconds timeout
    reporter: "spec",
    slow: 10000, // Tests slower than 10s are 'slow'
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Solidity-coverage config
  coverage: {
    enabled: true,
    skipFiles: ["test/", "mock/", "interfaces/"],
    measureStatementCoverage: true,
    measureBranchCoverage: true,
    measureFunctionCoverage: true,
  },
};
