# CORS Error Fix Guide

## Understanding the Error

**Error**: `Access to XMLHttpRequest at 'http://localhost:4001/api/auth/check-wallet/...' from origin 'https://www.tbafrica.xyz' has been blocked by CORS policy`

### Root Cause
The production frontend (`https://www.tbafrica.xyz`) is trying to connect to a **localhost backend** (`http://localhost:4001`), which browsers block for security reasons.

### Why This Happens
1. **Missing Environment Variable**: `VITE_API_URL` is not set in production
2. **Hardcoded Fallbacks**: Some code has `localhost:4001` as fallback
3. **Environment Mismatch**: Production frontend pointing to development backend

## Solutions

### Solution 1: Set Production Environment Variables

**For Production Frontend Deployment (Vercel/Render/etc):**

Set the environment variable:
```
VITE_API_URL=https://your-backend-url.com/api
```

**Example for Render.com backend:**
```
VITE_API_URL=https://trustbridge-backend.onrender.com/api
```

### Solution 2: Update Backend CORS Configuration

Ensure your backend `main.ts` includes the production frontend domain:

```typescript
app.enableCors({
  origin: [
    'https://www.tbafrica.xyz',
    'https://tbafrica.xyz',
    process.env.FRONTEND_URL || 'http://localhost:3000',
  ],
  credentials: true,
});
```

### Solution 3: Fix Hardcoded Localhost References

I've already fixed these files:
- ✅ `contractService.ts` - Removed hardcoded localhost
- ✅ `marketplace-contract.service.ts` - Removed hardcoded localhost  
- ✅ `PoolDetailPage.tsx` - Removed localhost fallback
- ✅ `AssetOwnerDashboard.tsx` - Removed localhost fallback

### Solution 4: Verify Environment Variable Usage

All API calls should use:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error('VITE_API_URL is not configured');
}
```

## Deployment Checklist

### Frontend (Vercel/Render)
- [ ] Set `VITE_API_URL` environment variable to production backend URL
- [ ] Rebuild and redeploy frontend
- [ ] Verify environment variable is loaded: Check browser console for API calls

### Backend (Render.com)
- [ ] Ensure CORS includes `https://www.tbafrica.xyz`
- [ ] Set `FRONTEND_URL` environment variable
- [ ] Restart backend server

## Testing

After fixing:

1. **Check Browser Console**: Should see API calls going to production backend, not localhost
2. **Network Tab**: Verify requests are to `https://your-backend.com/api/...` not `http://localhost:4001`
3. **CORS Headers**: Backend should return `Access-Control-Allow-Origin: https://www.tbafrica.xyz`

## Common Issues

### Issue: Environment variable not loading
**Fix**: In Vite, environment variables must be prefixed with `VITE_` and the app must be rebuilt

### Issue: Still seeing localhost calls
**Fix**: Clear browser cache, hard refresh (Ctrl+Shift+R), or rebuild frontend

### Issue: Backend CORS still blocking
**Fix**: Check backend logs, verify CORS origin list includes production domain

## Quick Fix Commands

```bash
# Frontend - Check environment variables
cd trustbridge-frontend
cat .env

# Backend - Check CORS configuration
cd trustbridge-backend
grep -A 5 "enableCors" src/main.ts

# Verify API URL is set
echo $VITE_API_URL
```

