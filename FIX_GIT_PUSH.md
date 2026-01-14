# Fix: Git Push Error - "src refspec main does not match any"

## Problem
The error occurs because you're trying to push a branch that doesn't exist yet. This happens when:
- No commits have been made
- Files haven't been staged and committed

## Solution - Step by Step

### Step 1: Check Current Status
```bash
cd /Users/MAC/Documents/TrustBridge
git status
```

### Step 2: Stage All Files
```bash
git add .
```

### Step 3: Verify Files Are Staged
```bash
git status
```
You should see files listed under "Changes to be committed"

### Step 4: Create Your First Commit
```bash
git commit -m "Initial commit: TrustBridge Africa - RWA Tokenization Platform on Mantle Network

- Real-world asset tokenization platform
- Built on Mantle Network (EVM Layer 2)
- Smart contracts: CoreAssetFactory, PoolManager, AMCManager
- Frontend: React + TypeScript + Vite
- Backend: NestJS + MongoDB
- Features: Real yield system, ROI tracking, asset owner management"
```

### Step 5: Verify Commit Was Created
```bash
git log --oneline
```
You should see your commit listed.

### Step 6: Check Current Branch
```bash
git branch
```
This will show your current branch (might be "master" or something else)

### Step 7: Rename Branch to Main (if needed)
```bash
git branch -M main
```

### Step 8: Push to GitHub
```bash
git push -u origin main
```

## Complete Command Sequence

Run these commands in order:

```bash
cd /Users/MAC/Documents/TrustBridge

# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit: TrustBridge Africa - RWA Tokenization Platform on Mantle Network"

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

## If You Still Get Errors

### Error: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/Osiyomeoh/TrustBridgeAfrica.git
```

### Error: Authentication required
You may need to authenticate:
- Use GitHub Personal Access Token instead of password
- Or use SSH: `git remote set-url origin git@github.com:Osiyomeoh/TrustBridgeAfrica.git`

### Error: "nothing to commit"
Check if files are being ignored:
```bash
git status
```
If you see "nothing to commit", check your `.gitignore` file - it might be excluding too much.

## Verify Success

After successful push:
1. Visit https://github.com/Osiyomeoh/TrustBridgeAfrica
2. You should see all your files
3. The README.md should be visible

