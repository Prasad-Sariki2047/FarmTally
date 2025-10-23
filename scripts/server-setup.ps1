# Server Setup Script for FarmTally Production Environment
# Configures server infrastructure on 147.93.153.247

param(
    [string]$ServerIP = "147.93.153.247",
    [string]$Username = "farmtally",
    [switch]$SkipDocker = $false,
    [switch]$SkipFirewall = $false
)

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

# Generate server setup commands
function Generate-ServerSetupCommands {
    Write-Step "Generating Server Setup Commands"
    
    $setupCommands = @"
#!/bin/bash
# FarmTally Server Setup Script for Ubuntu/Debian
# Run this script on the target server: 147.93.153.247

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "`${GREEN}[INFO]`${NC} `$1"
}

log_warn() {
    echo -e "`${YELLOW}[WARN]`${NC} `$1"
}

log_error() {
    echo -e "`${RED}[ERROR]`${NC} `$1"
}

# Update system
log_info "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install required packages
log_info "Installing required packages..."
sudo apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    htop \
    nginx \
    ufw \
    fail2ban \
    logrotate \
    cron \
    jq

# Install Docker
if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker `$USER
    rm get-docker.sh
else
    log_info "Docker is already installed"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    log_info "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-`$(uname -s)-`$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    log_info "Docker Compose is already installed"
fi

# Create farmtally user
if ! id "farmtally" &>/dev/null; then
    log_info "Creating farmtally user..."
    sudo useradd -m -s /bin/bash farmtally
    sudo usermod -aG docker farmtally
    sudo usermod -aG sudo farmtally
else
    log_info "User farmtally already exists"
fi

# Create directory structure
log_info "Creating directory structure..."
sudo mkdir -p /opt/farmtally/{data,backups,logs,ssl,config}
sudo mkdir -p /opt/farmtally/data/{postgres,redis}
sudo mkdir -p /opt/farmtally/backups/{postgres,redis}
sudo mkdir -p /opt/farmtally/logs/{nginx,app}

# Set permissions
sudo chown -R farmtally:farmtally /opt/farmtally
sudo chmod -R 755 /opt/farmtally
sudo chmod 700 /opt/farmtally/data/postgres
sudo chmod 700 /opt/farmtally/ssl

# Configure firewall
log_info "Configuring firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5432/tcp  # PostgreSQL (restrict to local network in production)
sudo ufw allow 6379/tcp  # Redis (restrict to local network in production)
sudo ufw --force enable

# Configure fail2ban
log_info "Configuring fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Setup log rotation
log_info "Setting up log rotation..."
sudo tee /etc/logrotate.d/farmtally > /dev/null <<EOF
/opt/farmtally/logs/app/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 farmtally farmtally
    postrotate
        docker-compose -f /opt/farmtally/docker-compose.yml restart farmtally-user-service || true
    endscript
}

/opt/farmtally/logs/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nginx nginx
    postrotate
        docker-compose -f /opt/farmtally/docker-compose.yml restart nginx || true
    endscript
}
EOF

# Setup backup cron job
log_info "Setting up backup cron job..."
sudo -u farmtally crontab -l 2>/dev/null | { cat; echo "0 2 * * * /opt/farmtally/scripts/backup.sh"; } | sudo -u farmtally crontab -

# Configure system limits
log_info "Configuring system limits..."
sudo tee -a /etc/security/limits.conf > /dev/null <<EOF
farmtally soft nofile 65536
farmtally hard nofile 65536
farmtally soft nproc 4096
farmtally hard nproc 4096
EOF

# Configure sysctl for better performance
log_info "Configuring kernel parameters..."
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF
# FarmTally optimizations
net.core.somaxconn = 1024
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 3
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF

sudo sysctl -p

# Install monitoring tools
log_info "Installing monitoring tools..."
sudo apt-get install -y htop iotop nethogs

# Create systemd service for FarmTally
log_info "Creating systemd service..."
sudo tee /etc/systemd/system/farmtally.service > /dev/null <<EOF
[Unit]
Description=FarmTally User Role Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/farmtally
ExecStart=/usr/local/bin/docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
TimeoutStartSec=0
User=farmtally
Group=farmtally

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable farmtally

log_info "Server setup completed successfully!"
log_info "Next steps:"
log_info "1. Copy your application files to /opt/farmtally/"
log_info "2. Configure environment variables in .env file"
log_info "3. Generate SSL certificates"
log_info "4. Start the service: sudo systemctl start farmtally"
log_info "5. Check status: sudo systemctl status farmtally"

log_warn "Please reboot the server to ensure all changes take effect"
log_warn "After reboot, log in as farmtally user to deploy the application"
"@

    # Save setup script
    $setupCommands | Out-File -FilePath "scripts/server-setup.sh" -Encoding UTF8
    
    Write-Info "Server setup script generated: scripts/server-setup.sh"
    Write-Info "Copy this script to your server and run it as root or with sudo"
}

# Generate backup script
function Generate-BackupScript {
    Write-Step "Generating Backup Script"
    
    $backupScript = @"
#!/bin/bash
# FarmTally Backup Script
# Automated backup for production data

set -e

# Configuration
BACKUP_DIR="/opt/farmtally/backups"
DATA_DIR="/opt/farmtally/data"
RETENTION_DAYS=30
TIMESTAMP=`$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "`${GREEN}[INFO]`${NC} `$1"
}

