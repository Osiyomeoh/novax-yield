import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, FileText, ArrowRight, CheckCircle, Shield, AlertCircle, TreePine, Truck, Building, DollarSign, Wrench, Package } from 'lucide-react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

const AssetTypeSelector: React.FC = () => {
  const navigate = useNavigate();
  const { user, startKYC } = useAuth();
  const { toast } = useToast();
  const isKYCApproved = user?.kycStatus?.toLowerCase() === 'approved';

  // Navigate to Novax receivables creation flow
  const handleCreateReceivable = () => {
    if (!isKYCApproved) {
      toast({
        title: 'KYC Required',
        description: 'Please complete KYC verification to create trade receivables.',
        variant: 'destructive'
      });
      return;
    }
    navigate('/dashboard/create-receivable');
  };

  const handleSelectAssetType = (route: string) => {
    if (!isKYCApproved) {
      toast({
        title: 'KYC Required',
        description: 'Please complete KYC verification to create assets.',
        variant: 'destructive'
      });
      return;
    }
    navigate(route);
  };

  const handleStartKYC = async () => {
    try {
      await startKYC();
      toast({
        title: 'KYC Verification Started',
        description: 'A new tab has opened for KYC verification. Please complete the verification to create assets.',
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
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Create Trade Receivable</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Tokenize your trade receivables and make them available for investment through Novax Yield pools.
          </p>
        </motion.div>

        {/* Direct to RWA Creation */}
        <div className="flex justify-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {!isKYCApproved ? (
              <Button
                variant="outline"
                size="lg"
                className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 px-8 py-4"
                onClick={handleStartKYC}
              >
                <Shield className="w-5 h-5 mr-2" />
                Complete KYC First
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4"
                onClick={handleCreateReceivable}
              >
                <FileText className="w-5 h-5 mr-2" />
                Create Trade Receivable
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </motion.div>
        </div>

        {/* Receivables Info */}
        <motion.div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What are Trade Receivables?</h3>
          <p className="text-gray-700 mb-4">
            Trade receivables are amounts owed to your business by customers for goods or services delivered. 
            By tokenizing these receivables, you can:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-gray-900 mb-1">Access Liquidity</div>
                <p className="text-gray-600">Get immediate funding instead of waiting for payment terms</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-gray-900 mb-1">Pool Investment</div>
                <p className="text-gray-600">Your receivables become part of investment pools for investors</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-gray-900 mb-1">Verified & Secure</div>
                <p className="text-gray-600">AMC verification ensures receivables meet quality standards</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-gray-900 mb-1">Transparent Process</div>
                <p className="text-gray-600">All receivables are recorded on-chain for transparency</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* KYC Banner */}
        {!isKYCApproved && (
          <motion.div
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  KYC Verification Required
                </h3>
                <p className="text-yellow-800 mb-4">
                  You need to complete identity verification before creating assets. This ensures compliance and security for all platform participants.
                </p>
                <Button
                  onClick={handleStartKYC}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Start KYC Verification
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info Box */}
        <motion.div
          className="bg-blue-50 border border-blue-200 rounded-lg p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            How Receivable Creation Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-blue-800">
            <div>
              <div className="font-semibold mb-1">1. Complete KYC</div>
              <p className="text-blue-700">Verify your identity to create receivables</p>
            </div>
            <div>
              <div className="font-semibold mb-1">2. Create Receivable</div>
              <p className="text-blue-700">Submit invoice details and supporting documents</p>
            </div>
            <div>
              <div className="font-semibold mb-1">3. AMC Verification</div>
              <p className="text-blue-700">AMC reviews and verifies your receivable</p>
            </div>
            <div>
              <div className="font-semibold mb-1">4. Pool Creation</div>
              <p className="text-blue-700">Verified receivables can be pooled for investment</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AssetTypeSelector;

