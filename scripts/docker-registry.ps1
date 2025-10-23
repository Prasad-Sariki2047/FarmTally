# Docker Registry Management Script for FarmTally (Windows PowerShell)
# Optimized for server deployment on 147.93.153.247

param(
    [string]$Version = "latest",
    [string]$Action = "build"
)

# Configuration
$REGISTRY_HOST = "147.93.153.247:5000"
$IMAGE_NAME = "farmtally/user-service"

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

# Build image
function Build-Image {
    Write-Info "Building Docker image: ${IMAGE_NAME}:${Version}"
    docker build -t "${IMAGE_NAME}:${Version}" .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Image built successfully"
    } else {
        Write-Error "Failed to build image"
        exit 1
    }
}

# Tag image for registry
function Tag-Image {
    Write-Info "Tagging image for registry: ${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
    docker tag "${IMAGE_NAME}:${Version}" "${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Image tagged successfully"
    } else {
        Write-Error "Failed to tag image"
        exit 1
    }
}

# Push image to registry
function Push-Image {
    Write-Info "Pushing image to registry: ${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
    docker push "${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Image pushed successfully"
    } else {
        Write-Error "Failed to push image"
        exit 1
    }
}

# Pull image from registry
function Pull-Image {
    Write-Info "Pulling image from registry: ${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
    docker pull "${REGISTRY_HOST}/${IMAGE_NAME}:${Version}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Image pulled successfully"
    } else {
        Write-Error "Failed to pull image"
        exit 1
    }
}

# List images in registry
function List-Images {
    Write-Info "Listing images in registry for ${IMAGE_NAME}"
    try {
        $response = Invoke-RestMethod -Uri "http://${REGISTRY_HOST}/v2/${IMAGE_NAME}/tags/list" -Method Get
        $response | ConvertTo-Json -Depth 3
    } catch {
        Write-Error "Failed to list images: $_"
    }
}

# Clean up old images
function Cleanup-Images {
    Write-Info "Cleaning up old Docker images"
    docker image prune -f
    docker system prune -f
    Write-Info "Cleanup completed"
}

# Main script logic
switch ($Action.ToLower()) {
    "build" {
        Build-Image
    }
    "tag" {
        Tag-Image
    }
    "push" {
        Build-Image
        Tag-Image
        Push-Image
    }
    "pull" {
        Pull-Image
    }
    "list" {
        List-Images
    }
    "cleanup" {
        Cleanup-Images
    }
    "full" {
        Build-Image
        Tag-Image
        Push-Image
        Cleanup-Images
    }
    default {
        Write-Host "Usage: .\docker-registry.ps1 -Version [version] -Action [build|tag|push|pull|list|cleanup|full]"
        Write-Host "  Version: Image version tag (default: latest)"
        Write-Host "  Action:  Docker operation to perform"
        Write-Host "    build:   Build Docker image"
        Write-Host "    tag:     Tag image for registry"
        Write-Host "    push:    Build, tag and push image to registry"
        Write-Host "    pull:    Pull image from registry"
        Write-Host "    list:    List available image tags in registry"
        Write-Host "    cleanup: Clean up old Docker images"
        Write-Host "    full:    Build, tag, push and cleanup"
        exit 1
    }
}

Write-Info "Docker registry operation completed successfully"