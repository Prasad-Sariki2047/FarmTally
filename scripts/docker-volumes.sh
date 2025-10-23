#!/bin/bash

# Docker Volume Management Script for FarmTally
# Manages persistent data storage for server deployment

set -e

# Configuration
DATA_DIR="/opt/farmtally/data"
BACKUP_DIR="/opt/farmtally/backups"
LOG_DIR="/opt/farmtally/logs"

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

# Create directory structure
create_directories() {
    log_info "Creating directory structure for persistent data"
    
    # Create main directories
    sudo mkdir -p ${DATA_DIR}/postgres
    sudo mkdir -p ${DATA_DIR}/redis
    sudo mkdir -p ${BACKUP_DIR}/postgres
    sudo mkdir -p ${BACKUP_DIR}/redis
    sudo mkdir -p ${LOG_DIR}/nginx
    sudo mkdir -p ${LOG_DIR}/app
    
    # Set proper permissions
    sudo chown -R 999:999 ${DATA_DIR}/postgres  # PostgreSQL user
    sudo chown -R 999:999 ${DATA_DIR}/redis     # Redis user
    sudo chown -R $(whoami):$(whoami) ${BACKUP_DIR}
    sudo chown -R $(whoami):$(whoami) ${LOG_DIR}
    
    # Set proper permissions for directories
    sudo chmod 755 ${DATA_DIR}
    sudo chmod 700 ${DATA_DIR}/postgres
    sudo chmod 755 ${DATA_DIR}/redis
    sudo chmod 755 ${BACKUP_DIR}
    sudo chmod 755 ${LOG_DIR}
    
    log_info "Directory structure created successfully"
}

# Setup volume mounts
setup_volumes() {
    log_info "Setting up Docker volume mounts"
    
    # Create Docker volumes if they don't exist
    docker volume create farmtally_postgres_data || true
    docker volume create farmtally_redis_data || true
    
    log_info "Docker volumes created successfully"
}

# Backup data
backup_data() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    log_info "Creating backup with timestamp: ${timestamp}"
    
    # Backup PostgreSQL data
    if [ -d "${DATA_DIR}/postgres" ]; then
        log_info "Backing up PostgreSQL data"
        sudo tar -czf ${BACKUP_DIR}/postgres/postgres_backup_${timestamp}.tar.gz -C ${DATA_DIR} postgres/
    fi
    
    # Backup Redis data
    if [ -d "${DATA_DIR}/redis" ]; then
        log_info "Backing up Redis data"
        sudo tar -czf ${BACKUP_DIR}/redis/redis_backup_${timestamp}.tar.gz -C ${DATA_DIR} redis/
    fi
    
    log_info "Backup completed successfully"
}

# Restore data
restore_data() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "Please specify backup file to restore"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring data from: $backup_file"
    
    # Stop containers before restore
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
    
    # Extract backup
    sudo tar -xzf $backup_file -C ${DATA_DIR}
    
    # Set proper permissions
    sudo chown -R 999:999 ${DATA_DIR}/postgres
    sudo chown -R 999:999 ${DATA_DIR}/redis
    
    log_info "Data restored successfully"
    log_warn "Please restart the containers: docker-compose up -d"
}

# Clean old backups
cleanup_backups() {
    local days=${1:-7}
    
    log_info "Cleaning up backups older than ${days} days"
    
    find ${BACKUP_DIR} -name "*.tar.gz" -mtime +${days} -delete
    
    log_info "Backup cleanup completed"
}

# Check disk usage
check_disk_usage() {
    log_info "Checking disk usage for FarmTally data directories"
    
    echo "Data directory usage:"
    du -sh ${DATA_DIR}/* 2>/dev/null || echo "No data directories found"
    
    echo ""
    echo "Backup directory usage:"
    du -sh ${BACKUP_DIR}/* 2>/dev/null || echo "No backup directories found"
    
    echo ""
    echo "Available disk space:"
    df -h ${DATA_DIR}
}

# Main script logic
case "${1:-setup}" in
    "setup")
        create_directories
        setup_volumes
        ;;
    "backup")
        backup_data
        ;;
    "restore")
        restore_data $2
        ;;
    "cleanup")
        cleanup_backups $2
        ;;
    "usage")
        check_disk_usage
        ;;
    *)
        echo "Usage: $0 [setup|backup|restore|cleanup|usage]"
        echo "  setup:   Create directory structure and Docker volumes"
        echo "  backup:  Create backup of all data"
        echo "  restore: Restore data from backup file"
        echo "  cleanup: Clean up old backups (default: 7 days)"
        echo "  usage:   Check disk usage for data directories"
        exit 1
        ;;
esac

log_info "Volume management operation completed successfully"