#!/bin/bash

# FarmTally Production Deployment Script
# Run this script on your server (147.93.153.247)

set -e  # Exit on any error

echo "🚀 Starting FarmTally Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Step 1: Create directory structure
print_status "Creating FarmTally directory structure..."
mkdir -p /opt/farmtally/{data/postgres,data/redis,logs/nginx,ssl,backups}
cd /opt/farmtally

# Step 2: Clone or update repository
if [ -d ".git" ]; then
    print_status "Updating existing repository..."
    git pull origin main
else
    print_status "Cloning FarmTally repository..."
    git clone https://github.com/Prasad-Sariki2047/FarmTally.git .
fi

# Step 3: Set up environment file
if [ ! -f ".env.production" ]; then
    print_status "Creating production environment file..."
    cp .env.example .env.production
    
    print_warning "IMPORTANT: Edit /opt/farmtally/.env.production with your secure passwords!"
    print_warning "You need to set:"
    echo "  - POSTGRES_PASSWORD"
    echo "  - REDIS_PASSWORD" 
    echo "  - JWT_SECRET"
    echo "  - DATABASE_URL"
    echo "  - REDIS_URL"
    
    read -p "Press Enter after you've updated .env.production..."
fi

# Step 4: Pull latest Docker image
print_status "Pulling latest Docker image..."
docker pull farmtally/user-service:latest || {
    print_warning "Could not pull image from registry, will build locally"
}

# Step 5: Stop existing services
print_status "Stopping existing services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down || true

# Step 6: Start services
print_status "Starting FarmTally services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Step 7: Wait for services to be ready
print_status "Waiting for services to start..."
sleep 30

# Step 8: Check service status
print_status "Checking service status..."
docker-compose ps

# Step 9: Verify database
print_status "Verifying database setup..."
docker-compose exec -T postgres psql -U farmtally_prod_user -d farmtally_prod -c "\dt" || {
    print_error "Database verification failed"
    exit 1
}

# Step 10: Test application
print_status "Testing application..."
sleep 10
curl -f http://localhost:3001/health || {
    print_error "Application health check failed"
    docker-compose logs farmtally-user-service
    exit 1
}

# Success message
print_status "🎉 FarmTally deployment completed successfully!"
echo ""
echo "Access your application at:"
echo "  - Application: http://147.93.153.247:3001"
echo "  - Nginx Proxy: http://147.93.153.247:8082"
echo ""
echo "Default admin user:"
echo "  - Email: admin@farmtally.com"
echo "  - Check logs for any setup information"
echo ""
echo "To view logs: docker-compose logs -f farmtally-user-service"
echo "To restart: docker-compose restart"