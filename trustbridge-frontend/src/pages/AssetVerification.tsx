import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FileUpload from '../components/UI/FileUpload';
import FilePreview from '../components/UI/FilePreview';
import Breadcrumb from '../components/UI/Breadcrumb';
import StepNavigation from '../components/UI/StepNavigation';
import { 
  Upload, 
  MapPin, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Building2,
  TreePine,
  Factory,
  Home,
  Loader2,
  Shield,
  TrendingUp,
  Trash2,
  Eye,
  Package,
  Palette,
  Car
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { ipfsService, IPFSUploadResult, IPFSFileMetadata } from '../services/ipfs';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { hederaTokenService } from '../services/hederaTokenService';
import { contractService, AssetCategory, VerificationLevel, AssetData } from '../services/contractService';
import { verificationService } from '../services/verificationService';
import AutoFill from '../components/UI/AutoFill';

// TypeScript declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

interface AssetDocument {
  id: string;
  file: File;
  type: 'ownership' | 'survey' | 'valuation' | 'insurance' | 'other';
  description: string;
  cid?: string;
  ipfsUrl?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface AssetPhoto {
  id: string;
  file: File;
  description: string;
  location?: { lat: number; lng: number };
  cid?: string;
  ipfsUrl?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

const AssetVerification: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected, address, walletType } = useWallet();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenizing, setIsTokenizing] = useState(false);
  const [isRequestingVerification, setIsRequestingVerification] = useState(false);
  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [photos, setPhotos] = useState<AssetPhoto[]>([]);

  // Check wallet connection on mount
  React.useEffect(() => {
  }, [isConnected, address, walletType]);

  // Handle URL parameters for pre-filling asset data
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const assetParam = urlParams.get('asset');
    
    if (assetParam) {
      try {
        const assetData = JSON.parse(decodeURIComponent(assetParam));
        console.log('Pre-filling form with asset data:', assetData);
        
        setFormData(prev => ({
          ...prev,
          assetName: assetData.name || prev.assetName,
          assetType: assetData.assetType || prev.assetType,
          location: {
            ...prev.location,
            address: assetData.location || prev.location.address
          },
          valuation: {
            ...prev.valuation,
            estimatedValue: assetData.value ? assetData.value.toString() : prev.valuation.estimatedValue
          }
        }));
        
        // If we have an assetId, we're in verification mode for an existing asset
        if (assetData.assetId) {
          console.log('Verification mode for existing asset:', assetData.assetId);
          setIsVerificationMode(true);
          // Skip document upload step and go directly to review
          setCurrentStep(3);
        }
      } catch (error) {
        console.error('Error parsing asset data from URL:', error);
      }
    }
  }, []);

  const [tokenizationResult, setTokenizationResult] = useState<{
    tokenId?: string;
    transactionId?: string;
    success: boolean;
    verificationTier?: string;
    processingTime?: number;
  } | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    cid: string;
    fileName: string;
    fileType: string;
    fileSize?: number;
  } | null>(null);
  
  // Upload progress states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const [formData, setFormData] = useState({
    assetType: '',
    assetName: '',
    description: '',
    category: AssetCategory.VEHICLES, // Default to VEHICLES
    verificationLevel: VerificationLevel.BASIC, // Default to BASIC
    location: {
      address: '',
      city: '',
      state: '',
      country: 'Nigeria',
      coordinates: { lat: 0, lng: 0 }
    },
    valuation: {
      estimatedValue: '',
      currency: 'NGN',
      valuationDate: '',
      valuator: '',
      maxInvestablePercentage: '100' // Default: 100% of asset can be tokenized
    },
    ownership: {
      ownerName: '',
      ownershipType: 'individual',
      ownershipPercentage: '100',
      legalEntity: ''
    },
    specifications: {
      size: '',
      unit: 'sqm',
      condition: 'excellent',
      yearBuilt: '',
      features: [],
      // Vehicle specific
      mileage: '',
      engineType: '',
      // Real estate specific
      propertyType: '',
      // Farmland specific
      soilType: '',
      waterSource: '',
      currentUse: '',
      // Art specific
      artist: '',
      yearCreated: '',
      medium: '',
      dimensions: '',
      // Business asset specific
      businessAssetType: '',
      purchaseDate: '',
      serialNumber: ''
    }
  });

  const assetTypes = [
    { value: 'farm_produce', label: 'Farm Produce', icon: TreePine, description: 'Agricultural products and commodities', category: AssetCategory.FARM_PRODUCE },
    { value: 'farmland', label: 'Farmland', icon: TreePine, description: 'Agricultural land and farming facilities', category: AssetCategory.FARMLAND },
    { value: 'real_estate', label: 'Real Estate', icon: Building2, description: 'Residential, commercial, or industrial properties', category: AssetCategory.REAL_ESTATE },
    { value: 'vehicles', label: 'Vehicles', icon: Car, description: 'Cars, trucks, motorcycles, and other vehicles', category: AssetCategory.VEHICLES },
    { value: 'art_collectibles', label: 'Art & Collectibles', icon: Palette, description: 'Artwork, antiques, and collectible items', category: AssetCategory.ART_COLLECTIBLES },
    { value: 'commodities', label: 'Commodities', icon: Package, description: 'Raw materials and commodity goods', category: AssetCategory.COMMODITIES },
    { value: 'business_assets', label: 'Business Assets', icon: Factory, description: 'Business equipment and intellectual property', category: AssetCategory.BUSINESS_ASSETS },
    { value: 'intellectual_property', label: 'Intellectual Property', icon: FileText, description: 'Patents, trademarks, and copyrights', category: AssetCategory.INTELLECTUAL_PROPERTY }
  ];

  const verificationLevels = [
    { value: VerificationLevel.BASIC, label: 'Basic', description: '1 attestor, 1% fee', fee: '1%' },
    { value: VerificationLevel.STANDARD, label: 'Standard', description: '2 attestors, 2% fee', fee: '2%' },
    { value: VerificationLevel.PREMIUM, label: 'Premium', description: '3 attestors, 3% fee', fee: '3%' },
    { value: VerificationLevel.ENTERPRISE, label: 'Enterprise', description: '5+ attestors, 5% fee', fee: '5%' }
  ];

  const documentTypes = [
    { value: 'ownership', label: 'Ownership Document', description: 'Title deed, certificate of occupancy, or ownership certificate' },
    { value: 'survey', label: 'Survey Plan', description: 'Official survey plan or land survey document' },
    { value: 'valuation', label: 'Valuation Report', description: 'Professional property valuation report' },
    { value: 'insurance', label: 'Insurance Policy', description: 'Property insurance policy document' },
    { value: 'other', label: 'Other Document', description: 'Any other relevant legal or technical document' }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (parent: keyof typeof formData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value
      }
    }));
  };

  // Auto-fill handler removed - no mock data support
  const handleAutoFill = (data: any) => {
    // Mock data removed - this function is disabled
    console.warn('Auto-fill disabled - mock data removed');
    return;
    setFormData({
      assetType: data?.assetType || '',
      assetName: data?.assetName || '',
      description: data.description,
      category: AssetCategory.VEHICLES, // Default category
      verificationLevel: VerificationLevel.BASIC, // Default level
      location: data.location,
      valuation: data.valuation,
      ownership: {
        ...data.ownership,
        legalEntity: data.ownership.ownershipType === 'corporate' ? data.ownership.ownerName : ''
      },
      specifications: {
        size: data.assetType === 'real_estate' ? '2000' : '50',
        unit: data.assetType === 'real_estate' ? 'sqm' : 'hectares',
        condition: 'excellent',
        yearBuilt: '2020',
        features: [],
        // Vehicle specific
        mileage: '',
        engineType: '',
        // Real estate specific
        propertyType: '',
        // Farmland specific
        soilType: '',
        waterSource: '',
        currentUse: '',
        // Art specific
        artist: '',
        yearCreated: '',
        medium: '',
        dimensions: '',
        // Business asset specific
        businessAssetType: '',
        purchaseDate: '',
        serialNumber: ''
      }
    });


    // Clear existing documents and photos - user will upload real files
    setDocuments([]);
    setPhotos([]);

    toast({
      title: 'Auto-fill Complete!',
      description: `Form filled with ${data.assetName} test data. Please upload your actual documents and photos.`,
        variant: 'success'
    });
  };


  const handleDocumentUpload = async (file: File, metadata: IPFSFileMetadata): Promise<IPFSUploadResult> => {
    return await ipfsService.uploadFile(file, {
      ...metadata,
      category: 'verification_document'
    });
  };

  const handlePhotoUpload = async (file: File, metadata: IPFSFileMetadata): Promise<IPFSUploadResult> => {
    return await ipfsService.uploadFile(file, {
      ...metadata,
      category: 'verification_photo'
    });
  };

  const uploadDocument = async (document: AssetDocument) => {
    try {
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id 
          ? { ...doc, status: 'uploading' as const }
          : doc
      ));

      const metadata: IPFSFileMetadata = {
        name: document.file.name,
        type: document.file.type,
        size: document.file.size,
        description: document.description,
        category: 'verification_document',
        tags: [document.type, 'asset_verification']
      };

      const result = await handleDocumentUpload(document.file, metadata);
      
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id 
          ? { 
              ...doc, 
              status: 'completed' as const,
              cid: result.cid,
              ipfsUrl: result.ipfsUrl
            }
          : doc
      ));

    } catch (error) {
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id 
          ? { 
              ...doc, 
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Upload failed'
            }
          : doc
      ));
      
      // Re-throw the error so uploadAllFiles can catch it
      throw error;
    }
  };

  const uploadPhoto = async (photo: AssetPhoto) => {
    try {
      setPhotos(prev => prev.map(p => 
        p.id === photo.id 
          ? { ...p, status: 'uploading' as const }
          : p
      ));

      const metadata: IPFSFileMetadata = {
        name: photo.file.name,
        type: photo.file.type,
        size: photo.file.size,
        description: photo.description,
        category: 'verification_photo',
        tags: ['asset_photo', 'verification']
      };

      const result = await handlePhotoUpload(photo.file, metadata);
      
      setPhotos(prev => prev.map(p => 
        p.id === photo.id 
          ? { 
              ...p, 
              status: 'completed' as const,
              cid: result.cid,
              ipfsUrl: result.ipfsUrl
            }
          : p
      ));

    } catch (error) {
      setPhotos(prev => prev.map(p => 
        p.id === photo.id 
          ? { 
              ...p, 
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Upload failed'
            }
          : p
      ));
      
      // Re-throw the error so uploadAllFiles can catch it
      throw error;
    }
  };

  const uploadAllFiles = async (): Promise<{ success: boolean; errors: string[] }> => {
    const pendingDocs = documents.filter(doc => doc.status === 'pending');
    const pendingPhotos = photos.filter(photo => photo.status === 'pending');
    const totalFiles = pendingDocs.length + pendingPhotos.length;
    
    if (totalFiles === 0) {
      return { success: true, errors: [] };
    }
    
    const errors: string[] = [];
    let completedFiles = 0;
    
    // Check if user is authenticated
    const token = localStorage.getItem('accessToken');
    if (!token) {
      errors.push('Authentication required. Please log in to upload files.');
      return { success: false, errors };
    }
    
    // Start upload process
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing uploads...');
    
    try {
      // Upload documents
      for (let i = 0; i < pendingDocs.length; i++) {
        const doc = pendingDocs[i];
        setUploadStatus(`Uploading document ${i + 1} of ${pendingDocs.length}: ${doc.file.name}`);
        
        try {
          await uploadDocument(doc);
          completedFiles++;
        } catch (error) {
          const errorMsg = `Document ${doc.file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`;
          errors.push(errorMsg);
          console.error('Document upload error:', errorMsg);
        }
        
        // Update progress
        const progress = Math.round((completedFiles / totalFiles) * 100);
        setUploadProgress(progress);
      }
      
      // Upload photos
      for (let i = 0; i < pendingPhotos.length; i++) {
        const photo = pendingPhotos[i];
        setUploadStatus(`Uploading photo ${i + 1} of ${pendingPhotos.length}: ${photo.file.name}`);
        
        try {
          await uploadPhoto(photo);
          completedFiles++;
        } catch (error) {
          const errorMsg = `Photo ${photo.file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`;
          errors.push(errorMsg);
          console.error('Photo upload error:', errorMsg);
        }
        
        // Update progress
        const progress = Math.round((completedFiles / totalFiles) * 100);
        setUploadProgress(progress);
      }
      
      // Upload complete
      setUploadStatus('Upload complete!');
      setUploadProgress(100);
      
      // Reset upload states after a delay
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
      }, 2000);
      
      return { success: errors.length === 0, errors };
    } catch (error) {
      const errorMsg = `Upload process failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error('Upload process error:', errorMsg);
      
      // Reset upload states on error
      setIsUploading(false);
      setUploadStatus('Upload failed');
      setUploadProgress(0);
      
      return { success: false, errors };
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== id));
  };

  const updateDocument = (id: string, updates: Partial<AssetDocument>) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, ...updates } : doc
    ));
  };

  const updatePhoto = (id: string, updates: Partial<AssetPhoto>) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === id ? { ...photo, ...updates } : photo
    ));
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              coordinates: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
            }
          }));
          toast({
            variant: "success",
            title: "Location Captured",
            description: "GPS coordinates have been automatically captured."
          });
        },
        (error) => {
          console.error('Location capture error:', error);
          toast({
            variant: "destructive",
            title: "Location Error",
            description: "Could not capture location. Please enter manually."
          });
        }
      );
    }
  };

  const handleVerificationRequest = async () => {
    setIsRequestingVerification(true);
    try {
      // Get asset data from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const assetParam = urlParams.get('asset');
      if (!assetParam) {
        throw new Error('Asset data not found in URL parameters');
      }
      
      const assetData = JSON.parse(decodeURIComponent(assetParam));
      if (!assetData.assetId) {
        throw new Error('Asset ID not found in asset data');
      }

      // Upload all files to IPFS first
      const uploadResult = await uploadAllFiles();
      
      if (!uploadResult.success) {
        toast({
          title: 'Upload Failed',
          description: `Some files failed to upload: ${uploadResult.errors.join(', ')}`,
          variant: 'destructive'
        });
        return;
      }

      // Connect verification service
      const connectResult = await verificationService.connect();
      if (!connectResult.success) {
        throw new Error(connectResult.error || 'Failed to connect verification service');
      }

      // Map verification level to attestor type
      const attestorType = 0;
      
      const verificationResult = await verificationService.requestVerification(
        assetData.assetId,
        attestorType,
        documents.map(doc => doc.cid || ''),
        documents.map(doc => doc.type),
        Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days deadline
      );

      if (verificationResult.success) {
        console.log('✅ Verification request submitted:', verificationResult.requestId);
        toast({
          title: "Verification Requested! 🔍",
          description: `Verification request submitted. Request ID: ${verificationResult.requestId}`,
          variant: 'success'
        });
        
        // Redirect to assets page after successful verification request
        setTimeout(() => {
          navigate('/dashboard/assets');
        }, 2000);
      } else {
        console.warn('⚠️ Verification request failed:', verificationResult.error);
        toast({
          title: "Verification Request Failed",
          description: verificationResult.error || 'Failed to submit verification request',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Verification request error:', error);
      toast({
        title: "Verification Request Error",
        description: error instanceof Error ? error.message : 'Failed to submit verification request',
        variant: 'destructive'
      });
    } finally {
      setIsRequestingVerification(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Handle verification mode for existing assets
      if (isVerificationMode) {
        await handleVerificationRequest();
        return;
      }

      // Upload all files to IPFS first
      const uploadResult = await uploadAllFiles();
      
      if (!uploadResult.success) {
        toast({
          title: 'Upload Failed',
          description: `Some files failed to upload: ${uploadResult.errors.join(', ')}`,
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }
      
      // Check if user is authenticated
      if (!user?.walletAddress) {
        toast({
          title: 'Authentication Required',
          description: 'Please connect your wallet to create an asset',
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }

      // Map form asset type to backend enum
      const mapAssetType = (type: string): string => {
        const typeMap: { [key: string]: string } = {
          'real-estate': 'REAL_ESTATE',
          'agricultural': 'AGRICULTURAL',
          'equipment': 'EQUIPMENT',
          'inventory': 'INVENTORY',
          'commodity': 'COMMODITY'
        };
        return typeMap[type.toLowerCase()] || 'REAL_ESTATE';
      };

      // Prepare asset data for Hedera tokenization
      const assetData = {
        owner: user.walletAddress, // Use user's wallet address
        type: mapAssetType(formData.assetType),
        name: formData.assetName,
        description: formData.description,
        location: {
          country: formData.location.country,
          region: formData.location.state,
          coordinates: formData.location.coordinates
        },
        totalValue: parseFloat(formData.valuation.estimatedValue) || 0,
        tokenSupply: Math.floor((parseFloat(formData.valuation.estimatedValue) || 0) / 100), // 1 token per $100
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        expectedAPY: 15.0, // Default APY
        metadata: {
          ownership: formData.ownership,
          valuation: formData.valuation,
          specifications: formData.specifications,
          documents: documents.map(doc => ({
            type: doc.type,
            description: doc.description,
            cid: doc.cid,
            ipfsUrl: doc.ipfsUrl
          })),
          photos: photos.map(photo => ({
            description: photo.description,
            location: photo.location,
            cid: photo.cid,
            ipfsUrl: photo.ipfsUrl
          }))
        }
      };

      // Move to tokenization step
      setCurrentStep(7);
      setIsTokenizing(true);
      const startTime = Date.now();

      // Debug: Log the asset data being sent
      console.log('Asset data being sent:', JSON.stringify(assetData, null, 2));
      
      // Check if wallet is connected
      if (!isConnected || !address) {
        toast({
          title: 'Wallet Required',
          description: 'Please connect your wallet to create tokens on Hedera',
          variant: 'destructive'
        });
        setIsTokenizing(false);
        setIsSubmitting(false);
        return;
      }

      // Show loading message
      toast({
        title: 'Creating Token...',
        description: `Please sign the message in your ${walletType === 'metamask' ? 'MetaMask' : 'wallet'}`,
        variant: 'default'
      });

      // Create asset using smart contract
      let tokenResult;
      
      if (walletType === 'metamask') {
        // For MetaMask, use the new smart contract
        const selectedAssetType = assetTypes.find(type => type.value === formData.assetType);
        // Separate photos and documents for proper asset creation
        const photoHashes = photos.filter(photo => photo.cid).map(photo => photo.cid!);
        const documentHashes = documents.filter(doc => doc.cid).map(doc => doc.cid!);
        const allEvidenceHashes = [...photoHashes, ...documentHashes];
        const allDocumentTypes = [
          ...photos.map(photo => 'photo'),
          ...documents.map(doc => doc.type)
        ];

        const assetData: AssetData = {
          category: selectedAssetType?.category || AssetCategory.VEHICLES,
          assetType: formData.assetType,
          name: formData.assetName,
          location: `${formData.location.address}, ${formData.location.city}, ${formData.location.country}`,
          totalValue: parseFloat(formData.valuation.estimatedValue) || 0,
          maturityDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year from now
          verificationLevel: formData.verificationLevel,
          evidenceHashes: allEvidenceHashes,
          documentTypes: allDocumentTypes,
          imageURI: photos.length > 0 && photos[0].ipfsUrl ? photos[0].ipfsUrl : '',
          maxInvestablePercentage: parseFloat(formData.valuation.maxInvestablePercentage) || 100, // Owner-specified investable percentage
          documentURI: documents.length > 0 && documents[0].ipfsUrl ? documents[0].ipfsUrl : '',
          description: formData.description
        };

        console.log('🚀 Creating asset with smart contract...');
        const assetId = await contractService.tokenizeAsset(assetData);
        
        // Convert string result to object format for compatibility
        tokenResult = {
          success: true,
          tokenId: assetId,
          transactionId: assetId, // Use asset ID as transaction reference
          transactionHash: assetId,
          fullSignature: assetId,
          assetId: assetId
        };
        
        console.log('✅ Asset created successfully with ID:', assetId);
      } else {
        // HashPack disabled - using MetaMask only
        throw new Error('HashPack is disabled. Please use MetaMask.');
      }

      // Check if token creation was successful first
      if (!tokenResult.success) {
        console.error('Token creation failed:', tokenResult.error);
        throw new Error(tokenResult.error || 'Token creation failed');
      }

      // Log the transaction/signature details for verification
      console.log('🎉 Asset Creation Successful!');
      console.log('📝 Transaction/Signature Details:');
      console.log('   Asset ID:', tokenResult.assetId);
      console.log('   Transaction ID:', tokenResult.transactionId);
      console.log('   Token ID:', tokenResult.tokenId);
      console.log('   Wallet Address:', user.walletAddress);
      console.log('   Asset Name:', assetData.name);
      console.log('   Asset Type:', assetData.assetType);
      console.log('   Total Value:', assetData.totalValue);
      
      // Log transaction details
      if (tokenResult.transactionHash || tokenResult.transactionId) {
        console.log('🔗 REAL Hedera transaction created!');
        console.log('🔗 Transaction Hash:', tokenResult.transactionHash || tokenResult.transactionId);
        console.log('🔗 Verify on Hashscan:', `https://hashscan.io/testnet/transaction/${tokenResult.transactionHash || tokenResult.transactionId}`);
        if (tokenResult.tokenId) {
          console.log('🔗 Token ID:', tokenResult.tokenId);
        }
        if (tokenResult.tokenAddress) {
          console.log('🔗 Token Address:', tokenResult.tokenAddress);
        }
        } else {
        console.log('🔗 Transaction completed but no transaction hash available');
      }

      // Create asset in backend using RWA endpoint (includes maxInvestablePercentage)
      // Prepare data for RWA endpoint
      const rwaAssetData = {
        category: assetData.category,
        assetType: assetData.assetType,
        name: assetData.name,
        location: assetData.location,
        totalValue: assetData.totalValue.toString(),
        maturityDate: assetData.maturityDate,
        evidenceHashes: assetData.evidenceHashes,
        documentTypes: assetData.documentTypes,
        imageURI: assetData.imageURI,
        documentURI: assetData.documentURI,
        description: assetData.description,
        owner: user.walletAddress,
        assetId: tokenResult.assetId, // From on-chain creation
        transactionId: tokenResult.transactionHash || tokenResult.transactionId,
        maxInvestablePercentage: assetData.maxInvestablePercentage || 100, // Include owner-specified percentage
      };
      
      console.log('📤 Sending asset to backend with maxInvestablePercentage:', rwaAssetData.maxInvestablePercentage);
      const response = await apiService.createRWAAsset(rwaAssetData);
      
      if (response.success) {
        setTokenizationResult({
          success: true,
          tokenId: tokenResult.tokenId,
          transactionId: tokenResult.transactionHash || tokenResult.transactionId,
          verificationTier: 'Premium', // Default tier for user-created tokens
          processingTime: Date.now() - startTime // Calculate actual processing time
        });
        
                  // Show success message with real transaction details
                  const hasRealTransaction = tokenResult.transactionHash || tokenResult.transactionId;
                  const transactionHash = tokenResult.transactionHash || tokenResult.transactionId;
                  toast({
                    title: "Asset Created & Tokenized! 🎉",
                    description: hasRealTransaction 
                      ? `Smart Contract Asset ID: ${tokenResult.assetId}\nBackend Asset ID: ${response.data.assetId}\nTransaction: ${transactionHash}\nVerify on Hashscan: https://hashscan.io/testnet/transaction/${transactionHash}`
                      : `Smart Contract Asset ID: ${tokenResult.assetId}\nBackend Asset ID: ${response.data.assetId}\nCheck console for details`,
                    variant: 'success'
                  });

                  // Request verification if using smart contract
                  if (walletType === 'metamask' && response.data.assetId) {
                    try {
                      console.log('🔍 Requesting verification for asset...');
                      setIsRequestingVerification(true);
                      
                      // Show loading toast
                      toast({
                        title: "Requesting Verification... 🔍",
                        description: "Submitting verification request to smart contract",
                        variant: 'default'
                      });
                      
                      // Connect verification service first
                      const connectResult = await verificationService.connect();
                      if (!connectResult.success) {
                        throw new Error(connectResult.error || 'Failed to connect verification service');
                      }
                      
                      // Map verification level to attestor type
                      // In a real system, this would be more sophisticated
                      const attestorType = 0; // LEGAL_EXPERT
                      
                      // Use the smart contract asset ID for verification, not the backend API asset ID
                      const smartContractAssetId = tokenResult.assetId || tokenResult.tokenId;
                      console.log('Using smart contract asset ID for verification:', smartContractAssetId);
                      
                      const verificationResult = await verificationService.requestVerification(
                        smartContractAssetId,
                        attestorType, // Use attestor type instead of verification level
                        documents.map(doc => doc.cid || ''),
                        documents.map(doc => doc.type),
                        Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days deadline
                      );

                      if (verificationResult.success) {
                        console.log('✅ Verification request submitted:', verificationResult.requestId);
                        toast({
                          title: "Verification Requested! 🔍",
                          description: `Verification request submitted. Request ID: ${verificationResult.requestId}`,
                          variant: 'success'
                        });
                        
                        // Redirect to assets page after successful verification request
                        setTimeout(() => {
                          navigate('/dashboard/assets');
                        }, 2000);
                      } else {
                        console.warn('⚠️ Verification request failed:', verificationResult.error);
                        toast({
                          title: "Verification Request Failed",
                          description: verificationResult.error || 'Failed to submit verification request',
                          variant: 'destructive'
                        });
                      }
                    } catch (error) {
                      console.error('Verification request error:', error);
                      toast({
                        title: "Verification Request Error",
                        description: error instanceof Error ? error.message : 'Failed to submit verification request',
                        variant: 'destructive'
                      });
                    } finally {
                      setIsRequestingVerification(false);
                    }
                  }
        
        // Reset form
        setFormData({
          assetType: '',
          assetName: '',
          description: '',
          category: AssetCategory.VEHICLES,
          verificationLevel: VerificationLevel.BASIC,
          location: {
            address: '',
            city: '',
            state: '',
            country: 'Nigeria',
            coordinates: { lat: 0, lng: 0 }
          },
          valuation: {
            estimatedValue: '',
            currency: 'NGN',
            valuationDate: '',
            valuator: ''
          },
          ownership: {
            ownerName: '',
            ownershipType: 'individual',
            ownershipPercentage: '100',
            legalEntity: ''
          },
          specifications: {
            size: '',
            unit: 'sqm',
            condition: 'excellent',
            yearBuilt: '',
            features: [],
            // Vehicle specific
            mileage: '',
            engineType: '',
            // Real estate specific
            propertyType: '',
            // Farmland specific
            soilType: '',
            waterSource: '',
            currentUse: '',
            // Art specific
            artist: '',
            yearCreated: '',
            medium: '',
            dimensions: '',
            // Business asset specific
            businessAssetType: '',
            purchaseDate: '',
            serialNumber: ''
          }
        });
        setDocuments([]);
        setPhotos([]);
        setCurrentStep(1);
      } else {
        throw new Error(response.message || 'Failed to create asset');
      }
    } catch (error: any) {
      console.error('Asset creation error:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      setTokenizationResult({
        success: false,
        tokenId: undefined,
        transactionId: undefined
      });
      
      toast({
        title: "Tokenization Failed",
        description: error?.message || "There was an error creating your asset on Hedera network. Please try again.",
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
      setIsTokenizing(false);
    }
  };

  // Check if we're in verification mode (existing asset)
  const isVerificationMode = React.useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const assetParam = urlParams.get('asset');
    if (assetParam) {
      try {
        const assetData = JSON.parse(decodeURIComponent(assetParam));
        return !!assetData.assetId;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const steps = isVerificationMode ? [
    { number: 1, title: 'Verification Level', description: 'Select verification level for existing asset' },
    { number: 2, title: 'Review & Submit', description: 'Review information and submit for verification' }
  ] : [
    { number: 1, title: 'Asset Type & Verification', description: 'Select asset type and verification level' },
    { number: 2, title: 'Basic Information', description: 'Provide asset details and location' },
    { number: 3, title: 'Ownership & Valuation', description: 'Ownership details and valuation information' },
    { number: 4, title: 'Documents & Photos', description: 'Upload supporting documents and photos' },
    { number: 5, title: 'Review & Submit', description: 'Review all information and submit for verification' },
    { number: 6, title: 'Tokenization', description: 'Create blockchain token for your asset' },
    { number: 7, title: 'Tokenization Complete', description: 'Asset successfully tokenized on Mantle network' }
  ];

  // Render asset-specific fields based on selected asset type
  const renderAssetSpecificFields = () => {
    const selectedType = assetTypes.find(type => type.value === formData.assetType);
    if (!selectedType) return null;

    switch (selectedType.category) {
      case AssetCategory.VEHICLES:
        return (
            <div>
            <h3 className="text-lg font-semibold text-off-white mb-4">Vehicle Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Year of Manufacture *
                </label>
                <Input
                  type="number"
                  value={formData.specifications.yearBuilt}
                  onChange={(e) => handleNestedInputChange('specifications', 'yearBuilt', e.target.value)}
                  placeholder="e.g., 2023"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Mileage/Kilometers
                </label>
                <Input
                  type="number"
                  value={formData.specifications.mileage || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'mileage', e.target.value)}
                  placeholder="e.g., 50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Engine Type
                </label>
                <select
                  value={formData.specifications.engineType || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'engineType', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                >
                  <option value="">Select engine type</option>
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Condition *
                </label>
                <select
                  value={formData.specifications.condition}
                  onChange={(e) => handleNestedInputChange('specifications', 'condition', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                  required
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>
          </div>
        );

      case AssetCategory.REAL_ESTATE:
                  return (
          <div>
            <h3 className="text-lg font-semibold text-off-white mb-4">Property Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Property Size *
                </label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    value={formData.specifications.size}
                    onChange={(e) => handleNestedInputChange('specifications', 'size', e.target.value)}
                    placeholder="Enter size"
                    className="flex-1"
                    required
                  />
                  <select
                    value={formData.specifications.unit}
                    onChange={(e) => handleNestedInputChange('specifications', 'unit', e.target.value)}
                    className="px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                  >
                    <option value="sqm">Sq M</option>
                    <option value="acres">Acres</option>
                    <option value="hectares">Hectares</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Year Built
                </label>
                <Input
                  type="number"
                  value={formData.specifications.yearBuilt}
                  onChange={(e) => handleNestedInputChange('specifications', 'yearBuilt', e.target.value)}
                  placeholder="e.g., 2020"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Property Type
                </label>
                <select
                  value={formData.specifications.propertyType || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'propertyType', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                >
                  <option value="">Select property type</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="land">Land</option>
                </select>
              </div>
                            <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Condition *
                </label>
                <select
                  value={formData.specifications.condition}
                  onChange={(e) => handleNestedInputChange('specifications', 'condition', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                  required
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="needs_renovation">Needs Renovation</option>
                </select>
                            </div>
                          </div>
          </div>
        );

      case AssetCategory.FARMLAND:
        return (
          <div>
            <h3 className="text-lg font-semibold text-off-white mb-4">Farmland Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Land Size *
                </label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    value={formData.specifications.size}
                    onChange={(e) => handleNestedInputChange('specifications', 'size', e.target.value)}
                    placeholder="Enter size"
                    className="flex-1"
                    required
                  />
                  <select
                    value={formData.specifications.unit}
                    onChange={(e) => handleNestedInputChange('specifications', 'unit', e.target.value)}
                    className="px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                  >
                    <option value="hectares">Hectares</option>
                    <option value="acres">Acres</option>
                    <option value="sqm">Sq M</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Soil Type
                </label>
                <select
                  value={formData.specifications.soilType || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'soilType', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                >
                  <option value="">Select soil type</option>
                  <option value="clay">Clay</option>
                  <option value="sandy">Sandy</option>
                  <option value="loamy">Loamy</option>
                  <option value="rocky">Rocky</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Water Source
                </label>
                <select
                  value={formData.specifications.waterSource || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'waterSource', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                >
                  <option value="">Select water source</option>
                  <option value="irrigation">Irrigation</option>
                  <option value="rainfed">Rainfed</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Current Use
                </label>
                <Input
                  value={formData.specifications.currentUse || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'currentUse', e.target.value)}
                  placeholder="e.g., Maize farming, Livestock grazing"
                />
              </div>
            </div>
          </div>
        );

      case AssetCategory.ART_COLLECTIBLES:
        return (
            <div>
            <h3 className="text-lg font-semibold text-off-white mb-4">Art & Collectibles Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Artist/Creator
                  </label>
                  <Input
                  value={formData.specifications.artist || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'artist', e.target.value)}
                  placeholder="Name of artist or creator"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Year Created
                </label>
                <Input
                  type="number"
                  value={formData.specifications.yearCreated || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'yearCreated', e.target.value)}
                  placeholder="e.g., 2020"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Medium
                </label>
                <Input
                  value={formData.specifications.medium || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'medium', e.target.value)}
                  placeholder="e.g., Oil on canvas, Bronze, Digital"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Dimensions
                </label>
                <Input
                  value={formData.specifications.dimensions || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'dimensions', e.target.value)}
                  placeholder="e.g., 24x36 inches"
                />
              </div>
            </div>
          </div>
        );

      case AssetCategory.BUSINESS_ASSETS:
        return (
          <div>
            <h3 className="text-lg font-semibold text-off-white mb-4">Business Asset Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Asset Type
                </label>
                <select
                  value={formData.specifications.businessAssetType || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'businessAssetType', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                >
                  <option value="">Select asset type</option>
                  <option value="equipment">Equipment</option>
                  <option value="intellectual_property">Intellectual Property</option>
                  <option value="inventory">Inventory</option>
                  <option value="furniture">Furniture</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Condition *
                </label>
                <select
                  value={formData.specifications.condition}
                  onChange={(e) => handleNestedInputChange('specifications', 'condition', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                    required
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Purchase Date
                </label>
                <Input
                  type="date"
                  value={formData.specifications.purchaseDate || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'purchaseDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Serial Number
                </label>
                <Input
                  value={formData.specifications.serialNumber || ''}
                  onChange={(e) => handleNestedInputChange('specifications', 'serialNumber', e.target.value)}
                  placeholder="Asset serial number"
                />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div>
            <h3 className="text-lg font-semibold text-off-white mb-4">Asset Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Size/Quantity *
                  </label>
                  <div className="flex space-x-2">
                    <Input
                    type="number"
                      value={formData.specifications.size}
                      onChange={(e) => handleNestedInputChange('specifications', 'size', e.target.value)}
                    placeholder="Enter size or quantity"
                      className="flex-1"
                    required
                    />
                    <select
                      value={formData.specifications.unit}
                      onChange={(e) => handleNestedInputChange('specifications', 'unit', e.target.value)}
                      className="px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                    >
                    <option value="units">Units</option>
                    <option value="kg">Kilograms</option>
                    <option value="tons">Tons</option>
                    <option value="liters">Liters</option>
                    </select>
                  </div>
                </div>
              <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Condition *
                </label>
                <select
                  value={formData.specifications.condition}
                  onChange={(e) => handleNestedInputChange('specifications', 'condition', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                  required
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>
          </div>
        );
    }
  };

  // Render documents and photos upload step (Step 2)
  const renderDocumentsAndPhotosStep = () => {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-off-white mb-2">Upload Documents & Photos</h2>
          <p className="text-off-white/70">
            Upload supporting documents and photos for your asset verification.
          </p>
        </div>

        {/* Document Upload Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-off-white mb-4">Documents</h3>
          <FileUpload
            onUpload={(uploadedFiles) => {
              const newDocs = uploadedFiles.map(uf => ({
                id: Math.random().toString(36).substr(2, 9),
                file: uf.file,
                type: uf.metadata?.type || 'other',
                description: uf.metadata?.description || '',
                status: 'pending' as const,
                cid: null
              }));
              setDocuments(prev => [...prev, ...newDocs]);
            }}
            acceptedTypes={[
              'application/pdf',
              'image/*',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]}
            maxFiles={10}
            maxSize={10 * 1024 * 1024} // 10MB
          />

          {/* Document List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc) => (
                <FilePreview
                  key={doc.id}
                  file={{
                    name: doc.file.name,
                    size: doc.file.size,
                    type: doc.file.type,
                    url: doc.cid ? `https://gateway.pinata.cloud/ipfs/${doc.cid}` : undefined
                  }}
                  onRemove={() => removeDocument(doc.id)}
                  status={doc.status}
                />
              ))}
            </div>
          )}
        </div>

        {/* Photo Upload Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-off-white mb-4">Photos</h3>
          <FileUpload
            onUpload={(uploadedFiles) => {
              const newPhotos = uploadedFiles.map(uf => ({
                id: Math.random().toString(36).substr(2, 9),
                file: uf.file,
                description: uf.metadata?.description || '',
                status: 'pending' as const,
                cid: null
              }));
              setPhotos(prev => [...prev, ...newPhotos]);
            }}
            acceptedTypes={[
              'image/*'
            ]}
            maxFiles={20}
            maxSize={5 * 1024 * 1024} // 5MB
          />

          {/* Photo List */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <FilePreview
                    file={{
                      name: photo.file.name,
                      size: photo.file.size,
                      type: photo.file.type,
                      url: photo.cid ? `https://gateway.pinata.cloud/ipfs/${photo.cid}` : undefined
                    }}
                    onRemove={() => removePhoto(photo.id)}
                    status={photo.status}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render review step (Step 3)
  const renderReviewStep = () => {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-off-white mb-2">Review & Submit</h2>
          <p className="text-off-white/70">
            Review your asset information and submit for verification.
          </p>
        </div>

        {/* Asset Information Summary */}
        <div className="bg-dark-gray rounded-lg p-6 border border-medium-gray">
          <h3 className="text-lg font-semibold text-off-white mb-4">Asset Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-off-white/70">Name:</span>
              <span className="text-off-white ml-2">{formData.assetName}</span>
            </div>
            <div>
              <span className="text-off-white/70">Type:</span>
              <span className="text-off-white ml-2">{formData.assetType}</span>
            </div>
            <div>
              <span className="text-off-white/70">Location:</span>
              <span className="text-off-white ml-2">{formData.location.address}</span>
            </div>
            <div>
              <span className="text-off-white/70">Value:</span>
              <span className="text-off-white ml-2">{formData.valuation.estimatedValue} {formData.valuation.currency}</span>
            </div>
          </div>
        </div>

        {/* Files Summary */}
        <div className="bg-dark-gray rounded-lg p-6 border border-medium-gray">
          <h3 className="text-lg font-semibold text-off-white mb-4">Asset Documentation</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-primary-blue mr-2" />
              <span className="text-off-white/70">Documents:</span>
              <span className="text-off-white ml-2">Already uploaded during asset creation</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-primary-blue mr-2" />
              <span className="text-off-white/70">Photos:</span>
              <span className="text-off-white ml-2">Already uploaded during asset creation</span>
            </div>
            <div className="mt-3 p-3 bg-primary-blue/20 border border-primary-blue/30 rounded-lg">
              <p className="text-primary-blue text-sm">
                ✓ This asset already has all required documentation from its original creation. 
                The verification request will use the existing documents and photos.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary-blue hover:bg-primary-blue-light text-black px-8 py-3"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit for Verification'
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (isVerificationMode) {
      switch (currentStep) {
        case 1:
          return (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-off-white mb-2">Asset Verification Request</h2>
                <p className="text-off-white/70">
                  Submit verification request for your existing asset.
                </p>
              </div>
              
              {/* Asset Information Display */}
              <div className="bg-dark-gray rounded-lg p-6 border border-medium-gray">
                <h3 className="text-lg font-semibold text-off-white mb-4">Asset Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-off-white/70">Name:</span>
                    <span className="text-off-white ml-2">{formData.assetName}</span>
                  </div>
                  <div>
                    <span className="text-off-white/70">Type:</span>
                    <span className="text-off-white ml-2">{formData.assetType}</span>
                  </div>
                  <div>
                    <span className="text-off-white/70">Location:</span>
                    <span className="text-off-white ml-2">{formData.location.address}</span>
                  </div>
                  <div>
                    <span className="text-off-white/70">Value:</span>
                    <span className="text-off-white ml-2">{formData.valuation.estimatedValue} {formData.valuation.currency}</span>
                  </div>
                </div>
              </div>
              
              {/* Verification Level Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-off-white">Select Verification Level</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-off-white/80 mb-2">
                      Verification Level *
                    </label>
                    <select
                      value={formData.verificationLevel}
                      onChange={(e) => handleInputChange('verificationLevel', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white focus:border-primary-blue focus:outline-none"
                      required
                    >
                      <option value="">Select verification level</option>
                      {Object.entries(VerificationLevel)
                        .filter(([key, value]) => typeof value === 'number')
                        .map(([key, value]) => (
                          <option key={value} value={value}>
                            {key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          );
        case 2:
          return renderReviewStep();
        default:
          return null;
      }
    } else {
      switch (currentStep) {
        case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Select Asset Type</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Asset Category *
                  </label>
                  <select
                    value={formData.assetType}
                    onChange={(e) => handleInputChange('assetType', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white focus:border-primary-blue focus:outline-none"
                    required
                  >
                    <option value="">Select an asset type</option>
                    {assetTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Show selected asset type details */}
                {formData.assetType && (
                  <div className="p-3 bg-midnight-800/50 border border-medium-gray rounded-lg">
                    {(() => {
                      const selectedType = assetTypes.find(type => type.value === formData.assetType);
                      if (!selectedType) return null;
                      const IconComponent = selectedType.icon;
                      return (
                        <div className="flex items-center space-x-3">
                          <IconComponent className="w-5 h-5 text-primary-blue-light" />
                          <div>
                            <p className="text-sm font-medium text-off-white">{selectedType.label}</p>
                            <p className="text-xs text-off-white/70">{selectedType.description}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
            
            {/* Verification Level Selection */}
            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Select Verification Level</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Verification Level *
                  </label>
                  <select
                    value={formData.verificationLevel}
                    onChange={(e) => handleInputChange('verificationLevel', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white focus:border-primary-blue focus:outline-none"
                    required
                  >
                    <option value="">Select verification level</option>
                    {verificationLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label} - {level.fee} - {level.description}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Show selected verification level details */}
                {formData.verificationLevel !== undefined && (
                  <div className="p-3 bg-midnight-800/50 border border-medium-gray rounded-lg">
                    {(() => {
                      const selectedLevel = verificationLevels.find(level => level.value === formData.verificationLevel);
                      if (!selectedLevel) return null;
                      return (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-off-white">{selectedLevel.label}</p>
                            <p className="text-xs text-off-white/70">{selectedLevel.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-primary-blue font-bold">{selectedLevel.fee}</span>
                            <p className="text-xs text-off-white/60">Fee</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Asset Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Asset Name *
                  </label>
                  <Input
                    value={formData.assetName}
                    onChange={(e) => handleInputChange('assetName', e.target.value)}
                    placeholder="Enter asset name"
                    required
                  />
                </div>
                <div>
                <label className="block text-sm font-medium text-off-white/80 mb-2">
                  Description *
                </label>
                  <Input
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter asset description"
                    required
                />
                </div>
              </div>
            </div>

            {/* Dynamic asset-specific fields */}
            {renderAssetSpecificFields()}

            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Location Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Full Address *
                  </label>
                  <Input
                    value={formData.location.address}
                    onChange={(e) => handleNestedInputChange('location', 'address', e.target.value)}
                    placeholder="Enter full address"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    City *
                  </label>
                  <Input
                    value={formData.location.city}
                    onChange={(e) => handleNestedInputChange('location', 'city', e.target.value)}
                    placeholder="Enter city"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    State *
                  </label>
                  <Input
                    value={formData.location.state}
                    onChange={(e) => handleNestedInputChange('location', 'state', e.target.value)}
                    placeholder="Enter state"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Country
                  </label>
                  <select
                    value={formData.location.country}
                    onChange={(e) => handleNestedInputChange('location', 'country', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                  >
                    <option value="Nigeria">Nigeria</option>
                    <option value="Ghana">Ghana</option>
                    <option value="Kenya">Kenya</option>
                    <option value="South Africa">South Africa</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    className="w-full"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Capture Current Location
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Ownership Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Owner Name *
                  </label>
                  <Input
                    value={formData.ownership.ownerName}
                    onChange={(e) => handleNestedInputChange('ownership', 'ownerName', e.target.value)}
                    placeholder="Enter owner name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Ownership Type
                  </label>
                  <select
                    value={formData.ownership.ownershipType}
                    onChange={(e) => handleNestedInputChange('ownership', 'ownershipType', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                  >
                    <option value="individual">Individual</option>
                    <option value="joint">Joint Ownership</option>
                    <option value="corporate">Corporate</option>
                    <option value="government">Government</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Ownership Percentage
                  </label>
                  <Input
                    type="number"
                    value={formData.ownership.ownershipPercentage}
                    onChange={(e) => handleNestedInputChange('ownership', 'ownershipPercentage', e.target.value)}
                    placeholder="100"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Legal Entity (if applicable)
                  </label>
                  <Input
                    value={formData.ownership.legalEntity}
                    onChange={(e) => handleNestedInputChange('ownership', 'legalEntity', e.target.value)}
                    placeholder="Company name or legal entity"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Valuation Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Estimated Value *
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="number"
                      value={formData.valuation.estimatedValue}
                      onChange={(e) => handleNestedInputChange('valuation', 'estimatedValue', e.target.value)}
                      placeholder="Enter estimated value"
                      required
                    />
                    <select
                      value={formData.valuation.currency}
                      onChange={(e) => handleNestedInputChange('valuation', 'currency', e.target.value)}
                      className="px-3 py-2 bg-dark-gray border border-medium-gray rounded-md text-off-white"
                    >
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Valuation Date
                  </label>
                  <Input
                    type="date"
                    value={formData.valuation.valuationDate}
                    onChange={(e) => handleNestedInputChange('valuation', 'valuationDate', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Valuator/Appraiser
                  </label>
                  <Input
                    value={formData.valuation.valuator}
                    onChange={(e) => handleNestedInputChange('valuation', 'valuator', e.target.value)}
                    placeholder="Name of professional valuator or appraiser"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-off-white/80 mb-2">
                    Maximum Investable Percentage *
                  </label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.valuation.maxInvestablePercentage}
                      onChange={(e) => handleNestedInputChange('valuation', 'maxInvestablePercentage', e.target.value)}
                      placeholder="100"
                      className="flex-1"
                    />
                    <span className="text-off-white/70">%</span>
                  </div>
                  <p className="text-xs text-off-white/60 mt-1">
                    Maximum percentage of this asset that can be tokenized for investment. 
                    You will retain ownership of the remaining percentage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Documents & Photos</h3>
              <p className="text-sm text-off-white/70 mb-4">
                Upload ownership documents, survey plans, valuation reports, and other supporting documents. 
                Files will be stored securely on IPFS.
              </p>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="mb-6 p-4 bg-midnight-800/50 border border-medium-gray rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-off-white">Uploading Files</span>
                    <span className="text-sm text-off-white/70">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-dark-gray rounded-full h-2 mb-2">
                    <div 
                      className="bg-primary-blue h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-off-white/70">{uploadStatus}</p>
                </div>
              )}

              {/* Upload Button */}
              {documents.length > 0 && !isUploading && (
                <div className="mb-4">
                  <Button
                    onClick={uploadAllFiles}
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? 'Uploading...' : 'Upload All Files'}
                  </Button>
                </div>
              )}
              
              <FileUpload
                onFilesChange={(uploadedFiles) => {
                  const newDocs = uploadedFiles.map(uf => ({
                    id: uf.id,
                    file: uf.file,
                    type: 'other' as const,
                    description: uf.metadata?.description || '',
                    cid: uf.cid,
                    ipfsUrl: uf.ipfsUrl,
                    status: 'pending' as const, // Always start as pending
                    error: uf.error
                  }));
                  setDocuments(prev => [...prev, ...newDocs]);
                }}
                maxFiles={10}
                maxSize={50 * 1024 * 1024} // 50MB
                acceptedTypes={['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png']}
                category="verification_document"
                description="Select verification documents (upload after selection)"
                showUploadButton={false} // Disable individual upload
              />

              {documents.length > 0 && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold text-off-white">Uploaded Documents</h4>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-off-white/70">
                        {documents.filter(doc => doc.status === 'completed').length} / {documents.length} uploaded
                      </span>
                      {documents.some(doc => doc.status === 'pending') && (
                        <span className="text-yellow-400">⚠️ Upload required</span>
                      )}
                    </div>
                  </div>
                  {documents.map((doc) => (
                    <Card key={doc.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-primary-blue-light" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-off-white">{doc.file.name}</p>
                            <div className="flex space-x-2 mt-2">
                              <select
                                value={doc.type}
                                onChange={(e) => updateDocument(doc.id, { type: e.target.value as any })}
                                className="px-2 py-1 bg-dark-gray border border-medium-gray rounded text-xs text-off-white"
                              >
                                {documentTypes.map(type => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                              <Input
                                value={doc.description}
                                onChange={(e) => updateDocument(doc.id, { description: e.target.value })}
                                placeholder="Description (optional)"
                                className="text-xs"
                              />
                            </div>
                            {doc.status === 'uploading' && (
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="w-3 h-3 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-xs text-primary-blue">Uploading...</p>
                              </div>
                            )}
                            {doc.status === 'completed' && doc.cid && (
                              <p className="text-xs text-primary-blue mt-1">
                                ✓ Uploaded to IPFS: {doc.cid}
                              </p>
                            )}
                            {doc.status === 'error' && (
                              <p className="text-xs text-red-400 mt-1">
                                ✗ {doc.error}
                              </p>
                            )}
                            {doc.status === 'pending' && (
                              <p className="text-xs text-off-white/70 mt-1">
                                ⏳ Pending upload
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {doc.status === 'completed' && doc.cid && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewFile({
                                cid: doc.cid!,
                                fileName: doc.file.name,
                                fileType: doc.file.type,
                                fileSize: doc.file.size
                              })}
                              className="text-primary-blue-light hover:text-primary-blue"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(doc.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Asset Photos</h3>
              <p className="text-sm text-off-white/70 mb-4">
                Upload clear photos of your asset from different angles. 
                Photos will be stored securely on IPFS.
              </p>
              
              <FileUpload
                onFilesChange={(uploadedFiles) => {
                  const newPhotos = uploadedFiles.map(uf => ({
                    id: uf.id,
                    file: uf.file,
                    description: uf.metadata?.description || '',
                    cid: uf.cid,
                    ipfsUrl: uf.ipfsUrl,
                    status: 'pending' as const, // Always start as pending
                    error: uf.error
                  }));
                  setPhotos(prev => [...prev, ...newPhotos]);
                }}
                maxFiles={20}
                maxSize={10 * 1024 * 1024} // 10MB
                acceptedTypes={['image/*']}
                category="verification_photo"
                description="Select asset photos (upload after selection)"
                showUploadButton={false} // Disable individual upload
              />

              {photos.length > 0 && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold text-off-white">Uploaded Photos</h4>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-off-white/70">
                        {photos.filter(photo => photo.status === 'completed').length} / {photos.length} uploaded
                      </span>
                      {photos.some(photo => photo.status === 'pending') && (
                        <span className="text-yellow-400">⚠️ Upload required</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <Card key={photo.id} className="p-4">
                        <div className="space-y-3">
                          <div className="aspect-square bg-dark-gray rounded-lg flex items-center justify-center overflow-hidden">
                            {photo.status === 'completed' && photo.ipfsUrl ? (
                              <img
                                src={photo.ipfsUrl}
                                alt={photo.description}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <img
                                src={URL.createObjectURL(photo.file)}
                                alt={photo.description}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-off-white truncate">{photo.file.name}</p>
                            <Input
                              value={photo.description}
                              onChange={(e) => updatePhoto(photo.id, { description: e.target.value })}
                              placeholder="Photo description"
                              className="text-xs"
                            />
                            {photo.status === 'uploading' && (
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-xs text-primary-blue">Uploading...</p>
                              </div>
                            )}
                            {photo.status === 'completed' && photo.cid && (
                              <p className="text-xs text-primary-blue">
                                ✓ Uploaded to IPFS
                              </p>
                            )}
                            {photo.status === 'error' && (
                              <p className="text-xs text-red-400">
                                ✗ {photo.error}
                              </p>
                            )}
                            {photo.status === 'pending' && (
                              <p className="text-xs text-off-white/70">
                                ⏳ Pending upload
                              </p>
                            )}
                            <div className="flex space-x-2">
                              {photo.status === 'completed' && photo.cid && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPreviewFile({
                                    cid: photo.cid!,
                                    fileName: photo.file.name,
                                    fileType: photo.file.type,
                                    fileSize: photo.file.size
                                  })}
                                  className="flex-1 text-primary-blue-light hover:text-primary-blue"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePhoto(photo.id)}
                                className="flex-1 text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Upload All Button */}
            {(documents.some(d => d.status === 'pending') || photos.some(p => p.status === 'pending')) && (
              <div className="flex flex-col items-center pt-6 border-t border-border-accent/20">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-semibold text-off-white mb-2">Ready to Upload?</h4>
                  <p className="text-sm text-off-white/70">
                    {documents.filter(d => d.status === 'pending').length} documents and {photos.filter(p => p.status === 'pending').length} photos selected
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    const result = await uploadAllFiles();
                    if (result.success) {
                      toast({
                        title: 'Upload Successful',
                        description: 'All files uploaded to IPFS successfully',
                        variant: 'success'
                      });
                    } else {
                      toast({
                        title: 'Upload Failed',
                        description: `Some files failed to upload: ${result.errors.join(', ')}`,
                        variant: 'destructive'
                      });
                    }
                  }}
                  size="lg"
                  className="bg-primary-blue hover:bg-primary-blue-light text-black px-8 py-3"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload All Files to IPFS
                </Button>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Review & Submit</h3>
              <div className="space-y-4">
                <div className="p-4 bg-midnight-800/50 border border-medium-gray rounded-lg">
                  <h4 className="font-semibold text-off-white mb-2">Asset Information</h4>
                  <p className="text-sm text-off-white/70">Name: {formData.assetName}</p>
                  <p className="text-sm text-off-white/70">Type: {formData.assetType}</p>
                  <p className="text-sm text-off-white/70">Location: {formData.location.address}</p>
                </div>
                <div className="p-4 bg-midnight-800/50 border border-medium-gray rounded-lg">
                  <h4 className="font-semibold text-off-white mb-2">Ownership</h4>
                  <p className="text-sm text-off-white/70">Owner: {formData.ownership.ownerName}</p>
                  <p className="text-sm text-off-white/70">Type: {formData.ownership.ownershipType}</p>
                </div>
                <div className="p-4 bg-midnight-800/50 border border-medium-gray rounded-lg">
                  <h4 className="font-semibold text-off-white mb-2">Valuation</h4>
                  <p className="text-sm text-off-white/70">Value: {formData.valuation.estimatedValue} {formData.valuation.currency}</p>
                </div>
                <div className="p-4 bg-midnight-800/50 border border-medium-gray rounded-lg">
                  <h4 className="font-semibold text-off-white mb-2">Documents</h4>
                  <p className="text-sm text-off-white/70">Documents: {documents.length} files</p>
                  <p className="text-sm text-off-white/70">Photos: {photos.length} files</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-off-white mb-4">Tokenization</h3>
              <div className="space-y-4">
                <Card className="p-4">
                  <h4 className="font-semibold text-off-white mb-2">Asset Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-off-white/70">Type:</span>
                      <span className="ml-2 text-off-white">
                        {assetTypes.find(t => t.value === formData.assetType)?.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-off-white/70">Name:</span>
                      <span className="ml-2 text-off-white">{formData.assetName}</span>
                    </div>
                    <div>
                      <span className="text-off-white/70">Size:</span>
                      <span className="ml-2 text-off-white">
                        {formData.specifications.size} {formData.specifications.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-off-white/70">Location:</span>
                      <span className="ml-2 text-off-white">
                        {formData.location.city}, {formData.location.state}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-semibold text-off-white mb-2">Ownership & Valuation</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-off-white/70">Owner:</span>
                      <span className="ml-2 text-off-white">{formData.ownership.ownerName}</span>
                    </div>
                    <div>
                      <span className="text-off-white/70">Ownership:</span>
                      <span className="ml-2 text-off-white">
                        {formData.ownership.ownershipPercentage}% {formData.ownership.ownershipType}
                      </span>
                    </div>
                    <div>
                      <span className="text-off-white/70">Estimated Value:</span>
                      <span className="ml-2 text-off-white">
                        {formData.valuation.estimatedValue} {formData.valuation.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-off-white/70">Valuator:</span>
                      <span className="ml-2 text-off-white">{formData.valuation.valuator || 'Not specified'}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-semibold text-off-white mb-2">Supporting Materials</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-off-white/70">Documents:</span>
                      <span className="ml-2 text-off-white">{documents.length} files</span>
                    </div>
                    <div>
                      <span className="text-off-white/70">Photos:</span>
                      <span className="ml-2 text-off-white">{photos.length} files</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary-blue/10 border border-primary-blue/30">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-primary-blue mt-0.5" />
                <div>
                  <h4 className="font-semibold text-primary-blue">Ready to Submit</h4>
                  <p className="text-sm text-off-white/70 mt-1">
                    Your asset verification request is complete. Once submitted, our team of professional attestors will review your asset and provide verification within 3-5 business days.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <TrendingUp className="w-16 h-16 text-primary-blue mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-off-white mb-2">Hedera Tokenization</h3>
              <p className="text-off-white/70">Creating blockchain token for your asset on Hedera network</p>
            </div>

            {!tokenizationResult ? (
              <div className="text-center">
                <div className="mb-6">
                  <Loader2 className="w-12 h-12 text-primary-blue mx-auto animate-spin mb-4" />
                  <h4 className="text-xl font-semibold text-off-white mb-2">Tokenizing Asset...</h4>
                  <p className="text-off-white/70">This may take a few moments while we create your token on the Hedera network</p>
                </div>
                
                <div className="max-w-md mx-auto">
                  <div className="bg-dark-card/50 border border-primary-blue/20 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-off-white/70">Asset Name:</span>
                      <span className="text-off-white font-semibold">{formData.assetName}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-off-white/70">Token Supply:</span>
                      <span className="text-primary-blue font-semibold">{formData.valuation.estimatedValue?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-off-white/70">Total Value:</span>
                      <span className="text-primary-blue font-semibold">{formData.valuation.estimatedValue?.toLocaleString()} {formData.valuation.currency}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : tokenizationResult.success ? (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-primary-blue mx-auto mb-4" />
                <h4 className="text-2xl font-bold text-primary-blue mb-2">
                  {tokenizationResult.verificationTier === 'INSTANT' ? 'Instant Tokenization Complete!' : 'Tokenization Successful!'}
                </h4>
                <p className="text-off-white/70 mb-6">
                  {tokenizationResult.verificationTier === 'INSTANT' 
                    ? 'Your asset was instantly verified and tokenized on the Hedera network'
                    : 'Your asset has been successfully tokenized on the Hedera network'
                  }
                </p>
                
                <div className="max-w-lg mx-auto space-y-4">
                  <Card className="bg-dark-card/50 border-primary-blue/20">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-off-white/70">Token ID:</span>
                          <span className="text-primary-blue font-mono text-sm">{tokenizationResult.tokenId}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-off-white/70">Transaction ID:</span>
                          <span className="text-off-white font-mono text-sm break-all max-w-[200px] truncate" title={tokenizationResult.transactionId}>
                            {tokenizationResult.transactionId}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-off-white/70">Status:</span>
                          <span className="text-primary-blue font-semibold">Active</span>
                        </div>
                        {tokenizationResult.verificationTier && (
                          <div className="flex items-center justify-between">
                            <span className="text-off-white/70">Verification Tier:</span>
                            <span className="text-primary-blue font-semibold">
                              {tokenizationResult.verificationTier}
                            </span>
                          </div>
                        )}
                        {tokenizationResult.processingTime && (
                          <div className="flex items-center justify-between">
                            <span className="text-off-white/70">Processing Time:</span>
                            <span className="text-primary-blue font-semibold">
                              {tokenizationResult.processingTime < 1 
                                ? `${Math.round(tokenizationResult.processingTime * 60)} seconds`
                                : `${Math.round(tokenizationResult.processingTime)} minutes`
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex gap-4 justify-center">
                    <Button
                      onClick={() => window.location.href = '/dashboard/assets'}
                      className="px-6 py-3"
                    >
                      View My Assets
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = '/dashboard'}
                      className="px-6 py-3"
                    >
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h4 className="text-2xl font-bold text-red-500 mb-2">Tokenization Failed</h4>
                <p className="text-off-white/70 mb-6">There was an error creating your token on the Hedera network</p>
                
                <Button
                  onClick={() => setCurrentStep(5)}
                  className="px-6 py-3"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        );

      default:
        return null;
      }
    }
  };

  const canProceed = () => {
    if (isVerificationMode) {
      switch (currentStep) {
        case 1:
          return formData.verificationLevel !== undefined;
        case 2:
          // Check if there are files and they are all uploaded
          const hasFiles = documents.length > 0 || photos.length > 0;
          const allUploaded = documents.every(doc => doc.status === 'completed') && 
                             photos.every(photo => photo.status === 'completed');
          return hasFiles && allUploaded;
        case 3:
          return true; // Review step - always can proceed
        default:
          return false;
      }
    } else {
      switch (currentStep) {
        case 1:
          return formData.assetType !== '';
        case 2:
          return formData.assetName !== '' && formData.description !== '' && formData.location.address !== '';
        case 3:
          return formData.ownership.ownerName !== '' && formData.valuation.estimatedValue !== '';
        case 4:
          // Check if there are files and they are all uploaded
          const hasFiles = documents.length > 0 || photos.length > 0;
          const allUploaded = documents.every(doc => doc.status === 'completed') && 
                             photos.every(photo => photo.status === 'completed');
          return hasFiles && allUploaded;
        case 5:
          return true; // Verification tiers step - always can proceed
        case 6:
          return true; // Review step - always can proceed
        case 7:
          return tokenizationResult !== null;
        default:
          return false;
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-off-white font-secondary relative overflow-hidden dark:bg-black light:bg-light-bg dark:text-off-white light:text-light-text">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,255,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,255,255,0.05),transparent_50%)]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: 'Dashboard', icon: <Home className="w-4 h-4" />, href: '/dashboard' },
              { label: 'Assets', icon: <TrendingUp className="w-4 h-4" />, href: '/dashboard/assets' },
              { label: 'Verify Asset', icon: <Shield className="w-4 h-4" />, current: true }
            ]}
            showBackButton={true}
            backButtonText="Back to Assets"
            onBack={() => window.history.back()}
          />
        </div>

        {/* Auto-Fill for Testing */}
        <div className="mb-8">
          <AutoFill 
            onAutoFill={handleAutoFill}
            disabled={isSubmitting || isTokenizing}
          />
        </div>
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-off-white mb-4"
          >
            Create & Tokenize Asset
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-off-white/70 mb-4"
          >
            Submit your asset for professional verification and tokenization
          </motion.p>
          
                {/* Wallet Status Indicators */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center gap-3"
                >
                </motion.div>
        </div>

        {/* Step Navigation */}
        <div className="mb-8 px-4">
          <StepNavigation
            steps={steps.map(step => ({
              id: step.number.toString(),
              title: step.title,
              description: step.description,
              completed: currentStep > step.number,
              current: currentStep === step.number,
              disabled: false
            }))}
            onStepClick={(stepId) => {
              const stepNumber = parseInt(stepId);
              if (stepNumber <= currentStep || canProceed()) {
                setCurrentStep(stepNumber);
              }
            }}
            className="justify-center"
          />
        </div>

        {/* Main Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-off-white">
                Step {currentStep}: {steps[currentStep - 1]?.title || 'Unknown Step'}
              </CardTitle>
              <p className="text-off-white/70">
                {steps[currentStep - 1]?.description || 'Step description not available'}
              </p>
            </CardHeader>
            <CardContent>
              {renderStepContent()}
            </CardContent>
          </Card>
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between mt-8 max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          
          {isVerificationMode ? (
            currentStep < 3 ? (
              <Button
                onClick={() => setCurrentStep(prev => Math.min(3, prev + 1))}
                disabled={!canProceed()}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting || isRequestingVerification}
                className="bg-primary-blue hover:bg-primary-blue-light text-black"
              >
                {isRequestingVerification ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Requesting Verification...
                  </>
                ) : (
                  'Request Verification'
                )}
              </Button>
            )
          ) : (
            currentStep < 6 ? (
              <Button
                onClick={() => setCurrentStep(prev => Math.min(7, prev + 1))}
                disabled={!canProceed()}
              >
                Next
              </Button>
            ) : currentStep === 6 ? (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting || isRequestingVerification}
                className="bg-primary-blue hover:bg-primary-blue-light text-black"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Asset...
                  </>
                ) : isRequestingVerification ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Requesting Verification...
                  </>
                ) : (
                  'Create & Tokenize Asset'
                )}
              </Button>
            ) : (
              <Button
                onClick={() => window.location.href = '/dashboard/assets'}
                className="px-8 py-3"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                View My Assets
              </Button>
            )
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          cid={previewFile.cid}
          fileName={previewFile.fileName}
          fileType={previewFile.fileType}
          fileSize={previewFile.fileSize}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
};

export default AssetVerification;
