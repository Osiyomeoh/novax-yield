import { ethers } from 'ethers';
import { novaxContractAddresses } from '../config/contracts';

/**
 * Contract Role Service
 * Checks on-chain roles for Novax smart contracts
 */

// Role hashes (must match contract)
export const AMC_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AMC_ROLE"));
export const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
export const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // 0x0000000000000000000000000000000000000000000000000000000000000000

/**
 * Check if user has a specific role on a contract
 */
export const checkContractRole = async (
  contractAddress: string,
  roleHash: string,
  userAddress: string,
  provider: ethers.Provider
): Promise<boolean> => {
  try {
    const abi = [
      "function hasRole(bytes32 role, address account) view returns (bool)"
    ];
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const hasRole = await contract.hasRole(roleHash, userAddress);
    return hasRole;
  } catch (error) {
    console.error('Error checking contract role:', error);
    return false;
  }
};

/**
 * Check if user has AMC_ROLE on ReceivableFactory
 */
export const hasAMCRoleOnReceivableFactory = async (
  userAddress: string,
  provider: ethers.Provider
): Promise<boolean> => {
  return checkContractRole(
    novaxContractAddresses.RECEIVABLE_FACTORY,
    AMC_ROLE,
    userAddress,
    provider
  );
};

/**
 * Check if user has AMC_ROLE on PoolManager
 */
export const hasAMCRoleOnPoolManager = async (
  userAddress: string,
  provider: ethers.Provider
): Promise<boolean> => {
  return checkContractRole(
    novaxContractAddresses.POOL_MANAGER,
    AMC_ROLE,
    userAddress,
    provider
  );
};

/**
 * Check if user has any AMC role (on either contract)
 */
export const hasAnyAMCRole = async (
  userAddress: string,
  provider: ethers.Provider
): Promise<boolean> => {
  const [hasReceivableRole, hasPoolRole] = await Promise.all([
    hasAMCRoleOnReceivableFactory(userAddress, provider),
    hasAMCRoleOnPoolManager(userAddress, provider)
  ]);
  return hasReceivableRole || hasPoolRole;
};

