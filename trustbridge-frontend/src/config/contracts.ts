/**
 * Contract Addresses Configuration
 * These addresses are loaded from environment variables or deployment config
 */

import { ethers } from 'ethers';

export interface ContractAddresses {
  TRUST_TOKEN: string;
  ASSET_NFT: string;
  CORE_ASSET_FACTORY: string;
  TRUST_ASSET_FACTORY: string;
  POOL_MANAGER: string;
  VERIFICATION_REGISTRY: string;
  TRUST_MARKETPLACE: string;
  TRUST_FAUCET: string;
  TRUST_TOKEN_EXCHANGE: string;
  AMC_MANAGER: string;
}

/**
 * Get contract address from environment or throw error
 * Tries multiple naming conventions for backward compatibility
 */
export const getContractAddress = (contractName: keyof ContractAddresses): string => {
  // Try multiple possible environment variable formats
  const envKey1 = `VITE_${contractName}_CONTRACT_ADDRESS`;
  const envKey2 = `VITE_${contractName}_ADDRESS`;
  
  // Special handling for AMC_MANAGER which uses VITE_AMC_MANAGER_ADDRESS
  const envKey3 = contractName === 'AMC_MANAGER' ? 'VITE_AMC_MANAGER_ADDRESS' : null;
  
  const address = import.meta.env[envKey1] || import.meta.env[envKey2] || (envKey3 ? import.meta.env[envKey3] : null);
  
  if (!address || address === '0x0000000000000000000000000000000000000000' || address.trim() === '') {
    console.error(`❌ Contract address for ${contractName} not found!`);
    console.error(`   Tried: ${envKey1}, ${envKey2}${envKey3 ? `, ${envKey3}` : ''}`);
    console.error(`   Please set the contract address in your .env file`);
    throw new Error(`Contract address for ${contractName} not configured. Please set VITE_${contractName}_ADDRESS in .env`);
  }
  
  // Validate address format
  if (!address.startsWith('0x') || address.length !== 42) {
    console.error(`❌ Invalid contract address format for ${contractName}: ${address}`);
    throw new Error(`Invalid contract address format for ${contractName}`);
  }
  
  console.log(`✅ Using ${contractName} address: ${address}`);
  
  // Debug logging for AMC_MANAGER to help troubleshoot
  if (contractName === 'AMC_MANAGER') {
    console.log(`🔍 AMC_MANAGER Debug:`, {
      'envKey1 (VITE_AMC_MANAGER_CONTRACT_ADDRESS)': import.meta.env.VITE_AMC_MANAGER_CONTRACT_ADDRESS,
      'envKey2 (VITE_AMC_MANAGER_ADDRESS)': import.meta.env.VITE_AMC_MANAGER_ADDRESS,
      'envKey3 (VITE_AMC_MANAGER_ADDRESS)': import.meta.env.VITE_AMC_MANAGER_ADDRESS,
      'Final address': address
    });
  }
  
  return address;
};

/**
 * All contract addresses
 */
export const contractAddresses: ContractAddresses = {
  TRUST_TOKEN: getContractAddress('TRUST_TOKEN'),
  ASSET_NFT: getContractAddress('ASSET_NFT'),
  CORE_ASSET_FACTORY: getContractAddress('CORE_ASSET_FACTORY'),
  TRUST_ASSET_FACTORY: getContractAddress('TRUST_ASSET_FACTORY'),
  POOL_MANAGER: getContractAddress('POOL_MANAGER'),
  VERIFICATION_REGISTRY: getContractAddress('VERIFICATION_REGISTRY'),
  TRUST_MARKETPLACE: getContractAddress('TRUST_MARKETPLACE'),
  TRUST_FAUCET: getContractAddress('TRUST_FAUCET'),
  TRUST_TOKEN_EXCHANGE: getContractAddress('TRUST_TOKEN_EXCHANGE'),
  AMC_MANAGER: getContractAddress('AMC_MANAGER'),
};

/**
 * Novax Yield Contract Addresses (Etherlink Shadownet)
 * Updated with latest deployed addresses
 */
export interface NovaxContractAddresses {
  RWA_FACTORY: string;
  RECEIVABLE_FACTORY: string;
  POOL_MANAGER: string;
  MARKETPLACE: string;
  NVX_TOKEN: string;
  USDC: string;
  STAKING_VAULT: string;
  VAULT_CAPACITY_MANAGER: string;
}

