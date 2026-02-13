const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  console.log('🔍 === CHECKING ASSET STATUS ON-CHAIN ===\n');

  // Asset ID to check (from command line or default)
  const ASSET_ID = process.argv[2] || '0xe0e2e348433e5e985ce6edc008dd888063c74c3c40333ecff3402a3ffd9c3a6b';

  // Contract addresses from environment
  const CORE_ASSET_FACTORY_ADDRESS = process.env.CORE_ASSET_FACTORY_ADDRESS || '0x3d047913e2D9852D24b9758D0804eF4C081Cdc7a';
  const AMC_MANAGER_ADDRESS = process.env.AMC_MANAGER_ADDRESS || process.env.VITE_AMC_MANAGER_ADDRESS || '0x995a59e804c9c53Ca1fe7e529ccd6f0dA617e36A';
  const RPC_URL = process.env.MANTLE_RPC_URL || process.env.VITE_MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz';

  console.log('📋 Configuration:');
  console.log('   Asset ID:', ASSET_ID);
  console.log('   CoreAssetFactory:', CORE_ASSET_FACTORY_ADDRESS);
  console.log('   AMCManager:', AMC_MANAGER_ADDRESS);
  console.log('   RPC URL:', RPC_URL);
  console.log('');

  // Minimal ABI for getAsset function
  const CoreAssetFactoryABI = [
    'function getAsset(bytes32) external view returns (bytes32,address,address,uint8,uint8,string,string,string,uint256,uint256,uint8,string[],string[],string,string,string,address,uint256,uint8,address,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256,uint256,address,uint256)'
  ];

  const AMCManagerABI = [
    'function getLegalTransferRecord(bytes32) external view returns (bytes32,address,address,uint8,string,uint256,uint256)',
    'function getInspectionRecord(bytes32) external view returns (bytes32,address,uint8,string,string,uint256,uint256)'
  ];

  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log('🔗 Connected to network');
    console.log('');

    // Get contract instances
    const coreAssetFactory = new ethers.Contract(CORE_ASSET_FACTORY_ADDRESS, CoreAssetFactoryABI, provider);
    const amcManager = new ethers.Contract(AMC_MANAGER_ADDRESS, AMCManagerABI, provider);

    // Status mappings
    const statusNames = {
      0: 'PENDING_VERIFICATION',
      1: 'VERIFIED_PENDING_AMC',
      2: 'AMC_INSPECTION_SCHEDULED',
      3: 'AMC_INSPECTION_COMPLETED',
      4: 'LEGAL_TRANSFER_PENDING',
      5: 'LEGAL_TRANSFER_COMPLETED',
      6: 'ACTIVE_AMC_MANAGED',
      7: 'DIGITAL_VERIFIED',
      8: 'DIGITAL_ACTIVE',
      9: 'REJECTED',
      10: 'FLAGGED'
    };

    const transferStatusNames = {
      0: 'PENDING',
      1: 'INITIATED',
      2: 'COMPLETED',
      3: 'REJECTED'
    };

    const inspectionStatusNames = {
      0: 'PENDING',
      1: 'SCHEDULED',
      2: 'COMPLETED',
      3: 'FLAGGED',
      4: 'REJECTED'
    };

    // 1. Get asset from CoreAssetFactory
    console.log('📊 [1/3] Fetching asset from CoreAssetFactory...');
    const assetResult = await coreAssetFactory.getAsset(ASSET_ID);
    
    // Parse the result tuple
    const asset = {
      id: assetResult[0],
      originalOwner: assetResult[1],
      currentOwner: assetResult[2],
      category: assetResult[3],
      assetType: assetResult[4],
      assetTypeString: assetResult[5],
      name: assetResult[6],
      location: assetResult[7],
      totalValue: assetResult[8],
      maturityDate: assetResult[9],
      verificationLevel: assetResult[10],
      evidenceHashes: assetResult[11],
      documentTypes: assetResult[12],
      imageURI: assetResult[13],
      documentURI: assetResult[14],
      description: assetResult[15],
      nftContract: assetResult[16],
      tokenId: assetResult[17],
      status: assetResult[18],
      currentAMC: assetResult[19],
      createdAt: assetResult[20],
      verifiedAt: assetResult[21],
      amcTransferredAt: assetResult[22],
      tradingVolume: assetResult[23],
      lastSalePrice: assetResult[24],
      isTradeable: assetResult[25],
      isListed: assetResult[26],
      listingPrice: assetResult[27],
      listingExpiry: assetResult[28],
      currentBuyer: assetResult[29],
      currentOffer: assetResult[30]
    };

    // Check if asset exists
    if (asset.id === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log('❌ Asset not found on blockchain!');
      console.log('   The asset ID does not exist in CoreAssetFactory.');
      process.exit(1);
    }

    const contractStatusNum = Number(asset.status);
    const contractStatusName = statusNames[contractStatusNum] || 'UNKNOWN';

    console.log('✅ Asset found on blockchain!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Asset ID:', asset.id);
    console.log('   Name:', asset.name);
    console.log('   Contract Status:', contractStatusNum, `(${contractStatusName})`);
    console.log('   Owner:', asset.currentOwner || asset.originalOwner);
    console.log('   Value:', ethers.formatEther(asset.totalValue || 0), 'TRUST');
    console.log('   Current AMC:', asset.currentAMC || 'None');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // 2. Get legal transfer record
    console.log('📋 [2/3] Checking legal transfer record from AMCManager...');
    try {
      const transferResult = await amcManager.getLegalTransferRecord(ASSET_ID);
      const legalTransferRecord = {
        assetId: transferResult[0],
        individualOwner: transferResult[1],
        amcAddress: transferResult[2],
        status: transferResult[3],
        legalDocumentHash: transferResult[4],
        initiatedAt: transferResult[5],
        completedAt: transferResult[6]
      };

      const recordAssetId = legalTransferRecord.assetId;
      const hasRecord = recordAssetId && recordAssetId !== '0x0000000000000000000000000000000000000000000000000000000000000000';

      if (hasRecord) {
        const transferStatusNum = Number(legalTransferRecord.status);
        const transferStatusName = transferStatusNames[transferStatusNum] || 'UNKNOWN';
        console.log('✅ Legal Transfer Record exists');
        console.log('   Transfer Status:', transferStatusNum, `(${transferStatusName})`);
        console.log('   AMC Address:', legalTransferRecord.amcAddress);
        console.log('   Individual Owner:', legalTransferRecord.individualOwner);
        if (Number(legalTransferRecord.completedAt) > 0) {
          const completedDate = new Date(Number(legalTransferRecord.completedAt) * 1000);
          console.log('   Completed At:', completedDate.toISOString());
        }
      } else {
        console.log('⚠️  Legal Transfer Record does NOT exist (empty/default record)');
      }
    } catch (error) {
      console.log(`⚠️  Error fetching legal transfer record: ${error.message}`);
    }
    console.log('');

    // 3. Get inspection record
    console.log('🔍 [3/3] Checking inspection record from AMCManager...');
    try {
      const inspectionResult = await amcManager.getInspectionRecord(ASSET_ID);
      const inspectionRecord = {
        assetId: inspectionResult[0],
        inspector: inspectionResult[1],
        status: inspectionResult[2],
        comments: inspectionResult[3],
        inspectionReportHash: inspectionResult[4],
        scheduledAt: inspectionResult[5],
        completedAt: inspectionResult[6]
      };

      const recordAssetId = inspectionRecord.assetId;
      const hasRecord = recordAssetId && recordAssetId !== '0x0000000000000000000000000000000000000000000000000000000000000000';

      if (hasRecord) {
        const inspectionStatusNum = Number(inspectionRecord.status);
        const inspectionStatusName = inspectionStatusNames[inspectionStatusNum] || 'UNKNOWN';
        console.log('✅ Inspection Record exists');
        console.log('   Inspection Status:', inspectionStatusNum, `(${inspectionStatusName})`);
        console.log('   Inspector:', inspectionRecord.inspector);
        if (Number(inspectionRecord.scheduledAt) > 0) {
          const scheduledDate = new Date(Number(inspectionRecord.scheduledAt) * 1000);
          console.log('   Scheduled At:', scheduledDate.toISOString());
        }
        if (Number(inspectionRecord.completedAt) > 0) {
          const completedDate = new Date(Number(inspectionRecord.completedAt) * 1000);
          console.log('   Completed At:', completedDate.toISOString());
        }
      } else {
        console.log('⚠️  Inspection Record does NOT exist (empty/default record)');
      }
    } catch (error) {
      console.log(`⚠️  Error fetching inspection record: ${error.message}`);
    }
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   On-Chain Contract Status: ${contractStatusNum} (${contractStatusName})`);
    console.log('');
    
    if (contractStatusNum === 6) {
      console.log('✅ Asset is ACTIVE_AMC_MANAGED (status 6) - Ready for pooling!');
    } else if (contractStatusNum === 5) {
      console.log('⚠️  Asset is LEGAL_TRANSFER_COMPLETED (status 5) - Needs activation to reach status 6');
      console.log('   To activate: Call amcManager.activateAsset(ASSET_ID)');
    } else if (contractStatusNum === 0) {
      console.log('❌ Asset is PENDING_VERIFICATION (status 0) - Workflow not started');
      console.log('   This asset needs to go through the full AMC workflow:');
      console.log('   1. Verify asset (status 0 → 1)');
      console.log('   2. Assign AMC (status 1 → 1)');
      console.log('   3. Schedule inspection (status 1 → 2)');
      console.log('   4. Complete inspection (status 2 → 3)');
      console.log('   5. Initiate legal transfer (status 3 → 3)');
      console.log('   6. Complete legal transfer (status 3 → 5)');
      console.log('   7. Activate asset (status 5 → 6)');
    } else {
      console.log(`⚠️  Asset is in status ${contractStatusNum} (${contractStatusName})`);
      console.log('   This asset needs to complete the AMC workflow to reach status 6 (ACTIVE_AMC_MANAGED)');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error checking asset status:', error.message);
    if (error.data) {
      console.error('   Error data:', error.data);
    }
    if (error.reason) {
      console.error('   Error reason:', error.reason);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });







