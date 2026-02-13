import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  FileText, 
  Image, 
  CheckCircle, 
  AlertCircle,
  Building,
  TreePine,
  Package,
  Truck,
  Wrench,
  Shield,
  Brain,
  TrendingUp
} from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
// Mantle service removed - using Etherlink/Novax contracts instead
import { ethers } from 'ethers';
import { useToast } from '../../hooks/useToast';
import { apiService } from '../../services/api';
import Card from '../UI/Card';
import Button from '../UI/Button';

interface RWAAssetData {
  // Basic Information
  name: string;
  description: string;
  type: string;
  category: string;
  
  // Location (for Real Estate)
  country: string;
  region: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  
  // Financial (Common)
  totalValue: number;
  expectedAPY: number;
  maturityDate: string;
  maxInvestablePercentage: number; // Maximum percentage of asset that can be tokenized (0-100, default: 100)
  
  // Documentation
  evidenceFiles: File[];
  selectedCategory: string;
  displayImage: File | null;
  
  // Additional Details
  condition: string;
  maintenanceHistory: string;
  insuranceInfo: string;
  complianceStatus: string;
  
  // Real Estate Specific
  propertyType?: string; // Residential, Commercial, Industrial
  squareFootage?: number;
  numberOfUnits?: number;
  yearBuilt?: number;
  
  // Bond Specific
  bondType?: string; // Corporate, Government, Municipal
  couponRate?: number; // Annual interest rate
  couponFrequency?: string; // Monthly, Quarterly, Semi-Annual, Annual
  faceValue?: number; // Principal amount
  issuer?: string; // Bond issuer name
  creditRating?: string; // AAA, AA, A, BBB, etc.
  
  // Business Assets Specific (Bonds, Revenue Streams)
  // Cashflow Specific
  cashflowType?: string; // Recurring, One-time, Subscription
  paymentFrequency?: string; // Daily, Weekly, Monthly, Quarterly, Annual
  paymentAmount?: number; // Amount per payment
  numberOfPayments?: number; // Total number of payments
  startDate?: string; // When payments start
  endDate?: string; // When payments end
  source?: string; // Source of cashflow (e.g., "Rental Income", "Service Revenue")
  
  // Trade Receivable Specific
  importerAddress?: string; // Importer (invoice payer) address
  invoiceNumber?: string; // Invoice number
}