log_warn() {
    echo -e "`${YELLOW}[WARN]`${NC} `$1"
}

log_error() {
    echo -e "`${RED}[ERROR]`${NC} `$1"
}

# Create backup directories
mkdir -p `${BACKUP_DIR}/{postgres,redis,config}

# Backup PostgreSQL
log_info "Backing up PostgreSQL database..."
docker exec farmtally-postgres pg_dumpall -U farmtally_prod_user > `${BACKUP_DIR}/postgres/postgres_backup_`${TIMESTAMP}.sql
gzip `${BACKUP_DIR}/postgres/postgres_backup_`${TIMESTAMP}.sql

# Backup Redis
log_info "Backing up Redis data..."
docker exec farmtally-redis redis-cli --rdb - > `${BACKUP_DIR}/redis/redis_backup_`${TIMESTAMP}.rdb
gzip `${BACKUP_DIR}/redis/redis_backup_`${TIMESTAMP}.rdb

# Backup configuration files
log_info "Backing up configuration files..."
tar -czf `${BACKUP_DIR}/config/config_backup_`${TIMESTAMP}.tar.gz \
    /opt/farmtally/.env* \
    /opt/farmtally/docker-compose*.yml \
    /opt/farmtally/nginx/ \
    2>/dev/null || true

# Clean old backups
log_info "Cleaning up old backups (older than `${RETENTION_DAYS} days)..."
find `${BACKUP_DIR} -name "*.sql.gz" -mtime +`${RETENTION_DAYS} -delete
find `${BACKUP_DIR} -name "*.rdb.gz" -mtime +`${RETENTION_DAYS} -delete
find `${BACKUP_DIR} -name "*.tar.gz" -mtime +`${RETENTION_DAYS} -delete

# Calculate backup sizes
POSTGRES_SIZE=`$(du -sh `${BACKUP_DIR}/postgres/ | cut -f1)
REDIS_SIZE=`$(du -sh `${BACKUP_DIR}/redis/ | cut -f1)
CONFIG_SIZE=`$(du -sh `${BACKUP_DIR}/config/ | cut -f1)

log_info "Backup completed successfully!"
log_info "PostgreSQL backup size: `${POSTGRES_SIZE}"
log_info "Redis backup size: `${REDIS_SIZE}"
log_info "Config backup size: `${CONFIG_SIZE}"

# Optional: Upload to cloud storage (uncomment and configure)
# log_info "Uploading to cloud storage..."
# aws s3 sync `${BACKUP_DIR} s3://farmtally-backups/`$(date +%Y/%m/%d)/ --delete
"@

    $backupScript | Out-File -FilePath "scripts/backup.sh" -Encoding UTF8
    
    Write-Info "Backup script generated: scripts/backup.sh"
}

# Generate monitoring script
function Generate-MonitoringScript {
    Write-Step "Generating Monitoring Script"
    
    $monitoringScript = @"
#!/bin/bash
# FarmTally Monitoring Script
# System health monitoring and alerting

set -e

# Configuration
LOG_FILE="/opt/farmtally/logs/monitoring.log"
ALERT_EMAIL="admin@farmtally.com"
CPU_THRESHOLD=80
MEMORY_THRESHOLD=80
DISK_THRESHOLD=85

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "`${GREEN}[INFO]`${NC} `$1" | tee -a `$LOG_FILE
}

log_warn() {
    echo -e "`${YELLOW}[WARN]`${NC} `$1" | tee -a `$LOG_FILE
}

