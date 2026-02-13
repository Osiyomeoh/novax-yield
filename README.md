# Novax Yield - Trade Receivables Financing Platform

**Trade Receivables Tokenization on Etherlink - Connecting Africa & Asia**

**Live Platform:** [novaxyield.com](https://novaxyield.com) | **Documentation:** [Documentation Page](https://novaxyield.com/documentation) | **One-Pager Pitch:** [View on Google Drive](https://drive.google.com/file/d/1hNhHUClXNU4i8NvwcMFX35VmI_VbwpSH/view?usp=sharing)

---

## Quick Start

**Novax Yield is built on Etherlink** - an EVM-compatible blockchain optimized for real-world asset tokenization and cross-border trade financing.

### Why Etherlink?

- **Low Gas Fees** - Perfect for fractional ownership and micro-investments
- **High Throughput** - Handles thousands of asset tokenizations
- **EVM Compatibility** - Seamless MetaMask integration
- **Scalable Architecture** - Ideal for scaling RWA tokenization across Africa and Asia

### Installation

```bash
# Clone repository
git clone https://github.com/Osiyomeoh/TrustBridgeAfrica.git
cd TrustBridgeAfrica

# Install backend dependencies
cd trustbridge-backend && npm install

# Install frontend dependencies
cd ../trustbridge-frontend && npm install

# Install contract dependencies
cd ../trustbridge-backend/contracts && npm install
```

### Setup

1. **Backend Setup**:
   ```bash
   cd trustbridge-backend
   cp .env.example .env
   # Edit .env with your configuration
   npm run start:dev
   ```

2. **Frontend Setup**:
   ```bash
   cd trustbridge-frontend
   cp env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

3. **Deploy Contracts**:
   ```bash
   cd trustbridge-backend/contracts
   cp env.example .env
   # Configure Etherlink Network RPC and private keys
   npx hardhat deploy --network etherlink_testnet
   ```

---

## The Vision

Novax Yield enables **exporters and importers** to access immediate liquidity from trade receivables (invoices) and **investors** to earn sustainable yields (8-12% APY) from financing cross-border trade between Africa and Asia.

### Mission
**Democratize $200B+ in African and Asian trade receivables** via:
- **Trade Receivables Financing**: Tokenize invoices for immediate liquidity
- **Etherlink Network**: Low-cost EVM blockchain for fast, cheap transactions
- **Smart Contracts**: Automated pool creation, investment, and yield distribution
- **Staking Vault**: Auto-deploy capital to pools with dynamic capacity management
- **Real Yields**: 8-12% APY from actual trade receivables, not speculation

---

## The Problem: Untapped Wealth in Africa & Asia

### **The Challenge**
Africa and Asia hold **$2+ trillion in "dead capital"** - assets that cannot be used as collateral, invested, or accessed by global markets:

1. **No Banking Infrastructure**
   - 65% of Africans are unbanked (400M+ people)
   - 30%+ of Asians lack access to formal banking (1B+ people)
   - No credit history → No access to capital
   - Cash economy limits investment

2. **Illiquid Assets**
   - $350B+ in real estate owned but not tradeable (Africa)
   - $500B+ in Asian real estate without liquidity
   - $150B+ in agricultural land without deed registration
   - $200B+ in Asian trade receivables waiting for financing
   - Asset owners can't prove ownership or asset value

3. **Traditional Banks Fail**
   - Banks require credit history → excludes millions
   - High fees (5-15%) eat into small business margins
   - Slow processing (days/weeks) prevents agility
   - Geographic limitations (urban-focused branches)
   - Bureaucratic lending processes

4. **Digital Divide**
   - 60% don't have internet access (Africa)
   - 40% lack reliable internet (parts of Asia)
   - 70% use basic phones (not smartphones)
   - Limited crypto knowledge or wallet infrastructure

5. **Limited Investment Access**
   - Local investors can't diversify globally
   - International investors can't access regional assets
   - Fragmented markets prevent liquidity
   - Cross-border trade financing is complex and expensive

### **The Solution: Novax Yield**

Novax Yield **tokenizes trade receivables** (invoices) on Etherlink, enabling exporters to get paid immediately while investors earn sustainable yields from financing cross-border trade:

#### **For Exporters (Business Owners)**
- **Tokenize Trade Receivables** - Convert unpaid invoices into liquid assets
- **Access Immediate Capital** - Get paid upfront (typically 80-90% of invoice value)
- **No Credit History Required** - On-chain verification replaces traditional banking
- **Low Fees** - 2-3% platform fees vs 5-15% traditional factoring
- **Fast Processing** - Days instead of weeks
- **Global Access** - Reach international investors directly
- **Transparent Process** - All transactions recorded on-chain

#### **For Investors (Local & Global)**
- **Real Yields** - Earn 8-12% APY from actual trade receivables
- **Fractional Investment** - Invest as little as $100 in high-value invoices
- **Diversification** - Access Africa-Asia trade corridors
- **Staking Vault** - Stake USDC for 8.5-12% APY with auto-deployment
- **Auto-Compounding** - Reinvest yields automatically for higher returns
- **Transparency** - All transactions recorded on-chain
- **AMC-Managed** - Professional verification and oversight

#### **For Stakers**
- **Stake USDC** - Deposit USDC in staking vault (not NVX)
- **Tiered APY** - Choose from 4 tiers (Silver: 8.5%, Gold: 9.5%, Platinum: 10.5%, Diamond: 12%)
- **Auto-Deployment** - Vault automatically deploys capital to receivable pools
- **Auto-Compounding** - Monthly compounding for higher returns
- **Dynamic Capacity** - Vault size managed based on deal flow
- **Waitlist System** - Fair allocation when vault is full

#### **NVX Token Benefits**
- **NVX Token** - Governance and utility token for the platform
- **Staking Rewards** - Additional rewards for NVX stakers
- **Governance** - Vote on platform proposals
- **Fee Discounts** - Pay platform fees in NVX for discounts

**Live Platform:** [novaxyield.com](https://novaxyield.com)

---

## Complete Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NOVAX YIELD PLATFORM                               │
│                      Built on Etherlink Network                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │              React + TypeScript + Vite                      │            │
│  │  • MetaMask Wallet Integration                              │            │
│  │  • Asset Creation & Management                               │            │
│  │  • Pool Investment Interface                                │            │
│  │  • Real-time ROI Tracking                                   │            │
│  │  • AMC Dashboard                                            │            │
│  │  • Portfolio Management                                     │            │
│  └────────────────────────────────────────────────────────────┘            │
│          ↓                                                                  │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │              NestJS Backend API                             │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │            │
│  │  │ Asset    │  │ AMC      │  │ ROI      │  │ Etherlink│  │            │
│  │  │ Service  │  │ Pools    │  │ Calc     │  │ Service  │  │            │
│  │  │          │  │ Service  │  │ Service  │  │          │  │            │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │            │
│  └────────────────────────────────────────────────────────────┘            │
│          ↓                                                                  │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │                    MongoDB Database                         │            │
│  │  • Users, Assets, Pools, Investments, Earnings             │            │
│  │  • Asset Owner Management, Revenue Reports                 │            │
│  └────────────────────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────────────────┐
│                    ETHERLINK NETWORK (EVM Compatible)                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Smart Contracts (Solidity)                                   │          │
│  │                                                               │          │
│  │  • NovaxReceivableFactory: Trade receivable creation & verification│          │
│  │  • NovaxPoolManager:      Investment pool creation & yield distribution│          │
│  │  • NovaxStakingVault:      USDC staking vault with auto-deployment│          │
│  │  • VaultCapacityManager:  Dynamic capacity management│          │
│  │  • AutoCompounder:        Automatic yield reinvestment│          │
│  │  • NVXToken:              Platform utility token (NVX)│          │
│  │  • PoolToken:             ERC-20 tokens for pool investments│          │
│  │                                                               │          │
│  │  Features:                                                    │          │
│  │  • Fractional ownership (18 decimals for micro-investments)  │          │
│  │  • Secondary trading (on-chain & DEX compatible)          │          │
│  │  • Redeeming (burn tokens for TRUST)                        │          │
│  │  • Tranche support (Senior/Junior)                           │          │
│  │  • Real-time ROI calculation                                 │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  IPFS (Pinata) - Decentralized Storage                       │          │
│  │                                                               │          │
│  │  • Asset Metadata:    RWA details & documentation           │          │
│  │  • Evidence Files:    Legal documents, photos               │          │
│  │  • Immutable Links:   Content-addressed storage             │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  External Integrations                                        │          │
│  │                                                               │          │
│  │  • Chainlink Oracles:   Real-time price feeds               │          │
│  │  • Google AI (Gemini):  Investment analysis                 │          │
│  │  • MetaMask:            Wallet integration                   │          │
│  └──────────────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Implemented Features - Production Ready

### Trade Receivables Financing

Novax Yield focuses on **Trade Receivables** - unpaid invoices from cross-border trade between Africa and Asia that can be tokenized and financed.

#### **Complete Flow: From Invoice to Yield**

```
1. EXPORTER CREATES RECEIVABLE
   ↓
   Exporter uploads invoice documents to IPFS
   ↓
   NovaxReceivableFactory.createReceivable()
   ↓
   Status: PENDING_VERIFICATION

2. AMC VERIFIES RECEIVABLE
   ↓
   AMC contacts importer off-chain
   ↓
   Importer approves invoice
   ↓
   Legal contract signed (assignment to AMC)
   ↓
   NovaxReceivableFactory.verifyReceivable()
   ↓
   Status: VERIFIED (with risk score & APR)

3. AMC CREATES POOL
   ↓
   NovaxPoolManager.createPool()
   ↓
   VaultCapacityManager.recordDealVolume()
   ↓
   Pool created with target amount & APR
   ↓
   Status: ACTIVE

4. CAPITAL DEPLOYMENT
   ↓
   Option A: Staking Vault Auto-Deploys
   ├─ NovaxStakingVault.deployToPool()
   └─ Capital automatically deployed from vault
   ↓
   Option B: Individual Investors
   ├─ Investors invest USDC
   └─ Receive pool tokens
   ↓
   Status: FUNDED

5. EXPORTER GETS PAID
   ↓
   Exporter receives USDC immediately
   ↓
   (80-90% of invoice value)

6. IMPORTER PAYS (90 days later)
   ↓
   Importer pays invoice amount + yield
   ↓
   AMC collects payment (on-chain or off-chain)
   ↓
   NovaxPoolManager.recordPayment()
   ↓
   Status: PAID

7. YIELD DISTRIBUTION
   ↓
   NovaxPoolManager.distributeYield()
   ↓
   If vault invested: Yield sent to vault
   ├─ Vault distributes to stakers proportionally
   └─ Auto-compounding if enabled
   ↓
   If individual investors: Yield sent directly
   ├─ USDC returned to investors
   └─ Pool tokens burned
   ↓
   Status: CLOSED
```

**Technical Implementation:**
- **IPFS**: `PinataService` uploads invoice documents → returns CID
- **Smart Contracts**: `NovaxReceivableFactory.createReceivable()` creates on-chain receivable
- **Verification**: AMC verifies with `verifyReceivable()` setting risk score & APR
- **Pool Creation**: `NovaxPoolManager.createPool()` creates investment pool
- **Auto-Deployment**: `NovaxStakingVault.deployToPool()` automatically deploys capital
- **Yield Distribution**: `NovaxPoolManager.distributeYield()` distributes returns
- **Blockchain**: All transactions recorded on Etherlink Network

### Staking Vault System

#### **How Staking Works**
1. **User Stakes USDC**: Deposit USDC in staking vault
2. **Choose Tier**: Select from 4 tiers (Silver, Gold, Platinum, Diamond)
3. **Auto-Deployment**: Vault automatically deploys capital to receivable pools
4. **Yield Generation**: Pools generate 8-12% APY from receivables
5. **Distribution**: Yield distributed proportionally to stakers
6. **Auto-Compounding**: Monthly compounding if enabled
7. **Unstake**: Withdraw after lock period expires

#### **Staking Tiers**
| Tier | Lock Period | APY | Min Stake |
|------|-------------|-----|-----------|
| **Silver** | 30 days | 8.5% | $1,000 |
| **Gold** | 90 days | 9.5% | $5,000 |
| **Platinum** | 180 days | 10.5% | $10,000 |
| **Diamond** | 365 days | 12% | $25,000 |

#### **Capacity Management**
- **Dynamic Cap**: Vault size = 3x monthly deal volume
- **Auto-Deployment**: Capital automatically deployed to new pools
- **Waitlist System**: When vault is full, new stakers join waitlist
- **Waitlist APY**: 5% APY from DeFi while waiting
- **Auto-Promotion**: Waitlist stakers promoted when capacity increases

#### **Auto-Compounding**
- **Monthly Compounding**: Yield reinvested every 30 days
- **Compound Formula**: A = P(1 + r/n)^(n*t)
- **Higher Returns**: Compounding increases effective APY
- **Example**: 8.5% APY with compounding = ~8.8% effective APY

### NVX Token Economy

The **NVX token** is the governance and utility token for the Novax Yield platform.

#### **Tokenomics**
- **Total Supply**: 1 Billion NVX tokens
- **Distribution**: 
  - 40% Community (rewards, staking, liquidity mining)
  - 20% Team & Advisors (vested 4 years)
  - 15% Investors (vested 3 years)
  - 15% Ecosystem Fund (AMCs, partnerships)
  - 5% Treasury Reserve
  - 5% Liquidity Pool

#### **Use Cases**
1. **Governance**: Vote on platform proposals and decisions
2. **Staking Rewards**: Additional NVX rewards for stakers
3. **Fee Payment**: Pay platform fees in NVX (30% discount)
4. **Liquidity Mining**: Provide liquidity to earn NVX
5. **Investment Rewards**: Receive NVX when investing in pools

#### **Governance (DAO)**
- **Proposal System**: NVX holders can submit proposals
- **Voting**: Weighted by NVX holdings
- **Minimum Threshold**: 1,000 NVX to submit, 100 NVX to vote
- **Execution**: Automated via smart contracts

### AI-Powered Analytics

#### **Google Gemini Integration**
- **Investment Analysis**: AI recommendations based on user profile
- **Risk Assessment**: ML-powered portfolio scoring
- **Market Intelligence**: Real-time trend analysis
- **Content Generation**: Marketing materials & descriptions

**Implementation:**
- Google AI Studio API calls from backend
- TRUST token gating for AI services
- Rate limiting and usage tracking
- Multi-modal AI (text, image, video)

### Analytics Dashboard

#### **Real-Time Data**
- **TVL**: Sum of all asset values
- **Active Users**: MongoDB user count
- **Geographic Distribution**: Countries with assets
- **Asset Categories**: Breakdown by sector
- **Pools**: Investment pool statistics

**Implementation:**
- Backend aggregates from Etherlink Network + MongoDB
- HCS topic queries for asset count
- Real-time updates via polling
- Charts and visualizations in frontend

---

## Technology Stack

### **Frontend**
```typescript
React 18 + TypeScript + Vite + Tailwind CSS
├── UI Components (shadcn/ui)
├── State Management (Context API + Hooks)
├── Wallet Integration (WalletConnect + HashPack)
├── USSD Simulator (Custom React Component)
├── Analytics Dashboard (Recharts + Custom Charts)
└── Responsive Design (Mobile-First)
```

### **Backend**
```typescript
NestJS + MongoDB + JWT + Swagger
├── Asset Management Service
├── AMC Pool Management Service
├── USSD Handler Service
├── Etherlink Network Integration Layer
├── IPFS Service (Pinata)
├── Google AI Service
├── Analytics Service
└── Admin Management Service
```

### **Blockchain (Etherlink Network)**
```typescript
Ethers.js + Hardhat
├── Smart Contracts: CoreAssetFactory, PoolManager, AMCManager
├── ERC-20 Tokens: TrustToken, PoolToken
├── Web3 Integration: MetaMask, WalletConnect
└── Contract Deployment: Hardhat deployment scripts
```

---

## Business Model & Market Value

### Revenue Streams

#### **1. Transaction Fees**
- **RWA Trading**: 1-3% of transaction value
- **Pool Investments**: Platform fee on all investments
- **Yield Distribution**: Fee on dividend payments

#### **2. Listing Fees**
- **Asset Creation**: One-time listing fee for RWAs
- **AMC Pool Launch**: Pool creation fee
- **Premium Listings**: Featured placement fees

#### **3. Subscription Revenue**
- **AMC Licenses**: Monthly/annual AMC licensing fees
- **Enterprise Plans**: Large-scale institutional plans
- **Premium Features**: Advanced analytics & tools

#### **4. Tokenomics**
- **TRUST Token**: Platform utility creates demand
- **Burn Mechanism**: Deflationary supply
- **Staking Rewards**: Lock tokens for rewards
- **Governance**: Voting rights drive value

#### **5. API & Data**
- **Market Data**: Sell aggregated market insights
- **API Access**: Developer API subscriptions
- **White-Label**: License platform to institutions

### Total Addressable Market (TAM)

| Market Segment | Size (Africa) | Size (Asia) | Total | Novax Yield Capture |
|----------------|----------------|-------------|-------|---------------------|
| **Agriculture** | $150B+ | $200B+ | $350B+ | 0.1% = $350M |
| **Real Estate** | $350B+ | $500B+ | $850B+ | 0.1% = $850M |
| **Commodities** | $100B+ | $150B+ | $250B+ | 0.1% = $250M |
| **Infrastructure** | $50B+ | $100B+ | $150B+ | 0.1% = $150M |
| **Trade Receivables** | $50B+ | $200B+ | $250B+ | 0.1% = $250M |
| **TOTAL TAM** | **$700B+** | **$1.15T+** | **$1.85T+** | **$1.85B+** |

### Competitive Advantages

| Feature | Traditional RWA | Novax Yield |
|---------|----------------|-------------|
| **Access** | Web3 savvy only | USSD + Web |
| **Fees** | $50-200 per txn | $0.001 |
| **Speed** | Minutes-hours | 3 seconds |
| **Gas** | User pays | Sponsor covers |
| **Mobile** | Smartphone only | Basic phone OK |
| **Yields** | Synthetic | Real asset-backed |
| **Compliance** | Light | KYC/AML + AMC |

### Growth Trajectory

**Year 1**: 10K users, 1,000 assets, $10M volume  
**Year 2**: 50K users, 5,000 assets, $50M volume  
**Year 3**: 200K users, 20,000 assets, $200M volume  
**Year 5**: 1M users, 100,000 assets, $1B volume  

---

## Complete User Flows

### Exporter: "Export Company Ltd"

**Scenario**: Export company has $100,000 unpaid invoice from importer in Asia, needs immediate cash flow

**Flow**:
```
1. Visit novaxyield.com and connect wallet (Privy/MetaMask)
   ↓
2. Navigate to "Create Receivable"
   ↓
3. Enter invoice details:
   - Amount: $100,000
   - Due Date: 90 days
   - Importer: (off-chain, address can be zero)
   ↓
4. Upload invoice documents to IPFS:
   - Invoice PDF
   - Purchase order
   - Shipping documents
   - Legal contract (assignment to AMC)
   ↓
5. Submit receivable for verification
   ↓
6. NovaxReceivableFactory.createReceivable() on-chain
   ↓
7. Status: PENDING_VERIFICATION
   ↓
8. AMC contacts importer off-chain
   ↓
9. Importer approves invoice
   ↓
10. AMC verifies receivable:
    - Risk Score: 20/100 (low risk)
    - APR: 10% (1000 basis points)
    ↓
11. NovaxReceivableFactory.verifyReceivable()
    ↓
12. Status: VERIFIED
    ↓
13. AMC creates pool:
    - Target: $100,000
    - APR: 10%
    - Maturity: 90 days
    ↓
14. NovaxPoolManager.createPool()
    ↓
15. Staking vault auto-deploys $100,000
    ↓
16. Exporter receives $90,000 USDC immediately
    ↓
17. 90 days later: Importer pays $100,000 + $2,466 yield
    ↓
18. Yield distributed to stakers
    ↓
19. Exporter checks: "Receivables: 1, Paid: $90,000, Status: Paid"
```

**Etherlink Network Transactions**:
- Receivable creation: `NovaxReceivableFactory.createReceivable()`
- Verification: `NovaxReceivableFactory.verifyReceivable()`
- Pool creation: `NovaxPoolManager.createPool()`
- Auto-deployment: `NovaxStakingVault.deployToPool()`
- Payment: `NovaxPoolManager.recordPayment()`
- Yield distribution: `NovaxPoolManager.distributeYield()`

### Investor/Staker: "Sarah from Lagos"

**Scenario**: Sarah wants to earn yield by staking $10,000 USDC

**Flow**:
```
1. Visit novaxyield.com on laptop/phone
   ↓
2. Connect wallet (Privy/MetaMask)
   ↓
3. Complete KYC verification (DidIt)
   ↓
4. Navigate to "Staking Vault"
   ↓
5. View staking tiers:
   - Silver: 30 days, 8.5% APY, $1,000 min
   - Gold: 90 days, 9.5% APY, $5,000 min
   - Platinum: 180 days, 10.5% APY, $10,000 min
   - Diamond: 365 days, 12% APY, $25,000 min
   ↓
6. Select Platinum tier (10.5% APY, 180 days)
   ↓
7. Enter stake amount: $10,000 USDC
   ↓
8. Enable auto-compounding
   ↓
9. Approve USDC spending
   ↓
10. Sign stake transaction
    ↓
11. NovaxStakingVault.stake() on-chain
    ↓
12. $10,000 USDC staked
    ↓
13. Vault auto-deploys to receivable pools
    ↓
14. Sarah views dashboard:
    - Staked: $10,000
    - Tier: Platinum
    - APY: 10.5%
    - Lock Period: 180 days
    - Auto-Compound: Enabled
    - Projected Return (1 year): $11,100
    ↓
15. Monthly compounding:
    - Month 1: $10,000 + $87.50 = $10,087.50
    - Month 2: $10,087.50 + $88.26 = $10,175.76
    - ... (compounding continues)
    ↓
16. After 180 days: Unstake available
    ↓
17. Unstake: Receive principal + yield
    ↓
18. Sarah receives: $10,525 USDC (5.25% for 6 months)
```

**Etherlink Network Transactions**:
- Staking: `NovaxStakingVault.stake()`
- Auto-deployment: `NovaxStakingVault.deployToPool()`
- Yield distribution: `NovaxPoolManager.distributeYield()` → `NovaxStakingVault.receivePayment()`
- Unstaking: `NovaxStakingVault.unstake()`

### AMC Admin: "Mr. Johnson"

**Scenario**: Licensed AMC manager verifying receivables and managing pools

**Flow**:
```
1. Login to AMC Dashboard
   ↓
2. Review pending receivables
   ↓
3. Contact importer off-chain
   ↓
4. Verify invoice approval
   ↓
5. Check legal contract (assignment to AMC)
   ↓
6. Assess risk:
   - Importer creditworthiness
   - Trade history
   - Invoice validity
   ↓
7. Set risk score: 20/100 (low risk)
   ↓
8. Set APR: 10% (1000 basis points)
   ↓
9. Verify receivable on-chain:
    NovaxReceivableFactory.verifyReceivable()
   ↓
10. Create pool:
    - Target: $100,000
    - APR: 10%
    - Maturity: 90 days
    ↓
11. NovaxPoolManager.createPool()
    ↓
12. VaultCapacityManager.recordDealVolume($100k)
    ↓
13. Monitor pool:
    - Status: FUNDED (vault deployed)
    - Exporter paid: $90,000
    ↓
14. 90 days later: Collect payment from importer
    ↓
15. Record payment on-chain:
    NovaxPoolManager.recordPayment()
    ↓
16. Distribute yield:
    NovaxPoolManager.distributeYield()
    ↓
17. Yield sent to staking vault
    ↓
18. Vault distributes to stakers
    ↓
19. Pool status: CLOSED
    ↓
20. Generate reports for regulators
```

---

## Security & Compliance

### **Blockchain Security**
- **On-Chain Audit Trail**: All transactions immutable on Etherlink Network
- **Smart Contracts**: Automated, audited business logic
- **Access Control**: Role-based permissions (AMC, Admin, Operator)
- **Block Explorer**: Real-time transaction verification

### **Platform Security**
- **PIN Security**: Bcrypt hashing, lockout mechanisms
- **JWT Tokens**: Secure API authentication
- **Role-Based Access**: Granular permissions (user, AMC, admin, super admin)
- **KYC/AML**: Didit integration + on-platform checks

### **Data Protection**
- **IPFS Encryption**: End-to-end document encryption
- **GDPR Compliance**: Data privacy controls
- **Session Management**: Secure session handling
- **API Rate Limiting**: DDoS protection


## Platform Metrics

### **Current Status (Testnet)**
| Metric | Value |
|--------|-------|
| **Platform** | novaxyield.com |
| **Blockchain** | Etherlink Shadownet (testnet only) |
| **Assets** | Test RWAs tokenized (test data only) |
| **Users** | Test users (testnet) |
| **Pools** | Test AMC pools (test data only) |
| **Volume** | Test investments (no real money) |
| **Uptime** | 99.9% |
| **Gas Fees** | Ultra-low on Etherlink |
| **Status** | **Testnet with test data only - no real assets or real money** |

### **Technical Performance**
| Metric | Value |
|--------|-------|
| **Transaction Speed** | ~2 seconds finality |
| **Transaction Cost** | Ultra-low on Etherlink |
| **Gas Fees** | Fraction of Ethereum mainnet |
| **API Latency** | <500ms |
| **Frontend Load** | <2s |
| **Database Queries** | <100ms |

---

## Market Opportunity - Africa & Asia

### **Demographics**

**Africa:**
- **Population**: 1.4 billion people
- **Unbanked**: 60% without bank accounts
- **Mobile**: 80% own mobile phones
- **USSD Usage**: 90% of mobile transactions

**Asia:**
- **Population**: 4.7 billion people
- **Unbanked**: 30%+ without bank accounts (1B+ people)
- **Mobile**: 85%+ own mobile phones
- **Digital Payments**: Growing adoption of mobile wallets

### **Asset Classes**

**Africa:**
- **Agriculture**: $150B+ annual output
- **Real Estate**: $350B+ property value
- **Commodities**: $100B+ natural resources
- **Infrastructure**: $50B+ projects needed

**Asia:**
- **Agriculture**: $200B+ annual output
- **Real Estate**: $500B+ property value
- **Commodities**: $150B+ natural resources
- **Infrastructure**: $100B+ projects needed
- **Trade Receivables**: $200B+ in cross-border trade financing

### **Regulatory Environment**

**Africa:**
- **Pro-Blockchain**: Nigeria, Ghana, Kenya, South Africa
- **Financial Inclusion**: Governments driving bankless adoption
- **RWA Frameworks**: Emerging tokenization regulations
- **Tax Incentives**: Favorable for foreign investments

**Asia:**
- **Pro-Blockchain**: Singapore, Hong Kong, UAE, India, Philippines
- **Financial Innovation**: Governments promoting fintech and blockchain
- **RWA Frameworks**: Established and emerging tokenization regulations
- **Trade Finance**: Supportive policies for cross-border trade

---

## Deployment Status

### Testnet Deployment (Current)
- **Backend API**: NestJS backend with MongoDB
- **Frontend**: React + Vite application
- **Database**: MongoDB Atlas
- **Blockchain**: Etherlink Shadownet (testnet only - no real assets)
- **IPFS**: Pinata infrastructure
- **Analytics**: Real-time blockchain data
- **Status**: Platform operates with **test data only** - no real assets, real money, or real investments

### **Smart Contracts Deployed (Testnet)**
| Contract | Address | Purpose |
|----------|---------|---------|
| **NovaxReceivableFactory** | Deployed on Etherlink Shadownet | Trade receivables creation & verification (test data only) |
| **NovaxPoolManager** | Deployed on Etherlink Shadownet | Investment pool creation & yield distribution (test data only) |
| **NovaxStakingVault** | Deployed on Etherlink Shadownet | USDC staking vault with auto-deployment (test data only) |
| **VaultCapacityManager** | Deployed on Etherlink Shadownet | Dynamic capacity management (test data only) |
| **AutoCompounder** | Deployed on Etherlink Shadownet | Automatic yield reinvestment (test data only) |
| **NVXToken** | Deployed on Etherlink Shadownet | Platform utility token (NVX) - test tokens only |
| **MockUSDC** | Deployed on Etherlink Shadownet | Test USDC token for payments (test tokens only) |
| **PoolToken** | Created per pool (testnet) | ERC-20 tokens for pool investments (test data only) |

**Note**: All contracts are deployed on Etherlink Shadownet. No real assets or real money are involved.

---

## Documentation & Resources

### **User Documentation**
- **Getting Started**: [novaxyield.com/documentation](https://novaxyield.com/documentation)
- **For Asset Owners**: Complete tokenization guide
- **For Investors**: Investment walkthrough
- **USSD Guide**: Mobile banking tutorial

### **Developer Resources**
- **API Docs**: [Swagger UI](https://trustbridge-backend.onrender.com/api-docs)
- **GitHub**: [Source Code](https://github.com/Osiyomeoh/TrustBridgeAfrica)
- **Etherlink Network**: [Documentation](https://docs.etherlink.com)

---

## Partnerships

### **Blockchain**
- **Etherlink Network** - EVM Compatible blockchain
- **Privy** - Wallet provider (MetaMask + social login)
- **Pinata** - IPFS storage partner
- **Chainlink** - Oracle price feeds (planned)

### **Financial Inclusion (Planned)**
- **Africa's Talking** - USSD gateway integration (Planned)
- **Paga** - Production payment processing (Planned)
- **MTN/Airtel/Orange** - USSD infrastructure (Planned)

### **Institutions**
- **AMCs**: Licensed asset management companies
- **Real Estate Firms**: Property developers
- **Agricultural Co-ops**: Farming collectives
- **Government**: Financial inclusion partnerships

---

## Roadmap

### Q1 2026 - Complete
- Core RWA tokenization platform
- AMC pool management system
- Etherlink Network integration
- Analytics dashboard
- Smart contract deployment
- IPFS storage
- Google AI integration
- Trust Token economy
- Real yield system
- ROI calculation & tracking
- Asset owner management
- Fraud prevention system

### Q2 2026
- Mobile apps (iOS/Android)
- DeFi lending/borrowing
- Cross-chain bridges
- Advanced analytics

---

## Why Novax Yield Wins

### **1. First-Mover in African & Asian Trade Receivables Financing**
No platform offers trade receivables tokenization on Etherlink with real yields (8-12% APY), connecting Africa and Asia

### **2. Blockchain-Native Architecture**
Built entirely on Etherlink Network (EVM Compatible) for speed & low cost

### **3. Actual Market Need**
60% of Africans and 30%+ of Asians are unbanked but own mobile phones → $1.85T+ untapped market

### **4. Regulatory Compliance**
KYC/AML + AMC certification = institutional-ready

### **5. Real Yields**
Actual ROI from assets, not synthetic DeFi products

### **6. Scalable Technology**
Handles millions of users on Etherlink Network's scalable infrastructure

---

## Getting Started

### Wallet Setup - MetaMask Required

**Privy** is the wallet provider used by Novax Yield. Connect with MetaMask or social login to access the platform.

#### **Step 1: Install MetaMask Wallet**
- **Chrome/Brave**: [Download MetaMask Extension](https://metamask.io/download/)
- **Firefox**: [Download MetaMask Add-on](https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/)
- **Mobile**: [iOS App Store](https://apps.apple.com/app/metamask/id1438144202) | [Google Play Store](https://play.google.com/store/apps/details?id=io.metamask)

#### **Step 2: Create MetaMask Account**
1. Install extension/add-on
2. Open MetaMask
3. Click **"Create a Wallet"**
4. **Save your recovery phrase** (12 words) - write it down securely!
5. Create password
6. Wallet created!

#### **Step 3: Connect to Etherlink Shadownet**
Novax Yield uses **Etherlink Shadownet** for all transactions.

1. Connect your wallet (MetaMask or social login via Privy)
2. The platform will automatically connect to Etherlink Shadownet
3. If using MetaMask, you may need to add the network:
   - **Network Name**: Etherlink Shadownet
   - **RPC URL**: `https://node.shadownet.etherlink.com`
   - **Chain ID**: `127823`
   - **Currency Symbol**: `XTZ`
   - **Block Explorer**: `https://explorer.shadownet.etherlink.com`

#### **Step 4: Get Free Test Tokens**
You need test tokens to pay for transactions on Testnet:

**Get Test XTZ (for gas):**
1. Visit Etherlink faucet (if available)
2. Enter your wallet address
3. Request test tokens for gas fees

**Get Test USDC:**
1. Connect wallet to Novax Yield platform
2. Use the USDC faucet (if available)
3. Or request from admin

#### **Step 5: Connect to Novax Yield**
1. Visit [novaxyield.com](https://novaxyield.com)
2. Click **"Connect Wallet"** or **"Sign In"**
3. Choose MetaMask or social login (Google, email)
4. Approve connection
5. Connected!

---

**For Developers**:
1. Connect wallet to Etherlink Shadownet
2. Get test tokens from faucet
3. Clone repo: `git clone https://github.com/Osiyomeoh/TrustBridgeAfrica.git`
4. Configure `.env` files with Etherlink RPC and private keys
5. Deploy contracts: `cd trustbridge-backend/contracts && npx hardhat deploy --network etherlink_testnet`
6. Run `npm run dev`

**For Investors**:
1. Connect wallet (MetaMask or social login)
2. Connect to Etherlink Shadownet
3. Get test tokens
4. Connect to platform
5. Browse pools and start investing

---

## Team

### **Core Team**

*[Team bios to be added - please provide team member information]*

#### **Founders & Leadership**
- **Samuel Aleonomoh**
  - **Role**: Founder & CEO
  - **Bio**: Visionary leader building Africa's first real-world asset tokenization platform on blockchain
  - **Contact**: [samuelaleonomoh5@gmail.com](mailto:samuelaleonomoh5@gmail.com)

#### **Design Team**
- **Blessing**
  - **Role**: Designer
  - **Bio**: Creative designer crafting intuitive user experiences for Novax Yield
  - **Contact**: [samuelaleonomoh5@gmail.com](mailto:samuelaleonomoh5@gmail.com)

### **Contact Information**

- **General Inquiries**: [samuelaleonomoh5@gmail.com](mailto:samuelaleonomoh5@gmail.com)
- **Business Partnerships**: [samuelaleonomoh5@gmail.com](mailto:samuelaleonomoh5@gmail.com)
- **Technical Support**: [samuelaleonomoh5@gmail.com](mailto:samuelaleonomoh5@gmail.com)
- **Media & Press**: [samuelaleonomoh5@gmail.com](mailto:samuelaleonomoh5@gmail.com)
- **Website**: [novaxyield.com](https://novaxyield.com)
- **GitHub**: [github.com/Osiyomeoh/TrustBridgeAfrica](https://github.com/Osiyomeoh/TrustBridgeAfrica)

---

## Compliance Declaration

### **IMPORTANT: Testnet Status**

**CURRENT STATUS**: Novax Yield is currently operating on **Etherlink Shadownet** with **test data only**. **No real assets are being tokenized or traded on the platform at this time.** All assets, pools, investments, and transactions are for testing and demonstration purposes only.

### **Regulated Assets Disclosure**

**Novax Yield** is designed to operate a trade receivables financing platform that facilitates the tokenization and financing of cross-border trade invoices between Africa and Asia:

- **Real Estate** (commercial and residential properties)
- **Agricultural Assets** (farmland, agribusiness, agricultural equipment)
- **Infrastructure Assets** (roads, bridges, renewable energy projects)
- **Commodities** (natural resources, mining assets)
- **Equipment** (machinery, vehicles, industrial equipment)

### **Regulatory Status**

**IMPORTANT DISCLOSURE**: When Novax Yield transitions to mainnet and begins tokenizing real trade receivables, the platform will involve **regulated assets** and will be subject to securities regulations, financial services regulations, and other applicable laws in various jurisdictions. **Currently, the platform operates on testnet with test data only and does not involve any real assets or regulated activities.**

#### **Key Regulatory Considerations**

1. **Securities Regulations**
   - Pool tokens and fractional ownership interests may constitute **securities** under applicable laws
   - Platform operates with **Asset Management Company (AMC) oversight** to ensure compliance
   - All pools are managed by **licensed Asset Management Companies** subject to regulatory supervision

2. **Financial Services Regulations**
   - Platform may be subject to **financial services licensing** requirements in various jurisdictions
   - **KYC/AML compliance** implemented for all users
   - **Anti-Money Laundering (AML)** and **Know Your Customer (KYC)** procedures enforced

3. **Asset-Specific Regulations**
   - **Real Estate**: Subject to property laws, land registration requirements, and real estate regulations
   - **Agricultural Assets**: Subject to agricultural and land use regulations
   - **Commodities**: Subject to commodity trading and resource extraction regulations

4. **Cross-Border Considerations**
   - Platform serves users across multiple African and Asian jurisdictions and globally
   - Compliance with **local regulations** in each jurisdiction where assets are located
   - Compliance with **investor jurisdiction regulations** where applicable
   - **Trade Receivables**: Cross-border trade financing between Africa and Asia requires compliance with both regions

### **Compliance Measures**

Novax Yield is designed to implement the following compliance measures when operating on mainnet with real trade receivables:

- **KYC/AML Procedures**: Will be required for all users before using the platform with real assets  
- **AMC Oversight**: All tokenized assets will be reviewed and managed by licensed Asset Management Companies  
- **Smart Contract Audits**: All smart contracts undergo security audits before deployment  
- **Regulatory Monitoring**: Ongoing monitoring of regulatory developments in relevant jurisdictions  
- **Legal Documentation**: Comprehensive legal documentation for asset tokenization and pool creation  
- **Transparent Reporting**: All transactions recorded on-chain for auditability and transparency  

**Note**: On testnet, these measures are simulated for testing purposes only.  

### **Jurisdictional Compliance**

**Note**: The following compliance requirements will apply when Novax Yield transitions to mainnet and begins tokenizing real trade receivables:

**Africa:**
- **Nigeria**: Will operate in compliance with SEC regulations and financial services laws
- **Ghana**: Will adhere to Securities and Exchange Commission requirements
- **Kenya**: Will comply with Capital Markets Authority regulations
- **South Africa**: Will adhere to Financial Sector Conduct Authority requirements

**Asia:**
- **Singapore**: Will comply with Monetary Authority of Singapore (MAS) regulations
- **Hong Kong**: Will adhere to Securities and Futures Commission requirements
- **UAE**: Will comply with local financial services regulations
- **India**: Will adhere to Securities and Exchange Board of India (SEBI) requirements
- **Philippines**: Will comply with Securities and Exchange Commission regulations

**Other Jurisdictions**: Platform expansion subject to local regulatory approval

**Current Status**: Platform is on testnet only - no regulatory compliance required for test data.

### **Risk Disclosures**

**TESTNET DISCLAIMER**: The platform currently operates on testnet with test data only. No real money, real assets, or real investments are involved.

**When operating on mainnet with real assets, investors should be aware that**:

- Tokenized assets may be subject to **regulatory changes** that could affect their value or transferability
- **Regulatory actions** in any jurisdiction could impact platform operations
- **Securities laws** may restrict the transfer or trading of pool tokens in certain jurisdictions
- **Asset ownership** is subject to local property laws and regulations
- **Tax implications** may vary by jurisdiction for both asset owners and investors

### **Legal Disclaimer**

**TESTNET STATUS**: Novax Yield is currently operating on Etherlink Shadownet with test data only. No real assets, real money, or real investments are involved. All transactions, assets, and pools are for testing and demonstration purposes only.

**This platform is not intended to provide legal, financial, or investment advice. Users should consult with qualified legal and financial advisors before participating in asset tokenization or making investment decisions. Novax Yield does not guarantee regulatory compliance in all jurisdictions and users are responsible for ensuring their participation complies with applicable laws in their jurisdiction.**

**When the platform transitions to mainnet with real assets, all applicable regulatory requirements will be implemented and enforced.**

### **Regulatory Updates**

Novax Yield (TrustBridge) is committed to maintaining compliance with evolving regulatory frameworks when operating on mainnet with real assets. For the latest regulatory information and compliance updates, please contact us at [samuelaleonomoh5@gmail.com](mailto:samuelaleonomoh5@gmail.com).

---

**TrustBridge Africa** - *Where Real-World Assets Meet Blockchain Innovation*

*Built on Etherlink Network • Global Trading Platform • Connecting Asia & Africa to International Markets • Real Yields from Real Assets*

---

© 2026 Novax Yield (TrustBridge). All rights reserved.  
**Live**: [tbafrica.xyz](https://tbafrica.xyz) | **Docs**: [Documentation](https://tbafrica.xyz/documentation)
