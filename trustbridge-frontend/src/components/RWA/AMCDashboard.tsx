import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/Card';
import Button from '../UI/Button';
import { 
  Building2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Calendar,
  FileText,
  Camera,
  Shield,
  TrendingUp,
  Users,
  DollarSign,
  Eye,
  Edit,
  X,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import AssetApproval from '../AMC/AssetApproval';
import PoolManagement from '../AMC/PoolManagement';
import { useWallet } from '../../contexts/WalletContext';
// Mantle service removed - using Etherlink/Novax contracts instead
import { getContractAddress } from '../../config/contracts';
import { ethers } from 'ethers';

interface AMCAsset {
  id: string;
  name: string;
  type: string;
  category: string;
  location: string;
  value: number;
  status: 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'INSPECTION_SCHEDULED' | 'INSPECTION_COMPLETED' | 'LEGAL_TRANSFER_PENDING' | 'LEGAL_TRANSFER_COMPLETED' | 'ACTIVE' | 'REJECTED';
  owner: string;
  assignedTo: string;
  inspectionDate?: string;
  inspectionReport?: string;
  legalTransferStatus?: string;
  createdAt: string;
  documents: string[];
  photos: string[];
}

interface InspectionRecord {
  assetId: string;
  inspector: string;
  scheduledDate: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  report?: string;
  findings?: {
    condition: string;
    documentationMatch: boolean;
    locationVerified: boolean;
    valueAssessment: number;
  };
  photos: string[];
}

const AMCDashboard: React.FC = () => {
  const { toast } = useToast();
  const { isConnected, address, signer, provider } = useWallet();
  const [assets, setAssets] = useState<AMCAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AMCAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assigned' | 'inspections' | 'transfers' | 'active' | 'approval' | 'pools'>('approval');
  const [poolCount, setPoolCount] = useState(0);
  const [isAssigningAMC, setIsAssigningAMC] = useState(false);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [isSchedulingInspection, setIsSchedulingInspection] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedAssetForScheduling, setSelectedAssetForScheduling] = useState<AMCAsset | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isCompletingInspection, setIsCompletingInspection] = useState<string | null>(null);
  const [isInitiatingTransfer, setIsInitiatingTransfer] = useState<string | null>(null);
  const [isCompletingTransfer, setIsCompletingTransfer] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState<string | null>(null);

  // Initialize contract service
  useEffect(() => {
    const initContractService = async () => {
      try {
        // Mantle service removed - using Etherlink/Novax contracts instead
        // TODO: Initialize Novax contract service for Etherlink
      } catch (error) {
        console.error('Failed to initialize contract service:', error);
      }
    };
    initContractService();
  }, [isConnected, provider, signer]);

  useEffect(() => {
    fetchAMCAssets();
    fetchPoolCount();
  }, []);

  // Fetch pool count for navigation badge
  const fetchPoolCount = async () => {
    try {
      // Mantle service removed - using Etherlink/Novax contracts instead
      // TODO: Replace with Novax contract calls for Etherlink
      const blockchainPools: any[] = [];
      const activePools = blockchainPools.filter((pool: any) => pool.isActive !== false);
      setPoolCount(activePools.length);
    } catch (error) {
      console.error('❌ Failed to fetch pool count from contract:', error);
      setPoolCount(0);
    }
  };

  // Helper function to map blockchain status to UI status
  const mapBlockchainStatus = (status: number): AMCAsset['status'] => {
    // AssetStatus enum: 0=PENDING_VERIFICATION, 1=VERIFIED_PENDING_AMC, 2=AMC_INSPECTION_SCHEDULED,
    // 3=AMC_INSPECTION_COMPLETED, 4=LEGAL_TRANSFER_PENDING, 5=LEGAL_TRANSFER_COMPLETED,
    // 6=ACTIVE_AMC_MANAGED, 7=DIGITAL_VERIFIED, 8=DIGITAL_ACTIVE, 9=REJECTED, 10=FLAGGED
    switch (status) {
      case 0: return 'PENDING_ASSIGNMENT'; // PENDING_VERIFICATION
      case 1: return 'ASSIGNED'; // VERIFIED_PENDING_AMC
      case 2: return 'INSPECTION_SCHEDULED'; // AMC_INSPECTION_SCHEDULED
      case 3: return 'INSPECTION_COMPLETED'; // AMC_INSPECTION_COMPLETED
      case 4: return 'LEGAL_TRANSFER_PENDING'; // LEGAL_TRANSFER_PENDING
      case 5: return 'LEGAL_TRANSFER_COMPLETED'; // LEGAL_TRANSFER_COMPLETED
      case 6: return 'ACTIVE'; // ACTIVE_AMC_MANAGED
      case 9: return 'REJECTED'; // REJECTED
      default: return 'PENDING_ASSIGNMENT';
    }
  };

  const fetchAMCAssets = async () => {
    try {
      setIsLoading(true);
      console.log('📡 Mantle service removed - use Novax contracts for Etherlink');

      // TODO: Replace with Novax contract calls for Etherlink
      const blockchainAssets: any[] = [];
      console.log(`✅ Fetched ${blockchainAssets.length} assets from blockchain`);

      // Transform blockchain assets to AMCAsset format
      const transformedAssets: AMCAsset[] = await Promise.all(
        blockchainAssets.map(async (asset: any) => {
          try {
            // Get inspection and legal transfer records if available
            let inspectionRecord = null;
            let legalTransferRecord = null;
            try {
              // TODO: Replace with Novax contract calls
              const inspectionRecordData = null as any;
              // Check if inspection record exists - look for scheduledAt, completedAt, or inspector address
              const scheduledAt = inspectionRecordData?.scheduledAt 
                ? (typeof inspectionRecordData.scheduledAt === 'bigint' ? Number(inspectionRecordData.scheduledAt) : Number(inspectionRecordData.scheduledAt || 0))
                : 0;
              const completedAt = inspectionRecordData?.completedAt 
                ? (typeof inspectionRecordData.completedAt === 'bigint' ? Number(inspectionRecordData.completedAt) : Number(inspectionRecordData.completedAt || 0))
                : 0;
              const inspector = inspectionRecordData?.inspector || '';
              const hasScheduledTime = scheduledAt > 0;
              const hasCompletedTime = completedAt > 0;
              const hasInspector = inspector && inspector !== '0x0000000000000000000000000000000000000000' && inspector !== '0x';
              
              // Inspection record exists if it has scheduledAt, completedAt, or inspector address
              if (hasScheduledTime || hasCompletedTime || hasInspector) {
                inspectionRecord = inspectionRecordData;
                console.log(`✅ Found inspection record for asset ${asset.assetId || asset.id}:`, {
                  status: inspectionRecordData?.status,
                  scheduledAt: hasScheduledTime ? new Date(scheduledAt * 1000).toISOString() : 'not set',
                  completedAt: hasCompletedTime ? new Date(completedAt * 1000).toISOString() : 'not set',
                  inspector: hasInspector ? inspector : 'not set'
                });
              } else {
                console.log(`ℹ️ No inspection record found for asset ${asset.assetId || asset.id} (empty/default record)`);
              }
            } catch (e) {
              console.log(`ℹ️ No inspection record found for asset ${asset.assetId || asset.id}:`, e.message);
            }
            try {
              // TODO: Replace with Novax contract calls
              const legalTransferRecordData = null as any;
              if (legalTransferRecordData && legalTransferRecordData.assetId && legalTransferRecordData.assetId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                legalTransferRecord = legalTransferRecordData;
              }
            } catch (e) {
              console.log(`ℹ️ No legal transfer record found for asset ${asset.assetId || asset.id}:`, e.message);
            }

            const totalValue = typeof asset.totalValue === 'bigint' 
              ? Number(asset.totalValue) / 1e18 
              : (typeof asset.totalValue === 'string' ? parseFloat(asset.totalValue) / 1e18 : Number(asset.totalValue || 0) / 1e18);

            // Log asset data for debugging
            console.log(`📋 Asset Data for ${asset.assetId || asset.id}:`, {
              name: asset.name,
              location: asset.location,
              totalValue: asset.totalValue,
              totalValueFormatted: totalValue,
              owner: asset.currentOwner || asset.originalOwner || asset.owner,
              status: asset.status,
              assetTypeString: asset.assetTypeString || asset.type
            });

            // IMPORTANT: Contract status is the ONLY source of truth
            // We do NOT override the contract status based on inspection or legal transfer records
            // The contract status on-chain is what determines if assets can be pooled, traded, etc.
            // Use 'let' instead of 'const' because we may need to override it for UI display purposes
            let statusNum = typeof asset.status === 'bigint' 
              ? Number(asset.status) 
              : (typeof asset.status === 'string' ? parseInt(asset.status) : Number(asset.status || 0));
            
            console.log(`📊 Asset ${asset.assetId || asset.id}: On-chain contract status=${statusNum}`);

            const createdAtTimestamp = asset.createdAt || Date.now() / 1000;
            const createdAtNum = typeof createdAtTimestamp === 'bigint' 
              ? Number(createdAtTimestamp) 
              : (typeof createdAtTimestamp === 'string' ? parseInt(createdAtTimestamp) : Number(createdAtTimestamp || Date.now() / 1000));

            // Get inspection date from completedAt or scheduledAt
            const inspectionDate = inspectionRecord?.completedAt 
              ? (typeof inspectionRecord.completedAt === 'bigint' ? Number(inspectionRecord.completedAt) : Number(inspectionRecord.completedAt || 0))
              : (inspectionRecord?.scheduledAt 
                ? (typeof inspectionRecord.scheduledAt === 'bigint' ? Number(inspectionRecord.scheduledAt) : Number(inspectionRecord.scheduledAt || 0))
                : undefined);

            // IMPORTANT: Contract status is the source of truth for pool creation
            // The contract status determines if an asset can be added to a pool (status 6 = ACTIVE_AMC_MANAGED)
            // We should ALWAYS use the contract status for UI display to ensure consistency
            // Status enum: 0=PENDING_VERIFICATION, 1=VERIFIED_PENDING_AMC, 2=AMC_INSPECTION_SCHEDULED,
            // 3=AMC_INSPECTION_COMPLETED, 4=LEGAL_TRANSFER_PENDING, 5=LEGAL_TRANSFER_COMPLETED,
            // 6=ACTIVE_AMC_MANAGED, 7=DIGITAL_VERIFIED, 8=DIGITAL_ACTIVE, 9=REJECTED, 10=FLAGGED
            // 
            // Note: Legal transfer records and inspection records are for reference only.
            // The contract status is what matters for pool creation and other operations.
            
            // Check legal transfer record status and update final status accordingly
            // TransferStatus enum: 0=PENDING, 1=INITIATED, 2=COMPLETED, 3=REJECTED
            if (legalTransferRecord && legalTransferRecord.status !== undefined) {
              const transferStatus = typeof legalTransferRecord.status === 'bigint' 
                ? Number(legalTransferRecord.status) 
                : (typeof legalTransferRecord.status === 'string' ? parseInt(legalTransferRecord.status) : Number(legalTransferRecord.status || 0));
              
              console.log(`🔍 Legal transfer record status: ${transferStatus} (0=PENDING, 1=INITIATED, 2=COMPLETED, 3=REJECTED), Contract status: ${statusNum}`);
              
              // If legal transfer is INITIATED (1), override status to LEGAL_TRANSFER_PENDING
              // This ensures UI shows correct button even if contract status hasn't updated yet
              if (transferStatus === 1) {
                console.log(`✅ Legal transfer is INITIATED (${transferStatus}), updating UI status to LEGAL_TRANSFER_PENDING`);
                // Override the status to show correct UI state
                statusNum = 4; // LEGAL_TRANSFER_PENDING
              }
              
              if (transferStatus === 2 && statusNum !== 6 && statusNum !== 5) {
                // Legal transfer is COMPLETED but contract status is not 5 or 6
                console.log(`⚠️ Legal transfer record shows COMPLETED (${transferStatus}) but contract status is ${statusNum}. Asset needs activation to reach status 6 (ACTIVE_AMC_MANAGED).`);
              }
            }
            
            // Map the (possibly updated) statusNum to UI status
            const finalStatus = mapBlockchainStatus(statusNum);
            
            console.log(`📊 Asset ${asset.assetId || asset.id}: Contract status=${statusNum} -> UI status=${finalStatus}`);

            const transformedAsset = {
              id: asset.assetId || asset.id || '',
              name: asset.name || `Asset ${(asset.assetId || asset.id || '').slice(0, 8)}`,
              type: asset.assetTypeString || asset.type || 'RWA',
              category: asset.category || 'RWA',
              location: asset.location || 'Unknown',
              value: totalValue,
              status: finalStatus,
              owner: asset.currentOwner || asset.originalOwner || asset.owner || '',
              assignedTo: legalTransferRecord?.amcAddress || inspectionRecord?.inspector || 'Not assigned',
              inspectionDate: inspectionDate ? new Date(inspectionDate * 1000).toISOString() : undefined,
              inspectionReport: inspectionRecord?.inspectionReportHash || undefined,
              legalTransferStatus: legalTransferRecord?.status !== undefined 
                ? (Number(legalTransferRecord.status) === 2 ? 'COMPLETED' : (Number(legalTransferRecord.status) === 1 ? 'INITIATED' : 'PENDING')) 
                : undefined,
              createdAt: createdAtNum > 0 ? new Date(createdAtNum * 1000).toISOString() : new Date().toISOString(),
              documents: asset.evidenceHashes || asset.legalDocuments || [],
              photos: asset.photos || []
            };

            // Warn if critical data is missing
            if (!asset.name || asset.name === '') {
              console.warn(`⚠️ Asset ${asset.assetId || asset.id} has no name`);
            }
            if (!asset.location || asset.location === '') {
              console.warn(`⚠️ Asset ${asset.assetId || asset.id} has no location (showing "Unknown")`);
            }
            if (totalValue === 0) {
              console.warn(`⚠️ Asset ${asset.assetId || asset.id} has value $0 (totalValue: ${asset.totalValue})`);
            }
            if (!asset.currentOwner && !asset.originalOwner && !asset.owner) {
              console.warn(`⚠️ Asset ${asset.assetId || asset.id} has no owner address`);
            }

            return transformedAsset;
          } catch (error) {
            console.error(`Error transforming asset ${asset.assetId}:`, error);
            return {
              id: asset.assetId || asset.id || '',
              name: asset.name || `Asset ${(asset.assetId || asset.id || '').slice(0, 8)}`,
              type: asset.type || 'RWA',
              category: 'RWA',
              location: 'Unknown',
              value: 0,
              status: 'PENDING_ASSIGNMENT' as const,
              owner: asset.owner || '',
              assignedTo: 'Not assigned',
              createdAt: new Date().toISOString(),
              documents: [],
              photos: []
            };
          }
        })
      );

      console.log('✅ Transformed AMC assets:', transformedAssets);
      setAssets(transformedAssets);
    } catch (error: any) {
      console.error('❌ Error fetching AMC assets:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch AMC assets: ${error.message || 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_ASSIGNMENT':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'ASSIGNED':
        return 'text-blue-400 bg-blue-400/10';
      case 'INSPECTION_SCHEDULED':
        return 'text-orange-400 bg-orange-400/10';
      case 'INSPECTION_COMPLETED':
        return 'text-primary-blue bg-primary-blue/10';
      case 'LEGAL_TRANSFER_PENDING':
        return 'text-purple-400 bg-purple-400/10';
      case 'LEGAL_TRANSFER_COMPLETED':
        return 'text-primary-blue bg-primary-blue/10';
      case 'ACTIVE':
        return 'text-primary-blue bg-primary-blue/10';
      case 'REJECTED':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING_ASSIGNMENT':
        return <Clock className="w-4 h-4" />;
      case 'ASSIGNED':
        return <Building2 className="w-4 h-4" />;
      case 'INSPECTION_SCHEDULED':
        return <Calendar className="w-4 h-4" />;
      case 'INSPECTION_COMPLETED':
        return <CheckCircle className="w-4 h-4" />;
      case 'LEGAL_TRANSFER_PENDING':
        return <FileText className="w-4 h-4" />;
      case 'LEGAL_TRANSFER_COMPLETED':
        return <CheckCircle className="w-4 h-4" />;
      case 'ACTIVE':
        return <TrendingUp className="w-4 h-4" />;
      case 'REJECTED':
        return <X className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const approveAsset = async (assetId: string) => {
    if (!isConnected || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to approve assets',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsApproving(assetId);

      // Initialize contract service with signer
      if (provider && signer) {
        // Mantle service removed - using Etherlink/Novax contracts instead
      } else {
        throw new Error('No signer or provider available');
      }

      // Convert assetId to bytes32 format if needed
      let assetIdBytes32: string;
      if (assetId.startsWith('0x') && assetId.length === 66) {
        assetIdBytes32 = assetId;
      } else if (assetId.startsWith('0x') && assetId.length < 66) {
        assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
      } else {
        assetIdBytes32 = ethers.id(assetId);
      }

      // VerificationLevel: 0=Basic, 1=Professional, 2=Expert, 3=Master
      // Using level 2 (Expert) for AMC approval
      const verificationLevel = 2; // Expert level

      console.log('✅ Approving asset on blockchain:', { assetId: assetIdBytes32, verificationLevel });

      // TODO: Replace with Novax contract calls for Etherlink
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      const txHash = '' as any;

      console.log('✅ Asset approved on blockchain:', txHash);

      toast({
        title: 'Asset Approved!',
        description: `Asset verified on Etherlink blockchain. Transaction: ${txHash.slice(0, 10)}...`,
        variant: 'default'
      });

      // Refresh assets list
      await fetchAMCAssets();
    } catch (error: any) {
      console.error('❌ Error approving asset:', error);
      toast({
        title: 'Approval Failed',
        description: error.message?.includes('AMC_ROLE') || error.message?.includes('AMC')
          ? 'You do not have AMC_ROLE on the contract. Please ensure your wallet has the required role.'
          : (error.message || 'Failed to approve asset on blockchain'),
        variant: 'destructive',
        duration: 8000
      });
    } finally {
      setIsApproving(null);
    }
  };

  const openScheduleModal = (asset: AMCAsset) => {
    setSelectedAssetForScheduling(asset);
    setScheduledDate('');
    setScheduledTime('');
    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setSelectedAssetForScheduling(null);
    setScheduledDate('');
    setScheduledTime('');
  };

  const scheduleInspection = async () => {
    if (!selectedAssetForScheduling) return;

    if (!isConnected || !signer || !address) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to schedule inspection',
        variant: 'destructive'
      });
      return;
    }

    // Validate date and time
    if (!scheduledDate || !scheduledTime) {
      toast({
        title: 'Date and Time Required',
        description: 'Please select both date and time for the inspection',
        variant: 'destructive'
      });
      return;
    }

    // Combine date and time and convert to Unix timestamp
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();

    if (scheduledDateTime <= now) {
      toast({
        title: 'Invalid Date/Time',
        description: 'Scheduled inspection must be in the future',
        variant: 'destructive'
      });
      return;
    }

    const scheduledAt = Math.floor(scheduledDateTime.getTime() / 1000); // Unix timestamp in seconds

    try {
      setIsSchedulingInspection(selectedAssetForScheduling.id);

      // Initialize contract service with signer
      if (provider && signer) {
        // Mantle service removed - using Etherlink/Novax contracts instead
      } else {
        throw new Error('No signer or provider available');
      }

      // Convert assetId to bytes32 format if needed
      const assetId = selectedAssetForScheduling.id;
      let assetIdBytes32: string;
      if (assetId.startsWith('0x') && assetId.length === 66) {
        assetIdBytes32 = assetId;
      } else if (assetId.startsWith('0x') && assetId.length < 66) {
        assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
      } else {
        assetIdBytes32 = ethers.id(assetId);
      }

      // Use the connected wallet address as inspector (AMC admin)
      const inspector = address;

      console.log('✅ Scheduling inspection on blockchain:', {
        assetId: assetIdBytes32,
        inspector,
        scheduledAt,
        scheduledDateTime: scheduledDateTime.toISOString()
      });

      // Schedule on blockchain
      // TODO: Replace with Novax contract calls for Etherlink
      // Mantle service removed - using Etherlink/Novax contracts instead
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      // const txHash = await mantleContractService.scheduleInspection(
      //   assetIdBytes32,
      //   inspector,
      //   scheduledAt
      // );
      const txHash = '' as any;

      console.log('✅ Inspection scheduled on blockchain, waiting for confirmation:', txHash);

      // Wait for transaction confirmation and block inclusion
      if (provider) {
        try {
          const receipt = await provider.waitForTransaction(txHash, 1, 60000); // Wait up to 60 seconds for 1 confirmation
          console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
          
          // Wait a bit more for blockchain state to settle
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (waitError) {
          console.warn('⚠️ Transaction wait timeout, but transaction was sent:', waitError);
        }
      }

      // Send email notification to asset creator
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        await fetch(`${import.meta.env.VITE_API_URL}/amc/inspection/send-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assetId: assetId,
            scheduledDateTime: scheduledDateTime.toISOString(),
            inspector: inspector,
            assetName: selectedAssetForScheduling.name
          }),
        });
        console.log('✅ Email notification sent to asset creator');
      } catch (emailError) {
        console.warn('⚠️ Failed to send email notification, but blockchain transaction succeeded:', emailError);
        // Don't fail the entire operation if email fails
      }

      toast({
        title: 'Inspection Scheduled!',
        description: `Physical inspection scheduled for ${scheduledDateTime.toLocaleString()}. Status updated. Transaction: ${txHash.slice(0, 10)}...`,
        variant: 'default',
        duration: 8000
      });

      // Close modal first
      closeScheduleModal();
      
      // Refresh assets list with retry to get updated status
      console.log('🔄 Refreshing asset list to show updated status...');
      await fetchAMCAssets();
      
      // Retry after a short delay in case blockchain state hasn't fully updated
      setTimeout(async () => {
        console.log('🔄 Re-checking asset status after delay...');
        await fetchAMCAssets();
      }, 3000);
    } catch (error: any) {
      console.error('❌ Error scheduling inspection:', error);
      toast({
        title: 'Scheduling Failed',
        description: error.message?.includes('AMC_ROLE') || error.message?.includes('AMC')
          ? 'You do not have AMC_ROLE on the contract. Please ensure your wallet has the required role.'
          : (error.message || 'Failed to schedule inspection on blockchain'),
        variant: 'destructive',
        duration: 8000
      });
    } finally {
      setIsSchedulingInspection(null);
    }
  };

  const completeInspection = async (assetId: string) => {
    if (!isConnected || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to complete inspection',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsCompletingInspection(assetId);

      // Initialize contract service with signer
      if (provider && signer) {
        // Mantle service removed - using Etherlink/Novax contracts instead
      } else {
        throw new Error('No signer or provider available');
      }

      // Check inspection record status first
      try {
        // TODO: Replace with Novax contract calls
        const inspectionRecord = null as any;
        const inspectionRecordAssetId = inspectionRecord?.assetId;
        const hasInspectionRecord = inspectionRecordAssetId && inspectionRecordAssetId !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        if (hasInspectionRecord) {
          const inspectionStatus = typeof inspectionRecord.status === 'bigint' 
            ? Number(inspectionRecord.status) 
            : (typeof inspectionRecord.status === 'string' ? parseInt(inspectionRecord.status) : Number(inspectionRecord.status || 0));
          
          console.log(`🔍 Inspection record found for asset ${assetId}, status: ${inspectionStatus} (0=PENDING, 1=SCHEDULED, 2=COMPLETED, 3=FLAGGED, 4=REJECTED)`);
          
          if (inspectionStatus === 2) {
            // Inspection is already COMPLETED
            console.log('✅ Inspection already completed, refreshing asset status...');
            toast({
              title: 'Inspection Already Completed',
              description: 'This inspection has already been completed. Refreshing asset status...',
              variant: 'default',
              duration: 5000
            });
            setIsCompletingInspection(null);
            // Refresh assets to get updated status
            await fetchAMCAssets();
            // Switch to Legal Transfers tab since inspection is completed
            setActiveTab('transfers');
            return;
          } else if (inspectionStatus !== 1) {
            // Inspection is not SCHEDULED (1), need to schedule first
            console.log(`⚠️ Inspection record exists but is not SCHEDULED (status: ${inspectionStatus}). Scheduling first...`);
            
            // Auto-schedule the inspection with current timestamp (0 = immediate)
            if (!address) {
              throw new Error('Wallet address not available');
            }
            
            console.log(`⏰ Auto-scheduling inspection for asset ${assetId} with inspector ${address} (immediate)`);
            // TODO: Replace with Novax contract calls
            throw new Error('Mantle service removed - use Novax contracts for Etherlink');
            const scheduleTxHash = '' as any;
            console.log('✅ Inspection scheduled automatically, transaction:', scheduleTxHash);
            
            // Wait for transaction confirmation
            if (provider) {
              try {
                await provider.waitForTransaction(scheduleTxHash, 1, 30000);
                console.log('✅ Inspection scheduling transaction confirmed');
                // Wait a bit more for blockchain state to settle
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (waitError) {
                console.warn('⚠️ Transaction wait timeout, but transaction was sent:', waitError);
                // Still wait a bit
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
        } else {
          console.log(`ℹ️ No inspection record found for asset ${assetId}. Contract will auto-create it.`);
        }
      } catch (inspectionRecordError) {
        console.warn('⚠️ Could not fetch inspection record, proceeding with completion (contract will handle):', inspectionRecordError);
        // Continue - the contract should auto-create the inspection record if it doesn't exist
      }

      // InspectionStatus: 0=PENDING, 1=SCHEDULED, 2=COMPLETED, 3=FLAGGED, 4=REJECTED
      // Use status 2 for COMPLETED
      const inspectionStatus = 2; // COMPLETED
      const comments = 'Physical inspection completed by AMC';
      const inspectionReportHash = ''; // Can be IPFS hash if available

      console.log('✅ Completing inspection on blockchain:', { assetId, inspectionStatus, comments });

      // TODO: Replace with Novax contract calls for Etherlink
      // Mantle service removed - using Etherlink/Novax contracts instead
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      // const txHash = await mantleContractService.completeInspection(
      //   assetId,
      //   inspectionStatus,
      //   comments,
      //   inspectionReportHash
      // );
      const txHash = '' as any;

      console.log('✅ Inspection completed on blockchain, waiting for confirmation:', txHash);

      // Optimistically update local state immediately
      setAssets(prev => prev.map(asset => 
        asset.id === assetId 
          ? { ...asset, status: 'INSPECTION_COMPLETED' as const }
          : asset
      ));

      // Wait for transaction confirmation
      if (provider) {
        try {
          const receipt = await provider.waitForTransaction(txHash, 1, 60000); // Wait up to 60 seconds for 1 confirmation
          console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
          
          // Wait a bit more for blockchain state to settle
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (waitError) {
          console.warn('⚠️ Transaction wait timeout, but transaction was sent:', waitError);
        }
      }

      toast({
        title: 'Inspection Completed!',
        description: `Physical inspection completed on Etherlink blockchain. Asset ready for legal transfer. Transaction: ${txHash.slice(0, 10)}...`,
        variant: 'default',
        duration: 8000
      });

      // Switch to Legal Transfers tab to show the completed inspection asset
      setActiveTab('transfers');
      console.log('🔄 Switched to Legal Transfers tab to show asset ready for legal transfer');

      // Refresh assets list with retry to get updated blockchain state
      console.log('🔄 Refreshing asset list to show updated status...');
      await fetchAMCAssets();
      
      // Retry after a short delay in case blockchain state hasn't fully updated
      setTimeout(async () => {
        console.log('🔄 Re-checking asset status after inspection completion...');
        await fetchAMCAssets();
      }, 3000);
    } catch (error: any) {
      console.error('❌ Error completing inspection:', error);
      const errorMessage = error.message || '';
      let userFriendlyMessage = 'Failed to complete inspection on blockchain';
      
      if (errorMessage.includes('AMC_ROLE') || errorMessage.includes('AMC')) {
        userFriendlyMessage = 'You do not have AMC_ROLE on the contract. Please ensure your wallet has the required role.';
      } else if (errorMessage.includes('not in SCHEDULED status') || errorMessage.includes('SCHEDULED status')) {
        userFriendlyMessage = 'Inspection must be scheduled first before it can be completed. Please schedule the inspection first using the "Schedule Inspection" button.';
      } else {
        userFriendlyMessage = errorMessage;
      }
      
      toast({
        title: 'Inspection Failed',
        description: userFriendlyMessage,
        variant: 'destructive',
        duration: 10000
      });
    } finally {
      setIsCompletingInspection(null);
    }
  };

  const initiateLegalTransfer = async (assetId: string) => {
    if (!isConnected || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to initiate legal transfer',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsInitiatingTransfer(assetId);

      // Initialize contract service with signer
      if (provider && signer) {
        // Mantle service removed - using Etherlink/Novax contracts instead
      } else {
        throw new Error('No signer or provider available');
      }

      // Find the asset to get the owner address
      const asset = assets.find(a => a.id === assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Check contract status before initiating legal transfer
      // Contract requires status to be: PENDING_VERIFICATION (0), VERIFIED_PENDING_AMC (1), or AMC_INSPECTION_COMPLETED (3)
      let contractAssetData = null;
      try {
        // TODO: Replace with Novax contract calls
        contractAssetData = null as any;
        const contractStatus = typeof contractAssetData.status === 'bigint' 
          ? Number(contractAssetData.status) 
          : (typeof contractAssetData.status === 'string' ? parseInt(contractAssetData.status) : Number(contractAssetData.status || 0));
        
        console.log(`🔍 Contract asset status: ${contractStatus} (0=PENDING_VERIFICATION, 1=VERIFIED_PENDING_AMC, 2=AMC_INSPECTION_SCHEDULED, 3=AMC_INSPECTION_COMPLETED, 4=LEGAL_TRANSFER_PENDING, 5=LEGAL_TRANSFER_COMPLETED)`);
        
        // Contract allows: 0, 1, or 3 - but NOT 2 (AMC_INSPECTION_SCHEDULED), 4 (LEGAL_TRANSFER_PENDING), or 5 (LEGAL_TRANSFER_COMPLETED)
        if (contractStatus === 2) {
          throw new Error('Asset contract status is AMC_INSPECTION_SCHEDULED (2), but inspection appears completed. The inspection completion transaction may not have updated the contract status. Please refresh and try again, or complete the inspection again if needed.');
        }
        
        if (contractStatus === 4) {
          throw new Error('Legal transfer has already been initiated for this asset (status: LEGAL_TRANSFER_PENDING). Please use the "Complete Legal Transfer" button instead.');
        }
        
        if (contractStatus === 5) {
          throw new Error('Legal transfer has already been completed for this asset (status: LEGAL_TRANSFER_COMPLETED). Please use the "Activate Asset" button to activate the asset for marketplace trading.');
        }
        
        if (![0, 1, 3].includes(contractStatus)) {
          throw new Error(`Asset contract status (${contractStatus}) is not valid for legal transfer initiation. Expected: PENDING_VERIFICATION (0), VERIFIED_PENDING_AMC (1), or AMC_INSPECTION_COMPLETED (3).`);
        }
      } catch (statusCheckError: any) {
        if (statusCheckError.message.includes('contract status')) {
          throw statusCheckError;
        }
        console.warn('Could not verify contract status, proceeding anyway:', statusCheckError);
      }

      // Get the asset owner from blockchain
      let ownerAddress = asset.owner;
      if (!ownerAddress || ownerAddress === '0x0000000000000000000000000000000000000000') {
        // Try to get asset from blockchain to get owner (use data we already fetched if available)
        if (contractAssetData) {
          ownerAddress = contractAssetData.currentOwner || contractAssetData.originalOwner || contractAssetData.owner;
        } else {
          // Mantle contract service removed - using Etherlink/Novax contracts instead
          // TODO: Replace with Novax contract calls for Etherlink
          console.warn('⚠️ Mantle service removed - cannot fetch asset owner from blockchain');
          throw new Error('Mantle service removed - use Novax contracts for Etherlink');
          // try {
          //   const assetData = await mantleContractService.getAsset(assetId);
          //   ownerAddress = assetData.currentOwner || assetData.originalOwner || assetData.owner;
          // } catch (e) {
          //   console.error('Could not fetch asset owner from blockchain:', e);
          //   throw new Error('Could not determine asset owner. Please try again.');
          // }
        }
      }

      // Convert assetId to bytes32 format if needed
      let assetIdBytes32: string;
      if (assetId.startsWith('0x') && assetId.length === 66) {
        assetIdBytes32 = assetId;
      } else if (assetId.startsWith('0x') && assetId.length < 66) {
        assetIdBytes32 = ethers.zeroPadValue(assetId, 32);
      } else {
        assetIdBytes32 = ethers.id(assetId);
      }

      // Legal document hash (IPFS hash if available)
      const legalDocumentHash = ''; // Can be updated to include IPFS hash of legal documents

      console.log('✅ Initiating legal transfer on blockchain:', {
        assetId: assetIdBytes32,
        ownerAddress,
        legalDocumentHash
      });

      // TODO: Replace with Novax contract calls for Etherlink
      // Mantle service removed - using Etherlink/Novax contracts instead
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      // const txHash = await mantleContractService.initiateLegalTransfer(
      //   assetIdBytes32,
      //   ownerAddress,
      //   legalDocumentHash
      // );
      const txHash = '' as any;
      
      console.log('✅ Legal transfer initiated successfully, transaction:', txHash);

      // Wait for transaction confirmation
      if (provider) {
        try {
          const receipt = await provider.waitForTransaction(txHash, 1, 60000);
          console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (waitError) {
          console.warn('⚠️ Transaction wait timeout, but transaction was sent:', waitError);
        }
      }

      toast({
        title: 'Legal Transfer Initiated!',
        description: `Legal transfer initiated on Etherlink blockchain. Transaction: ${txHash.slice(0, 10)}...`,
        variant: 'default',
        duration: 8000
      });

      // Refresh assets list
      await fetchAMCAssets();
      
      // Retry after a short delay
      setTimeout(async () => {
        console.log('🔄 Re-checking asset status after legal transfer initiation...');
        await fetchAMCAssets();
      }, 3000);
    } catch (error: any) {
      console.error('❌ Error initiating legal transfer:', error);
      let errorMessage = error.message || 'Failed to initiate legal transfer on blockchain';
      
      if (error.message?.includes('AMC_ROLE') || error.message?.includes('AMC')) {
        errorMessage = 'You do not have AMC_ROLE on the contract. Please ensure your wallet has the required role.';
      } else if (error.message?.includes('inspection not completed') || error.message?.includes('Physical inspection')) {
        errorMessage = 'Physical inspection must be completed before initiating legal transfer. Please complete the inspection first.';
      } else if (error.message?.includes('not in valid status') || error.message?.includes('contract status')) {
        // Use the specific error message from our status check
        errorMessage = error.message;
      } else if (error.message?.includes('Asset not in valid status for legal transfer')) {
        errorMessage = 'Asset contract status is not valid for legal transfer. The asset status must be AMC_INSPECTION_COMPLETED (3). The inspection completion may not have updated the contract status. Please refresh and try again, or complete the inspection again if needed.';
      }
      
      toast({
        title: 'Legal Transfer Initiation Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 10000
      });
    } finally {
      setIsInitiatingTransfer(null);
    }
  };

  const completeLegalTransfer = async (assetId: string) => {
    if (!isConnected || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to complete legal transfer',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsCompletingTransfer(assetId);

      // Initialize contract service with signer
      if (provider && signer) {
        // Mantle service removed - using Etherlink/Novax contracts instead
      } else {
        throw new Error('No signer or provider available');
      }

      console.log('✅ Completing legal transfer on blockchain:', assetId);

      // TODO: Replace with Novax contract calls for Etherlink
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      const txHash = '' as any;

      console.log('✅ Legal transfer completed on blockchain:', txHash);

      toast({
        title: 'Legal Transfer Completed!',
        description: `Legal transfer completed on Etherlink blockchain. Transaction: ${txHash.slice(0, 10)}...`,
        variant: 'default'
      });

      // Refresh assets list
      await fetchAMCAssets();
    } catch (error: any) {
      console.error('❌ Error completing legal transfer:', error);
      toast({
        title: 'Legal Transfer Failed',
        description: error.message?.includes('AMC_ROLE') || error.message?.includes('AMC')
          ? 'You do not have AMC_ROLE on the contract. Please ensure your wallet has the required role.'
          : (error.message || 'Failed to complete legal transfer on blockchain'),
        variant: 'destructive',
        duration: 8000
      });
    } finally {
      setIsCompletingTransfer(null);
    }
  };

  const activateAsset = async (assetId: string) => {
    if (!isConnected || !signer) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to activate asset',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsActivating(assetId);

      // Initialize contract service with signer
      if (provider && signer) {
        // Mantle service removed - using Etherlink/Novax contracts instead
      } else {
        throw new Error('No signer or provider available');
      }

      // Check contract status and legal transfer record before activating
      // Mantle contract service removed - using Etherlink/Novax contracts instead
      // TODO: Replace with Novax contract calls for Etherlink
      try {
        // const contractAssetData = await mantleContractService.getAsset(assetId);
        // const contractStatus = typeof contractAssetData.status === 'bigint' 
        //   ? Number(contractAssetData.status) 
        //   : (typeof contractAssetData.status === 'string' ? parseInt(contractAssetData.status) : Number(contractAssetData.status || 0));
        const contractAssetData = null as any;
        const contractStatus = 0; // Default status since contract service removed
        
        console.log(`🔍 Contract asset status: ${contractStatus} (expected 5=LEGAL_TRANSFER_COMPLETED)`);
        
        if (contractStatus === 6) {
          throw new Error(`Asset is already activated (status: ACTIVE_AMC_MANAGED). The asset is already active and ready for marketplace trading.`);
        }
        
        if (contractStatus !== 5) {
          throw new Error(`Asset contract status is ${contractStatus}, but activation requires LEGAL_TRANSFER_COMPLETED (5). Current status: ${contractStatus === 0 ? 'PENDING_VERIFICATION' : contractStatus === 1 ? 'VERIFIED_PENDING_AMC' : contractStatus === 2 ? 'AMC_INSPECTION_SCHEDULED' : contractStatus === 3 ? 'AMC_INSPECTION_COMPLETED' : contractStatus === 4 ? 'LEGAL_TRANSFER_PENDING' : contractStatus === 6 ? 'ACTIVE_AMC_MANAGED' : 'UNKNOWN'}. Please complete the legal transfer first.`);
        }

        // Check legal transfer record status
        // TODO: Replace with Novax contract calls
        const legalTransferRecord = null as any;
        if (legalTransferRecord && legalTransferRecord.assetId && legalTransferRecord.assetId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          const transferStatus = typeof legalTransferRecord.status === 'bigint' 
            ? Number(legalTransferRecord.status) 
            : (typeof legalTransferRecord.status === 'string' ? parseInt(legalTransferRecord.status) : Number(legalTransferRecord.status || 0));
          
          console.log(`🔍 Legal transfer record status: ${transferStatus} (expected 2=COMPLETED)`);
          
          // TransferStatus enum: 0=PENDING, 1=INITIATED, 2=COMPLETED, 3=REJECTED
          if (transferStatus !== 2) {
            throw new Error(`Legal transfer record status is ${transferStatus}, but activation requires COMPLETED (2). Current status: ${transferStatus === 0 ? 'PENDING' : transferStatus === 1 ? 'INITIATED' : transferStatus === 3 ? 'REJECTED' : 'UNKNOWN'}. Please complete the legal transfer first.`);
          }
        } else {
          throw new Error('Legal transfer record not found. Please complete the legal transfer before activating the asset.');
        }
      } catch (statusCheckError: any) {
        if (statusCheckError.message.includes('status') || statusCheckError.message.includes('Legal transfer')) {
          throw statusCheckError;
        }
        console.warn('Could not verify contract status, proceeding anyway:', statusCheckError);
      }

      console.log('✅ Activating asset on blockchain:', assetId);

      // TODO: Replace with Novax contract calls for Etherlink
      throw new Error('Mantle service removed - use Novax contracts for Etherlink');
      const txHash = '' as any;

      console.log('✅ Asset activated on blockchain:', txHash);

      toast({
        title: 'Asset Activated!',
        description: `Asset activated on Etherlink blockchain. Transaction: ${txHash.slice(0, 10)}...`,
        variant: 'default'
      });

      // Refresh assets list
      await fetchAMCAssets();
    } catch (error: any) {
      console.error('❌ Error activating asset:', error);
      let errorMessage = error.message || 'Failed to activate asset on blockchain';
      
      if (error.message?.includes('AMC_ROLE') || error.message?.includes('AMC')) {
        errorMessage = 'You do not have AMC_ROLE on the contract. Please ensure your wallet has the required role.';
      } else if (error.message?.includes('Legal transfer must be completed') || error.message?.includes('Legal transfer not completed')) {
        errorMessage = 'Legal transfer must be completed before activation. Please use the "Complete Legal Transfer" button first.';
      } else if (error.message?.includes('status') || error.message?.includes('Legal transfer record')) {
        // Use the specific error message from our status check
        errorMessage = error.message;
      }
      
      toast({
        title: 'Activation Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 10000
      });
    } finally {
      setIsActivating(null);
    }
  };

  const assignAMCWithChainlinkVRF = async (assetId: string) => {
    try {
      setIsAssigningAMC(true);
      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) return;
      
      const response = await fetch(`${apiUrl}/assets/rwa/${assetId}/assign-amc-vrf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to assign AMC with Chainlink VRF');
      }

      const result = await response.json();
      
      setAssets(prev => prev.map(asset => 
        asset.id === assetId 
          ? { 
              ...asset, 
              status: 'ASSIGNED' as const,
              assignedTo: result.amcId
            }
          : asset
      ));
      
      toast({
        title: 'AMC Assigned Successfully!',
        description: `Asset assigned to ${result.amcId} using Chainlink VRF. ${result.assignmentReason}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error assigning AMC with VRF:', error);
      toast({
        title: 'AMC Assignment Failed',
        description: 'Failed to assign AMC using Chainlink VRF. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsAssigningAMC(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    switch (activeTab) {
      case 'approval':
        return asset.status === 'PENDING_ASSIGNMENT'; // PENDING_VERIFICATION from blockchain
      case 'assigned':
        return ['ASSIGNED', 'INSPECTION_SCHEDULED', 'INSPECTION_COMPLETED'].includes(asset.status);
      case 'inspections':
        return ['INSPECTION_SCHEDULED', 'INSPECTION_COMPLETED'].includes(asset.status);
      case 'transfers':
        // Show assets that are ready for legal transfer (inspection completed) or already in legal transfer
        return ['INSPECTION_COMPLETED', 'LEGAL_TRANSFER_PENDING', 'LEGAL_TRANSFER_COMPLETED'].includes(asset.status);
      case 'active':
        return asset.status === 'ACTIVE';
      default:
        return true;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-off-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-off-white mb-2">AMC Dashboard</h1>
          <p className="text-primary-blue-light">Manage and verify real-world assets</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Assets</p>
                  <p className="text-2xl font-bold text-off-white">{assets.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-primary-blue" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Pending Inspection</p>
                  <p className="text-2xl font-bold text-off-white">
                    {assets.filter(a => a.status === 'INSPECTION_SCHEDULED').length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Assets</p>
                  <p className="text-2xl font-bold text-off-white">
                    {assets.filter(a => a.status === 'ACTIVE').length}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary-blue" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Value</p>
                  <p className="text-2xl font-bold text-off-white">
                    ${assets.reduce((sum, asset) => sum + asset.value, 0).toLocaleString()}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6">
          {[
            { id: 'approval', label: 'Pending Approval', count: assets.filter(a => a.status === 'PENDING_ASSIGNMENT').length },
            { id: 'assigned', label: 'Assigned Assets', count: assets.filter(a => ['ASSIGNED', 'INSPECTION_SCHEDULED', 'INSPECTION_COMPLETED'].includes(a.status)).length },
            { id: 'inspections', label: 'Inspections', count: assets.filter(a => ['INSPECTION_SCHEDULED', 'INSPECTION_COMPLETED'].includes(a.status)).length },
            { id: 'transfers', label: 'Legal Transfers', count: assets.filter(a => ['INSPECTION_COMPLETED', 'LEGAL_TRANSFER_PENDING', 'LEGAL_TRANSFER_COMPLETED'].includes(a.status)).length },
            { id: 'active', label: 'Active Assets', count: assets.filter(a => a.status === 'ACTIVE').length },
            { id: 'pools', label: 'Pool Management', count: poolCount }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-blue text-black'
                  : 'text-gray-400 hover:text-off-white hover:bg-gray-800'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Conditional Content Based on Active Tab */}
        {activeTab === 'pools' && <PoolManagement />}
        
        {/* Assets List - Show for all tabs except pools */}
        {activeTab !== 'pools' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-off-white mb-1">{asset.name}</CardTitle>
                    <p className="text-sm text-gray-400">{asset.type}</p>
                  </div>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getStatusColor(asset.status)}`}>
                    {getStatusIcon(asset.status)}
                    <span className="capitalize">{asset.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300">{asset.location || 'Unknown'}</span>
                    {asset.location === 'Unknown' && (
                      <span className="text-xs text-yellow-400 ml-1" title="Location not set on-chain">⚠️</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300">
                      {asset.value > 0 ? `$${asset.value.toLocaleString()}` : '$0'}
                    </span>
                    {asset.value === 0 && (
                      <span className="text-xs text-yellow-400 ml-1" title="Value not set on-chain">⚠️</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300">
                      Owner: {asset.owner && asset.owner.length > 0 
                        ? `${asset.owner.slice(0, 6)}...${asset.owner.slice(-4)}` 
                        : 'Unknown'}
                    </span>
                    {(!asset.owner || asset.owner.length === 0) && (
                      <span className="text-xs text-yellow-400 ml-1" title="Owner not set on-chain">⚠️</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {asset.status === 'PENDING_ASSIGNMENT' && (
                    <Button
                      onClick={() => approveAsset(asset.id)}
                      disabled={isApproving === asset.id || !isConnected}
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      size="sm"
                    >
                      {isApproving === asset.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve Asset
                        </>
                      )}
                    </Button>
                  )}
                  
                  {asset.status === 'ASSIGNED' && (
                    <Button
                      onClick={() => openScheduleModal(asset)}
                      disabled={isSchedulingInspection === asset.id || !isConnected}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                      size="sm"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule Inspection
                    </Button>
                  )}
                  
                  {asset.status === 'INSPECTION_SCHEDULED' && (
                    <Button
                      onClick={() => completeInspection(asset.id)}
                      disabled={isCompletingInspection === asset.id || !isConnected}
                      className="w-full bg-primary-blue hover:bg-primary-blue text-white"
                      size="sm"
                    >
                      {isCompletingInspection === asset.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Complete Inspection
                        </>
                      )}
                    </Button>
                  )}
                  
                  {asset.status === 'INSPECTION_COMPLETED' && asset.legalTransferStatus !== 'INITIATED' && (
                    <Button
                      onClick={() => initiateLegalTransfer(asset.id)}
                      disabled={isInitiatingTransfer === asset.id || !isConnected}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                      size="sm"
                    >
                      {isInitiatingTransfer === asset.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Initiating...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Initiate Legal Transfer
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Show "Complete Legal Transfer" if legal transfer is initiated but status hasn't updated yet */}
                  {asset.status === 'INSPECTION_COMPLETED' && asset.legalTransferStatus === 'INITIATED' && (
                    <Button
                      onClick={() => completeLegalTransfer(asset.id)}
                      disabled={isCompletingTransfer === asset.id || !isConnected}
                      className="w-full bg-primary-blue text-black hover:bg-primary-blue-light"
                      size="sm"
                    >
                      {isCompletingTransfer === asset.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Complete Legal Transfer
                        </>
                      )}
                    </Button>
                  )}
                  
                  {asset.status === 'LEGAL_TRANSFER_PENDING' && (
                    <Button
                      onClick={() => completeLegalTransfer(asset.id)}
                      disabled={isCompletingTransfer === asset.id || !isConnected}
                      className="w-full bg-primary-blue text-black hover:bg-primary-blue-light"
                      size="sm"
                    >
                      {isCompletingTransfer === asset.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Complete Legal Transfer
                        </>
                      )}
                    </Button>
                  )}
                  
                  {asset.status === 'LEGAL_TRANSFER_COMPLETED' && (
                    <Button
                      onClick={() => activateAsset(asset.id)}
                      disabled={isActivating === asset.id || !isConnected}
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      size="sm"
                    >
                      {isActivating === asset.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Activating...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Activate Asset
                        </>
                      )}
                    </Button>
                  )}
                  
                  {asset.status === 'ACTIVE' && (
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => setSelectedAsset(asset)}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        onClick={() => setSelectedAsset(asset)}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Manage
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}

        {activeTab !== 'pools' && filteredAssets.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              {activeTab === 'transfers' 
                ? 'No assets ready for legal transfer'
                : activeTab === 'inspections'
                ? 'No assets in inspection phase'
                : activeTab === 'approval'
                ? 'No assets pending approval'
                : 'No assets found'}
            </h3>
            <p className="text-gray-500">
              {activeTab === 'transfers' 
                ? 'Assets with completed inspections will appear here. Check the "Inspections" tab for assets with completed inspections.'
                : 'No assets match the current filter criteria.'}
            </p>
          </div>
        )}

        {/* Asset Details Modal */}
        {selectedAsset && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-xl text-off-white">Asset Details</CardTitle>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="text-gray-400 hover:text-off-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Asset Name and Status */}
                <div>
                  <h3 className="text-2xl font-bold text-off-white mb-2">{selectedAsset.name}</h3>
                  <div className="flex items-center space-x-3">
                    <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm ${getStatusColor(selectedAsset.status)}`}>
                      {getStatusIcon(selectedAsset.status)}
                      <span className="capitalize">{selectedAsset.status.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="text-gray-400 text-sm">{selectedAsset.type}</span>
                  </div>
                </div>

                {/* Asset Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Location</p>
                      <p className="text-off-white">{selectedAsset.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Value</p>
                      <p className="text-off-white">${selectedAsset.value.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <Users className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Owner</p>
                      <p className="text-off-white font-mono text-xs">{selectedAsset.owner}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Assigned To</p>
                      <p className="text-off-white font-mono text-xs">{selectedAsset.assignedTo}</p>
                    </div>
                  </div>
                  
                  {selectedAsset.inspectionDate && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-400">Inspection Date</p>
                        <p className="text-off-white">
                          {(() => {
                            try {
                              // inspectionDate is stored as ISO string (from line 294: new Date(inspectionDate * 1000).toISOString())
                              const date = new Date(selectedAsset.inspectionDate);
                              return isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString();
                            } catch {
                              return 'Not available';
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Created At</p>
                      <p className="text-off-white">
                        {new Date(selectedAsset.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                {selectedAsset.inspectionReport && (
                  <div>
                    <h4 className="text-lg font-semibold text-off-white mb-2">Inspection Report</h4>
                    <p className="text-gray-300 text-sm">{selectedAsset.inspectionReport}</p>
                  </div>
                )}

                {selectedAsset.legalTransferStatus && (
                  <div>
                    <h4 className="text-lg font-semibold text-off-white mb-2">Legal Transfer Status</h4>
                    <p className="text-gray-300 text-sm">{selectedAsset.legalTransferStatus}</p>
                  </div>
                )}

                {/* Documents */}
                {selectedAsset.documents && selectedAsset.documents.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-off-white mb-2">Documents</h4>
                    <div className="space-y-2">
                      {selectedAsset.documents.map((doc, index) => (
                        <a
                          key={index}
                          href={doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-primary-blue hover:text-primary-blue-light text-sm"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Document {index + 1}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4 border-t border-gray-700">
                  <Button
                    onClick={() => setSelectedAsset(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    Close
                  </Button>
                  {selectedAsset.status === 'ACTIVE' && (
                    <Button
                      onClick={() => {
                        // Navigate to marketplace or pool management
                        toast({
                          title: 'Asset Management',
                          description: 'Use "Pool Management" tab to add this asset to a pool, or visit the Marketplace to list it for trading.',
                          variant: 'default',
                          duration: 5000
                        });
                      }}
                      className="flex-1 bg-primary-blue text-black hover:bg-primary-blue-light"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Manage Asset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Schedule Inspection Modal */}
        {showScheduleModal && selectedAssetForScheduling && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md m-4">
              <CardHeader>
                <CardTitle className="text-xl text-off-white">Schedule Inspection</CardTitle>
                <p className="text-sm text-gray-400 mt-2">
                  Schedule physical inspection for <strong>{selectedAssetForScheduling.name}</strong>
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Inspection Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Inspection Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                    required
                  />
                </div>
                {scheduledDate && scheduledTime && (
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-400">Scheduled for:</p>
                    <p className="text-off-white font-medium">
                      {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="flex space-x-3 pt-4">
                  <Button
                    onClick={closeScheduleModal}
                    variant="outline"
                    className="flex-1"
                    disabled={isSchedulingInspection === selectedAssetForScheduling.id}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={scheduleInspection}
                    disabled={isSchedulingInspection === selectedAssetForScheduling.id || !scheduledDate || !scheduledTime}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {isSchedulingInspection === selectedAssetForScheduling.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Schedule Inspection
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AMCDashboard;
