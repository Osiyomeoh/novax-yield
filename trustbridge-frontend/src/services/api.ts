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

export const apiService = {
  // Generic HTTP methods
  get: (url: string, config?: any) => apiClient.get(url, config).then(res => res.data),
  post: (url: string, data?: any, config?: any) => apiClient.post(url, data, config).then(res => res.data),
  put: (url: string, data?: any, config?: any) => apiClient.put(url, data, config).then(res => res.data),
  delete: (url: string, config?: any) => apiClient.delete(url, config).then(res => res.data),
  
  // Analytics
  getMarketAnalytics: () => apiClient.get('/external/analytics/overview').then(res => res.data),
  getRealTimeAnalytics: () => apiClient.get('/external/analytics/stats').then(res => res.data),
  
  // Assets
  getAssets: (params?: any) => apiClient.get('/assets', { params }).then(res => res.data),
  getAsset: (id: string) => apiClient.get(`/assets/${id}`).then(res => res.data),
  createAsset: (data: any) => apiClient.post('/assets', data).then(res => res.data),
  createRWAAsset: (data: any) => apiClient.post('/assets/rwa', data).then(res => res.data), // Use RWA endpoint for RWA assets
  createAssetWithTokenization: (data: any) => apiClient.post('/assets/create-with-tokenization', data).then(res => res.data),
  getFeaturedAssets: () => apiClient.get('/assets/featured').then(res => res.data),
  getAssetsByOwner: (owner: string) => apiClient.get(`/assets/owner/${owner}`).then(res => res.data),
  
  // Portfolio
  getPortfolio: (userId?: string) => apiClient.get('/portfolio', { params: { userId } }).then(res => res.data),
  
  // Investments
  getInvestments: () => apiClient.get('/investments').then(res => res.data),
  createInvestment: (data: any) => apiClient.post('/investments', data).then(res => res.data),
  
  // Mantle blockchain operations
  tokenizeAsset: (data: any) => apiClient.post('/rwa/tokenize', data).then(res => res.data),
  mintTokens: (data: any) => apiClient.post('/rwa/mint', data).then(res => res.data),
  getTokenInfo: (tokenId: string) => apiClient.get(`/assets/${tokenId}`).then(res => res.data),
  
  // Verification - Asset Owner APIs
  submitVerification: (data: any) => apiClient.post('/verification/submit', data).then(res => res.data),
  getVerificationStatus: (assetId: string) => apiClient.get(`/verification/${assetId}`).then(res => res.data),
  getMyVerifications: (params?: any) => apiClient.get('/verification/my-verifications', { params }).then(res => res.data),
  updateVerification: (verificationId: string, data: any) => apiClient.put(`/verification/${verificationId}`, data).then(res => res.data),
  cancelVerification: (verificationId: string) => apiClient.delete(`/verification/${verificationId}`).then(res => res.data),
  
  // IPFS File Management
  getPresignedUrl: (data: any) => apiClient.post('/ipfs/presigned-url', data).then(res => res.data),
  getFile: (cid: string) => apiClient.get(`/ipfs/file/${cid}`).then(res => res.data),
  pinFile: (data: any) => apiClient.post('/ipfs/pin', data).then(res => res.data),
  unpinFile: (cid: string) => apiClient.delete(`/ipfs/unpin/${cid}`).then(res => res.data),
  getFileMetadata: (cid: string) => apiClient.get(`/ipfs/metadata/${cid}`).then(res => res.data),
  listPinnedFiles: () => apiClient.get('/ipfs/list').then(res => res.data),
  
  // Legacy file upload (for backward compatibility)
  uploadVerificationDocument: (verificationId: string, formData: FormData) => apiClient.post(`/verification/${verificationId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data),
  uploadVerificationPhoto: (verificationId: string, formData: FormData) => apiClient.post(`/verification/${verificationId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data),
  
  // Verification - Attestor APIs
  getAttestorAssignments: (params?: any) => apiClient.get('/verification/attestor/assignments', { params }).then(res => res.data),
  getVerificationDetails: (verificationId: string) => apiClient.get(`/verification/attestor/${verificationId}`).then(res => res.data),
  submitAttestation: (verificationId: string, data: any) => apiClient.post(`/verification/attestor/${verificationId}/attest`, data).then(res => res.data),
  updateAttestation: (verificationId: string, data: any) => apiClient.put(`/verification/attestor/${verificationId}/attest`, data).then(res => res.data),
  getAttestorStats: () => apiClient.get('/verification/attestor/stats').then(res => res.data),
  getAttestorProfile: () => apiClient.get('/verification/attestor/profile').then(res => res.data),
  updateAttestorProfile: (data: any) => apiClient.put('/verification/attestor/profile', data).then(res => res.data),
  
  // Verification - Admin APIs
  getAllVerifications: (params?: any) => apiClient.get('/verification/admin/all', { params }).then(res => res.data),
  assignAttestor: (verificationId: string, attestorId: string) => apiClient.post(`/verification/admin/${verificationId}/assign`, { attestorId }).then(res => res.data),
  getAttestors: (params?: any) => apiClient.get('/verification/admin/attestors', { params }).then(res => res.data),
  createAttestor: (data: any) => apiClient.post('/verification/admin/attestors', data).then(res => res.data),
  updateAttestor: (attestorId: string, data: any) => apiClient.put(`/verification/admin/attestors/${attestorId}`, data).then(res => res.data),
  deactivateAttestor: (attestorId: string) => apiClient.delete(`/verification/admin/attestors/${attestorId}`).then(res => res.data),
  
  // Auth
  loginWithEmail: (credentials: any) => apiClient.post('/auth/email', credentials).then(res => res.data),
  loginWithWallet: (walletData: any) => apiClient.post('/auth/wallet', walletData).then(res => res.data),
  completeProfile: (profileData: any) => apiClient.post('/auth/complete-profile', profileData).then(res => res.data),
  verifyEmail: (data: { token: string }) => apiClient.post('/auth/verify-email', data).then(res => res.data),
  resendVerification: (email: string) => apiClient.post('/auth/resend-verification', { email }, { timeout: 20000 }).then(res => res.data), // 20 second timeout for email sending
  getProfile: () => apiClient.get('/auth/me').then(res => res.data),
  checkWalletUser: (address: string) => apiClient.get(`/auth/check-wallet/${address}`).then(res => res.data),
  checkEmailUser: (email: string) => apiClient.get(`/auth/check-email/${encodeURIComponent(email)}`).then(res => res.data),
  refreshToken: (refreshToken: string) => apiClient.post('/auth/refresh', { refreshToken }).then(res => res.data),
  logout: () => apiClient.post('/auth/logout').then(res => res.data),
  
  // KYC
  startKYC: () => apiClient.post('/kyc/start').then(res => res.data),
  checkKYCStatus: (inquiryId: string) => apiClient.get(`/kyc/status/${inquiryId}`).then(res => res.data),
  getKYCInquiry: (inquiryId: string) => apiClient.get(`/kyc/inquiry/${inquiryId}`).then(res => res.data),
  updateKYCStatus: (inquiryId: string, status: string) => apiClient.post('/auth/kyc/update-status', { inquiryId, status }).then(res => res.data), 
  getKYCStatus: () => apiClient.get('/auth/kyc/status').then(res => res.data),
  
  // Token generation for verified users
  generateToken: (walletAddress: string) => apiClient.post('/auth/generate-token', { walletAddress }).then(res => res.data),
  
  // AMC Pools
  getAMCPools: (params?: any) => apiClient.get('/amc-pools', { params }).then(res => res.data),
  getAMCPool: (poolId: string) => apiClient.get(`/amc-pools/${poolId}`).then(res => res.data),
  getActiveAMCPools: () => apiClient.get('/amc-pools/active').then(res => res.data),
}