export const novaxContractAddresses: NovaxContractAddresses = {
  RWA_FACTORY: import.meta.env.VITE_NOVAX_RWA_FACTORY_ADDRESS || '0xa2f09a984dc9730F5F6519886EDB527962819a69',
  RECEIVABLE_FACTORY: import.meta.env.VITE_NOVAX_RECEIVABLE_FACTORY_ADDRESS || '0x8bec56E184A90fd2a9f438b6DBb7d55aF155a453', // New with efficient getters
  POOL_MANAGER: import.meta.env.VITE_NOVAX_POOL_MANAGER_ADDRESS || '0xe40D74E1f4184fB534085452b748852a63421118', // New with stakingVault support
  MARKETPLACE: import.meta.env.VITE_NOVAX_MARKETPLACE_ADDRESS || '0x0C66b29384919Ea0CaC553f23Cda58076AF3450C',
  NVX_TOKEN: import.meta.env.VITE_NVX_TOKEN_ADDRESS || '0x40c0B78b584486473216FE108D2025A3593B4A4D',
  USDC: import.meta.env.VITE_USDC_ADDRESS || '0xC449434dcf6Faca53595b4B020568Ef01FEA23a5', // MockUSDC
  STAKING_VAULT: import.meta.env.VITE_STAKING_VAULT_ADDRESS || '0x1a10c80F4fC09EF2658E555cc7DB8dA68C710bd5',
  VAULT_CAPACITY_MANAGER: import.meta.env.VITE_VAULT_CAPACITY_MANAGER_ADDRESS || '0xB1F97FF54F34e0552a889f4C841d6637574Ea554',
};

/**
 * Network configuration
 * Updated for Etherlink Shadownet (Novax Yield)
 */
export const networkConfig = {
  name: import.meta.env.VITE_NETWORK || 'etherlink_testnet',
  chainId: parseInt(import.meta.env.VITE_CHAIN_ID || '127823'),
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com',
  explorer: import.meta.env.VITE_EXPLORER_URL || 'https://shadownet.explorer.etherlink.com',
};

/**
 * Backward compatibility: NETWORK_CONFIG alias
 */
export const NETWORK_CONFIG = networkConfig;

/**
 * Role constants matching OpenZeppelin AccessControl
 * These are keccak256 hashes as defined in the smart contracts
 */
export const ROLES = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash, // 0x0000000000000000000000000000000000000000000000000000000000000000
  ADMIN_ROLE: ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE')),
  AMC_ROLE: ethers.keccak256(ethers.toUtf8Bytes('AMC_ROLE')),
  OPERATOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE')),
  MINTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE')),
  BURNER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE')),
  // Legacy roles (for backward compatibility)
  VERIFIER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('VERIFIER_ROLE')),
  ATTESTOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes('ATTESTOR_ROLE')),
  INSPECTOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes('INSPECTOR_ROLE')),
};

/**
 * Backward compatibility: CONTRACT_ADDRESSES object with lowercase keys
 */
export const CONTRACT_ADDRESSES = {
  trustToken: contractAddresses.TRUST_TOKEN,
  assetNFT: contractAddresses.ASSET_NFT,
  coreAssetFactory: contractAddresses.CORE_ASSET_FACTORY,
  trustAssetFactory: contractAddresses.TRUST_ASSET_FACTORY,
  poolManager: contractAddresses.POOL_MANAGER,
  verificationRegistry: contractAddresses.VERIFICATION_REGISTRY,
  trustMarketplace: contractAddresses.TRUST_MARKETPLACE,
  trustFaucet: contractAddresses.TRUST_FAUCET,
  trustTokenExchange: contractAddresses.TRUST_TOKEN_EXCHANGE,
  amcManager: contractAddresses.AMC_MANAGER,
  // Additional aliases for backward compatibility
  assetNft: contractAddresses.ASSET_NFT,
  coreAsset: contractAddresses.CORE_ASSET_FACTORY,
  trustAsset: contractAddresses.TRUST_ASSET_FACTORY,
  pool: contractAddresses.POOL_MANAGER,
  marketplace: contractAddresses.TRUST_MARKETPLACE,
  faucet: contractAddresses.TRUST_FAUCET,
  exchange: contractAddresses.TRUST_TOKEN_EXCHANGE,
};
