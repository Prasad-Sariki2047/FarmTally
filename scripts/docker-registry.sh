#!/bin/bash

# Docker Registry Management Script for FarmTally
# Optimized for server deployment on 147.93.153.247

set -e

# Configuration
REGISTRY_HOST="147.93.153.247:5000"
IMAGE_NAME="farmtally/user-service"
VERSION=${1:-latest}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Build image
build_image() {
    log_info "Building Docker image: ${IMAGE_NAME}:${VERSION}"
    docker build -t ${IMAGE_NAME}:${VERSION} .
    
    if [ $? -eq 0 ]; then
        log_info "Image built successfully"
    else
        log_error "Failed to build image"
        exit 1
    fi
}

# Tag image for registry
tag_image() {
    log_info "Tagging image for registry: ${REGISTRY_HOST}/${IMAGE_NAME}:${VERSION}"
    docker tag ${IMAGE_NAME}:${VERSION} ${REGISTRY_HOST}/${IMAGE_NAME}:${VERSION}
    
    if [ $? -eq 0 ]; then
        log_info "Image tagged successfully"
    else
        log_error "Failed to tag image"
        exit 1
    fi
}

# Push image to registry
push_image() {
    log_info "Pushing image to registry: ${REGISTRY_HOST}/${IMAGE_NAME}:${VERSION}"
    docker push ${REGISTRY_HOST}/${IMAGE_NAME}:${VERSION}
    
    if [ $? -eq 0 ]; then
        log_info "Image pushed successfully"
    else
        log_error "Failed to push image"
        exit 1
    fi
}

# Pull image from registry
pull_image() {
    log_info "Pulling image from registry: ${REGISTRY_HOST}/${IMAGE_NAME}:${VERSION}"
    docker pull ${REGISTRY_HOST}/${IMAGE_NAME}:${VERSION}
    
    if [ $? -eq 0 ]; then
        log_info "Image pulled successfully"
    else
        log_error "Failed to pull image"
        exit 1
    fi
}

# List images in registry
list_images() {
    log_info "Listing images in registry for ${IMAGE_NAME}"
    curl -s -X GET http://${REGISTRY_HOST}/v2/${IMAGE_NAME}/tags/list | jq '.'
}

# Clean up old images
cleanup_images() {
    log_info "Cleaning up old Docker images"
    docker image prune -f
    docker system prune -f
    log_info "Cleanup completed"
}

# Main script logic
case "${2:-build}" in
    "build")
        build_image
        ;;
    "tag")
        tag_image
        ;;
    "push")
        build_image
        tag_image
        push_image
        ;;
    "pull")
        pull_image
        ;;
    "list")
        list_images
        ;;
    "cleanup")
        cleanup_images
        ;;
    "full")
        build_image
        tag_image
        push_image
        cleanup_images
        ;;
    *)
        echo "Usage: $0 [version] [build|tag|push|pull|list|cleanup|full]"
        echo "  version: Image version tag (default: latest)"
        echo "  build:   Build Docker image"
        echo "  tag:     Tag image for registry"
        echo "  push:    Build, tag and push image to registry"
        echo "  pull:    Pull image from registry"
        echo "  list:    List available image tags in registry"
        echo "  cleanup: Clean up old Docker images"
        echo "  full:    Build, tag, push and cleanup"
        exit 1
        ;;
esac

log_info "Docker registry operation completed successfully"