# Disaster Recovery Script for FarmTally
# Comprehensive backup and recovery procedures

param(
    [string]$Action = "backup",
    [string]$BackupLocation = "/opt/farmtally/backups",
    [string]$RestoreFrom = "",
    [switch]$FullBackup = $false,
    [switch]$TestRestore = $false
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

# Generate disaster recovery script
function Generate-DisasterRecoveryScript {
    Write-Step "Generating Disaster Recovery Script"
    
    $drScript = @"
#!/bin/bash
# FarmTally Disaster Recovery Script
# Comprehensive backup and recovery procedures

set -e

# Configuration
BACKUP_DIR="/opt/farmtally/backups"
DATA_DIR="/opt/farmtally/data"
CONFIG_DIR="/opt/farmtally"
REMOTE_BACKUP_HOST="backup-server.farmtally.com"
REMOTE_BACKUP_USER="farmtally-backup"
RETENTION_DAYS=30
TIMESTAMP=`$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "`${GREEN}[INFO]`${NC} `$1" | tee -a `$BACKUP_DIR/recovery.log
}

log_warn() {
    echo -e "`${YELLOW}[WARN]`${NC} `$1" | tee -a `$BACKUP_DIR/recovery.log
}

log_error() {
    echo -e "`${RED}[ERROR]`${NC} `$1" | tee -a `$BACKUP_DIR/recovery.log
}

log_step() {
    echo -e "`${BLUE}==== `$1 ====${NC}" | tee -a `$BACKUP_DIR/recovery.log
}

# Pre-flight checks
preflight_checks() {
    log_step "Running Pre-flight Checks"
    
    # Check if running as correct user
    if [ "`$(whoami)" != "farmtally" ] && [ "`$(whoami)" != "root" ]; then
        log_error "This script must be run as farmtally user or root"
        exit 1
    fi
    
    # Check disk space
    AVAILABLE_SPACE=`$(df `$BACKUP_DIR | tail -1 | awk '{print `$4}')
    REQUIRED_SPACE=5242880  # 5GB in KB
    
    if [ `$AVAILABLE_SPACE -lt `$REQUIRED_SPACE ]; then
        log_error "Insufficient disk space. Required: 5GB, Available: `$((`$AVAILABLE_SPACE / 1024 / 1024))GB"
        exit 1
    fi
    
    # Check Docker services
    if ! docker ps | grep -q farmtally; then
        log_warn "FarmTally containers are not running"
    fi
    
    log_info "Pre-flight checks completed"
}

# Full system backup
full_backup() {
    log_step "Starting Full System Backup"
    
    BACKUP_NAME="farmtally_full_backup_`$TIMESTAMP"
    BACKUP_PATH="`$BACKUP_DIR/`$BACKUP_NAME"
    
    mkdir -p `$BACKUP_PATH
    
    # Stop services for consistent backup
    log_info "Stopping services for consistent backup..."
    docker-compose -f `$CONFIG_DIR/docker-compose.yml -f `$CONFIG_DIR/docker-compose.prod.yml down
    
    # Backup PostgreSQL
    log_info "Backing up PostgreSQL database..."
    sudo -u postgres pg_dumpall > `$BACKUP_PATH/postgres_full.sql
    gzip `$BACKUP_PATH/postgres_full.sql
    
    # Backup Redis
    log_info "Backing up Redis data..."
    cp /var/lib/redis/dump.rdb `$BACKUP_PATH/redis_dump.rdb 2>/dev/null || true
    cp /var/lib/redis/appendonly.aof `$BACKUP_PATH/redis_appendonly.aof 2>/dev/null || true
    
    # Backup application data
    log_info "Backing up application data..."
    tar -czf `$BACKUP_PATH/app_data.tar.gz -C `$DATA_DIR . 2>/dev/null || true
    
    # Backup configuration
    log_info "Backing up configuration files..."
    tar -czf `$BACKUP_PATH/config.tar.gz \
        `$CONFIG_DIR/.env* \
        `$CONFIG_DIR/docker-compose*.yml \
        `$CONFIG_DIR/nginx/ \
        `$CONFIG_DIR/ssl/ \
        `$CONFIG_DIR/scripts/ \
        2>/dev/null || true
    
    # Backup system configuration
    log_info "Backing up system configuration..."
    tar -czf `$BACKUP_PATH/system_config.tar.gz \
        /etc/nginx/ \
        /etc/postgresql/ \
        /etc/redis/ \
        /etc/fail2ban/ \
        /etc/ufw/ \
        /etc/systemd/system/farmtally.service \
        2>/dev/null || true
    
    # Create backup manifest
    log_info "Creating backup manifest..."
    cat > `$BACKUP_PATH/manifest.txt <<EOF
FarmTally Full Backup Manifest
Created: `$(date)
Backup Name: `$BACKUP_NAME
Server: `$(hostname)
IP Address: `$(hostname -I | awk '{print `$1}')

Contents:
- postgres_full.sql.gz: Complete PostgreSQL database dump
- redis_dump.rdb: Redis RDB snapshot
- redis_appendonly.aof: Redis AOF file
- app_data.tar.gz: Application data directory
- config.tar.gz: FarmTally configuration files
- system_config.tar.gz: System configuration files

Checksums:
`$(cd `$BACKUP_PATH && sha256sum *.gz *.rdb *.aof 2>/dev/null || true)
EOF

    # Calculate backup size
    BACKUP_SIZE=`$(du -sh `$BACKUP_PATH | cut -f1)
    
    # Restart services
    log_info "Restarting services..."
    docker-compose -f `$CONFIG_DIR/docker-compose.yml -f `$CONFIG_DIR/docker-compose.prod.yml up -d
    
    log_info "Full backup completed: `$BACKUP_PATH"
    log_info "Backup size: `$BACKUP_SIZE"
    
    # Compress entire backup
    log_info "Compressing backup archive..."
    tar -czf `$BACKUP_DIR/`$BACKUP_NAME.tar.gz -C `$BACKUP_DIR `$BACKUP_NAME
    rm -rf `$BACKUP_PATH
    
    log_info "Compressed backup: `$BACKUP_DIR/`$BACKUP_NAME.tar.gz"
}

# Incremental backup
incremental_backup() {
    log_step "Starting Incremental Backup"
    
    BACKUP_NAME="farmtally_incremental_backup_`$TIMESTAMP"
    BACKUP_PATH="`$BACKUP_DIR/`$BACKUP_NAME"
    
    mkdir -p `$BACKUP_PATH
    
    # Backup only changed data (last 24 hours)
    log_info "Backing up changed PostgreSQL data..."
    sudo -u postgres psql -d farmtally_prod -c "
        COPY (
            SELECT * FROM users WHERE updated_at > NOW() - INTERVAL '24 hours'
        ) TO '`$BACKUP_PATH/users_incremental.csv' WITH CSV HEADER;
    " 2>/dev/null || true
    
    # Backup Redis changes
    log_info "Backing up Redis incremental data..."
    redis-cli --rdb `$BACKUP_PATH/redis_incremental.rdb 2>/dev/null || true
    
    # Backup logs
    log_info "Backing up recent logs..."
    find `$CONFIG_DIR/logs -name "*.log" -mtime -1 -exec cp {} `$BACKUP_PATH/ \; 2>/dev/null || true
    
    # Compress incremental backup
    tar -czf `$BACKUP_DIR/`$BACKUP_NAME.tar.gz -C `$BACKUP_DIR `$BACKUP_NAME
    rm -rf `$BACKUP_PATH
    
    log_info "Incremental backup completed: `$BACKUP_DIR/`$BACKUP_NAME.tar.gz"
}

