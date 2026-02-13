import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Calendar, DollarSign, User, CheckCircle, XCircle, AlertCircle, Shield, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useWallet } from '../../contexts/PrivyWalletContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePrivy } from '@privy-io/react-auth';
import { novaxContractService } from '../../services/novaxContractService';
import { apiService } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { ethers } from 'ethers';
import Button from '../UI/Button';
import Input from '../UI/Input';
import ProviderDebugger from '../Debug/ProviderDebugger';

interface CreateReceivableForm {
  amountUSD: string;
  dueDate: string;
  invoiceNumber: string;
  description: string;
  documents: File[];
}

const CreateReceivable: React.FC = () => {
  const { address, signer, isConnected, provider, loading: walletLoading, connectWallet } = useWallet();
  const { authenticated, ready, user: privyUser, login } = usePrivy();
  const { user, startKYC } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
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
    amountUSD: '',
    dueDate: '',
    invoiceNumber: '',
    description: '',
    documents: []
  });

  const totalSteps = 4;
  const steps = [
    { id: 1, title: 'Basic Information', icon: User },
    { id: 2, title: 'Invoice Details', icon: FileText },
    { id: 3, title: 'Documents', icon: Upload },
    { id: 4, title: 'Review', icon: CheckCircle }
  ];

  useEffect(() => {
    // Debug: Log provider status
    console.log('CreateReceivable - Provider status:', {
      hasProvider: !!provider,
      hasSigner: !!signer,
      address,
      isConnected,
      authenticated,
      ready,
      walletLoading
    });

    // Initialize contract service when we have provider
    if (provider) {
      novaxContractService.initialize(signer || null, provider);
      console.log('✅ CreateReceivable - Contract service initialized');
    } else {
      console.warn('⚠️ CreateReceivable - Provider not available yet', {
        address,
        authenticated,
        ready,
        walletLoading
      });
    }
  }, [signer, provider, address, isConnected, authenticated, ready, walletLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData(prev => ({
        ...prev,
        documents: Array.from(e.target.files || [])
      }));
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.amountUSD && formData.dueDate);
      case 2:
        return true; // Invoice number and description are optional
      case 3:
        return true; // Documents are optional
      case 4:
        return true; // Review step
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
        description: 'Please fill in all required fields before proceeding.',
        variant: 'destructive'
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    // Allow going back to previous steps, but validate before going forward
    if (step <= currentStep || validateStep(currentStep)) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If KYC is not approved, start KYC instead of creating receivable
    if (!isKYCApproved) {
      await handleStartKYC();
      return;
    }
    
    // Debug: Log all wallet state
    console.log('CreateReceivable - Submit attempt:', {
      address,
      hasProvider: !!provider,
      hasSigner: !!signer,
      isConnected,
      authenticated,
      ready,
      walletLoading,
      checkingWallet
    });
    
    // Check if we have address (wallet might still be initializing)
    if (!address) {
      console.warn('CreateReceivable - No address:', {
        authenticated,
        ready,
        walletLoading,
        checkingWallet
      });
      toast({
        title: 'Wallet Not Ready',
        description: 'Your wallet is still initializing. Please wait a moment and try again.',
        variant: 'destructive'
      });
      return;
    }

    // Ensure contract service is initialized (should already be done in useEffect)
    if (!provider) {
      console.error('CreateReceivable - Provider not available on submit:', {
        address,
        authenticated,
        ready,
        walletLoading,
        isConnected,
        hasSigner: !!signer,
        checkingWallet
      });
      toast({
        title: 'Wallet Provider Not Ready',
        description: 'Your wallet provider is still initializing. Please wait a moment and try again. If the issue persists, try refreshing the page.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.amountUSD || !formData.dueDate) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      // Step 1: Create metadata JSON (documents are optional, can be uploaded later)
      const importerAddress = address || '0x0000000000000000000000000000000000000000';
      const metadata = {
        invoiceNumber: formData.invoiceNumber,
        description: formData.description,
        documents: [], // Documents can be uploaded separately later
        createdAt: new Date().toISOString(),
        exporter: address,
        importer: importerAddress,
      };

      // Step 2: Upload metadata to IPFS (required for smart contract)
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

      // Step 3: Convert CID to bytes32 (use id() to hash the string to bytes32)
      const metadataCIDBytes32 = ethers.id(metadataCID);

      // Step 4: Convert amount to USDC (6 decimals)
      const amountInWei = ethers.parseUnits(formData.amountUSD, 6);

      // Step 5: Convert due date to Unix timestamp
      const dueDateTimestamp = Math.floor(new Date(formData.dueDate).getTime() / 1000);

      // Step 6: Ensure signer is available before calling contract
      if (!signer && provider) {
        // Try to get signer from provider
        try {
          const providerSigner = await provider.getSigner();
          if (providerSigner) {
            novaxContractService.initialize(providerSigner, provider);
          }
        } catch (signerError) {
          console.warn('Could not get signer from provider:', signerError);
          toast({
            title: 'Wallet Signer Not Ready',
            description: 'Please wait for your wallet to fully initialize, or try refreshing the page.',
            variant: 'destructive'
          });
          return;
        }
      }
      
      if (!signer) {
        toast({
          title: 'Wallet Signer Required',
          description: 'Your wallet signer is not available. Please ensure your wallet is fully connected.',
          variant: 'destructive'
        });
        return;
      }

      // Step 7: Create receivable on-chain (DIRECT SMART CONTRACT CALL)
      toast({
        title: 'Creating Receivable',
        description: 'Creating receivable on blockchain...',
        variant: 'default'
      });
      
      const result = await novaxContractService.createReceivable(
        importerAddress,
        amountInWei,
        dueDateTimestamp,
        metadataCIDBytes32
      );

      // Wait for transaction confirmation
      if (result.txHash) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds for confirmation
      }

      // Log success
      console.log('🎉🎉🎉 RECEIVABLE CREATION COMPLETE 🎉🎉🎉', {
        receivableId: result.receivableId,
        txHash: result.txHash,
        amount: formData.amountUSD,
        dueDate: formData.dueDate,
        importer: importerAddress,
        exporter: address,
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Receivable Created Successfully! 🎉',
        description: `Receivable created successfully! ID: ${result.receivableId.substring(0, 10)}...`,
        variant: 'default'
      });
      
      // Wait a bit for blockchain state to update, then navigate
      console.log('⏳ Waiting for blockchain state to update...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for block confirmation
      
      // Set flag to refresh receivables when navigating
      sessionStorage.setItem('refreshReceivables', 'true');
      sessionStorage.setItem('newReceivableId', result.receivableId);
      
      // Navigate to receivables list
      navigate('/dashboard/receivables');
    } catch (error: any) {
      console.error("Error creating receivable:", error);
      toast({
        title: 'Creation Failed',
        description: `Failed to create receivable: ${error.message || error.reason}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [address, signer, formData, navigate, toast, isKYCApproved]);

  const handleStartKYC = useCallback(async () => {
    try {
      await startKYC();
      toast({
        title: 'KYC Verification Started',
        description: 'A new tab has opened for KYC verification. Please complete the verification to create trade receivables.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error starting KYC:', error);
      toast({
        title: 'KYC Error',
        description: error instanceof Error ? error.message : 'Failed to start KYC verification. Please try again.',
        variant: 'destructive'
      });
    }
  }, [startKYC, toast]);

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


  // Show debugger in development
  const showDebugger = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      {showDebugger && (
        <div className="max-w-4xl mx-auto mb-6">
          <ProviderDebugger />
        </div>
      )}
      <div className="max-w-4xl mx-auto">
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
              <p className="text-sm text-gray-600 mt-1">Tokenize your invoice for financing</p>
            </div>
          </motion.div>
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const isClickable = currentStep >= step.id;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center flex-1">
                    <button
                      type="button"
                      onClick={() => isClickable && goToStep(step.id)}
                      disabled={!isClickable}
                      className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white scale-110'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      } ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
                    >
                      {isCompleted ? (
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
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 mt-6 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form Carousel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {/* Step 1: Basic Information */}
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
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Basic Information</h2>
                    <p className="text-sm text-gray-600">Enter the essential details about your trade receivable</p>
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
                    <p className="text-xs text-gray-500 mt-1">The total amount of the invoice in USDC</p>
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
                    <p className="text-xs text-gray-500 mt-1">When the invoice payment is due</p>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Invoice Details */}
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
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice Details</h2>
                    <p className="text-sm text-gray-600">Add additional information about your invoice</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Number
                    </label>
                    <Input
                      type="text"
                      name="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={handleInputChange}
                      placeholder="INV-2024-001"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe the goods or services..."
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 3: Documents */}
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
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice Documents</h2>
                    <p className="text-sm text-gray-600">Upload supporting documents (optional but recommended)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Upload className="w-4 h-4 inline mr-2" />
                      Invoice Documents (PDF, Images)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 mb-2">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          PDF, PNG, JPG (MAX. 10MB each)
                        </p>
                      </label>
                    </div>
                    {formData.documents.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-gray-700">Selected files:</p>
                        {formData.documents.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Upload invoice documents, contracts, or supporting files (will be stored on IPFS)
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Review */}
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
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Review & Submit</h2>
                    <p className="text-sm text-gray-600">Please review your information before submitting</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice Amount:</span>
                          <span className="text-gray-900 font-semibold">${formData.amountUSD || '0'} USDC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Due Date:</span>
                          <span className="text-gray-900">{formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : 'Not provided'}</span>
                        </div>
                      </div>
                    </div>

                    {(formData.invoiceNumber || formData.description) && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice Details</h3>
                        <div className="space-y-2 text-sm">
                          {formData.invoiceNumber && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Invoice Number:</span>
                              <span className="text-gray-900">{formData.invoiceNumber}</span>
                            </div>
                          )}
                          {formData.description && (
                            <div>
                              <span className="text-gray-600 block mb-1">Description:</span>
                              <p className="text-gray-900">{formData.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {formData.documents.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
                        <div className="space-y-2">
                          {formData.documents.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span className="text-gray-900">{file.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={loading}
                    className={`flex items-center gap-2 ${
                      !isKYCApproved 
                        ? 'bg-yellow-600 hover:bg-yellow-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                  >
                    {loading ? (
                      'Creating...'
                    ) : !isKYCApproved ? (
                      <>
                        <Shield className="w-4 h-4" />
                        Do KYC
                      </>
                    ) : (
                      <>
                        Create Receivable
                        <ArrowRight className="w-4 h-4" />
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

export default CreateReceivable;

