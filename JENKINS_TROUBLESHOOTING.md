# Jenkins Build Troubleshooting Guide

## Issue: "fatal: couldn't find remote ref refs/heads/main"

### Problem
Jenkins is failing to fetch the `main` branch with error:
```
fatal: couldn't find remote ref refs/heads/main
```

### Root Cause
This typically happens when:
1. Jenkins job was configured before the repository had a `main` branch
2. Jenkins is looking for the wrong branch name
3. Webhook timing issues
4. Jenkins credentials are not properly configured

### Solution Steps

## Step 1: Fix Jenkins Job Configuration

### Access Jenkins Dashboard
1. Go to: http://147.93.153.247:8080
2. Navigate to your FarmTally job
3. Click "Configure"

### Update Source Code Management
1. In the "Source Code Management" section:
   - Repository URL: `https://github.com/Prasad-Sariki2047/FarmTally.git`
   - Credentials: Select your GitHub credentials
   - **Branch Specifier**: Change from `*/main` to `main` or `refs/heads/main`

### Update Pipeline Configuration
1. In the "Pipeline" section:
   - Definition: Pipeline script from SCM
   - SCM: Git
   - Repository URL: `https://github.com/Prasad-Sariki2047/FarmTally.git`
   - **Branch Specifier**: `main` (not `*/main`)
   - Script Path: `Jenkinsfile`

## Step 2: Verify GitHub Webhook

### Check Webhook Configuration
1. Go to: https://github.com/Prasad-Sariki2047/FarmTally/settings/hooks
2. Verify webhook URL: `http://147.93.153.247:8080/github-webhook/`
3. Content type: `application/json`
4. Events: "Just the push event" or "Send me everything"

### Test Webhook
1. Click on the webhook
2. Go to "Recent Deliveries"
3. Check if deliveries are successful (green checkmark)

## Step 3: Manual Build Test

### Trigger Manual Build
1. In Jenkins, go to your FarmTally job
2. Click "Build Now"
3. Check console output for errors

### Alternative: Build with Parameters
1. Click "Build with Parameters"
2. Specify branch: `main`
3. Run the build

## Step 4: Fix Credentials (if needed)

### GitHub Credentials
1. Jenkins Dashboard → Manage Jenkins → Manage Credentials
2. Add new credentials:
   - Kind: Username with password
   - Username: `Prasad-Sariki2047`
   - Password: Your GitHub Personal Access Token
   - ID: `github-credentials`

### SSH Credentials (for deployment)
1. Add SSH private key for server access
2. ID: `server-ssh-credentials`

## Step 5: Alternative Jenkinsfile Configuration

If the issue persists, update the Jenkinsfile checkout stage:

```groovy
stage('Checkout') {
    steps {
        echo 'Checking out FarmTally source code...'
        checkout([
            $class: 'GitSCM',
            branches: [[name: 'main']],
            userRemoteConfigs: [[
                url: 'https://github.com/Prasad-Sariki2047/FarmTally.git',
                credentialsId: 'github-credentials'
            ]]
        ])
        
        script {
            env.GIT_COMMIT_SHORT = sh(
                script: 'git rev-parse --short HEAD',
                returnStdout: true
            ).trim()
            env.BUILD_TAG = "farmtally-${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
        }
    }
}
```

## Step 6: Restart Jenkins (if needed)

If configuration changes don't take effect:
```bash
# SSH to your server
ssh root@147.93.153.247

# Restart Jenkins
docker-compose restart jenkins
```

## Verification Steps

After making changes:

1. **Test Repository Access**:
   ```bash
   git ls-remote https://github.com/Prasad-Sariki2047/FarmTally.git
   ```

2. **Verify Branch Exists**:
   ```bash
   git ls-remote --heads https://github.com/Prasad-Sariki2047/FarmTally.git
   ```

3. **Test Jenkins Build**: Trigger a manual build

4. **Check Webhook**: Make a small commit and push to test automatic triggering

## Expected Result

After fixing:
- Jenkins should successfully fetch the `main` branch
- Build should proceed through all stages
- Application should deploy to http://147.93.153.247:3001

## Quick Fix Commands

If you have SSH access to the Jenkins server:

```bash
# Check if repository is accessible
curl -I https://github.com/Prasad-Sariki2047/FarmTally.git

# Test git access
git ls-remote https://github.com/Prasad-Sariki2047/FarmTally.git

# Restart Jenkins if needed
docker-compose restart jenkins
```

## Next Steps

1. Apply the Jenkins job configuration changes
2. Test with a manual build
3. Make a small commit to test webhook triggering
4. Monitor the build console output
5. Verify deployment at http://147.93.153.247:3001

The most likely fix is updating the branch specifier in Jenkins from `*/main` to just `main`.