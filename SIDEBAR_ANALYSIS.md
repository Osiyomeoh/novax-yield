# Sidebar Menu Analysis

## Current Menu Structure

### Main Navigation (Always Visible)
1. **Marketplace** - `/dashboard/marketplace` ✅ Keep (Core feature)
2. **Profile** - `/dashboard/profile` ✅ Keep (User account)
3. **Analytics** - `/dashboard/analytics` ⚠️ Consider removing (Not essential for RWA focus)
4. **Settings** - `/dashboard/settings` ✅ Keep (User preferences)

### Trading Section (Dropdown)
1. **Trading** - `/dashboard/trading` ❌ Remove (Not RWA-focused)
2. **Secondary Markets** - `/dashboard/secondary-markets` ❌ Remove (Not RWA-focused)

### Investment Section (Dropdown)
1. **Pool Marketplace** - `/pools` ✅ Keep (Core RWA feature)
2. **Pool Management** - `/pool-dashboard` ✅ Keep (AMC pool management)

### Real-World Assets Section (Dropdown)
1. **Create RWA Asset** - `/dashboard/create-rwa-asset` ✅ Keep (Core feature)
2. **RWA Management** - `/dashboard/rwa-management` ✅ Keep (Asset management)
3. **AMC Dashboard** - `/dashboard/amc-dashboard` ✅ Keep (AMC operations)

### Verification Section (Dropdown)
1. **Verification** - `/dashboard/verification` ✅ Keep (Asset verification)

### Admin Section (Dropdown - Admin Only)
1. **Admin Dashboard** - `/dashboard/admin` ✅ Keep (Admin overview)
2. **Asset Management** - `/dashboard/admin/assets` ✅ Keep (Asset approval)
3. **AMC Pool Management** - `/dashboard/admin/amc-pools` ✅ Keep (Pool management)
4. **Dividend Management** - `/dashboard/admin/dividend-management` ✅ Keep (Dividend distribution)

## Recommendations

### Remove These Items:
1. ❌ **Trading** section (entire section)
   - Trading - `/dashboard/trading`
   - Secondary Markets - `/dashboard/secondary-markets`
   - Reason: Not focused on RWA, adds complexity

2. ⚠️ **Analytics** (main nav item)
   - Analytics - `/dashboard/analytics`
   - Reason: Not essential for RWA tokenization flow, can be accessed via admin if needed

### Keep These Items:
✅ **Main Navigation:**
- Marketplace (core feature)
- Profile (user account)
- Settings (user preferences)

✅ **Investment Section:**
- Pool Marketplace (core RWA feature)
- Pool Management (AMC operations)

✅ **Real-World Assets Section:**
- Create RWA Asset (core feature)
- RWA Management (asset management)
- AMC Dashboard (AMC operations)

✅ **Verification Section:**
- Verification (asset verification)

✅ **Admin Section:**
- All admin items (needed for platform management)

## Proposed Simplified Menu

### Main Navigation
1. Marketplace
2. Profile
3. Settings

### Investment (Dropdown)
1. Pool Marketplace
2. Pool Management

### Real-World Assets (Dropdown)
1. Create RWA Asset
2. RWA Management
3. AMC Dashboard

### Verification (Dropdown)
1. Verification

### Admin (Dropdown - Admin Only)
1. Admin Dashboard
2. Asset Management
3. AMC Pool Management
4. Dividend Management