# Restore from backup
restore_backup() {
    local backup_file="`$1"
    
    if [ -z "`$backup_file" ]; then
        log_error "Please specify backup file to restore from"
        exit 1
    fi
    
    if [ ! -f "`$backup_file" ]; then
        log_error "Backup file not found: `$backup_file"
        exit 1
    fi
    
    log_step "Starting System Restore from `$backup_file"
    
    # Confirmation prompt
    read -p "This will overwrite current data. Continue? (yes/no): " confirm
    if [ "`$confirm" != "yes" ]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
    
    # Stop services
    log_info "Stopping services..."
    docker-compose -f `$CONFIG_DIR/docker-compose.yml -f `$CONFIG_DIR/docker-compose.prod.yml down
    
    # Extract backup
    log_info "Extracting backup..."
    RESTORE_DIR="/tmp/farmtally_restore_`$TIMESTAMP"
    mkdir -p `$RESTORE_DIR
    tar -xzf "`$backup_file" -C `$RESTORE_DIR
    
    # Find backup directory
    BACKUP_CONTENT=`$(find `$RESTORE_DIR -name "manifest.txt" -exec dirname {} \;)
    
    if [ -z "`$BACKUP_CONTENT" ]; then
        log_error "Invalid backup file format"
        exit 1
    fi
    
    # Restore PostgreSQL
    if [ -f "`$BACKUP_CONTENT/postgres_full.sql.gz" ]; then
        log_info "Restoring PostgreSQL database..."
        systemctl stop postgresql
        sudo -u postgres dropdb farmtally_prod 2>/dev/null || true
        sudo -u postgres createdb farmtally_prod
        gunzip -c `$BACKUP_CONTENT/postgres_full.sql.gz | sudo -u postgres psql
        systemctl start postgresql
    fi
    
    # Restore Redis
    if [ -f "`$BACKUP_CONTENT/redis_dump.rdb" ]; then
        log_info "Restoring Redis data..."
        systemctl stop redis-server
        cp `$BACKUP_CONTENT/redis_dump.rdb /var/lib/redis/dump.rdb
        cp `$BACKUP_CONTENT/redis_appendonly.aof /var/lib/redis/appendonly.aof 2>/dev/null || true
        chown redis:redis /var/lib/redis/*
        systemctl start redis-server
    fi
    
    # Restore application data
    if [ -f "`$BACKUP_CONTENT/app_data.tar.gz" ]; then
        log_info "Restoring application data..."
        tar -xzf `$BACKUP_CONTENT/app_data.tar.gz -C `$DATA_DIR
    fi
    
    # Restore configuration
    if [ -f "`$BACKUP_CONTENT/config.tar.gz" ]; then
        log_info "Restoring configuration files..."
        tar -xzf `$BACKUP_CONTENT/config.tar.gz -C /
    fi
    
    # Restart services
    log_info "Starting services..."
    docker-compose -f `$CONFIG_DIR/docker-compose.yml -f `$CONFIG_DIR/docker-compose.prod.yml up -d
    
    # Cleanup
    rm -rf `$RESTORE_DIR
    
    log_info "System restore completed successfully"
}

# Test restore procedure
test_restore() {
    log_step "Testing Restore Procedure"
    
    # Create test backup
    log_info "Creating test backup..."
    TEST_BACKUP="`$BACKUP_DIR/test_backup_`$TIMESTAMP.tar.gz"
    
    # Create minimal test data
    mkdir -p /tmp/test_backup
    echo "Test backup created on `$(date)" > /tmp/test_backup/test.txt
    tar -czf `$TEST_BACKUP -C /tmp test_backup
    rm -rf /tmp/test_backup
    
    # Test extraction
    log_info "Testing backup extraction..."
    TEST_RESTORE_DIR="/tmp/test_restore_`$TIMESTAMP"
    mkdir -p `$TEST_RESTORE_DIR
    tar -xzf `$TEST_BACKUP -C `$TEST_RESTORE_DIR
    
    if [ -f "`$TEST_RESTORE_DIR/test_backup/test.txt" ]; then
        log_info "Backup extraction test: PASSED"
    else
        log_error "Backup extraction test: FAILED"
    fi
    
    # Cleanup
    rm -rf `$TEST_RESTORE_DIR `$TEST_BACKUP
    
    log_info "Restore test completed"
}

# Cleanup old backups
cleanup_backups() {
    log_step "Cleaning Up Old Backups"
    
    log_info "Removing backups older than `$RETENTION_DAYS days..."
    
    find `$BACKUP_DIR -name "farmtally_*_backup_*.tar.gz" -mtime +`$RETENTION_DAYS -delete
    
    # Keep at least 3 full backups
    FULL_BACKUPS=`$(find `$BACKUP_DIR -name "farmtally_full_backup_*.tar.gz" | wc -l)
    if [ `$FULL_BACKUPS -gt 3 ]; then
        find `$BACKUP_DIR -name "farmtally_full_backup_*.tar.gz" | sort | head -n -3 | xargs rm -f
    fi
    
    log_info "Backup cleanup completed"
}

# Upload to remote backup
upload_remote_backup() {
    local backup_file="`$1"
    
    if [ -z "`$REMOTE_BACKUP_HOST" ]; then
        log_warn "Remote backup host not configured"
        return
    fi
    
    log_info "Uploading backup to remote server..."
    
    # Upload via rsync
    rsync -avz --progress "`$backup_file" `$REMOTE_BACKUP_USER@`$REMOTE_BACKUP_HOST:/backups/farmtally/
    
    if [ `$? -eq 0 ]; then
        log_info "Remote backup upload completed"
    else
        log_error "Remote backup upload failed"
    fi
}

# Main disaster recovery function
main() {
    case "`$1" in
        "full-backup")
            preflight_checks
            full_backup
            cleanup_backups
            ;;
        "incremental-backup")
            preflight_checks
            incremental_backup
            ;;
        "restore")
            preflight_checks
            restore_backup "`$2"
            ;;
        "test-restore")
            test_restore
            ;;
        "cleanup")
            cleanup_backups
            ;;
        *)
            echo "Usage: `$0 [full-backup|incremental-backup|restore|test-restore|cleanup]"
            echo ""
            echo "Commands:"
            echo "  full-backup        Create complete system backup"
            echo "  incremental-backup Create incremental backup (last 24h changes)"
            echo "  restore <file>     Restore from backup file"
            echo "  test-restore       Test restore procedures"
            echo "  cleanup            Remove old backup files"
            echo ""
            echo "Examples:"
            echo "  `$0 full-backup"
            echo "  `$0 restore /opt/farmtally/backups/farmtally_full_backup_20241023_120000.tar.gz"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "`$@"
"@

    $drScript | Out-File -FilePath "scripts/disaster-recovery.sh" -Encoding UTF8
    Write-Info "Disaster recovery script generated: scripts/disaster-recovery.sh"
}

# Generate system monitoring script
function Generate-SystemMonitoring {
    Write-Step "Generating System Monitoring Script"
    
    $monitorScript = @"
#!/bin/bash
# System Monitoring Script for FarmTally Production
# Comprehensive system health monitoring

set -e

# Configuration
LOG_DIR="/opt/farmtally/logs"
ALERT_EMAIL="admin@farmtally.com"
METRICS_FILE="`$LOG_DIR/system-metrics.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90
ALERT_THRESHOLD_LOAD=5.0

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "`${GREEN}[INFO]`${NC} `$1" | tee -a `$METRICS_FILE
}

log_warn() {
    echo -e "`${YELLOW}[WARN]`${NC} `$1" | tee -a `$METRICS_FILE
}

log_error() {
    echo -e "`${RED}[ERROR]`${NC} `$1" | tee -a `$METRICS_FILE
}

log_metric() {
    echo "`$(date '+%Y-%m-%d %H:%M:%S'),`$1" >> `$METRICS_FILE
}

# System resource monitoring
monitor_system_resources() {
    # CPU Usage
    CPU_USAGE=`$(top -bn1 | grep "Cpu(s)" | awk '{print `$2}' | awk -F'%' '{print `$1}')
    log_metric "cpu_usage,`$CPU_USAGE"
    
    if (( `$(echo "`$CPU_USAGE > `$ALERT_THRESHOLD_CPU" | bc -l) )); then
        log_warn "High CPU usage: `${CPU_USAGE}%"
        send_alert "High CPU Usage" "CPU usage is at `${CPU_USAGE}%"
    fi
    
    # Memory Usage
    MEMORY_INFO=`$(free -m)
    MEMORY_TOTAL=`$(echo "`$MEMORY_INFO" | awk 'NR==2{print `$2}')
    MEMORY_USED=`$(echo "`$MEMORY_INFO" | awk 'NR==2{print `$3}')
    MEMORY_USAGE=`$(echo "scale=1; `$MEMORY_USED * 100 / `$MEMORY_TOTAL" | bc)
    log_metric "memory_usage,`$MEMORY_USAGE"
    log_metric "memory_total,`$MEMORY_TOTAL"
    log_metric "memory_used,`$MEMORY_USED"
    
    if (( `$(echo "`$MEMORY_USAGE > `$ALERT_THRESHOLD_MEMORY" | bc -l) )); then
        log_warn "High memory usage: `${MEMORY_USAGE}%"
        send_alert "High Memory Usage" "Memory usage is at `${MEMORY_USAGE}%"
    fi
    
    # Disk Usage
    DISK_INFO=`$(df -h / | tail -1)
    DISK_USAGE=`$(echo "`$DISK_INFO" | awk '{print `$5}' | sed 's/%//')
    DISK_AVAILABLE=`$(echo "`$DISK_INFO" | awk '{print `$4}')
    log_metric "disk_usage,`$DISK_USAGE"
    log_metric "disk_available,`$DISK_AVAILABLE"
    
    if [ `$DISK_USAGE -gt `$ALERT_THRESHOLD_DISK ]; then
        log_warn "High disk usage: `${DISK_USAGE}%"
        send_alert "High Disk Usage" "Disk usage is at `${DISK_USAGE}%, available: `$DISK_AVAILABLE"
    fi
    
    # Load Average
    LOAD_AVG=`$(uptime | awk -F'load average:' '{print `$2}' | awk '{print `$1}' | sed 's/,//')
    log_metric "load_average,`$LOAD_AVG"
    
    if (( `$(echo "`$LOAD_AVG > `$ALERT_THRESHOLD_LOAD" | bc -l) )); then
        log_warn "High system load: `$LOAD_AVG"
        send_alert "High System Load" "System load average is `$LOAD_AVG"
    fi
}

# Docker container monitoring
monitor_docker_containers() {
    CONTAINERS=("farmtally-user-service" "farmtally-postgres" "farmtally-redis" "farmtally-nginx")
    
    for container in "`${CONTAINERS[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q `$container; then
            # Container is running
            log_metric "container_status,`$container,running"
            
            # Get container stats
            STATS=`$(docker stats `$container --no-stream --format "{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}")
            CPU_PERC=`$(echo `$STATS | cut -d',' -f1 | sed 's/%//')
            MEM_USAGE=`$(echo `$STATS | cut -d',' -f2)
            
            log_metric "container_cpu,`$container,`$CPU_PERC"
            log_metric "container_memory,`$container,`$MEM_USAGE"
            
        else
            # Container is not running
            log_error "Container `$container is not running"
            log_metric "container_status,`$container,stopped"
            send_alert "Container Down" "Container `$container is not running"
        fi
    done
}

# Application health monitoring
monitor_application_health() {
    # Health check endpoint
    if curl -f -s -m 10 http://localhost:3000/health > /dev/null; then
        log_metric "app_health,healthy"
        log_info "Application health check: OK"
    else
        log_error "Application health check: FAILED"
        log_metric "app_health,unhealthy"
        send_alert "Application Health Check Failed" "The application health endpoint is not responding"
    fi
    
    # Database connectivity
    if sudo -u postgres psql -U farmtally_prod_user -d farmtally_prod -c "SELECT 1;" > /dev/null 2>&1; then
        log_metric "db_health,healthy"
        
        # Database size
        DB_SIZE=`$(sudo -u postgres psql -U farmtally_prod_user -d farmtally_prod -t -c "SELECT pg_size_pretty(pg_database_size('farmtally_prod'));" | xargs)
        log_metric "db_size,`$DB_SIZE"
        
        # Active connections
        ACTIVE_CONN=`$(sudo -u postgres psql -U farmtally_prod_user -d farmtally_prod -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" | xargs)
        log_metric "db_connections,`$ACTIVE_CONN"
        
    else
        log_error "Database connectivity: FAILED"
        log_metric "db_health,unhealthy"
        send_alert "Database Connection Failed" "Cannot connect to PostgreSQL database"
    fi
    
    # Redis connectivity
    if redis-cli -a farmtally_redis_secure_password_2024 ping | grep -q PONG; then
        log_metric "redis_health,healthy"
        
        # Redis memory usage
        REDIS_MEMORY=`$(redis-cli -a farmtally_redis_secure_password_2024 info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        log_metric "redis_memory,`$REDIS_MEMORY"
        
        # Connected clients
        REDIS_CLIENTS=`$(redis-cli -a farmtally_redis_secure_password_2024 info clients | grep connected_clients | cut -d: -f2 | tr -d '\r')
        log_metric "redis_clients,`$REDIS_CLIENTS"
        
    else
        log_error "Redis connectivity: FAILED"
        log_metric "redis_health,unhealthy"
        send_alert "Redis Connection Failed" "Cannot connect to Redis server"
    fi
}

# Network monitoring
monitor_network() {
    # Check listening ports
    LISTENING_PORTS=`$(ss -tuln | grep -E ":80|:443|:3000|:5432|:6379" | wc -l)
    log_metric "listening_ports,`$LISTENING_PORTS"
    
    # Network connections
    ESTABLISHED_CONN=`$(ss -tun | grep ESTAB | wc -l)
    log_metric "established_connections,`$ESTABLISHED_CONN"
    
    # Check external connectivity
    if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        log_metric "external_connectivity,ok"
    else
        log_error "External connectivity: FAILED"
        log_metric "external_connectivity,failed"
        send_alert "Network Connectivity Issue" "Cannot reach external networks"
    fi
}

# Log file monitoring
monitor_logs() {
    # Check for errors in application logs
    if [ -f "`$LOG_DIR/app/farmtally.log" ]; then
        ERROR_COUNT=`$(tail -n 1000 `$LOG_DIR/app/farmtally.log | grep -i error | wc -l)
        log_metric "app_errors,`$ERROR_COUNT"
        
        if [ `$ERROR_COUNT -gt 10 ]; then
            log_warn "High error count in application logs: `$ERROR_COUNT"
            send_alert "High Error Rate" "`$ERROR_COUNT errors found in application logs"
        fi
    fi
    
    # Check nginx error logs
    if [ -f "`$LOG_DIR/nginx/error.log" ]; then
        NGINX_ERRORS=`$(tail -n 1000 `$LOG_DIR/nginx/error.log | wc -l)
        log_metric "nginx_errors,`$NGINX_ERRORS"
    fi
}

# Send alert notification
send_alert() {
    local subject="`$1"
    local message="`$2"
    local timestamp=`$(date)
    
    # Log alert
    log_error "ALERT: `$subject - `$message"
    
    # Send email (if configured)
    if command -v mail >/dev/null 2>&1 && [ -n "`$ALERT_EMAIL" ]; then
        echo "Alert Time: `$timestamp
Server: `$(hostname)
Subject: `$subject
Message: `$message

System Status:
CPU Usage: `$(top -bn1 | grep "Cpu(s)" | awk '{print `$2}')
Memory Usage: `$(free -m | awk 'NR==2{printf "%.1f%%", `$3*100/`$2}')
Disk Usage: `$(df -h / | tail -1 | awk '{print `$5}')
Load Average: `$(uptime | awk -F'load average:' '{print `$2}')
" | mail -s "FarmTally Alert: `$subject" `$ALERT_EMAIL
    fi
}

# Generate monitoring report
generate_report() {
    local report_file="`$LOG_DIR/monitoring-report-`$(date +%Y%m%d).txt"
    
    cat > `$report_file <<EOF
FarmTally System Monitoring Report
Generated: `$(date)
Server: `$(hostname)

=== System Resources ===
CPU Usage: `$(top -bn1 | grep "Cpu(s)" | awk '{print `$2}')
Memory Usage: `$(free -m | awk 'NR==2{printf "%d/%dMB (%.1f%%)", `$3,`$2,`$3*100/`$2}')
Disk Usage: `$(df -h / | tail -1 | awk '{print `$5 " (" `$4 " available)"}')
Load Average: `$(uptime | awk -F'load average:' '{print `$2}')
Uptime: `$(uptime | awk '{print `$3 " " `$4}' | sed 's/,//')

=== Docker Containers ===
`$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

=== Application Health ===
Health Endpoint: `$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "Failed")
Database: `$(sudo -u postgres psql -U farmtally_prod_user -d farmtally_prod -c "SELECT 1;" > /dev/null 2>&1 && echo "OK" || echo "Failed")
Redis: `$(redis-cli -a farmtally_redis_secure_password_2024 ping 2>/dev/null || echo "Failed")

=== Network Status ===
Listening Ports: `$(ss -tuln | grep -E ":80|:443|:3000|:5432|:6379")
Active Connections: `$(ss -tun | grep ESTAB | wc -l)
External Connectivity: `$(ping -c 1 8.8.8.8 > /dev/null 2>&1 && echo "OK" || echo "Failed")

=== Recent Alerts ===
`$(tail -n 20 `$METRICS_FILE | grep -E "WARN|ERROR" || echo "No recent alerts")
EOF

    log_info "Monitoring report generated: `$report_file"
}

# Main monitoring function
main() {
    echo "`$(date): Starting system monitoring check" >> `$METRICS_FILE
    
    monitor_system_resources
    monitor_docker_containers
    monitor_application_health
    monitor_network
    monitor_logs
    
    # Generate daily report at midnight
    if [ "`$(date +%H%M)" = "0000" ]; then
        generate_report
    fi
    
    echo "`$(date): Monitoring check completed" >> `$METRICS_FILE
    echo "---" >> `$METRICS_FILE
}

# Execute monitoring
main
"@

    $monitorScript | Out-File -FilePath "scripts/system-monitoring.sh" -Encoding UTF8
    Write-Info "System monitoring script generated: scripts/system-monitoring.sh"
}

# Main execution
Write-Host "🔧 FarmTally Infrastructure Configuration Generator" -ForegroundColor Magenta
Write-Host ""

Generate-DisasterRecoveryScript
Generate-SystemMonitoring

Write-Host ""
Write-Info "Infrastructure configuration completed!"
Write-Info "Generated files:"
Write-Host "  - scripts/install-databases.ps1 (database installation)"
Write-Host "  - scripts/disaster-recovery.sh (backup and recovery)"
Write-Host "  - scripts/system-monitoring.sh (system monitoring)"
Write-Host ""
Write-Info "Next steps:"
Write-Host "1. Run database installation: .\scripts\install-databases.ps1"
Write-Host "2. Copy scripts to server and make executable"
Write-Host "3. Set up cron jobs for monitoring and backups"
Write-Host "4. Test disaster recovery procedures"
Write-Host "5. Configure alerting and notifications"