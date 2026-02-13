import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Upload, 
  Calendar, 
  DollarSign, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Shield, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight,
  Building2,
  Globe,
  Package,
  Search,
  Clock,
  Verified
} from 'lucide-react';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePrivy } from '@privy-io/react-auth';
import { novaxContractService } from '../../services/novaxContractService';
import { apiService } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { ethers } from 'ethers';
import Button from '../UI/Button';
import Input from '../UI/Input';
import { StatusBadge } from '../UI/StatusBadge';

interface LineItem {
  id: string;
  description: string;
  hsCode: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
}

interface CreateReceivableForm {
  // Exporter Info (pre-filled from user)
  exporterName: string;
  exporterAddress: string;
  exporterCountry: string;
  exporterTaxId: string;
  exporterBankName: string;
  exporterBankAccount: string;
  exporterSwiftCode: string;
  exporterKYCStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
  
  // Importer Info
  importerName: string;
  importerAddress: string;
  importerCountry: string;
  importerTaxId: string;
  importerBankName: string;
  importerBankAccount: string;
  importerSwiftCode: string;
  importerWalletAddress: string;
  importerKYBStatus: 'not_verified' | 'verifying' | 'verified' | 'rejected';
  
  // Trade Details - Basic
  invoiceNumber: string;
  amountUSD: string;
  currency: string;
  exchangeRate: string;
  dueDate: string;
  description: string;
  commodity: string;
  tradeDate: string;
  shippingTerms: string;
  paymentTerms: string;
  paymentMethod: string; // Letter of Credit, Open Account, etc.
  
  // Product Line Items
  lineItems: LineItem[];
  
  // Shipping & Logistics
  portOfLoading: string;
  portOfDischarge: string;
  vesselName: string;
  shippingLine: string;
  containerNumbers: string;
  shippingDate: string;
  expectedArrivalDate: string;
  freightForwarder: string;
  
  // Regulatory & Compliance
  exportLicenseNumber: string;
  importLicenseNumber: string;
  customsDeclarationNumber: string;
  exportPermitNumber: string;
  importPermitNumber: string;
  
  // Insurance
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceCoverageAmount: string;
  
  // Documents
  invoiceDocument: File | null;
  billOfLading: File | null;
  certificateOfOrigin: File | null;
  purchaseOrder: File | null;
  contract: File | null;
  packingList: File | null;
  qualityInspectionCertificate: File | null;
  phytosanitaryCertificate: File | null;
  insuranceCertificate: File | null;
  exportPermit: File | null;
  importPermit: File | null;
  
  // Verification Status
  exporterVerified: boolean;
  importerVerified: boolean;
  tradeVerified: boolean;
}

