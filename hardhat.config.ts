require("@nomicfoundation/hardhat-toolbox");
require("@typechain/hardhat");
require("hardhat-gas-reporter");
require("solidity-coverage");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1, // Riduci runs per contratti più piccoli
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf",
          },
        },
      },
      viaIR: true, // Importante per ottimizzazione avanzata
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20, // Più account per i test
        accountsBalance: "100000000000000000000000", // 100,000 ETH per account
      },
      gas: 30000000, // Aumentato gas limit
      blockGasLimit: 30000000, // Aumentato block gas limit
      allowUnlimitedContractSize: true, // IMPORTANTE: Abilita contratti grandi
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      gas: 30000000,
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true,
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
    timeout: 60000, // 60 secondi timeout per test complessi
    reporter: "spec",
    slow: 10000, // Test più lenti di 10s vengono marcati come slow
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Configurazione per solidity-coverage
  coverage: {
    enabled: true,
    skipFiles: ["test/", "mock/", "interfaces/"],
    measureStatementCoverage: true,
    measureBranchCoverage: true,
    measureFunctionCoverage: true,
  },
};