log_error() {
    echo -e "`${RED}[ERROR]`${NC} `$1" | tee -a `$LOG_FILE
}

# Check system resources
check_system_resources() {
    log_info "Checking system resources..."
    
    # CPU usage
    CPU_USAGE=`$(top -bn1 | grep "Cpu(s)" | awk '{print `$2}' | awk -F'%' '{print `$1}')
    if (( `$(echo "`$CPU_USAGE > `$CPU_THRESHOLD" | bc -l) )); then
        log_warn "High CPU usage: `${CPU_USAGE}%"
    fi
    
    # Memory usage
    MEMORY_USAGE=`$(free | grep Mem | awk '{printf("%.1f", `$3/`$2 * 100.0)}')
    if (( `$(echo "`$MEMORY_USAGE > `$MEMORY_THRESHOLD" | bc -l) )); then
        log_warn "High memory usage: `${MEMORY_USAGE}%"
    fi
    
    # Disk usage
    DISK_USAGE=`$(df / | tail -1 | awk '{print `$5}' | sed 's/%//')
    if [ `$DISK_USAGE -gt `$DISK_THRESHOLD ]; then
        log_warn "High disk usage: `${DISK_USAGE}%"
    fi
    
    log_info "CPU: `${CPU_USAGE}%, Memory: `${MEMORY_USAGE}%, Disk: `${DISK_USAGE}%"
}

# Check Docker containers
check_containers() {
    log_info "Checking Docker containers..."
    
    # Check if containers are running
    CONTAINERS=("farmtally-user-service" "farmtally-postgres" "farmtally-redis" "farmtally-nginx")
    
    for container in "`${CONTAINERS[@]}"; do
        if ! docker ps | grep -q `$container; then
            log_error "Container `$container is not running"
        else
            log_info "Container `$container is healthy"
        fi
    done
}

# Check application health
check_application_health() {
    log_info "Checking application health..."
    
    # Health check endpoint
    if curl -f -s http://localhost:3000/health > /dev/null; then
        log_info "Application health check passed"
    else
        log_error "Application health check failed"
    fi
    
    # Database connectivity
    if docker exec farmtally-postgres pg_isready -U farmtally_prod_user > /dev/null 2>&1; then
        log_info "Database connectivity check passed"
    else
        log_error "Database connectivity check failed"
    fi
    
    # Redis connectivity
    if docker exec farmtally-redis redis-cli ping | grep -q PONG; then
        log_info "Redis connectivity check passed"
    else
        log_error "Redis connectivity check failed"
    fi
}

# Check log files for errors
check_logs() {
    log_info "Checking logs for errors..."
    
    # Check application logs for errors in the last hour
    ERROR_COUNT=`$(docker logs farmtally-user-service --since="1h" 2>&1 | grep -i error | wc -l)
    if [ `$ERROR_COUNT -gt 10 ]; then
        log_warn "High error count in application logs: `$ERROR_COUNT errors in the last hour"
    fi
}

# Main monitoring function
run_monitoring() {
    echo "`$(date): Starting monitoring check" >> `$LOG_FILE
    
    check_system_resources
    check_containers
    check_application_health
    check_logs
    
    echo "`$(date): Monitoring check completed" >> `$LOG_FILE
    echo "---" >> `$LOG_FILE
}

# Run monitoring
run_monitoring
"@

    $monitoringScript | Out-File -FilePath "scripts/monitoring.sh" -Encoding UTF8
    
    Write-Info "Monitoring script generated: scripts/monitoring.sh"
}

# Main execution
Write-Host "🔧 FarmTally Server Setup Configuration Generator" -ForegroundColor Magenta
Write-Host "Target Server: $ServerIP" -ForegroundColor Magenta
Write-Host ""

Generate-ServerSetupCommands
Generate-BackupScript
Generate-MonitoringScript

Write-Host ""
Write-Info "Server setup configuration completed!"
Write-Info "Generated files:"
Write-Host "  - scripts/server-setup.sh (run on target server)"
Write-Host "  - scripts/backup.sh (automated backup script)"
Write-Host "  - scripts/monitoring.sh (system monitoring)"
Write-Host ""
Write-Info "Next steps:"
Write-Host "1. Copy scripts to your server: scp scripts/*.sh user@$ServerIP:/tmp/"
Write-Host "2. SSH to server: ssh user@$ServerIP"
Write-Host "3. Run setup: sudo bash /tmp/server-setup.sh"
Write-Host "4. Deploy application using deploy.ps1 script"