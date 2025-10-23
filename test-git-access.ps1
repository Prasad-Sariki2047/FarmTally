# Test Git Repository Access
# Run this script to verify GitHub repository is accessible

Write-Host "Testing FarmTally Repository Access..." -ForegroundColor Green

# Test 1: Check if repository URL is accessible
Write-Host "`n1. Testing repository URL accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://github.com/Prasad-Sariki2047/FarmTally" -Method Head -UseBasicParsing
    Write-Host "✅ Repository URL is accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Repository URL not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: List remote branches
Write-Host "`n2. Listing remote branches..." -ForegroundColor Yellow
try {
    $branches = git ls-remote --heads https://github.com/Prasad-Sariki2047/FarmTally.git
    Write-Host "✅ Remote branches found:" -ForegroundColor Green
    Write-Host $branches
} catch {
    Write-Host "❌ Failed to list remote branches: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Check specific main branch
Write-Host "`n3. Checking main branch specifically..." -ForegroundColor Yellow
try {
    $mainBranch = git ls-remote https://github.com/Prasad-Sariki2047/FarmTally.git refs/heads/main
    if ($mainBranch) {
        Write-Host "✅ Main branch exists: $mainBranch" -ForegroundColor Green
    } else {
        Write-Host "❌ Main branch not found" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to check main branch: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Test clone (dry run)
Write-Host "`n4. Testing git clone (dry run)..." -ForegroundColor Yellow
try {
    $cloneTest = git ls-remote https://github.com/Prasad-Sariki2047/FarmTally.git HEAD
    Write-Host "✅ Repository is cloneable: $cloneTest" -ForegroundColor Green
} catch {
    Write-Host "❌ Repository clone test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Check current local repository status
Write-Host "`n5. Checking local repository status..." -ForegroundColor Yellow
try {
    $gitStatus = git status --porcelain
    $currentBranch = git branch --show-current
    Write-Host "✅ Current branch: $currentBranch" -ForegroundColor Green
    
    if ($gitStatus) {
        Write-Host "⚠️  Uncommitted changes found:" -ForegroundColor Yellow
        Write-Host $gitStatus
    } else {
        Write-Host "✅ Working directory clean" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to check local repository: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "="*50 -ForegroundColor Cyan
Write-Host "JENKINS CONFIGURATION RECOMMENDATIONS:" -ForegroundColor Cyan
Write-Host "="*50 -ForegroundColor Cyan
Write-Host "1. Repository URL: https://github.com/Prasad-Sariki2047/FarmTally.git"
Write-Host "2. Branch Specifier: main (not */main)"
Write-Host "3. Credentials: Use GitHub Personal Access Token"
Write-Host "4. Webhook URL: http://147.93.153.247:8080/github-webhook/"
Write-Host "="*50 -ForegroundColor Cyan