const CreateRWAAsset: React.FC = () => {
  const { isConnected, address, signer, connectWallet } = useWallet();
  const accountId = address; // Compatibility: accountId = address for EVM
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const displayImageInputRef = useRef<HTMLInputElement>(null);
  const evidenceFilesInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    displayImage: boolean;
    evidenceFiles: boolean;
    metadata: boolean;
    currentFile?: string;
    totalFiles?: number;
    currentFileIndex?: number;
  }>({
    displayImage: false,
    evidenceFiles: false,
    metadata: false
  });
  
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  
  const [assetData, setAssetData] = useState<RWAAssetData>({
    name: '',
    description: '',
    type: '',
    category: '',
      country: '',
    region: '',
      address: '',
    coordinates: { lat: 0, lng: 0 },
    totalValue: 0,
    expectedAPY: 0,
    maturityDate: '',
    maxInvestablePercentage: 100, // Default: 100% of asset can be tokenized
    evidenceFiles: [],
    selectedCategory: '',
    displayImage: null,
    condition: '',
    maintenanceHistory: '',
    insuranceInfo: '',
    complianceStatus: ''
  });

  const assetTypes = [
    // Original Asset Types based on contract categories
    { 
      value: 'REAL_ESTATE', 
      label: 'Real Estate', 
      icon: Building, 
      description: 'Commercial buildings, residential properties, industrial facilities',
      category: 0, // REAL_ESTATE in contract
      isPrimary: true
    },
    { 
      value: 'COMMODITY', 
      label: 'Commodity', 
      icon: Truck, 
      description: 'Precious metals, energy resources, raw materials',
      category: 1, // COMMODITY in contract
      isPrimary: true
    },
    { 
      value: 'AGRICULTURAL', 
      label: 'Agriculture', 
      icon: TreePine, 
      description: 'Farmland, plantations, agricultural facilities, crops',
      category: 2, // AGRICULTURE in contract
      isPrimary: true
    },
    { 
      value: 'INFRASTRUCTURE', 
      label: 'Infrastructure', 
      icon: Building, 
      description: 'Roads, bridges, utilities, public facilities',
      category: 3, // INFRASTRUCTURE in contract
      isPrimary: true
    },
    { 
      value: 'BUSINESS', 
      label: 'Business Assets', 
      icon: DollarSign, 
      description: 'Bonds, revenue streams, business equity, financial instruments',
      category: 4, // BUSINESS in contract
      isPrimary: true
    },
    { 
      value: 'EQUIPMENT', 
      label: 'Equipment', 
      icon: Wrench, 
      description: 'Machinery, vehicles, industrial equipment',
      category: 5, // OTHER in contract
      isPrimary: false
    },
    { 
      value: 'INVENTORY', 
      label: 'Inventory', 
      icon: Package, 
      description: 'Finished goods, stock, warehouse inventory',
      category: 5, // OTHER in contract
      isPrimary: false
    },
    { 
      value: 'TRADE_RECEIVABLE', 
      label: 'Trade Receivable', 
      icon: FileText, 
      description: 'Invoices, trade receivables, cross-border financing',
      category: 5, // OTHER in contract (trade receivables are RWA)
      isPrimary: true
    }
  ];

  // Get asset-specific document categories
  const getDocumentCategories = () => {
    const baseCategories = [
      { value: 'ownership', label: 'Ownership Documents', icon: FileText, required: true },
      { value: 'photos', label: 'Asset Photos', icon: Image, required: false },
      { value: 'inspection', label: 'Inspection Reports', icon: CheckCircle, required: false },
      { value: 'certificates', label: 'Certificates & Compliance', icon: Shield, required: false },
      { value: 'financial', label: 'Financial Documents', icon: DollarSign, required: false },
      { value: 'legal', label: 'Legal Documents', icon: FileText, required: false },
      { value: 'maintenance', label: 'Maintenance Records', icon: Wrench, required: false }
    ];

    // Asset-specific ownership document descriptions
    const ownershipDescriptions: Record<string, string> = {
      'REAL_ESTATE': 'Deed, Title, Certificate of Ownership',
      'COMMODITY': 'Certificate of Ownership, Warehouse Receipt, Bill of Lading',
      'AGRICULTURAL': 'Land Deed, Title, Certificate of Ownership',
      'INFRASTRUCTURE': 'Deed, Title, Certificate of Ownership, Government Authorization',
      'BUSINESS': 'Bond Certificate, Business License, Equity Certificate, Financial Instruments',
      'BONDS': 'Bond Certificate, Custody Statement, Registry Records',
      'CASHFLOW': 'Service Agreement, Contract, Revenue Agreement',
      'EQUIPMENT': 'Bill of Sale, Certificate of Ownership, Registration',
      'INVENTORY': 'Bill of Sale, Purchase Receipt, Warehouse Receipt'
    };

    return baseCategories.map(cat => {
      if (cat.value === 'ownership' && assetData.type) {
        return {
          ...cat,
          description: ownershipDescriptions[assetData.type] || 'Certificate of Ownership'
        };
      }
      if (cat.value === 'photos') {
        const photoDescriptions: Record<string, string> = {
          'REAL_ESTATE': 'Multiple angles, current condition',
          'COMMODITY': 'Commodity photos, storage images',
          'AGRICULTURAL': 'Land photos, crop images, facility photos',
          'INFRASTRUCTURE': 'Infrastructure photos, facility images',
          'BUSINESS': 'Business documents, certificate images',
          'BONDS': 'Bond certificate images (if physical)',
          'CASHFLOW': 'Contract/service agreement images',
          'EQUIPMENT': 'Multiple angles, current condition',
          'INVENTORY': 'Product photos, warehouse images'
        };
        return {
          ...cat,
          description: photoDescriptions[assetData.type] || 'Multiple angles, current condition',
          required: ['REAL_ESTATE', 'EQUIPMENT'].includes(assetData.type)
        };
      }
      if (cat.value === 'financial') {
        const financialDescriptions: Record<string, string> = {
          'REAL_ESTATE': 'Valuation reports, financial statements',
          'COMMODITY': 'Market valuation, commodity prices',
          'AGRICULTURAL': 'Land valuation, crop yield reports',
          'INFRASTRUCTURE': 'Infrastructure valuation, maintenance costs',
          'BUSINESS': 'Business valuation, financial statements, revenue reports',
          'BONDS': 'Prospectus, Credit Rating Report, Payment History',
          'CASHFLOW': 'Payment History, Bank Statements, Revenue Reports'
        };
        return {
          ...cat,
          description: financialDescriptions[assetData.type] || 'Valuation reports, financial statements',
          required: ['BONDS', 'BUSINESS', 'CASHFLOW'].includes(assetData.type)
        };
      }
      if (cat.value === 'legal') {
        const legalDescriptions: Record<string, string> = {
          'REAL_ESTATE': 'Contracts, agreements, legal opinions',
          'COMMODITY': 'Purchase agreements, storage contracts',
          'AGRICULTURAL': 'Land agreements, farming contracts',
          'INFRASTRUCTURE': 'Government contracts, maintenance agreements',
          'BUSINESS': 'Business agreements, partnership contracts, bond indentures',
          'BONDS': 'Bond Agreement, Indenture, Terms & Conditions',
          'CASHFLOW': 'Service Agreement, Revenue Contracts, Licensing Agreement'
        };
        return {
          ...cat,
          description: legalDescriptions[assetData.type] || 'Contracts, agreements, legal opinions',
          required: ['BONDS', 'BUSINESS', 'CASHFLOW'].includes(assetData.type)
        };
      }
      return cat;
    });
  };

  const documentCategories = getDocumentCategories();

  const handleInputChange = (field: keyof RWAAssetData, value: any) => {
    setAssetData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (files: File[]) => {
    setAssetData(prev => ({
      ...prev,
      evidenceFiles: [...prev.evidenceFiles, ...files]
    }));
    
    // Reset the file input to allow selecting the same file again
    if (evidenceFilesInputRef.current) {
      evidenceFilesInputRef.current.value = '';
    }
  };

  const handleDisplayImageChange = (file: File | null) => {
    setAssetData(prev => ({
      ...prev,
      displayImage: file
    }));
    
    // Reset the file input to allow selecting the same file again
    if (displayImageInputRef.current) {
      displayImageInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAssetData(prev => ({
      ...prev,
      evidenceFiles: prev.evidenceFiles.filter((_, i) => i !== index)
    }));
  };


  // Compress multiple IPFS CIDs into a single hash for token memo storage
  const compressIPFSHashes = (cids: string[]): string => {
    // Create a compressed hash from multiple IPFS CIDs
    // This allows us to store multiple document references in the token memo
    const combinedCids = cids.join('|');
    
    // Create a hash of the combined CIDs to fit in token memo (100 char limit)
    const encoder = new TextEncoder();
    const data = encoder.encode(combinedCids);
    
    // Use a simple hash function to create a shorter representation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    
    // Convert to base36 for shorter representation
    return hash.toString(36);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check wallet connection
      if (!isConnected || !address) {
        await connectWallet();
        if (!isConnected || !address) {
          throw new Error('Wallet not connected. Please connect your MetaMask wallet.');
        }
      }
      
      if (!signer) {
        throw new Error('Wallet signer not available. Please reconnect your wallet.');
      }

      // Step 1: Upload files to IPFS using real IPFS service
      console.log('Uploading files to IPFS...');
      
      // Import ipfsService
      const { ipfsService } = await import('../../services/ipfs');
      
      // Check if server URL is configured
      const serverUrl = (import.meta as any).env.VITE_SERVER_URL;
      if (!serverUrl) {
        throw new Error('Server URL not configured. Please set VITE_SERVER_URL in your .env file.');
      }
      
      // Upload display image first
      let displayImageUrl = '';
      if (assetData.displayImage) {
        console.log('Uploading display image to IPFS...');
        setUploadProgress(prev => ({ ...prev, displayImage: true, currentFile: assetData.displayImage?.name }));
        
        try {
          const displayImageResult = await ipfsService.uploadFile(assetData.displayImage, {
            name: `${assetData.name} - Display Image`,
            type: assetData.displayImage.type,
            size: assetData.displayImage.size,
            description: 'Main asset display image'
          });
          
          console.log('📦 Display image upload result:', {
            cid: displayImageResult.cid,
            ipfsUrl: displayImageResult.ipfsUrl,
            pinSize: displayImageResult.pinSize
          });
          
          // Use CID in ipfs:// format for blockchain storage (more standard and efficient)
          // This ensures the CID is stored directly, and we can construct gateway URLs when needed
          displayImageUrl = displayImageResult.cid 
            ? `ipfs://${displayImageResult.cid}` 
            : displayImageResult.ipfsUrl; // Fallback to full URL if CID not available
          
          console.log('✅ Display image URL for blockchain:', displayImageUrl);
          console.log('📋 Display image CID:', displayImageResult.cid);
        } catch (error) {
          console.error('Failed to upload display image:', error);
          throw new Error(`Failed to upload display image: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the backend server is running at ${serverUrl}`);
        } finally {
          setUploadProgress(prev => ({ ...prev, displayImage: false }));
        }
      }

      // Upload all evidence files to IPFS
      const uploadedFiles = [];
      if (assetData.evidenceFiles.length > 0) {
        setUploadProgress(prev => ({ 
          ...prev, 
          evidenceFiles: true, 
          totalFiles: assetData.evidenceFiles.length,
          currentFileIndex: 0
        }));
        
        try {
          for (let i = 0; i < assetData.evidenceFiles.length; i++) {
            const file = assetData.evidenceFiles[i];
            console.log(`Uploading evidence file ${i + 1}/${assetData.evidenceFiles.length}: ${file.name}`);
            
            setUploadProgress(prev => ({ 
              ...prev, 
              currentFile: file.name,
              currentFileIndex: i + 1
            }));
          
            try {
              const fileResult = await ipfsService.uploadFile(file, {
                name: `${assetData.name} - ${file.name}`,
                type: file.type,
                size: file.size,
                description: `Evidence file for ${assetData.selectedCategory}`
              });
              console.log(`📦 Evidence file ${i + 1} upload result:`, {
                name: file.name,
                cid: fileResult.cid,
                ipfsUrl: fileResult.ipfsUrl,
                pinSize: fileResult.pinSize
              });
              
              uploadedFiles.push({
                name: file.name,
                type: file.type,
                size: file.size,
                url: fileResult.cid ? `ipfs://${fileResult.cid}` : fileResult.ipfsUrl, // Use ipfs:// format
                cid: fileResult.cid
              });
            } catch (error) {
              console.error(`Failed to upload file ${file.name}:`, error);
              throw new Error(`Failed to upload evidence file "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the backend server is running at ${serverUrl}`);
            }
          }
        } catch (error) {
          setUploadProgress(prev => ({ ...prev, evidenceFiles: false }));
          throw error; // Re-throw to be caught by outer try-catch
        }
        
        setUploadProgress(prev => ({ ...prev, evidenceFiles: false }));
      }

      // Step 2: Create comprehensive metadata with type-specific fields
      const metadata: any = {
        name: assetData.name,
        description: assetData.description,
        type: 'RWA', // Set type as 'RWA' for Profile filtering
        assetType: assetData.type, // Store actual asset type (REAL_ESTATE, BONDS, etc.)
        category: assetData.category,
        totalValue: assetData.totalValue,
        expectedAPY: assetData.expectedAPY,
        maturityDate: assetData.maturityDate,
        displayImage: displayImageUrl,
        evidenceFiles: uploadedFiles,
        selectedCategory: assetData.selectedCategory,
        createdAt: new Date().toISOString()
      };

      // Add location for Real Estate
      if (assetData.type === 'REAL_ESTATE') {
        metadata.location = {
          country: assetData.country,
          region: assetData.region,
          address: assetData.address,
          coordinates: assetData.coordinates
        };
        metadata.propertyType = assetData.propertyType;
        metadata.squareFootage = assetData.squareFootage;
        metadata.numberOfUnits = assetData.numberOfUnits;
        metadata.yearBuilt = assetData.yearBuilt;
        metadata.condition = assetData.condition;
        metadata.maintenanceHistory = assetData.maintenanceHistory;
        metadata.insuranceInfo = assetData.insuranceInfo;
      }

      // Add bond-specific fields
      if (assetData.type === 'BONDS') {
        metadata.bondType = assetData.bondType;
        metadata.couponRate = assetData.couponRate;
        metadata.couponFrequency = assetData.couponFrequency;
        metadata.faceValue = assetData.faceValue;
        metadata.issuer = assetData.issuer;
        metadata.creditRating = assetData.creditRating;
      }


      // Add cashflow-specific fields
      if (assetData.type === 'CASHFLOW') {
        metadata.cashflowType = assetData.cashflowType;
        metadata.paymentFrequency = assetData.paymentFrequency;
        metadata.paymentAmount = assetData.paymentAmount;
        metadata.numberOfPayments = assetData.numberOfPayments;
        metadata.startDate = assetData.startDate;
        metadata.endDate = assetData.endDate;
        metadata.source = assetData.source;
      }

      // Add trade receivable specific fields
      if (assetData.type === 'TRADE_RECEIVABLE') {
        metadata.importerAddress = assetData.importerAddress;
        metadata.invoiceNumber = assetData.invoiceNumber;
        metadata.dueDate = assetData.maturityDate; // Due date for invoice
      }

      // Add compliance status for all types
      metadata.complianceStatus = assetData.complianceStatus;

      // Step 3: Upload metadata to IPFS
      console.log('Uploading metadata to IPFS...');
      setUploadProgress(prev => ({ ...prev, metadata: true, currentFile: 'metadata.json' }));
      
      const metadataJson = JSON.stringify(metadata);
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], 'rwa-metadata.json', { type: 'application/json' });
      
      const metadataUploadResult = await ipfsService.uploadFile(metadataFile, {
        name: `${assetData.name} - RWA Metadata`,
        type: 'application/json',
        size: metadataFile.size,
        description: 'RWA Asset Metadata JSON'
      });
      
      setUploadProgress(prev => ({ ...prev, metadata: false }));

      if (!metadataUploadResult?.cid && !metadataUploadResult?.ipfsUrl) {
        throw new Error('Failed to upload metadata to IPFS');
      }

      const metadataCid = metadataUploadResult.cid;
      const metadataUrl = metadataCid 
        ? `ipfs://${metadataCid}` 
        : metadataUploadResult.ipfsUrl; // Fallback to full URL if CID not available
      
      console.log('✅ Metadata uploaded to IPFS:', {
        cid: metadataCid,
        url: metadataUrl,
        ipfsUrl: metadataUploadResult.ipfsUrl
      });

      // Map asset type to contract AssetCategory enum
      // Contract enum: REAL_ESTATE=0, COMMODITY=1, AGRICULTURE=2, INFRASTRUCTURE=3, BUSINESS=4, OTHER=5
      const mapAssetTypeToCategory = (assetType: string): number => {
        switch (assetType) {
          case 'REAL_ESTATE':
            return 0; // REAL_ESTATE
          case 'BUSINESS':
          case 'BONDS':
            return 4; // BUSINESS (financial instruments)
          case 'CASHFLOW':
            return 4; // BUSINESS (revenue streams)
          case 'COMMODITY':
            return 1; // COMMODITY
          case 'AGRICULTURAL':
            return 2; // AGRICULTURE
          case 'EQUIPMENT':
          case 'INVENTORY':
            return 5; // OTHER
          default:
            return 4; // BUSINESS (default)
        }
      };

      const assetCategory = mapAssetTypeToCategory(assetData.type);
      const locationString = `${assetData.country}, ${assetData.region}${assetData.address ? `, ${assetData.address}` : ''}`;
      
      // Convert maturity date to Unix timestamp
      const maturityTimestamp = assetData.maturityDate 
        ? BigInt(Math.floor(new Date(assetData.maturityDate).getTime() / 1000))
        : BigInt(0);

      // Prepare evidence hashes and document types
      // Use CID directly if available, otherwise use the URL (which should be in ipfs:// format)
      const evidenceHashes = uploadedFiles.map(f => f.cid || f.url);
      const documentTypes = uploadedFiles.map(f => f.name || 'Document');

      // Step 4: Create RWA asset via Etherlink smart contract
      console.log('🚀 Creating RWA asset on Etherlink Network...');
      console.log('📋 Asset creation parameters:', {
        category: assetCategory,
        name: assetData.name,
        location: locationString,
        totalValue: assetData.totalValue,
        maturityDate: maturityTimestamp.toString(),
        imageURI: displayImageUrl,
        documentURI: metadataUrl,
        evidenceHashes: evidenceHashes,
        evidenceCount: evidenceHashes.length
      });
      
      console.log('🔗 IPFS URLs being stored on blockchain:', {
        imageURI: displayImageUrl,
        documentURI: metadataUrl,
        evidenceHashes: evidenceHashes
      });

      // Initialize Novax contract service if not already initialized
      if (signer) {
        const { novaxContractService } = await import('../../services/novaxContractService');
        const provider = new ethers.BrowserProvider(window.ethereum!);
        novaxContractService.initialize(signer, provider);
      }

      // Extract CID from metadata URL (already uploaded to IPFS above)
      // The metadata was already uploaded and we have metadataCid and metadataUrl
      const metadataCID = metadataCid || metadataUrl.replace('ipfs://', '').split('/')[0] || ethers.id(JSON.stringify(metadata));

      // Create asset on-chain using Novax contracts
      const { novaxContractService } = await import('../../services/novaxContractService');
      
      let createResult: { assetId: string; txHash: string; receivableId?: string };
      
      if (assetData.type === 'TRADE_RECEIVABLE') {
        // Trade Receivable: Use NovaxReceivableFactory
        if (!assetData.importerAddress || !ethers.isAddress(assetData.importerAddress)) {
          throw new Error('Invalid importer address');
        }
        
        const dueDateTimestamp = assetData.maturityDate 
          ? Math.floor(new Date(assetData.maturityDate).getTime() / 1000)
          : 0;
        
        if (dueDateTimestamp <= Math.floor(Date.now() / 1000)) {
          throw new Error('Due date must be in the future');
        }
        
        const receivableResult = await novaxContractService.createReceivable(
          assetData.importerAddress,
          ethers.parseUnits(assetData.totalValue.toString(), 6), // USDC (6 decimals)
          dueDateTimestamp,
          metadataCID // IPFS CID as bytes32
        );
        
        createResult = {
          assetId: receivableResult.receivableId,
          txHash: receivableResult.txHash,
          receivableId: receivableResult.receivableId
        };
        
        console.log('✅ Trade Receivable created on Etherlink:', createResult.assetId);
        console.log('📋 Transaction hash:', createResult.txHash);
      } else {
        // RWA Asset: Use NovaxRwaFactory
        const createRwaResult = await novaxContractService.createRwa(
          assetCategory, // 0-5: REAL_ESTATE, AGRICULTURE, INFRASTRUCTURE, COMMODITY, EQUIPMENT, OTHER
          ethers.parseUnits(assetData.totalValue.toString(), 6), // USDC (6 decimals)
          assetData.maxLTV || 70, // Max LTV percentage (0-100)
          metadataCID // IPFS CID as bytes32
        );
        
        createResult = {
          assetId: createRwaResult.assetId,
          txHash: createRwaResult.txHash
        };
        
        console.log('✅ RWA asset created on Etherlink:', createResult.assetId);
        console.log('📋 Transaction hash:', createResult.txHash);
      }

      // Sync asset to backend database with maxInvestablePercentage
      try {
        console.log('📤 Syncing asset to backend database...');
        console.log('   ✅ maturityDate:', assetData.maturityDate, '→ Unix timestamp:', Number(maturityTimestamp));
        console.log('   ✅ maxInvestablePercentage:', assetData.maxInvestablePercentage || 100, '%');
        const rwaAssetData = {
          category: assetCategory,
          assetType: assetData.type,
          name: assetData.name,
          location: locationString,
          totalValue: assetData.totalValue.toString(),
          maturityDate: Number(maturityTimestamp), // ✅ Maturity date (Unix timestamp in seconds)
          evidenceHashes: evidenceHashes,
          documentTypes: documentTypes,
          imageURI: displayImageUrl,
          documentURI: metadataUrl,
          description: assetData.description,
          owner: address || '',
          assetId: createResult.assetId,
          transactionId: createResult.txHash,
          maxInvestablePercentage: assetData.maxInvestablePercentage || 100, // ✅ Max investable percentage (separate field, 0-100)
        };
        
        const backendResponse = await apiService.createRWAAsset(rwaAssetData);
        console.log('✅ Asset synced to backend database:', backendResponse);
      } catch (backendError: any) {
        // Don't fail the entire creation if backend sync fails
        console.warn('⚠️ Failed to sync asset to backend database (non-critical):', backendError.message);
        toast({
          title: 'Asset Created on Blockchain',
          description: 'Asset created on-chain successfully, but backend sync failed. The asset will still be available.',
          variant: 'default'
        });
      }

      setSuccess(true);
      
      // Set refresh flag for profile page
      sessionStorage.setItem('profileNeedsRefresh', 'true');
      
      // Show success toast
      const successMessage = assetData.type === 'TRADE_RECEIVABLE'
        ? `Your trade receivable has been created on Etherlink Network with IPFS metadata. Receivable ID: ${createResult.assetId.slice(0, 10)}... Status: PENDING_VERIFICATION. Please wait for AMC approval.`
        : `Your RWA asset has been created on Etherlink Network with IPFS metadata. Asset ID: ${createResult.assetId.slice(0, 10)}... Status: PENDING_VERIFICATION. Please wait for AMC approval.`;
      
      toast({
        title: assetData.type === 'TRADE_RECEIVABLE' ? 'Trade Receivable Created Successfully!' : 'RWA Asset Created Successfully!',
        description: successMessage,
        variant: 'default'
      });
      
    } catch (error) {
      console.error('Error creating RWA asset:', error);
      setError(error instanceof Error ? error.message : 'Failed to create RWA asset');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return assetData.name && assetData.description && assetData.type;
      case 2:
        if (assetData.type === 'TRADE_RECEIVABLE') {
          return assetData.importerAddress && ethers.isAddress(assetData.importerAddress);
        }
        return assetData.country && assetData.region && assetData.address;
      case 3:
        if (assetData.type === 'TRADE_RECEIVABLE') {
          // Trade receivables: amount and due date (can be any future date)
          const today = new Date();
          const dueDate = assetData.maturityDate ? new Date(assetData.maturityDate) : null;
          const isValidDueDate = dueDate && dueDate > today;
          return assetData.totalValue > 0 && assetData.maturityDate && isValidDueDate;
        }
        // Validate maturity date is at least 1 year in the future for other assets
        const today = new Date();
        const oneYearFromNow = new Date(today);
        oneYearFromNow.setFullYear(today.getFullYear() + 1);
        const maturityDate = assetData.maturityDate ? new Date(assetData.maturityDate) : null;
        const isValidMaturityDate = maturityDate && maturityDate >= oneYearFromNow;
        
        return assetData.totalValue > 0 && 
               assetData.expectedAPY > 0 && 
               assetData.maturityDate && 
               isValidMaturityDate;
      case 4:
        return assetData.selectedCategory && assetData.evidenceFiles.length > 0 && assetData.displayImage;
      case 5:
        return true; // AI Analysis step - always valid
      case 6:
        return true; // Review step - always valid
      default:
        return false;
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-primary-blue mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-off-white mb-2">
            RWA Asset Tokenized Successfully!
          </h2>
          <p className="text-primary-blue-light mb-6">
            Your RWA asset has been tokenized as an NFT with IPFS metadata and submitted for AMC approval. The NFT contains all your asset documentation and will be reviewed by our team.
          </p>
          <Button 
            onClick={() => navigate('/dashboard/profile', { state: { refreshAssets: true, assetCreated: true } })}
            className="bg-primary-blue text-black hover:bg-primary-blue-light"
          >
            View Profile
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-off-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-off-white mb-4"
          >
            Create RWA Asset
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-primary-blue-light text-lg"
          >
            Submit your real-world asset for tokenization on Etherlink
          </motion.p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step 
                    ? 'bg-primary-blue text-white' 
                    : 'bg-gray-700 text-white'
                }`}>
                  {step}
                </div>
                {step < 5 && (
                  <div className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-primary-blue' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-primary-blue-light">
            <span>Basic Info</span>
            <span>{assetData.type === 'TRADE_RECEIVABLE' ? 'Invoice Details' : 'Location'}</span>
            <span>Financial</span>
            <span>Documents</span>
            <span>Review</span>
          </div>
        </motion.div>

        {/* Form Steps */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="mt-8">
            <div className="p-6">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-off-white mb-4">
                    Basic Information
                  </h2>
              
                  <div>
                    <label className="block text-sm font-medium text-off-white mb-2">
                      Asset Name *
                    </label>
                    <input
                      type="text"
                      value={assetData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                      placeholder="Enter asset name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-off-white mb-2">
                      Description *
                    </label>
                    <textarea
                      value={assetData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                      placeholder="Describe your asset in detail"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-off-white mb-2">
                      Asset Type *
                    </label>
                    <div className="space-y-4">
                      {/* Primary Asset Types */}
                      <div>
                        <h3 className="text-sm font-semibold text-primary-blue mb-3">Primary Asset Types</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {assetTypes.filter(type => type.isPrimary).map((type) => {
                            const Icon = type.icon;
                            return (
                              <div
                                key={type.value}
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                  assetData.type === type.value
                                    ? 'border-primary-blue bg-primary-blue/10'
                                    : 'border-primary-blue/50 hover:border-primary-blue'
                                }`}
                                onClick={() => handleInputChange('type', type.value)}
                              >
                                <div className="flex items-center space-x-3">
                                  <Icon className="w-6 h-6 text-primary-blue" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-off-white">
                                        {type.label}
                                      </span>
                                      <span className="text-xs bg-primary-blue/20 text-primary-blue px-2 py-0.5 rounded">Primary</span>
                                    </div>
                                    <div className="text-sm text-primary-blue-light">
                                      {type.description}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Other Asset Types */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">Other Asset Types</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {assetTypes.filter(type => !type.isPrimary).map((type) => {
                            const Icon = type.icon;
                            return (
                              <div
                                key={type.value}
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                  assetData.type === type.value
                                    ? 'border-primary-blue bg-primary-blue/10'
                                    : 'border-gray-600 hover:border-gray-500'
                                }`}
                                onClick={() => handleInputChange('type', type.value)}
                              >
                                <div className="flex items-center space-x-3">
                                  <Icon className="w-6 h-6 text-gray-400" />
                                  <div>
                                    <div className="font-medium text-off-white">
                                      {type.label}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                      {type.description}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

          {/* Step 2: Location (Real Estate) or Type-Specific Details */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Real Estate: Location */}
              {assetData.type === 'REAL_ESTATE' && (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Property Location & Details
                  </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Country *
                    </label>
                  <input
                    type="text"
                    value={assetData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Country"
                    />
                  </div>

                  <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Region/State *
                    </label>
                  <input
                    type="text"
                    value={assetData.region}
                    onChange={(e) => handleInputChange('region', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Region or State"
                  />
                </div>
                  </div>

                    <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Address *
                      </label>
                <textarea
                  value={assetData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Complete address"
                      />
                    </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Latitude
                      </label>
                  <input
                    type="number"
                    step="any"
                    value={assetData.coordinates.lat}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      handleInputChange('coordinates', { ...assetData.coordinates, lat: isNaN(val) ? 0 : val });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Latitude"
                      />
                    </div>
                
                    <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Longitude
                      </label>
                  <input
                    type="number"
                    step="any"
                    value={assetData.coordinates.lng}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      handleInputChange('coordinates', { ...assetData.coordinates, lng: isNaN(val) ? 0 : val });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Longitude"
                      />
                    </div>
                  </div>

                  {/* Real Estate Specific Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Property Type *
                      </label>
                      <select
                        value={assetData.propertyType || ''}
                        onChange={(e) => handleInputChange('propertyType', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select property type</option>
                        <option value="Residential">Residential</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Industrial">Industrial</option>
                        <option value="Land">Land/Plot</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Square Footage
                      </label>
                      <input
                        type="number"
                        value={assetData.squareFootage || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          handleInputChange('squareFootage', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Square footage"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Number of Units
                      </label>
                      <input
                        type="number"
                        value={assetData.numberOfUnits || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          handleInputChange('numberOfUnits', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Number of units"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Year Built
                      </label>
                      <input
                        type="number"
                        value={assetData.yearBuilt || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          handleInputChange('yearBuilt', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Year built"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Bonds: Bond Details */}
              {assetData.type === 'BONDS' && (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Bond Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Bond Type *
                      </label>
                      <select
                        value={assetData.bondType || ''}
                        onChange={(e) => handleInputChange('bondType', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select bond type</option>
                        <option value="Corporate">Corporate Bond</option>
                        <option value="Government">Government Bond</option>
                        <option value="Municipal">Municipal Bond</option>
                        <option value="Convertible">Convertible Bond</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Issuer Name *
                      </label>
                      <input
                        type="text"
                        value={assetData.issuer || ''}
                        onChange={(e) => handleInputChange('issuer', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Bond issuer name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Face Value *
                      </label>
                      <input
                        type="number"
                        value={assetData.faceValue || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('faceValue', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Face value (principal)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Coupon Rate (%) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={assetData.couponRate || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('couponRate', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Annual coupon rate"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Coupon Frequency *
                      </label>
                      <select
                        value={assetData.couponFrequency || ''}
                        onChange={(e) => handleInputChange('couponFrequency', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select frequency</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Semi-Annual">Semi-Annual</option>
                        <option value="Annual">Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Credit Rating
                      </label>
                      <select
                        value={assetData.creditRating || ''}
                        onChange={(e) => handleInputChange('creditRating', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select rating</option>
                        <option value="AAA">AAA</option>
                        <option value="AA">AA</option>
                        <option value="A">A</option>
                        <option value="BBB">BBB</option>
                        <option value="BB">BB</option>
                        <option value="B">B</option>
                        <option value="CCC">CCC</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Cashflow: Cashflow Details */}
              {assetData.type === 'CASHFLOW' && (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Cashflow Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cashflow Type *
                      </label>
                      <select
                        value={assetData.cashflowType || ''}
                        onChange={(e) => handleInputChange('cashflowType', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select cashflow type</option>
                        <option value="Recurring">Recurring</option>
                        <option value="One-time">One-time</option>
                        <option value="Subscription">Subscription</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Source *
                      </label>
                      <input
                        type="text"
                        value={assetData.source || ''}
                        onChange={(e) => handleInputChange('source', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., Rental Income, Service Revenue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Payment Frequency *
                      </label>
                      <select
                        value={assetData.paymentFrequency || ''}
                        onChange={(e) => handleInputChange('paymentFrequency', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select frequency</option>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Annual">Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Payment Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={assetData.paymentAmount || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('paymentAmount', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Amount per payment"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Number of Payments *
                      </label>
                      <input
                        type="number"
                        value={assetData.numberOfPayments || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          handleInputChange('numberOfPayments', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Total number of payments"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        value={assetData.startDate || ''}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Date *
                      </label>
                      <input
                        type="date"
                        value={assetData.endDate || ''}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Trade Receivable: Invoice Details */}
              {assetData.type === 'TRADE_RECEIVABLE' && (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Trade Receivable Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Importer Address (Invoice Payer) *
                      </label>
                      <input
                        type="text"
                        value={assetData.importerAddress || ''}
                        onChange={(e) => handleInputChange('importerAddress', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0x..."
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Wallet address of the importer who will pay the invoice
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        value={assetData.invoiceNumber || ''}
                        onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Invoice number (optional)"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Other Asset Types: Basic Location (if needed) */}
              {!['REAL_ESTATE', 'BONDS', 'CASHFLOW', 'BUSINESS', 'TRADE_RECEIVABLE'].includes(assetData.type) && assetData.type && (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Asset Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Country
                      </label>
                      <input
                        type="text"
                        value={assetData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Country"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Region/State
                      </label>
                      <input
                        type="text"
                        value={assetData.region}
                        onChange={(e) => handleInputChange('region', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Region or State"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Address/Location
                      </label>
                      <textarea
                        value={assetData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Asset location or address"
                      />
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Step 3: Financial Details */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {assetData.type === 'TRADE_RECEIVABLE' ? 'Invoice Financial Details' : 'Financial Details'}
              </h2>
              
              {/* Trade Receivable: Amount and Due Date */}
              {assetData.type === 'TRADE_RECEIVABLE' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Invoice Amount (USDC) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={assetData.totalValue || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('totalValue', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Invoice amount in USDC"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Due Date *
                      </label>
                      <input
                        type="date"
                        value={assetData.maturityDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => handleInputChange('maturityDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Payment due date for the invoice
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Total Asset Value (USD) *
                    </label>
                  <input
                      type="number"
                    value={assetData.totalValue || ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      handleInputChange('totalValue', isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Asset value in USD"
                  />
                  </div>

                    <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Expected APY (%) *
                      </label>
                  <input
                        type="number"
                    step="0.1"
                    value={assetData.expectedAPY || ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      handleInputChange('expectedAPY', isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Expected annual return"
                      />
                    </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-off-white mb-2">
                        Maturity Date *
                      </label>
                  <input
                        type="date"
                    value={assetData.maturityDate}
                        min={(() => {
                          const minDate = new Date();
                          minDate.setFullYear(minDate.getFullYear() + 1);
                          return minDate.toISOString().split('T')[0];
                        })()}
                        onChange={(e) => handleInputChange('maturityDate', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        When the tokenization period ends. Investors will receive returns until this date. 
                        <span className="text-yellow-400 font-semibold"> Minimum: 1 year from today.</span>
                        Typically 1-5 years from now, depending on asset type.
                      </p>
                      {assetData.maturityDate && (() => {
                        const today = new Date();
                        const oneYearFromNow = new Date(today);
                        oneYearFromNow.setFullYear(today.getFullYear() + 1);
                        const maturityDate = new Date(assetData.maturityDate);
                        const isValid = maturityDate >= oneYearFromNow;
                        if (!isValid) {
                          return (
                            <p className="text-xs text-red-400 mt-1">
                              ⚠️ Maturity date must be at least 1 year from today. Minimum date: {oneYearFromNow.toLocaleDateString()}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                
                <div>
                  <label className="block text-sm font-medium text-off-white mb-2">
                    Asset Condition
                  </label>
                  <select
                    value={assetData.condition}
                    onChange={(e) => handleInputChange('condition', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  >
                    <option value="">Select condition</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                    </div>
                  </div>

              {/* Maximum Investable Percentage */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-off-white mb-2">
                  Maximum Investable Percentage *
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={assetData.maxInvestablePercentage || 100}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 100 : parseFloat(e.target.value);
                      handleInputChange('maxInvestablePercentage', isNaN(val) ? 100 : Math.min(100, Math.max(0, val)));
                    }}
                    className="flex-1 px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                    placeholder="100"
                  />
                  <span className="text-off-white">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Maximum percentage of this asset that can be tokenized for investment. 
                  You will retain ownership of the remaining percentage. Default: 100%
                </p>
                
                {/* Preview Calculation */}
                {assetData.totalValue > 0 && (
                  <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Preview:</p>
                    <div className="text-sm text-off-white space-y-1">
                      <p>Total Asset Value: <span className="font-semibold">${assetData.totalValue.toLocaleString()}</span></p>
                      <p>Maximum Tokenizable: <span className="font-semibold text-primary-blue">
                        ${(assetData.totalValue * (assetData.maxInvestablePercentage || 100) / 100).toLocaleString()} 
                        ({assetData.maxInvestablePercentage || 100}%)
                      </span></p>
                      <p>Owner Retains: <span className="font-semibold text-green-400">
                        ${(assetData.totalValue * (100 - (assetData.maxInvestablePercentage || 100)) / 100).toLocaleString()} 
                        ({100 - (assetData.maxInvestablePercentage || 100)}%)
                      </span></p>
                    </div>
                  </div>
                )}
              </div>
                </>
              )}
            </motion.div>
          )}

          {/* Step 4: Documents */}
          {currentStep === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-semibold text-off-white mb-4">
                Required Documents & Images
              </h2>
              
              {/* Display Image */}
              <div>
                <label className="block text-sm font-medium text-off-white mb-2">
                  Display Image * (Main image for the asset)
                </label>
                <input
                  ref={displayImageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif"
                  onChange={(e) => handleDisplayImageChange(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
                <p className="text-sm text-primary-blue-light mt-1">
                  Upload the main image that will represent your asset
                </p>
                {assetData.displayImage && (
                  <p className="text-sm text-primary-blue mt-1">
                    ✅ Selected: {assetData.displayImage.name}
                  </p>
                )}
                    </div>
                    
              {/* Document Categories */}
              <div>
                <label className="block text-sm font-medium text-off-white mb-2">
                  Select Document Category * (Choose one category for your files)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {documentCategories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <div
                        key={category.value}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          assetData.selectedCategory === category.value
                            ? 'border-primary-blue bg-primary-blue/10'
                            : 'border-gray-600 hover:border-primary-blue-light'
                        }`}
                        onClick={() => {
                          handleInputChange('selectedCategory', category.value);
                        }}
                      >
                        <div className="text-center">
                          <Icon className="w-8 h-8 mx-auto mb-2 text-primary-blue" />
                          <div className="font-medium text-off-white text-sm mb-1 flex items-center justify-center">
                            {category.label}
                            {category.required && (
                              <span className="text-red-400 ml-1">*</span>
                            )}
                      </div>
                          <div className="text-xs text-primary-blue-light">
                            {category.description}
                    </div>
                          {category.required && (
                            <div className="text-xs text-red-400 mt-1 font-medium">
                              Required
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <p className="text-sm text-primary-blue-light">
                    Selected: {assetData.selectedCategory ? documentCategories.find(cat => cat.value === assetData.selectedCategory)?.label : 'None'}
                  </p>
                    </div>
                  </div>
                  
              {/* File Upload - Only show after category is selected */}
              {assetData.selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-off-white mb-2">
                    Upload Evidence Files * (Upload files for selected category)
                  </label>
                  <input
                    ref={evidenceFilesInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => handleFileUpload(Array.from(e.target.files || []))}
                    className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-off-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-primary-blue-light">
                      Upload files for: <strong>{documentCategories.find(cat => cat.value === assetData.selectedCategory)?.label}</strong>
                    </p>
                    <div className="text-sm font-medium text-primary-blue">
                      {assetData.evidenceFiles.length} files
                    </div>
                  </div>
                  {assetData.evidenceFiles.length === 0 && (
                    <p className="text-sm text-red-400 mt-1">
                      ⚠️ Please upload at least one file
                    </p>
                  )}
                </div>
              )}

              {/* Uploaded Files List - Only show after category is selected */}
              {assetData.selectedCategory && assetData.evidenceFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-off-white mb-2">Uploaded Files:</h4>
                  <div className="space-y-2">
                    {assetData.evidenceFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-600">
                        <span className="text-sm text-off-white">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                  </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
              )}

          {/* Step 5: AI Analysis */}
          {currentStep === 5 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <Brain className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  AI-Powered Asset Analysis
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Get instant validation, pricing, and risk assessment for your real-world asset
                </p>
              </div>

              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center max-w-4xl mx-auto">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  AI Analysis feature is temporarily unavailable. Skipping to submit your asset.
                </p>
                <Button
                  onClick={() => {
                    setAiAnalysisResult({ validation: { status: 'skipped' } });
                    setCurrentStep(6);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Continue to Review
                </Button>
              </div>

              <div className="flex justify-center space-x-4 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(4)}
                >
                  Back to Documents
                </Button>
                <Button
                  onClick={() => setCurrentStep(6)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Skip Analysis & Continue
                </Button>
              </div>
            </motion.div>
          )}

              {/* Step 6: Review & Submit */}
              {currentStep === 6 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Review & Submit
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Basic Information</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <p><strong>Name:</strong> {assetData.name}</p>
                      <p><strong>Type:</strong> {assetData.type}</p>
                      <p><strong>Description:</strong> {assetData.description}</p>
                        </div>
                    </div>
                    
                  {assetData.type === 'TRADE_RECEIVABLE' ? (
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2">Invoice Details</h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p><strong>Importer Address:</strong> {assetData.importerAddress}</p>
                        <p><strong>Invoice Number:</strong> {assetData.invoiceNumber || 'Not provided'}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2">Location</h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p><strong>Country:</strong> {assetData.country}</p>
                        <p><strong>Region:</strong> {assetData.region}</p>
                        <p><strong>Address:</strong> {assetData.address}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                      {assetData.type === 'TRADE_RECEIVABLE' ? 'Invoice Financial Details' : 'Financial Details'}
                    </h3>
                    <div className="text-sm text-primary-blue-light space-y-1">
                      <p><strong>{assetData.type === 'TRADE_RECEIVABLE' ? 'Amount' : 'Value'}:</strong> ${assetData.totalValue.toLocaleString()}</p>
                      {assetData.type !== 'TRADE_RECEIVABLE' && (
                        <>
                          <p><strong>APY:</strong> {assetData.expectedAPY}%</p>
                          <p><strong>Condition:</strong> {assetData.condition || 'Not specified'}</p>
                        </>
                      )}
                      <p><strong>{assetData.type === 'TRADE_RECEIVABLE' ? 'Due Date' : 'Maturity'}:</strong> {assetData.maturityDate}</p>
                        </div>
                    </div>
                    
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Documents</h3>
                    <div className="text-sm text-primary-blue-light space-y-1">
                      <p><strong>Display Image:</strong> {assetData.displayImage ? 'Uploaded' : 'Not uploaded'}</p>
                      <p><strong>Evidence Files:</strong> {assetData.evidenceFiles.length}</p>
                      <p><strong>Document Category:</strong> {documentCategories.find(cat => cat.value === assetData.selectedCategory)?.label || 'None'}</p>
                    </div>
                  </div>

                  {/* AI Analysis Results */}
                  {aiAnalysisResult && (
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                        <Brain className="w-4 h-4 mr-2 text-blue-500" />
                        AI Analysis Results
                      </h3>
                      <div className="text-sm text-primary-blue-light space-y-1">
                        <p><strong>Validation:</strong> 
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            aiAnalysisResult.validation?.status === 'valid' ? 'bg-primary-blue text-primary-blue' :
                            aiAnalysisResult.validation?.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {aiAnalysisResult.validation?.status?.toUpperCase() || 'N/A'}
                          </span>
                        </p>
                        {aiAnalysisResult.marketValue && (
                          <p><strong>Suggested Value:</strong> ${aiAnalysisResult.marketValue.suggested?.toLocaleString() || 'N/A'}</p>
                        )}
                        {aiAnalysisResult.riskAssessment && (
                          <p><strong>Risk Level:</strong> {aiAnalysisResult.riskAssessment.level?.toUpperCase() || 'N/A'}</p>
                        )}
                        {aiAnalysisResult.compliance && (
                          <p><strong>Compliance:</strong> 
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${
                              aiAnalysisResult.compliance.status === 'compliant' ? 'bg-primary-blue text-primary-blue' : 'bg-red-100 text-red-800'
                            }`}>
                              {aiAnalysisResult.compliance.status?.toUpperCase() || 'N/A'}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Progress Indicator */}
              {(uploadProgress.displayImage || uploadProgress.evidenceFiles || uploadProgress.metadata) && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center mb-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    <p className="text-blue-700 dark:text-blue-300 font-medium">Uploading to IPFS...</p>
                  </div>
                  
                  {uploadProgress.displayImage && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      📸 Uploading display image: {uploadProgress.currentFile}
                    </div>
                  )}
                  
                  {uploadProgress.evidenceFiles && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      📄 Uploading evidence files: {uploadProgress.currentFile} 
                      ({uploadProgress.currentFileIndex}/{uploadProgress.totalFiles})
                    </div>
                  )}
                  
                  {uploadProgress.metadata && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      📋 Uploading metadata: {uploadProgress.currentFile}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                    <p className="text-red-700 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}
            </motion.div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="border-gray-600 text-off-white hover:bg-gray-700"
                >
                  Previous
                </Button>

                {currentStep < 6 ? (
                  <Button
                    onClick={nextStep}
                    disabled={!isStepValid(currentStep)}
                    className="bg-primary-blue text-black hover:bg-primary-blue-light"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-primary-blue text-black hover:bg-primary-blue-light"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                        {uploadProgress.displayImage || uploadProgress.evidenceFiles || uploadProgress.metadata 
                          ? 'Uploading to IPFS...' 
                          : 'Creating NFT...'}
                      </div>
                    ) : 'Submit Asset'}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateRWAAsset;