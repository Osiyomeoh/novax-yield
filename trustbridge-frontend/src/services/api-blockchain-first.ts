import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL

if (!API_BASE_URL) {
  console.error('⚠️ VITE_API_URL is not configured. API calls will fail.');
  console.error('Please set VITE_API_URL environment variable to your backend URL.');
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth tokens
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      // Don't redirect automatically - let AuthContext handle the flow
      console.log('API 401 error: User not authenticated, clearing tokens but not redirecting')
    }
    return Promise.reject(error)
  }
)

// BLOCKCHAIN-FIRST API SERVICE
// This service only handles auth, KYC, and IPFS operations
// All asset data comes from blockchain via contractService
export const apiService = {
  // Generic HTTP methods
  get: (url: string, config?: any) => apiClient.get(url, config).then(res => res.data),
  post: (url: string, data?: any, config?: any) => apiClient.post(url, data, config).then(res => res.data),
  put: (url: string, data?: any, config?: any) => apiClient.put(url, data, config).then(res => res.data),
  delete: (url: string, config?: any) => apiClient.delete(url, config).then(res => res.data),
  
  // AUTH & KYC (BACKEND ONLY)
  
  // Authentication
  login: (data: any) => apiClient.post('/auth/login', data).then(res => res.data),
  register: (data: any) => apiClient.post('/auth/register', data).then(res => res.data),
  logout: () => apiClient.post('/auth/logout').then(res => res.data),
  refreshToken: () => apiClient.post('/auth/refresh').then(res => res.data),
  
  // KYC & Profile
  submitKYC: (data: any) => apiClient.post('/kyc/submit', data).then(res => res.data),
  getKYCStatus: (userId: string) => apiClient.get(`/kyc/status/${userId}`).then(res => res.data),
  updateProfile: (data: any) => apiClient.put('/profile', data).then(res => res.data),
  getProfile: (userId: string) => apiClient.get(`/profile/${userId}`).then(res => res.data),
  
  // IPFS OPERATIONS (BACKEND ONLY)
  
  // IPFS file upload
  uploadToIPFS: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post('/ipfs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data)
  },
  
  // IPFS file retrieval
  getIPFSFile: (hash: string) => apiClient.get(`/ipfs/${hash}`).then(res => res.data),
  
  // IPFS metadata
  getIPFSMetadata: (hash: string) => apiClient.get(`/ipfs/metadata/${hash}`).then(res => res.data),
  
  // MINIMAL ASSET OPERATIONS (BACKEND ONLY)
  // These are only used for storing minimal metadata and linking to blockchain
  
  // Store minimal asset metadata (for search/indexing only)
  storeAssetMetadata: (data: {
    assetId: string;
    blockchainAddress: string;
    owner: string;
    type: 'DIGITAL' | 'RWA';
    category: string;
    name: string;
    imageHash?: string;
    documentHash?: string;
  }) => apiClient.post('/assets/metadata', data).then(res => res.data),
  
  // Get minimal asset metadata (for search/indexing only)
  getAssetMetadata: (assetId: string) => apiClient.get(`/assets/metadata/${assetId}`).then(res => res.data),
  
  // Search assets by metadata
  searchAssets: (query: string, filters?: any) => 
    apiClient.get('/assets/search', { params: { q: query, ...filters } }).then(res => res.data),
  
  // TRADING OPERATIONS (BACKEND ONLY)
  // These store minimal trading metadata, actual trading happens on blockchain
  
  // Store trading metadata
  storeTradingMetadata: (data: {
    assetId: string;
    transactionHash: string;
    buyer: string;
    seller: string;
    price: string;
    timestamp: number;
  }) => apiClient.post('/trading/metadata', data).then(res => res.data),
  
  // Get trading history
  getTradingHistory: (assetId: string) => apiClient.get(`/trading/history/${assetId}`).then(res => res.data),
  
  // POOL OPERATIONS (BACKEND ONLY)
  // These store minimal pool metadata, actual pool operations happen on blockchain
  
  // Store pool metadata
  storePoolMetadata: (data: {
    poolId: string;
    blockchainAddress: string;
    manager: string;
    name: string;
    description: string;
    totalValue: string;
    investorCount: number;
  }) => apiClient.post('/pools/metadata', data).then(res => res.data),
  
  // Get pool metadata
  getPoolMetadata: (poolId: string) => apiClient.get(`/pools/metadata/${poolId}`).then(res => res.data),
  
  // AMC OPERATIONS (BACKEND ONLY)
  // These store minimal AMC metadata, actual AMC operations happen on blockchain
  
  // Store AMC metadata
  storeAMCMetadata: (data: {
    amcId: string;
    blockchainAddress: string;
    name: string;
    jurisdiction: string;
    manager: string;
    isActive: boolean;
  }) => apiClient.post('/amc/metadata', data).then(res => res.data),
  
  // Get AMC metadata
  getAMCMetadata: (amcId: string) => apiClient.get(`/amc/metadata/${amcId}`).then(res => res.data),
  
  // ANALYTICS (BACKEND ONLY)
  
  // Get market analytics
  getMarketAnalytics: () => apiClient.get('/analytics/market').then(res => res.data),
  
  // Get user analytics
  getUserAnalytics: (userId: string) => apiClient.get(`/analytics/user/${userId}`).then(res => res.data),
  
  // NOTIFICATIONS (BACKEND ONLY)
  
  // Get notifications
  getNotifications: (userId: string) => apiClient.get(`/notifications/${userId}`).then(res => res.data),
  
  // Mark notification as read
  markNotificationRead: (notificationId: string) => 
    apiClient.put(`/notifications/${notificationId}/read`).then(res => res.data),
  
  // HEALTH CHECK
  
  // Health check
  healthCheck: () => apiClient.get('/health').then(res => res.data),
}

export default apiService
