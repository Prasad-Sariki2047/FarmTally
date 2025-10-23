# 🔧 Jenkins Pipeline Configuration for FarmTally

## Step-by-Step Configuration Guide

### 1. General Configuration (Current Screen)

**Fill in these fields:**

#### **Description**
```
FarmTally User Role Management System - CI/CD Pipeline for automated testing, building, and deployment to production server 147.93.153.247
```

#### **Checkboxes to Enable:**
- ✅ **Discard old builds** (Check this)
- ✅ **Do not allow concurrent builds** (Check this - prevents conflicts)
- ❌ **Do not allow the pipeline to resume if the controller restarts** (Leave unchecked)
- ❌ **GitHub project** (Leave unchecked for now)
- ❌ **Pipeline speed/durability override** (Leave unchecked)
- ❌ **Preserve stashes from completed builds** (Leave unchecked)
- ❌ **This project is parameterized** (Leave unchecked)

#### **Build Retention Settings** (if you checked "Discard old builds")
- **Days to keep builds**: `30`
- **Max # of builds to keep**: `10`

---

### 2. Branch Sources Configuration (Next Screen)

After clicking "Save" or "Apply", you'll see the Branch Sources section:

#### **Add Source → Git**
- **Project Repository**: `https://github.com/Prasad-Sariki2047/FarmTally.git`
- **Credentials**: Select or create GitHub credentials (see below)

#### **Behaviors**
- ✅ **Discover branches** → **All branches**
- ✅ **Discover pull requests from origin** → **Merging the pull request with the current target branch revision**

---

### 3. Build Configuration

#### **Build Configuration**
- **Mode**: `by Jenkinsfile`
- **Script Path**: `Jenkinsfile` (default)

#### **Scan Multibranch Pipeline Triggers**
- ✅ **Periodically if not otherwise run**
- **Interval**: `5 minutes`

---

### 4. Advanced Configuration

#### **Property Strategy**
- Select: `All branches get the same properties`

#### **Orphaned Item Strategy**
- ✅ **Discard old items**
- **Days to keep old items**: `7`
- **Max # of old items to keep**: `5`

---

## 🔐 Required Credentials Setup

### Before configuring the pipeline, set up these credentials:

### 1. GitHub Credentials
**Go to: Manage Jenkins → Manage Credentials → System → Global credentials → Add Credentials**

#### **GitHub Personal Access Token**
- **Kind**: `Username with password`
- **Scope**: `Global`
- **Username**: `Prasad-Sariki2047` (your GitHub username)
- **Password**: `[Your GitHub Personal Access Token]`
- **ID**: `farmtally-github-credentials`
- **Description**: `FarmTally GitHub Repository Access`

**To create GitHub Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `admin:repo_hook`
4. Copy the token and use it as password

### 2. Server SSH Credentials
#### **SSH Private Key**
- **Kind**: `SSH Username with private key`
- **Scope**: `Global`
- **ID**: `farmtally-server-ssh`
- **Username**: `root`
- **Private Key**: `Enter directly` → [Paste your SSH private key]
- **Description**: `FarmTally Server SSH Access (147.93.153.247)`

### 3. Docker Registry Credentials
#### **Docker Registry Access**
- **Kind**: `Username with password`
- **Scope**: `Global`
- **Username**: `farmtally`
- **Password**: `farmtally_registry_2024`
- **ID**: `farmtally-docker-registry`
- **Description**: `FarmTally Docker Registry Access`

---

## 📋 Complete Configuration Checklist

### ✅ Pipeline Configuration
- [ ] Pipeline name: `farmtally-user-service`
- [ ] Description filled in
- [ ] Discard old builds enabled (30 days, 10 builds max)
- [ ] Concurrent builds disabled
- [ ] GitHub repository URL added
- [ ] GitHub credentials configured
- [ ] Jenkinsfile path set to `Jenkinsfile`
- [ ] Periodic scanning enabled (5 minutes)

### ✅ Credentials Setup
- [ ] GitHub credentials: `farmtally-github-credentials`
- [ ] Server SSH credentials: `farmtally-server-ssh`
- [ ] Docker registry credentials: `farmtally-docker-registry`

### ✅ Repository Setup
- [ ] Repository URL: `https://github.com/Prasad-Sariki2047/FarmTally.git`
- [ ] Main branch exists with Jenkinsfile
- [ ] Repository is accessible with provided credentials

---

## 🚀 After Configuration

### 1. Save and Scan
1. Click **"Save"**
2. Jenkins will automatically scan the repository
3. It should detect the `main` branch
4. First build should start automatically

### 2. Monitor First Build
1. Go to the pipeline job
2. Click on the `main` branch
3. Monitor the build progress
4. Check console output for any issues

### 3. Verify Build Steps
The pipeline should execute these stages:
1. **Checkout** - Pull code from GitHub
2. **Environment Setup** - Install Node.js dependencies
3. **Code Quality** - Run linting and security scans
4. **Test** - Run unit tests
5. **Build** - Build Docker image
6. **Push to Registry** - Push image to Docker registry
7. **Deploy to Production** - Deploy to server (main branch only)
8. **Post-Deploy Tests** - Verify deployment

---

## 🔧 Troubleshooting Common Issues

### Build Fails at Checkout
- **Issue**: GitHub credentials not working
- **Solution**: Verify GitHub token has correct permissions
- **Check**: Repository URL is correct and accessible

### Build Fails at Docker Push
- **Issue**: Docker registry credentials not working
- **Solution**: Verify registry is running on server
- **Command**: `curl http://147.93.153.247:5000/v2/`

### Build Fails at Deploy
- **Issue**: SSH credentials not working
- **Solution**: Verify SSH key has access to server
- **Test**: `ssh -i your-key root@147.93.153.247`

### Build Fails at Health Check
- **Issue**: Application not starting properly
- **Solution**: Check application logs
- **Command**: `docker logs farmtally-user-service`

---

## 📞 Next Steps After Pipeline Creation

### 1. Test Manual Build
1. Go to pipeline → main branch
2. Click "Build Now"
3. Monitor build progress
4. Verify successful deployment

### 2. Set Up Webhook (Optional)
1. Go to GitHub repository settings
2. Add webhook: `http://147.93.153.247:8080/github-webhook/`
3. Enable push events
4. Test automatic builds on code push

### 3. Configure Notifications
1. Add email notifications for build failures
2. Set up Slack integration (optional)
3. Configure build status badges

### 4. Monitor and Optimize
1. Review build times and optimize if needed
2. Add more test stages if required
3. Set up deployment approvals for production

---

**Your pipeline is now ready to automatically build and deploy FarmTally whenever you push code to GitHub!**