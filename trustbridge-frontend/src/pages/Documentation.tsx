import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Book, 
  Zap, 
  TrendingUp, 
  Wallet, 
  Shield, 
  Coins, 
  CircleHelp,
  Menu,
  X,
  Search,
  ChevronRight,
  ExternalLink,
  Code,
  FileText,
  Users,
  Globe,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/UI/Button';

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  subsections: {
    id: string;
    title: string;
    content: React.ReactNode;
  }[];
}

const Documentation: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('getting-started');
  const [activeSubsection, setActiveSubsection] = useState<string>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Update active subsection when section changes
  useEffect(() => {
    const section = docSections.find(s => s.id === activeSection);
    if (section && section.subsections.length > 0) {
      setActiveSubsection(section.subsections[0].id);
    }
  }, [activeSection]);

  const docSections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Zap,
      subsections: [
        {
          id: 'overview',
          title: 'Overview',
          content: (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-4">Welcome to TrustBridge Africa</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Novax Yield is a global trading platform for real-world asset (RWA) tokenization and trade receivables financing built on Etherlink Network. 
                  We enable African asset owners to tokenize their assets, making them accessible to global investors 
                  through blockchain technology.
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
                <h3 className="text-xl font-semibold mb-3">What is TrustBridge?</h3>
                <p className="text-gray-700 mb-4">
                  TrustBridge is a decentralized platform that bridges real-world assets (RWAs) with blockchain technology. 
                  We specialize in tokenizing African assets including agriculture, real estate, and infrastructure, 
                  enabling fractional ownership and global investment access.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    For Asset Owners
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Tokenize your real-world assets and unlock new funding opportunities. 
                    Access global capital markets through blockchain technology.
                  </p>
                  <Link to="#asset-owners" className="text-blue-600 hover:underline">
                    Learn more →
                  </Link>
                </div>
                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-blue-600" />
                    For Investors
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Invest in diversified African assets through blockchain-powered pools. 
                    Earn returns while supporting African economic development.
                  </p>
                  <Link to="#investors" className="text-blue-600 hover:underline">
                    Learn more →
                  </Link>
                </div>
              </div>
            </div>
          )
        },
        {
          id: 'quick-start',
          title: 'Quick Start Guide',
          content: (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">Quick Start Guide</h2>
              
              <div className="space-y-6">
                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold mb-3">Step 1: Install MetaMask</h3>
                  <p className="text-gray-600 mb-4">
                    MetaMask is required to interact with TrustBridge. Download and install it from:
                  </p>
                  <a 
                    href="https://metamask.io" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-2"
                  >
                    metamask.io <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold mb-3">Step 2: Connect to Etherlink Shadownet</h3>
                  <p className="text-gray-600 mb-4">
                    Connect to Etherlink Shadownet (automatic via Privy):
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
                    <div className="mb-2"><strong>Network Name:</strong> Etherlink Shadownet</div>
                    <div className="mb-2"><strong>RPC URL:</strong> https://node.shadownet.etherlink.com</div>
                    <div className="mb-2"><strong>Chain ID:</strong> 127823</div>
                    <div className="mb-2"><strong>Currency Symbol:</strong> XTZ</div>
                    <div><strong>Block Explorer:</strong> https://explorer.shadownet.etherlink.com</div>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold mb-3">Step 3: Get Test Tokens</h3>
                  <p className="text-gray-600 mb-4">
                    Get free test tokens from our faucet to start using the platform:
                  </p>
                  <Link to="/get-test-tokens">
                    <Button variant="outline">Get Test Tokens</Button>
                  </Link>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold mb-3">Step 4: Connect Wallet</h3>
                  <p className="text-gray-600 mb-4">
                    Connect your MetaMask wallet to TrustBridge and complete your profile.
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold mb-3">Step 5: Complete KYC</h3>
                  <p className="text-gray-600 mb-4">
                    Complete Know Your Customer (KYC) verification via Didit to unlock full platform access.
                  </p>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'asset-owners',
      title: 'For Asset Owners',
      icon: TrendingUp,
      subsections: [
        {
          id: 'tokenization',
          title: 'Asset Tokenization',
          content: (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">Tokenize Your Assets</h2>
              
              <p className="text-lg text-gray-600 mb-6">
                Transform your real-world assets and trade receivables into tradeable digital tokens on the Etherlink blockchain. 
                This enables fractional ownership and access to global capital markets.
              </p>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded mb-6">
                <h3 className="text-xl font-semibold mb-3">Supported Asset Types</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Agriculture:</strong> Farms, crops, livestock, agricultural equipment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Real Estate:</strong> Commercial and residential properties</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Infrastructure:</strong> Roads, bridges, utilities, public works</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Commodities:</strong> Natural resources, minerals, energy</span>
                  </li>
                </ul>
              </div>

              <h3 className="text-2xl font-semibold mb-4">Tokenization Process</h3>
              
              <div className="space-y-6">
                <div className="border rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
                    <div>
                      <h4 className="text-xl font-semibold mb-2">Connect & Verify</h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        <li>Connect your MetaMask wallet</li>
                        <li>Complete KYC verification via Didit</li>
                        <li>Verify your email address</li>
                        <li>Complete your profile</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
                    <div>
                      <h4 className="text-xl font-semibold mb-2">Create Your Asset</h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        <li>Navigate to "Create RWA Asset" in the dashboard</li>
                        <li>Fill in asset details (name, type, location, value)</li>
                        <li>Upload supporting documents and evidence</li>
                        <li>Set your expected APY (Annual Percentage Yield)</li>
                        <li>Set maximum investable percentage</li>
                        <li>Review and submit for AMC approval</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
                    <div>
                      <h4 className="text-xl font-semibold mb-2">AMC Approval</h4>
                      <p className="text-gray-600 mb-2">
                        Your asset will be reviewed by our Asset Management Company (AMC) team. Once approved:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        <li>Your asset receives a unique token ID on Etherlink</li>
                        <li>Metadata is stored on IPFS (decentralized storage)</li>
                        <li>Asset status is updated on-chain via smart contracts</li>
                        <li>Asset becomes available for pooling</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">4</div>
                    <div>
                      <h4 className="text-xl font-semibold mb-2">Pool Creation & Investment</h4>
                      <p className="text-gray-600 mb-2">
                        AMC may bundle your asset into a pool with other assets:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        <li>Pool tokens are created as ERC-20 tokens on Etherlink</li>
                        <li>Pool becomes available for investment</li>
                        <li>You earn returns as investments are made</li>
                        <li>Track earnings in your portfolio dashboard</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'investors',
      title: 'For Investors',
      icon: Wallet,
      subsections: [
        {
          id: 'investing',
          title: 'How to Invest',
          content: (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">Invest in African Assets</h2>
              
              <p className="text-lg text-gray-600 mb-6">
                Access diversified investment opportunities in African agriculture, real estate, and infrastructure 
                through blockchain-powered pools.
              </p>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded mb-6">
                <h3 className="text-xl font-semibold mb-2">⚠️ Important Disclaimer</h3>
                <p className="text-gray-700">
                  Investments are subject to asset performance and market conditions. Returns are not guaranteed. 
                  Always conduct due diligence before investing. This platform is for educational and testing purposes.
                </p>
              </div>

              <h3 className="text-2xl font-semibold mb-4">Investment Process</h3>
              
              <div className="space-y-6">
                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3">Step 1: Setup Your Account</h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li>Connect MetaMask wallet to TrustBridge</li>
                    <li>Complete profile and KYC verification</li>
                    <li>Ensure you have MNT for gas fees</li>
                    <li>Get TRUST tokens for investments (via Exchange)</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3">Step 2: Browse Investment Opportunities</h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li>Visit the Marketplace or AMC Pools section</li>
                    <li>Filter by asset type, APY, location, or risk level</li>
                    <li>Review asset details and documentation</li>
                    <li>Check AMC verification status</li>
                    <li>Review pool structure and tranches (if applicable)</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3">Step 3: Make an Investment</h4>
                  <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>Click "Invest" on a pool or asset</li>
                    <li>Select tranche type (Senior or Junior) if applicable</li>
                    <li>Enter investment amount (minimum investment applies)</li>
                    <li>Review transaction details and expected returns</li>
                    <li>Approve TRUST token spending (if first time)</li>
                    <li>Approve the investment transaction in MetaMask</li>
                    <li>Wait for transaction confirmation</li>
                    <li>Receive pool tokens on Etherlink</li>
                  </ol>
                </div>

                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3">Step 4: Track Returns</h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li>Monitor your portfolio in the dashboard</li>
                    <li>Track APY and cumulative returns</li>
                    <li>View real-time ROI calculations</li>
                    <li>Receive dividends automatically as TRUST tokens</li>
                    <li>View transaction history on Etherlink Explorer</li>
                    <li>Redeem investments when pool matures</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded mt-6">
                <h3 className="text-xl font-semibold mb-3">Understanding Pool Tranches</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Senior Tranche</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Lower risk, lower returns</li>
                      <li>• Priority in payouts</li>
                      <li>• Typically 70% of pool</li>
                      <li>• Lower APY (~8-10%)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Junior Tranche</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Higher risk, higher returns</li>
                      <li>• Secondary in payouts</li>
                      <li>• Typically 30% of pool</li>
                      <li>• Higher APY (~15-20%)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'technical',
      title: 'Technical Docs',
      icon: Code,
      subsections: [
        {
          id: 'architecture',
          title: 'Architecture',
          content: (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">Technical Architecture</h2>
              
              <p className="text-lg text-gray-600 mb-6">
                Novax Yield is built on Etherlink's EVM-compatible blockchain infrastructure, 
                providing low fees, high throughput, and seamless Ethereum compatibility.
              </p>

              <h3 className="text-2xl font-semibold mb-4">Blockchain Infrastructure</h3>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    Etherlink Network
                  </h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li><strong>Type:</strong> EVM-compatible Layer 2</li>
                    <li><strong>Chain ID:</strong> 5003 (Sepolia Testnet)</li>
                    <li><strong>Gas Fees:</strong> ~$0.001 per transaction</li>
                    <li><strong>Finality:</strong> Fast block confirmation</li>
                    <li><strong>Explorer:</strong> <a href="https://explorer.shadownet.etherlink.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">explorer.shadownet.etherlink.com</a></li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Smart Contracts
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <h5 className="font-semibold mb-2">CoreAssetFactory</h5>
                      <p className="text-sm text-gray-600">Creates and manages RWA assets as ERC-721 NFTs</p>
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">PoolManager</h5>
                      <p className="text-sm text-gray-600">Manages investment pools and tranches</p>
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">AMCManager</h5>
                      <p className="text-sm text-gray-600">Handles asset approval and management</p>
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">TrustToken</h5>
                      <p className="text-sm text-gray-600">Platform utility token (ERC-20)</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Token Standards
                  </h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li><strong>ERC-721:</strong> Unique tokens for individual RWA assets</li>
                    <li><strong>ERC-20:</strong> Pool tokens, tranche tokens, and TRUST token</li>
                    <li><strong>Metadata:</strong> Stored on IPFS (decentralized storage)</li>
                  </ul>
                </div>
              </div>

              <h3 className="text-2xl font-semibold mb-4 mt-8">Storage & Infrastructure</h3>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3">IPFS (InterPlanetary File System)</h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li>Decentralized metadata storage</li>
                    <li>Evidence documents and legal files</li>
                    <li>Immutable content addressing (CIDs)</li>
                    <li>Powered by Pinata infrastructure</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3">Wallet Integration</h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li><strong>MetaMask:</strong> Primary wallet for web interface</li>
                    <li><strong>WalletConnect:</strong> Standard protocol for connections</li>
                    <li><strong>Rainbow Kit:</strong> Wallet connection UI library</li>
                  </ul>
                </div>
              </div>
            </div>
          )
        },
        {
          id: 'api',
          title: 'API Reference',
          content: (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">API Reference</h2>
              
              <p className="text-lg text-gray-600 mb-6">
                TrustBridge provides RESTful APIs for interacting with the platform programmatically.
              </p>

              <div className="bg-gray-50 border rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold mb-3">Base URL</h3>
                <code className="text-sm bg-white px-3 py-2 rounded border block">
                  {import.meta.env.VITE_API_URL || 'https://api.trustbridge.africa'}
                </code>
              </div>

              <h3 className="text-2xl font-semibold mb-4">Authentication</h3>
              <p className="text-gray-600 mb-4">
                Most endpoints require authentication via JWT token in the Authorization header:
              </p>
              <div className="bg-gray-50 border rounded-lg p-4">
                <code className="text-sm">
                  Authorization: Bearer {'<token>'}
                </code>
              </div>

              <h3 className="text-2xl font-semibold mb-4 mt-8">Endpoints</h3>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-semibold">GET /amc-pools</h4>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Public</span>
                  </div>
                  <p className="text-gray-600 mb-2">Get all active investment pools</p>
                  <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                    GET /api/amc-pools
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-semibold">GET /amc-pools/:poolId</h4>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Public</span>
                  </div>
                  <p className="text-gray-600 mb-2">Get pool details by ID</p>
                  <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                    GET /api/amc-pools/{'{poolId}'}
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-semibold">POST /amc-pools/:poolId/invest</h4>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Auth</span>
                  </div>
                  <p className="text-gray-600 mb-2">Invest in a pool</p>
                  <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                    POST /api/amc-pools/{'{poolId}'}/invest
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded mt-6">
                <h3 className="text-xl font-semibold mb-2">Full API Documentation</h3>
                <p className="text-gray-700 mb-4">
                  For complete API documentation, visit our Swagger UI:
                </p>
                <a 
                  href={`${import.meta.env.VITE_API_URL || 'https://api.trustbridge.africa'}/api-docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-2"
                >
                  View API Docs <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'trust-token',
      title: 'TRUST Token',
      icon: Coins,
      subsections: [
        {
          id: 'overview',
          title: 'Overview',
          content: (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">TRUST Token Economy</h2>
              
              <p className="text-lg text-gray-600 mb-6">
                TRUST is the native platform token powering the TrustBridge ecosystem. Use it for fees, 
                governance, staking, and investments.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">What is TRUST?</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>Platform utility token on Etherlink blockchain</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>ERC-20 standard token</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>Used for platform fees and investments</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>Governance and staking capabilities</span>
                    </li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">How to Get TRUST</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold mb-2">Exchange MNT for TRUST</h4>
                      <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                        <li>Visit "Exchange" in the sidebar</li>
                        <li>Select "Swap MNT → TRUST"</li>
                        <li>Enter amount and approve transaction</li>
                      </ol>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Earn Through Participation</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>Platform rewards</li>
                        <li>Referral bonuses</li>
                        <li>Early adopter programs</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-6 bg-blue-50">
                <h3 className="text-xl font-semibold mb-3">Using TRUST Tokens</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Platform Operations</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Pay platform fees</li>
                      <li>• Invest in AMC pools</li>
                      <li>• Access premium features</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Governance & Staking</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Vote on DAO proposals</li>
                      <li>• Stake for rewards</li>
                      <li>• Participate in governance</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'faq',
      title: 'FAQ',
      icon: CircleHelp,
      subsections: [
        {
          id: 'general',
          title: 'General Questions',
          content: (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>
              
              <div className="space-y-6">
                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">What is RWA Tokenization?</h3>
                  <p className="text-gray-600">
                    RWA (Real-World Asset) tokenization converts physical assets like farms, real estate, 
                    or machinery into digital tokens on a blockchain. This allows fractional ownership and 
                    global investment access while maintaining transparency and immutability.
                  </p>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">Why Etherlink Network?</h3>
                  <p className="text-gray-600 mb-3">
                    Etherlink offers several advantages:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>EVM-compatibility for seamless Ethereum integration</li>
                    <li>Ultra-low gas fees (~$0.001 per transaction)</li>
                    <li>High throughput and fast finality</li>
                    <li>Modular Layer 2 architecture</li>
                    <li>Support for ERC-20 and ERC-721 tokens</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">Do I need crypto to use TrustBridge?</h3>
                  <p className="text-gray-600">
                    Yes, you need XTZ (native token) for transaction fees. The platform may 
                    sponsor gas fees for select transactions. For testnet, you can get free test tokens 
                    from our faucet.
                  </p>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">How do I get XTZ?</h3>
                  <p className="text-gray-600 mb-3">
                    For mainnet: Purchase XTZ on exchanges or bridge from other networks to Etherlink.
                  </p>
                  <p className="text-gray-600">
                    For testnet: Use our "Get Test Tokens" feature for free test tokens.
                  </p>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">What are the fees?</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li><strong>Etherlink Network:</strong> ~$0.001 per transaction</li>
                    <li><strong>IPFS Storage:</strong> Free (via Pinata)</li>
                    <li><strong>Platform Fees:</strong> Subject to governance</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">Is my asset data secure?</h3>
                  <p className="text-gray-600">
                    Yes. Metadata is stored on decentralized IPFS, transactions are immutable on Etherlink, 
                    and your wallet keys never leave your device. We use industry-standard encryption and 
                    follow best practices for security.
                  </p>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">Can I sell my tokens?</h3>
                  <p className="text-gray-600">
                    Token liquidity depends on market demand. Pools typically have lock periods. 
                    Secondary markets may develop over time. You can redeem investments when pools mature.
                  </p>
                </div>
              </div>
            </div>
          )
        }
      ]
    }
  ];

  const filteredSections = docSections.filter(section => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.subsections.some(sub => 
        sub.title.toLowerCase().includes(query) ||
        (typeof sub.content === 'string' && sub.content.toLowerCase().includes(query))
      )
    );
  });

  const activeSectionData = docSections.find(s => s.id === activeSection);
  const activeSubsectionData = activeSectionData?.subsections.find(s => s.id === activeSubsection);

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden border-b bg-white sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Book className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold">Documentation</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 h-screen lg:h-auto
          w-64 bg-gray-50 border-r border-gray-200
          overflow-y-auto z-40
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Book className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-bold">Documentation</h2>
              </div>
              
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <nav className="space-y-1">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                
                return (
                  <div key={section.id}>
                    <button
                      onClick={() => {
                        setActiveSection(section.id);
                        setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                        transition-colors
                        ${isActive 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {section.title}
                    </button>
                    
                    {isActive && (
                      <div className="ml-7 mt-1 space-y-1">
                        {section.subsections.map((subsection) => (
                          <button
                            key={subsection.id}
                            onClick={() => {
                              setActiveSubsection(subsection.id);
                              setSidebarOpen(false);
                            }}
                            className={`
                              w-full text-left px-3 py-1.5 rounded text-sm
                              transition-colors
                              ${activeSubsection === subsection.id
                                ? 'text-blue-600 font-medium bg-blue-50'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              }
                            `}
                          >
                            {subsection.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {activeSubsectionData ? (
              <motion.div
                key={activeSubsection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {activeSubsectionData.content}
              </motion.div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Select a section to view documentation</p>
              </div>
            )}

            {/* Footer Navigation */}
            {activeSectionData && (
              <div className="mt-12 pt-8 border-t">
                <div className="flex justify-between items-center">
                  <div>
                    {activeSectionData.subsections.findIndex(s => s.id === activeSubsection) > 0 && (
                      <button
                        onClick={() => {
                          const currentIndex = activeSectionData.subsections.findIndex(s => s.id === activeSubsection);
                          setActiveSubsection(activeSectionData.subsections[currentIndex - 1].id);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        ← Previous
                      </button>
                    )}
                  </div>
                  <div>
                    {activeSectionData.subsections.findIndex(s => s.id === activeSubsection) < activeSectionData.subsections.length - 1 && (
                      <button
                        onClick={() => {
                          const currentIndex = activeSectionData.subsections.findIndex(s => s.id === activeSubsection);
                          setActiveSubsection(activeSectionData.subsections[currentIndex + 1].id);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Next →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Documentation;