const CreateReceivableEnhanced: React.FC = () => {
  const { address, signer, isConnected, provider, loading: walletLoading, connectWallet } = useWallet();
  const { authenticated, ready, user: privyUser, login } = usePrivy();
  const { user, startKYC } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [verifyingImporter, setVerifyingImporter] = useState(false);
  const [verifyingTrade, setVerifyingTrade] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(true);
  
  const isKYCApproved = user?.kycStatus?.toLowerCase() === 'approved';

  // Check if user is logged in (either authenticated or has Privy user object)
  const isLoggedIn = authenticated || !!privyUser;

  // Give Privy time to initialize wallet connection
  useEffect(() => {
    const timer = setTimeout(() => {
      setCheckingWallet(false);
    }, 3000); // Wait 3 seconds for Privy to initialize (increased from 2s)

    return () => clearTimeout(timer);
  }, []);
  
  const [formData, setFormData] = useState<CreateReceivableForm>({
    exporterName: user?.name || '',
    exporterAddress: address || '',
    exporterCountry: user?.country || '',
    exporterTaxId: '',
    exporterBankName: '',
    exporterBankAccount: '',
    exporterSwiftCode: '',
    exporterKYCStatus: (user?.kycStatus?.toLowerCase() as any) || 'not_started',
    importerName: '',
    importerAddress: '',
    importerCountry: '',
    importerTaxId: '',
    importerBankName: '',
    importerBankAccount: '',
    importerSwiftCode: '',
    importerWalletAddress: '',
    importerKYBStatus: 'not_verified',
    invoiceNumber: '',
    amountUSD: '',
    currency: 'USDC',
    exchangeRate: '1.0',
    dueDate: '',
    description: '',
    commodity: '',
    tradeDate: '',
    shippingTerms: 'FOB',
    paymentTerms: 'Net 30',
    paymentMethod: 'Open Account',
    lineItems: [],
    portOfLoading: '',
    portOfDischarge: '',
    vesselName: '',
    shippingLine: '',
    containerNumbers: '',
    shippingDate: '',
    expectedArrivalDate: '',
    freightForwarder: '',
    exportLicenseNumber: '',
    importLicenseNumber: '',
    customsDeclarationNumber: '',
    exportPermitNumber: '',
    importPermitNumber: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceCoverageAmount: '',
    invoiceDocument: null,
    billOfLading: null,
    certificateOfOrigin: null,
    purchaseOrder: null,
    contract: null,
    packingList: null,
    qualityInspectionCertificate: null,
    phytosanitaryCertificate: null,
    insuranceCertificate: null,
    exportPermit: null,
    importPermit: null,
    exporterVerified: false,
    importerVerified: false,
    tradeVerified: false,
  });

  const totalSteps = 10;
  const steps = [
    { id: 1, title: 'Exporter Verification', icon: User, description: 'Verify your identity and business' },
    { id: 2, title: 'Exporter Details', icon: Building2, description: 'Complete exporter information' },
    { id: 3, title: 'Importer Information', icon: Building2, description: 'Enter importer details' },
    { id: 4, title: 'Importer Verification', icon: Shield, description: 'Verify importer business (KYB)' },
    { id: 5, title: 'Trade Details', icon: FileText, description: 'Enter trade and invoice information' },
    { id: 6, title: 'Product Line Items', icon: Package, description: 'Add product line items' },
    { id: 7, title: 'Shipping & Logistics', icon: Globe, description: 'Enter shipping details' },
    { id: 8, title: 'Trade Documents', icon: Upload, description: 'Upload trade documents' },
    { id: 9, title: 'Trade Verification', icon: Verified, description: 'Verify trade authenticity' },
    { id: 10, title: 'Review & Tokenize', icon: CheckCircle, description: 'Review and create receivable' },
  ];

  useEffect(() => {
    // Initialize contract service when we have provider (signer optional for embedded wallets)
    if (provider) {
      novaxContractService.initialize(signer || null, provider);
    } else if (address && ready && authenticated) {
      // If we have address but no provider yet, try to create a fallback provider
      // This allows the form to work even if Privy provider isn't ready
      const initWithFallback = async () => {
        try {
          const { ethers } = await import('ethers');
          // Use Etherlink RPC as fallback - contract service will use Privy signMessage for transactions
          const etherlinkRpcUrl = import.meta.env.VITE_RPC_URL || 'https://node.shadownet.etherlink.com';
          const fallbackProvider = new ethers.JsonRpcProvider(etherlinkRpcUrl);
          novaxContractService.initialize(null, fallbackProvider);
          console.log('Initialized contract service with fallback provider');
        } catch (error) {
          console.error('Failed to initialize with fallback provider:', error);
        }
      };
      
      // Wait a bit for provider to be set, then use fallback if needed
      const timer = setTimeout(() => {
        if (provider) {
          novaxContractService.initialize(signer || null, provider);
        } else {
          initWithFallback();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    // Check exporter KYC status
    if (user?.kycStatus?.toLowerCase() === 'approved') {
      setFormData(prev => ({
        ...prev,
        exporterKYCStatus: 'approved',
        exporterVerified: true
      }));
    }
  }, [signer, provider, address, ready, authenticated, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (fieldName: keyof CreateReceivableForm, file: File | null) => {
    setFormData(prev => ({ ...prev, [fieldName]: file }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Exporter Verification
        return formData.exporterVerified;
      case 2: // Exporter Details
        return !!(
          formData.exporterName &&
          formData.exporterAddress &&
          formData.exporterCountry &&
          formData.exporterBankName &&
          formData.exporterBankAccount
        );
      case 3: // Importer Information
        return !!(
          formData.importerName &&
          formData.importerAddress &&
          formData.importerCountry &&
          formData.importerWalletAddress
        );
      case 4: // Importer Verification
        return formData.importerVerified;
      case 5: // Trade Details
        return !!(
          formData.invoiceNumber &&
          formData.amountUSD &&
          formData.dueDate &&
          formData.commodity &&
          formData.tradeDate
        );
      case 6: // Product Line Items
        return formData.lineItems.length > 0;
      case 7: // Shipping & Logistics
        return !!(
          formData.portOfLoading &&
          formData.portOfDischarge &&
          formData.shippingDate
        );
      case 8: // Trade Documents
        return !!(
          formData.invoiceDocument &&
          formData.billOfLading &&
          formData.certificateOfOrigin
        );
      case 9: // Trade Verification
        return formData.tradeVerified;
      case 10: // Review
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      toast({
        title: 'Validation Error',
        description: 'Please complete all required fields and verifications before proceeding.',
        variant: 'destructive'
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Verify Exporter (KYC)
  const handleVerifyExporter = async () => {
    if (!isKYCApproved) {
      try {
        await startKYC();
        toast({
          title: 'KYC Started',
          description: 'Please complete KYC verification to proceed.',
          variant: 'default'
        });
      } catch (error) {
        console.error('KYC error:', error);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        exporterVerified: true,
        exporterKYCStatus: 'approved'
      }));
      toast({
        title: 'Exporter Verified',
        description: 'Your KYC verification is complete.',
        variant: 'default'
      });
    }
  };

  // Verify Importer (KYB)
  const handleVerifyImporter = async () => {
    if (!formData.importerName || !formData.importerAddress || !formData.importerWalletAddress) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all importer details first.',
        variant: 'destructive'
      });
      return;
    }

    setVerifyingImporter(true);
    try {
      // Call backend API to start KYB verification for importer
      const response = await apiService.post('/kyc/start-kyb', {
        businessName: formData.importerName,
        businessAddress: formData.importerAddress,
        country: formData.importerCountry,
        walletAddress: formData.importerWalletAddress,
        type: 'importer'
      });

      if (response.success) {
        setFormData(prev => ({
          ...prev,
          importerKYBStatus: 'verifying'
        }));
        
        toast({
          title: 'KYB Verification Started',
          description: 'Importer business verification is in progress. This may take a few minutes.',
          variant: 'default'
        });

        // Poll for verification status
        const checkStatus = async () => {
          try {
            const statusResponse = await apiService.get(`/kyc/kyb-status/${response.inquiryId}`);
            if (statusResponse.status === 'verified') {
              setFormData(prev => ({
                ...prev,
                importerKYBStatus: 'verified',
                importerVerified: true
              }));
              toast({
                title: 'Importer Verified',
                description: 'Importer business verification completed successfully.',
                variant: 'default'
              });
            } else if (statusResponse.status === 'rejected') {
              setFormData(prev => ({
                ...prev,
                importerKYBStatus: 'rejected'
              }));
              toast({
                title: 'Verification Failed',
                description: 'Importer verification was rejected. Please check the information and try again.',
                variant: 'destructive'
              });
            } else {
              // Continue polling
              setTimeout(checkStatus, 5000);
            }
          } catch (error) {
            console.error('Error checking KYB status:', error);
          }
        };

        setTimeout(checkStatus, 5000);
      }
    } catch (error: any) {
      console.error('KYB verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to start importer verification. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setVerifyingImporter(false);
    }
  };

  // Verify Trade
  const handleVerifyTrade = async () => {
    if (!formData.invoiceDocument || !formData.billOfLading || !formData.certificateOfOrigin) {
      toast({
        title: 'Missing Documents',
        description: 'Please upload all required trade documents.',
        variant: 'destructive'
      });
      return;
    }

    setVerifyingTrade(true);
    try {
      // Upload documents to IPFS
      const formDataUpload = new FormData();
      formDataUpload.append('invoice', formData.invoiceDocument);
      formDataUpload.append('billOfLading', formData.billOfLading);
      formDataUpload.append('certificateOfOrigin', formData.certificateOfOrigin);
      if (formData.purchaseOrder) formDataUpload.append('purchaseOrder', formData.purchaseOrder);
      if (formData.contract) formDataUpload.append('contract', formData.contract);

      const uploadResponse = await apiService.post('/ipfs/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const documentCIDs = uploadResponse.cids || [];

      // Call backend to verify trade
      const verifyResponse = await apiService.post('/verification/verify-trade', {
        exporter: {
          name: formData.exporterName,
          address: formData.exporterAddress,
          country: formData.exporterCountry,
          walletAddress: address,
          kycStatus: formData.exporterKYCStatus
        },
        importer: {
          name: formData.importerName,
          address: formData.importerAddress,
          country: formData.importerCountry,
          walletAddress: formData.importerWalletAddress,
          kybStatus: formData.importerKYBStatus
        },
        trade: {
          invoiceNumber: formData.invoiceNumber,
          amount: formData.amountUSD,
          dueDate: formData.dueDate,
          commodity: formData.commodity,
          tradeDate: formData.tradeDate,
          shippingTerms: formData.shippingTerms,
          paymentTerms: formData.paymentTerms,
          description: formData.description
        },
        documents: documentCIDs
      });

      if (verifyResponse.verified) {
        setFormData(prev => ({
          ...prev,
          tradeVerified: true
        }));
        toast({
          title: 'Trade Verified',
          description: 'Trade verification completed successfully. You can now tokenize the receivable.',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: verifyResponse.reason || 'Trade verification failed. Please check your documents and try again.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Trade verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify trade. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setVerifyingTrade(false);
    }
  };

  // Tokenize Receivable
  const handleTokenize = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if we have address (wallet might still be initializing)
    if (!address) {
      toast({
        title: 'Wallet Not Ready',
        description: 'Your wallet is still initializing. Please wait a moment and try again.',
        variant: 'destructive'
      });
      return;
    }

    // Ensure contract service is initialized (should already be done in useEffect, but double-check)
    if (!provider) {
      // Provider should have been initialized in useEffect, but if not, try fallback
      console.warn('Provider not available, contract service should use fallback from useEffect');
    }

    if (!formData.exporterVerified || !formData.importerVerified || !formData.tradeVerified) {
      toast({
        title: 'Verification Required',
        description: 'Please complete all verifications before tokenizing.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      // Upload all documents to IPFS (optional - can skip if fails)
      let documentCIDs: string[] = [];
      const hasDocuments = formData.invoiceDocument || formData.billOfLading || formData.certificateOfOrigin || formData.purchaseOrder || formData.contract;
      
      if (hasDocuments) {
        try {
          const formDataUpload = new FormData();
          if (formData.invoiceDocument) formDataUpload.append('invoice', formData.invoiceDocument);
          if (formData.billOfLading) formDataUpload.append('billOfLading', formData.billOfLading);
          if (formData.certificateOfOrigin) formDataUpload.append('certificateOfOrigin', formData.certificateOfOrigin);
          if (formData.purchaseOrder) formDataUpload.append('purchaseOrder', formData.purchaseOrder);
          if (formData.contract) formDataUpload.append('contract', formData.contract);

          toast({
            title: 'Uploading Documents',
            description: 'Uploading documents to IPFS...',
            variant: 'default'
          });

          const uploadResponse = await apiService.post('/ipfs/upload', formDataUpload, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          documentCIDs = uploadResponse.cids || [];
        } catch (docError: any) {
          console.warn('Document upload failed, continuing without documents:', docError);
          toast({
            title: 'Document Upload Skipped',
            description: 'Continuing without documents. You can upload them later.',
            variant: 'default'
          });
        }
      }

      // Create comprehensive metadata
      const metadata = {
        exporter: {
          name: formData.exporterName,
          address: formData.exporterAddress,
          country: formData.exporterCountry,
          walletAddress: address,
          kycStatus: formData.exporterKYCStatus,
          verified: formData.exporterVerified
        },
        importer: {
          name: formData.importerName,
          address: formData.importerAddress,
          country: formData.importerCountry,
          walletAddress: formData.importerWalletAddress,
          kybStatus: formData.importerKYBStatus,
          verified: formData.importerVerified
        },
        trade: {
          invoiceNumber: formData.invoiceNumber,
          amount: formData.amountUSD,
          dueDate: formData.dueDate,
          commodity: formData.commodity,
          tradeDate: formData.tradeDate,
          shippingTerms: formData.shippingTerms,
          paymentTerms: formData.paymentTerms,
          description: formData.description
        },
        documents: documentCIDs,
        verification: {
          exporterVerified: formData.exporterVerified,
          importerVerified: formData.importerVerified,
          tradeVerified: formData.tradeVerified,
          verifiedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString()
      };

      // Upload metadata to IPFS (required for smart contract)
      toast({
        title: 'Uploading Metadata',
        description: 'Uploading metadata to IPFS...',
        variant: 'default'
      });

      let metadataCID: string;
      try {
        const metadataResponse = await apiService.post('/ipfs/upload-json', {
          data: metadata,
          fileName: `receivable-metadata-${Date.now()}.json`,
          metadata: {
            type: 'receivable_metadata',
            exporter: address
          }
        });
        metadataCID = metadataResponse.cid || metadataResponse.data?.cid;

        if (!metadataCID) {
          throw new Error("Failed to get CID from IPFS upload");
        }
      } catch (ipfsError: any) {
        console.error('IPFS upload failed, using hash of metadata as fallback:', ipfsError);
        // Fallback: Use hash of metadata as CID (not ideal but allows contract call)
        metadataCID = ethers.id(JSON.stringify(metadata));
        toast({
          title: 'IPFS Upload Warning',
          description: 'Using fallback metadata hash. Documents should be uploaded separately.',
          variant: 'default'
        });
      }

      // Convert CID to bytes32
      const metadataCIDBytes32 = ethers.id(metadataCID);

      // Convert amount to USDC (6 decimals)
      const amountInWei = ethers.parseUnits(formData.amountUSD, 6);

      // Convert due date to Unix timestamp
      const dueDateTimestamp = Math.floor(new Date(formData.dueDate).getTime() / 1000);

      // Create receivable on-chain
      toast({
        title: 'Creating Receivable',
        description: 'Creating receivable on blockchain...',
        variant: 'default'
      });

      const result = await novaxContractService.createReceivable(
        formData.importerWalletAddress,
        amountInWei,
        dueDateTimestamp,
        metadataCIDBytes32
      );

      toast({
        title: 'Receivable Created',
        description: `Receivable tokenized successfully! ID: ${result.receivableId.substring(0, 10)}...`,
        variant: 'default'
      });
      
      navigate('/dashboard/receivables');
    } catch (error: any) {
      console.error("Error tokenizing receivable:", error);
      toast({
        title: 'Tokenization Failed',
        description: `Failed to tokenize receivable: ${error.message || error.reason}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [address, signer, formData, navigate, toast]);

  // Show loading while Privy is initializing
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Initializing...</h2>
          <p className="text-gray-600 mb-6">Please wait while we initialize Privy.</p>
        </div>
      </div>
    );
  }

  // Show loading while checking wallet connection (give Privy time to create embedded wallet)
  if (checkingWallet || walletLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Checking Wallet Connection...</h2>
          <p className="text-gray-600 mb-6">Please wait while we verify your wallet connection.</p>
          <div className="mt-4 text-sm text-gray-500 space-y-1">
            <p>Privy Ready: {ready ? 'Yes' : 'No'}</p>
            <p>Authenticated: {authenticated ? 'Yes' : 'No'}</p>
            <p>Address: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not detected'}</p>
            <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Only block if not logged in - check both authenticated and privyUser
  if (!isLoggedIn && ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in with Privy to create a trade receivable.</p>
          <div className="flex flex-col gap-3">
            <Button 
              onClick={async () => {
                try {
                  await login();
                  toast({
                    title: 'Signing In...',
                    description: 'Please complete the Privy sign-in process.',
                    variant: 'default'
                  });
                } catch (error) {
                  toast({
                    title: 'Sign In Failed',
                    description: error instanceof Error ? error.message : 'Failed to sign in. Please try again.',
                    variant: 'destructive'
                  });
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Sign In with Privy
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
          <div className="mt-4 text-xs text-gray-500 space-y-1">
            <p>Debug Info:</p>
            <p>Privy Ready: {ready ? 'Yes' : 'No'}</p>
            <p>Authenticated: {authenticated ? 'Yes' : 'No'}</p>
            <p>Has Privy User: {privyUser ? 'Yes' : 'No'}</p>
            <p>Address: {address || 'None'}</p>
            <p>IsConnected: {isConnected ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated but no address yet, show a message but allow form to load
  // The form will show a message if address is needed for submission
  if (!address) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Creating Wallet...</h2>
          <p className="text-gray-600 mb-6">Your embedded wallet is being created. This may take a few moments.</p>
          <div className="mt-4 text-sm text-gray-500 space-y-1">
            <p>Authenticated: Yes ✓</p>
            <p>Wallet Address: Creating...</p>
            <p className="text-xs mt-4">If this takes too long, please refresh the page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Trade Receivable</h1>
              <p className="text-sm text-gray-600 mt-1">Verify exporter, importer, and trade before tokenization</p>
            </div>
          </motion.div>
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4 overflow-x-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const isClickable = currentStep >= step.id;
              const isVerified = 
                (step.id === 1 && formData.exporterVerified) ||
                (step.id === 3 && formData.importerVerified) ||
                (step.id === 6 && formData.tradeVerified);

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center flex-1 min-w-[100px]">
                    <button
                      type="button"
                      onClick={() => isClickable && setCurrentStep(step.id)}
                      disabled={!isClickable}
                      className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white scale-110'
                          : isCompleted || isVerified
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      } ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
                    >
                      {isCompleted || isVerified ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </button>
                    <span className={`text-xs mt-2 text-center ${
                      isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </span>
                    <span className="text-xs text-gray-400 mt-1 text-center">
                      {step.description}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 mt-6 min-w-[50px] ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
          <form onSubmit={handleTokenize}>
            <AnimatePresence mode="wait">
              {/* Step 1: Exporter Verification */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Exporter Verification</h2>
                    <p className="text-sm text-gray-600">Verify your identity and business information (KYC/KYB)</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">Exporter Information</p>
                        <div className="mt-2 space-y-1 text-sm text-blue-800">
                          <p><strong>Name:</strong> {formData.exporterName || 'Not provided'}</p>
                          <p><strong>Wallet:</strong> {formData.exporterAddress ? `${formData.exporterAddress.slice(0, 6)}...${formData.exporterAddress.slice(-4)}` : 'Not connected'}</p>
                          <p><strong>Country:</strong> {formData.exporterCountry || 'Not provided'}</p>
                        </div>
                      </div>
                      <StatusBadge 
                        status={formData.exporterKYCStatus === 'approved' ? 'verified' : formData.exporterKYCStatus === 'pending' ? 'pending' : 'not_started'} 
                        size="md"
                      />
                    </div>
                  </div>

                  {!formData.exporterVerified && (
                    <div className="text-center py-6">
                      <Shield className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                      <p className="text-gray-700 mb-4">
                        You need to complete KYC verification to create trade receivables.
                      </p>
                      <Button
                        type="button"
                        onClick={handleVerifyExporter}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        {isKYCApproved ? 'Verify Exporter' : 'Start KYC Verification'}
                      </Button>
                    </div>
                  )}

                  {formData.exporterVerified && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800 font-medium">Exporter Verified ✓</p>
                      </div>
                      <p className="text-sm text-green-700 mt-2">
                        Your KYC verification is complete. You can proceed to the next step.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Importer Information */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Importer Information</h2>
                    <p className="text-sm text-gray-600">Enter the importer (buyer) business details</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Building2 className="w-4 h-4 inline mr-2" />
                      Importer Business Name (Required)
                    </label>
                    <Input
                      type="text"
                      name="importerName"
                      value={formData.importerName}
                      onChange={handleInputChange}
                      placeholder="ABC Trading Company Ltd"
                      required
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Globe className="w-4 h-4 inline mr-2" />
                      Importer Business Address (Required)
                    </label>
                    <Input
                      type="text"
                      name="importerAddress"
                      value={formData.importerAddress}
                      onChange={handleInputChange}
                      placeholder="123 Business Street, City, Country"
                      required
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country (Required)
                    </label>
                    <Input
                      type="text"
                      name="importerCountry"
                      value={formData.importerCountry}
                      onChange={handleInputChange}
                      placeholder="United States"
                      required
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4 inline mr-2" />
                      Importer Wallet Address (Required)
                    </label>
                    <Input
                      type="text"
                      name="importerWalletAddress"
                      value={formData.importerWalletAddress}
                      onChange={handleInputChange}
                      placeholder="0x..."
                      required
                      className="w-full font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The importer's wallet address on Etherlink network
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Importer Verification (KYB) */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Importer Verification (KYB)</h2>
                    <p className="text-sm text-gray-600">Verify the importer's business information</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Importer Details</p>
                    <div className="space-y-1 text-sm text-blue-800">
                      <p><strong>Name:</strong> {formData.importerName}</p>
                      <p><strong>Address:</strong> {formData.importerAddress}</p>
                      <p><strong>Country:</strong> {formData.importerCountry}</p>
                      <p><strong>Wallet:</strong> {formData.importerWalletAddress ? `${formData.importerWalletAddress.slice(0, 6)}...${formData.importerWalletAddress.slice(-4)}` : 'Not provided'}</p>
                    </div>
                  </div>

                  {!formData.importerVerified && (
                    <div className="text-center py-6">
                      <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                      <p className="text-gray-700 mb-4">
                        Verify the importer's business information using KYB (Know Your Business) verification.
                      </p>
                      <Button
                        type="button"
                        onClick={handleVerifyImporter}
                        disabled={verifyingImporter}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {verifyingImporter ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Start KYB Verification
                          </>
                        )}
                      </Button>
                      
                      {formData.importerKYBStatus === 'verifying' && (
                        <p className="text-sm text-gray-600 mt-4">
                          Verification in progress. This may take a few minutes...
                        </p>
                      )}
                    </div>
                  )}

                  {formData.importerVerified && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800 font-medium">Importer Verified ✓</p>
                      </div>
                      <p className="text-sm text-green-700 mt-2">
                        Importer business verification completed successfully.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 4: Trade Details */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Trade Details</h2>
                    <p className="text-sm text-gray-600">Enter invoice and trade information</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Invoice Number (Required)
                      </label>
                      <Input
                        type="text"
                        name="invoiceNumber"
                        value={formData.invoiceNumber}
                        onChange={handleInputChange}
                        placeholder="INV-2024-001"
                        required
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <DollarSign className="w-4 h-4 inline mr-2" />
                        Invoice Amount (USDC) (Required)
                      </label>
                      <Input
                        type="number"
                        name="amountUSD"
                        value={formData.amountUSD}
                        onChange={handleInputChange}
                        placeholder="10000"
                        step="0.01"
                        min="0"
                        required
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Due Date (Required)
                      </label>
                      <Input
                        type="date"
                        name="dueDate"
                        value={formData.dueDate}
                        onChange={handleInputChange}
                        required
                        className="w-full"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trade Date (Required)
                      </label>
                      <Input
                        type="date"
                        name="tradeDate"
                        value={formData.tradeDate}
                        onChange={handleInputChange}
                        required
                        className="w-full"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Package className="w-4 h-4 inline mr-2" />
                        Commodity/Product (Required)
                      </label>
                      <Input
                        type="text"
                        name="commodity"
                        value={formData.commodity}
                        onChange={handleInputChange}
                        placeholder="Agricultural products, Electronics, etc."
                        required
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shipping Terms
                      </label>
                      <select
                        name="shippingTerms"
                        value={formData.shippingTerms}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="FOB">FOB (Free On Board)</option>
                        <option value="CIF">CIF (Cost, Insurance, Freight)</option>
                        <option value="EXW">EXW (Ex Works)</option>
                        <option value="DDP">DDP (Delivered Duty Paid)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Terms
                      </label>
                      <select
                        name="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="Net 30">Net 30</option>
                        <option value="Net 60">Net 60</option>
                        <option value="Net 90">Net 90</option>
                        <option value="Cash on Delivery">Cash on Delivery</option>
                        <option value="Letter of Credit">Letter of Credit</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe the goods or services being traded..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 5: Trade Documents */}
              {currentStep === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Trade Documents</h2>
                    <p className="text-sm text-gray-600">Upload required trade documents for verification</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Invoice Document (Required) *
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileChange('invoiceDocument', e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                      {formData.invoiceDocument && (
                        <p className="text-xs text-green-600 mt-1">✓ {formData.invoiceDocument.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Bill of Lading (Required) *
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileChange('billOfLading', e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                      {formData.billOfLading && (
                        <p className="text-xs text-green-600 mt-1">✓ {formData.billOfLading.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Certificate of Origin (Required) *
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileChange('certificateOfOrigin', e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                      {formData.certificateOfOrigin && (
                        <p className="text-xs text-green-600 mt-1">✓ {formData.certificateOfOrigin.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Purchase Order (Optional)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileChange('purchaseOrder', e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      {formData.purchaseOrder && (
                        <p className="text-xs text-green-600 mt-1">✓ {formData.purchaseOrder.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Trade Contract (Optional)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileChange('contract', e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      {formData.contract && (
                        <p className="text-xs text-green-600 mt-1">✓ {formData.contract.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> All documents will be uploaded to IPFS and used for trade verification. 
                      Make sure all documents are clear and legible.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 6: Trade Verification */}
              {currentStep === 6 && (
                <motion.div
                  key="step6"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Trade Verification</h2>
                    <p className="text-sm text-gray-600">Verify the authenticity of the trade and documents</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-blue-900 mb-3">Verification Checklist</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        {formData.exporterVerified ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={formData.exporterVerified ? 'text-green-700' : 'text-red-700'}>
                          Exporter Verified (KYC)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.importerVerified ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={formData.importerVerified ? 'text-green-700' : 'text-red-700'}>
                          Importer Verified (KYB)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.invoiceDocument && formData.billOfLading && formData.certificateOfOrigin ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={formData.invoiceDocument && formData.billOfLading && formData.certificateOfOrigin ? 'text-green-700' : 'text-red-700'}>
                          Required Documents Uploaded
                        </span>
                      </div>
                    </div>
                  </div>

                  {!formData.tradeVerified && (
                    <div className="text-center py-6">
                      <Verified className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                      <p className="text-gray-700 mb-4">
                        Verify the trade authenticity by checking documents and trade details.
                      </p>
                      <Button
                        type="button"
                        onClick={handleVerifyTrade}
                        disabled={verifyingTrade || !formData.invoiceDocument || !formData.billOfLading || !formData.certificateOfOrigin}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {verifyingTrade ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Verifying Trade...
                          </>
                        ) : (
                          <>
                            <Verified className="w-4 h-4 mr-2" />
                            Verify Trade
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {formData.tradeVerified && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800 font-medium">Trade Verified ✓</p>
                      </div>
                      <p className="text-sm text-green-700 mt-2">
                        Trade verification completed successfully. You can now proceed to tokenize the receivable.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 7: Review & Tokenize */}
              {currentStep === 7 && (
                <motion.div
                  key="step7"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Review & Tokenize</h2>
                    <p className="text-sm text-gray-600">Review all information before tokenizing the receivable</p>
                  </div>

                  {/* Verification Status */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-green-900 mb-2">All Verifications Complete ✓</p>
                    <div className="space-y-1 text-sm text-green-800">
                      <p>✓ Exporter Verified (KYC)</p>
                      <p>✓ Importer Verified (KYB)</p>
                      <p>✓ Trade Verified</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Exporter Information</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Name:</strong> {formData.exporterName}</p>
                        <p><strong>Wallet:</strong> {formData.exporterAddress ? `${formData.exporterAddress.slice(0, 6)}...${formData.exporterAddress.slice(-4)}` : 'N/A'}</p>
                        <p><strong>Country:</strong> {formData.exporterCountry}</p>
                        <p><strong>Status:</strong> <StatusBadge status="verified" size="sm" /></p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Importer Information</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Name:</strong> {formData.importerName}</p>
                        <p><strong>Address:</strong> {formData.importerAddress}</p>
                        <p><strong>Country:</strong> {formData.importerCountry}</p>
                        <p><strong>Wallet:</strong> {formData.importerWalletAddress ? `${formData.importerWalletAddress.slice(0, 6)}...${formData.importerWalletAddress.slice(-4)}` : 'N/A'}</p>
                        <p><strong>Status:</strong> <StatusBadge status="verified" size="sm" /></p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Trade Details</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Invoice Number:</strong> {formData.invoiceNumber}</p>
                        <p><strong>Amount:</strong> ${formData.amountUSD} USDC</p>
                        <p><strong>Due Date:</strong> {formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : 'N/A'}</p>
                        <p><strong>Commodity:</strong> {formData.commodity}</p>
                        <p><strong>Trade Date:</strong> {formData.tradeDate ? new Date(formData.tradeDate).toLocaleDateString() : 'N/A'}</p>
                        <p><strong>Shipping Terms:</strong> {formData.shippingTerms}</p>
                        <p><strong>Payment Terms:</strong> {formData.paymentTerms}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
                      <div className="space-y-1 text-sm">
                        {formData.invoiceDocument && <p>✓ Invoice: {formData.invoiceDocument.name}</p>}
                        {formData.billOfLading && <p>✓ Bill of Lading: {formData.billOfLading.name}</p>}
                        {formData.certificateOfOrigin && <p>✓ Certificate of Origin: {formData.certificateOfOrigin.name}</p>}
                        {formData.purchaseOrder && <p>✓ Purchase Order: {formData.purchaseOrder.name}</p>}
                        {formData.contract && <p>✓ Contract: {formData.contract.name}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Ready to Tokenize:</strong> All verifications are complete. Click the button below to create the trade receivable on the blockchain.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep === 1 ? () => navigate('/dashboard/receivables') : handlePrevious}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {currentStep === 1 ? 'Cancel' : 'Previous'}
              </Button>

              <div className="flex gap-2">
                {currentStep < totalSteps ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!validateStep(currentStep)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={loading || !formData.exporterVerified || !formData.importerVerified || !formData.tradeVerified}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Tokenizing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Tokenize Receivable
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateReceivableEnhanced;

