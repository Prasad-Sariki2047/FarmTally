# 🚀 Git Push Commands for FarmTally

## Step-by-Step Git Setup and Push

### 1. Initialize Git Repository (if not already done)
```bash
git init
```

### 2. Add Remote Repository
```bash
git remote add origin https://github.com/Prasad-Sariki2047/FarmTally.git
```

### 3. Check Current Status
```bash
git status
```

### 4. Add All Files to Staging
```bash
git add .
```

### 5. Create Initial Commit
```bash
git commit -m "Initial commit: FarmTally User Role Management System

- Complete user authentication system with multiple methods
- Role-based access control (RBAC) for 8 user types
- Business relationship management
- Supply chain integration
- Docker deployment configuration
- Jenkins CI/CD pipeline setup
- Comprehensive monitoring and logging
- Production-ready deployment scripts"
```

### 6. Set Main Branch (if needed)
```bash
git branch -M main
```

### 7. Push to GitHub
```bash
git push -u origin main
```

---

## 🔧 Alternative: If Repository Already Exists

If you've already created files in the GitHub repository, you might need to pull first:

### Option A: Force Push (if you want to overwrite)
```bash
git push -u origin main --force
```

### Option B: Pull and Merge (if you want to keep existing files)
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

---

## 📋 Complete Command Sequence

Copy and paste these commands one by one:

```bash
# Navigate to your project directory
cd /path/to/your/farmtally-project

# Initialize git (if not done)
git init

# Add remote repository
git remote add origin https://github.com/Prasad-Sariki2047/FarmTally.git

# Check status
git status

# Add all files
git add .

# Commit with descriptive message
git commit -m "Initial commit: FarmTally User Role Management System

Features:
- Multi-method authentication (Magic Link, OTP, Social)
- RBAC for 8 user roles (App Admin, Farm Admin, Field Manager, etc.)
- Business relationship management
- Supply chain integration
- Docker containerization
- Jenkins CI/CD pipeline
- Monitoring with Prometheus/Grafana
- Production deployment on 147.93.153.247
- Hostinger email integration
- Comprehensive security and audit logging"

# Set main branch
git branch -M main

# Push to GitHub
git push -u origin main
```

---

## 🎯 After Successful Push

### 1. Verify on GitHub
- Go to: https://github.com/Prasad-Sariki2047/FarmTally
- Check that all files are uploaded
- Verify Jenkinsfile is present

### 2. Check Jenkins Build
- Go to: http://147.93.153.247:8080
- Navigate to your FarmTally pipeline
- Should automatically detect the push and start building

### 3. Monitor Build Progress
- Watch the build stages:
  1. Checkout ✅
  2. Environment Setup ✅
  3. Code Quality ✅
  4. Test ✅
  5. Build ✅
  6. Push to Registry ✅
  7. Deploy to Production ✅
  8. Post-Deploy Tests ✅

### 4. Verify Deployment
```bash
# Check application health
curl http://147.93.153.247:3001/health

# Expected response:
# {"status":"healthy","timestamp":"...","service":"FarmTally User Role Management"}
```

---

## 🚨 Troubleshooting

### If Git Push Fails
```bash
# Check remote URL
git remote -v

# If wrong, update it
git remote set-url origin https://github.com/Prasad-Sariki2047/FarmTally.git

# Try push again
git push -u origin main
```

### If Jenkins Build Fails
1. Check Jenkins console output
2. Verify credentials are set up correctly
3. Check server connectivity
4. Review Jenkinsfile syntax

### If Files Are Missing
```bash
# Check what's being ignored
git status --ignored

# Add specific files if needed
git add filename
git commit -m "Add missing file"
git push
```

---

## 📊 Expected Results

After successful push and build:

✅ **GitHub Repository**: All files uploaded  
✅ **Jenkins Build**: Automatic build triggered  
✅ **Docker Images**: Built and pushed to registry  
✅ **Application**: Deployed on port 3001  
✅ **Health Check**: Returns healthy status  
✅ **Webhook**: GitHub → Jenkins integration working  

---

**Ready to push? Run the commands above and let's see Jenkins in action! 🚀**