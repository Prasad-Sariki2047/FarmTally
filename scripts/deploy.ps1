# FarmTally Deployment Script for Windows PowerShell
# Complete deployment automation for server 147.93.153.247

param(
    [string]$Environment = "production",
    [string]$Version = "latest",
    [switch]$SkipBuild = $false,
    [switch]$SkipBackup = $false,
    [switch]$Force = $false
)

# Configuration
$REGISTRY_HOST = "147.93.153.247:5000"
$IMAGE_NAME = "farmtally/user-service"
$COMPOSE_FILES = @("docker-compose.yml", "docker-compose.prod.yml")

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==== $Message ====" -ForegroundColor Cyan
}

# Pre-deployment checks
function Test-Prerequisites {
    Write-Step "Checking Prerequisites"
    
    # Check Docker
    try {
        docker --version | Out-Null
        Write-Info "Docker is installed"
    } catch {
        Write-Error "Docker is not installed or not in PATH"
        exit 1
    }
    
    # Check Docker Compose
    try {
        docker-compose --version | Out-Null
        Write-Info "Docker Compose is installed"
    } catch {
        Write-Error "Docker Compose is not installed or not in PATH"
        exit 1
    }
    
    # Check required files
    $requiredFiles = @("Dockerfile", "docker-compose.yml", "docker-compose.prod.yml", "package.json")
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            Write-Error "Required file not found: $file"
            exit 1
        }
    }
    Write-Info "All required files are present"
    
    # Check environment file
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Write-Warn ".env file not found, copying from .env.example"
            Copy-Item ".env.example" ".env"
        } else {
            Write-Error "Neither .env nor .env.example found"
            exit 1
        }
    }
    Write-Info "Environment configuration is ready"
}

# Build and push image
function Build-AndPushImage {
    if ($SkipBuild) {
        Write-Info "Skipping build step as requested"
        return
    }
    
    Write-Step "Building and Pushing Docker Image"
    
    # Build image
    Write-Info "Building Docker image: ${IMAGE_NAME}:${Version}"
    docker build -t "${IMAGE_NAME}:${Version}" .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build Docker image"
        exit 1
    }
    
    # Tag for registry
    Write-Info "Tagging image for registry"
    docker tag "${IMAGE_NAME}:${Version}" "${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
    
    # Push to registry (optional, for remote deployments)
    try {
        Write-Info "Attempting to push to registry"
        docker push "${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
        Write-Info "Image pushed to registry successfully"
    } catch {
        Write-Warn "Failed to push to registry, continuing with local image"
    }
}

# Backup existing data
function Backup-ExistingData {
    if ($SkipBackup) {
        Write-Info "Skipping backup step as requested"
        return
    }
    
    Write-Step "Creating Backup of Existing Data"
    
    # Check if containers are running
    $runningContainers = docker-compose ps -q
    if ($runningContainers) {
        Write-Info "Creating backup before deployment"
        & ".\scripts\docker-volumes.ps1" -Action backup
    } else {
        Write-Info "No running containers found, skipping backup"
    }
}

# Deploy services
function Deploy-Services {
    Write-Step "Deploying FarmTally Services"
    
    # Stop existing services
    Write-Info "Stopping existing services"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
    
    # Pull latest images (if using registry)
    Write-Info "Pulling latest images"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull --ignore-pull-failures
    
    # Start services
    Write-Info "Starting services in production mode"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start services"
        exit 1
    }
    
    Write-Info "Services started successfully"
}

# Health checks
function Test-Deployment {
    Write-Step "Running Health Checks"
    
    # Wait for services to start
    Write-Info "Waiting for services to initialize..."
    Start-Sleep -Seconds 30
    
    # Check container status
    Write-Info "Checking container status"
    $containers = docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
    Write-Host $containers
    
    # Test health endpoints
    $maxRetries = 10
    $retryCount = 0
    
    do {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Info "Health check passed"
                $healthContent = $response.Content | ConvertFrom-Json
                Write-Host "Service: $($healthContent.service)"
                Write-Host "Status: $($healthContent.status)"
                Write-Host "Timestamp: $($healthContent.timestamp)"
                break
            }
        } catch {
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Warn "Health check failed, retrying in 10 seconds... ($retryCount/$maxRetries)"
                Start-Sleep -Seconds 10
            } else {
                Write-Error "Health check failed after $maxRetries attempts"
                Write-Info "Container logs:"
                docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 farmtally-user-service
                exit 1
            }
        }
    } while ($retryCount -lt $maxRetries)
}

# Cleanup old resources
function Cleanup-OldResources {
    Write-Step "Cleaning Up Old Resources"
    
    # Remove unused images
    Write-Info "Removing unused Docker images"
    docker image prune -f
    
    # Remove unused volumes (be careful with this)
    if ($Force) {
        Write-Warn "Force cleanup: removing unused volumes"
        docker volume prune -f
    }
    
    # Remove unused networks
    docker network prune -f
    
    Write-Info "Cleanup completed"
}

# Display deployment summary
function Show-DeploymentSummary {
    Write-Step "Deployment Summary"
    
    Write-Info "Environment: $Environment"
    Write-Info "Version: $Version"
    Write-Info "Registry: $REGISTRY_HOST"
    
    Write-Host ""
    Write-Info "Service URLs:"
    Write-Host "  Health Check: http://localhost:3000/health"
    Write-Host "  API Base: http://localhost:3000/api"
    Write-Host "  Auth Service: http://localhost:3000/api/auth"
    Write-Host "  Relationships: http://localhost:3000/api/relationships"
    
    Write-Host ""
    Write-Info "Management Commands:"
    Write-Host "  View logs: docker-compose logs -f"
    Write-Host "  Stop services: docker-compose down"
    Write-Host "  Restart services: docker-compose restart"
    Write-Host "  Scale services: docker-compose up -d --scale farmtally-user-service=2"
    
    Write-Host ""
    Write-Info "Monitoring:"
    Write-Host "  Container status: docker-compose ps"
    Write-Host "  Resource usage: docker stats"
    Write-Host "  Service health: curl http://localhost:3000/health"
}

# Main deployment flow
function Start-Deployment {
    Write-Host "🚀 Starting FarmTally Deployment" -ForegroundColor Magenta
    Write-Host "Environment: $Environment" -ForegroundColor Magenta
    Write-Host "Version: $Version" -ForegroundColor Magenta
    Write-Host ""
    
    try {
        Test-Prerequisites
        Build-AndPushImage
        Backup-ExistingData
        Deploy-Services
        Test-Deployment
        Cleanup-OldResources
        Show-DeploymentSummary
        
        Write-Host ""
        Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
        
    } catch {
        Write-Host ""
        Write-Error "❌ Deployment failed: $_"
        Write-Info "Rolling back..."
        
        # Attempt rollback
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
        
        exit 1
    }
}

# Confirmation prompt
if (-not $Force) {
    Write-Host "About to deploy FarmTally to $Environment environment" -ForegroundColor Yellow
    Write-Host "Version: $Version" -ForegroundColor Yellow
    Write-Host "Skip Build: $SkipBuild" -ForegroundColor Yellow
    Write-Host "Skip Backup: $SkipBackup" -ForegroundColor Yellow
    Write-Host ""
    
    $confirmation = Read-Host "Continue with deployment? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Deployment cancelled by user"
        exit 0
    }
}

# Start deployment
Start-Deployment