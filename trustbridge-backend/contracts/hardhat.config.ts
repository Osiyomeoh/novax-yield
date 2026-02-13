import { HardhatUserConfig } from "hardhat/config.js";
import "@nomicfoundation/hardhat-toolbox";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const config = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    // Mantle networks removed
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    },
    etherlink_testnet: {
      url: process.env.ETHERLINK_TESTNET_RPC_URL || "https://node.shadownet.etherlink.com",
      chainId: 127823,
      accounts: (() => {
        const accounts: string[] = [];
        if (process.env.ETHERLINK_PRIVATE_KEY) {
          accounts.push(process.env.ETHERLINK_PRIVATE_KEY);
        }
        // Support both ETHERLINK_PRIVATE_KEY2 and ETHERLINK_PRIVATE_KEY_2 naming conventions
        // Prefer ETHERLINK_PRIVATE_KEY2 if both exist to avoid duplicates
        if (process.env.ETHERLINK_PRIVATE_KEY2) {
          accounts.push(process.env.ETHERLINK_PRIVATE_KEY2);
        } else if (process.env.ETHERLINK_PRIVATE_KEY_2) {
          accounts.push(process.env.ETHERLINK_PRIVATE_KEY_2);
        }
        if (process.env.ETHERLINK_PRIVATE_KEY3) {
          accounts.push(process.env.ETHERLINK_PRIVATE_KEY3);
        } else if (process.env.ETHERLINK_PRIVATE_KEY_3) {
          accounts.push(process.env.ETHERLINK_PRIVATE_KEY_3);
        }
        if (process.env.ETHERLINK_PRIVATE_KEY4) {
          accounts.push(process.env.ETHERLINK_PRIVATE_KEY4);
        } else if (process.env.ETHERLINK_PRIVATE_KEY_4) {
          accounts.push(process.env.ETHERLINK_PRIVATE_KEY_4);
        }
        return accounts;
      })(),
      gas: "auto",
      gasPrice: "auto",
    },
    etherlink_mainnet: {
      url: process.env.ETHERLINK_MAINNET_RPC_URL || "https://rpc.mainnet.etherlink.com",
      chainId: 42793,
      accounts: process.env.ETHERLINK_PRIVATE_KEY ? [process.env.ETHERLINK_PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto",
    },
    // Hedera networks removed
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
      customChains: [
        {
          network: "etherlink_testnet",
          chainId: 127823,
          urls: {
            apiURL: "https://shadownet.explorer.etherlink.com/api",
            browserURL: "https://shadownet.explorer.etherlink.com",
          },
        },
        {
          network: "etherlinkMainnet",
          chainId: 42793,
          urls: {
            apiURL: "https://explorer.etherlink.com/api",
            browserURL: "https://explorer.etherlink.com",
          },
        },
      ],
    },
  } as any,
  chainDescriptors: {
    // Mantle chain descriptors removed
    127823: {
      name: "etherlinkShadownet",
      blockExplorers: {
        etherscan: {
          name: "Etherlink Shadownet Explorer",
          url: "https://shadownet.explorer.etherlink.com",
          apiUrl: "https://shadownet.explorer.etherlink.com/api",
        },
      },
    },
    42793: {
      name: "etherlinkMainnet",
      blockExplorers: {
        etherscan: {
          name: "Etherlink Mainnet Explorer",
          url: "https://explorer.etherlink.com",
          apiUrl: "https://explorer.etherlink.com/api",
        },
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
} as HardhatUserConfig;

export default config;
