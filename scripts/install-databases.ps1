# Database Installation Script for FarmTally
# Installs and configures PostgreSQL, MongoDB, and Redis for production

param(
    [switch]$PostgreSQL = $true,
    [switch]$Redis = $true,
    [switch]$MongoDB = $false,  # Optional for future use
    [string]$PostgreSQLVersion = "15",
    [string]$RedisVersion = "7"
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

# Generate PostgreSQL installation script
function Generate-PostgreSQLInstall {
    Write-Step "Generating PostgreSQL Installation Script"
    
    $postgresScript = @"
#!/bin/bash
# PostgreSQL Installation and Configuration Script
# Version: $PostgreSQLVersion

set -e

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

# Install PostgreSQL
install_postgresql() {
    log_info "Installing PostgreSQL $PostgreSQLVersion..."
    
    # Add PostgreSQL official APT repository
    sudo apt-get update
    sudo apt-get install -y wget ca-certificates
    
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
    echo "deb http://apt.postgresql.org/pub/repos/apt/ `$(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
    
    sudo apt-get update
    sudo apt-get install -y postgresql-$PostgreSQLVersion postgresql-client-$PostgreSQLVersion postgresql-contrib-$PostgreSQLVersion
    
    log_info "PostgreSQL $PostgreSQLVersion installed successfully"
}

# Configure PostgreSQL
configure_postgresql() {
    log_info "Configuring PostgreSQL..."
    
    # Start and enable PostgreSQL
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    # Create farmtally database and user
    sudo -u postgres psql -c "CREATE DATABASE farmtally_prod;"
    sudo -u postgres psql -c "CREATE USER farmtally_prod_user WITH ENCRYPTED PASSWORD 'farmtally_secure_password_2024';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE farmtally_prod TO farmtally_prod_user;"
    sudo -u postgres psql -c "ALTER USER farmtally_prod_user CREATEDB;"
    
    # Configure PostgreSQL settings
    PG_VERSION=`$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1)
    PG_CONFIG_DIR="/etc/postgresql/`$PG_VERSION/main"
    
    # Backup original configuration
    sudo cp `$PG_CONFIG_DIR/postgresql.conf `$PG_CONFIG_DIR/postgresql.conf.backup
    sudo cp `$PG_CONFIG_DIR/pg_hba.conf `$PG_CONFIG_DIR/pg_hba.conf.backup
    
    # Update postgresql.conf
    sudo tee -a `$PG_CONFIG_DIR/postgresql.conf > /dev/null <<EOF

# FarmTally Production Settings
listen_addresses = '*'
port = 5432
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 10MB

# Security
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
password_encryption = scram-sha-256
EOF

    # Update pg_hba.conf for secure access
    sudo tee `$PG_CONFIG_DIR/pg_hba.conf > /dev/null <<EOF
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             postgres                                peer
local   all             all                                     md5

# IPv4 local connections
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             172.20.0.0/16           scram-sha-256

# IPv6 local connections
host    all             all             ::1/128                 scram-sha-256

# Replication connections
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
EOF

    # Restart PostgreSQL to apply changes
    sudo systemctl restart postgresql
    
    log_info "PostgreSQL configuration completed"
}

# Setup PostgreSQL monitoring
setup_postgresql_monitoring() {
    log_info "Setting up PostgreSQL monitoring..."
    
    # Create monitoring script
    sudo tee /opt/farmtally/scripts/postgres-monitor.sh > /dev/null <<'EOF'
#!/bin/bash
# PostgreSQL Monitoring Script

PGUSER="farmtally_prod_user"
PGDATABASE="farmtally_prod"
LOG_FILE="/opt/farmtally/logs/postgres-monitor.log"

# Check database connectivity
if sudo -u postgres psql -U `$PGUSER -d `$PGDATABASE -c "SELECT 1;" > /dev/null 2>&1; then
    echo "`$(date): PostgreSQL connectivity OK" >> `$LOG_FILE
else
    echo "`$(date): PostgreSQL connectivity FAILED" >> `$LOG_FILE
fi

# Check database size
DB_SIZE=`$(sudo -u postgres psql -U `$PGUSER -d `$PGDATABASE -t -c "SELECT pg_size_pretty(pg_database_size('`$PGDATABASE'));" | xargs)
echo "`$(date): Database size: `$DB_SIZE" >> `$LOG_FILE

# Check active connections
ACTIVE_CONN=`$(sudo -u postgres psql -U `$PGUSER -d `$PGDATABASE -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" | xargs)
echo "`$(date): Active connections: `$ACTIVE_CONN" >> `$LOG_FILE
EOF

    sudo chmod +x /opt/farmtally/scripts/postgres-monitor.sh
    
    # Add to cron
    (sudo -u postgres crontab -l 2>/dev/null; echo "*/5 * * * * /opt/farmtally/scripts/postgres-monitor.sh") | sudo -u postgres crontab -
    
    log_info "PostgreSQL monitoring setup completed"
}

# Main PostgreSQL installation
main() {
    log_info "Starting PostgreSQL installation and configuration..."
    
    install_postgresql
    configure_postgresql
    setup_postgresql_monitoring
    
    log_info "PostgreSQL setup completed successfully!"
    log_info "Database: farmtally_prod"
    log_info "User: farmtally_prod_user"
    log_warn "Please change the default password in production!"
}

main
"@

    $postgresScript | Out-File -FilePath "scripts/install-postgresql.sh" -Encoding UTF8
    Write-Info "PostgreSQL installation script generated: scripts/install-postgresql.sh"
}

# Generate Redis installation script
function Generate-RedisInstall {
    Write-Step "Generating Redis Installation Script"
    
    $redisScript = @"
#!/bin/bash
# Redis Installation and Configuration Script
# Version: $RedisVersion

set -e

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

# Install Redis
install_redis() {
    log_info "Installing Redis $RedisVersion..."
    
    # Add Redis repository
    sudo apt-get update
    sudo apt-get install -y software-properties-common
    sudo add-apt-repository -y ppa:redislabs/redis
    sudo apt-get update
    
    # Install Redis
    sudo apt-get install -y redis-server
    
    log_info "Redis $RedisVersion installed successfully"
}

# Configure Redis
configure_redis() {
    log_info "Configuring Redis..."
    
    # Backup original configuration
    sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup
    
    # Create Redis configuration
    sudo tee /etc/redis/redis.conf > /dev/null <<EOF
# Redis Configuration for FarmTally Production

# Network
bind 127.0.0.1 172.20.0.0/16
port 6379
protected-mode yes
tcp-backlog 511
timeout 0
tcp-keepalive 300

# General
daemonize yes
supervised systemd
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis-server.log
databases 16

# Security
requirepass farmtally_redis_secure_password_2024
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
rename-command CONFIG "CONFIG_b835729c9f"

# Memory Management
maxmemory 512mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Append Only File
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-load-truncated yes
aof-use-rdb-preamble yes

# Slow Log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Latency Monitoring
latency-monitor-threshold 100

# Client Output Buffer Limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Performance
hz 10
dynamic-hz yes
aof-rewrite-incremental-fsync yes
rdb-save-incremental-fsync yes
EOF

    # Set proper permissions
    sudo chown redis:redis /etc/redis/redis.conf
    sudo chmod 640 /etc/redis/redis.conf
    
    # Create log directory
    sudo mkdir -p /var/log/redis
    sudo chown redis:redis /var/log/redis
    
    # Start and enable Redis
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
    
    log_info "Redis configuration completed"
}

# Setup Redis monitoring
setup_redis_monitoring() {
    log_info "Setting up Redis monitoring..."
    
    # Create monitoring script
    sudo tee /opt/farmtally/scripts/redis-monitor.sh > /dev/null <<'EOF'
#!/bin/bash
# Redis Monitoring Script

REDIS_PASSWORD="farmtally_redis_secure_password_2024"
LOG_FILE="/opt/farmtally/logs/redis-monitor.log"

# Check Redis connectivity
if redis-cli -a `$REDIS_PASSWORD ping | grep -q PONG; then
    echo "`$(date): Redis connectivity OK" >> `$LOG_FILE
else
    echo "`$(date): Redis connectivity FAILED" >> `$LOG_FILE
fi

# Check Redis memory usage
MEMORY_USAGE=`$(redis-cli -a `$REDIS_PASSWORD info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
echo "`$(date): Redis memory usage: `$MEMORY_USAGE" >> `$LOG_FILE

# Check connected clients
CONNECTED_CLIENTS=`$(redis-cli -a `$REDIS_PASSWORD info clients | grep connected_clients | cut -d: -f2 | tr -d '\r')
echo "`$(date): Connected clients: `$CONNECTED_CLIENTS" >> `$LOG_FILE

# Check keyspace
KEYSPACE=`$(redis-cli -a `$REDIS_PASSWORD info keyspace | grep db0 | cut -d: -f2 | tr -d '\r')
if [ -n "`$KEYSPACE" ]; then
    echo "`$(date): Keyspace info: `$KEYSPACE" >> `$LOG_FILE
else
    echo "`$(date): No keys in database" >> `$LOG_FILE
fi
EOF

    sudo chmod +x /opt/farmtally/scripts/redis-monitor.sh
    
    # Add to cron
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/farmtally/scripts/redis-monitor.sh") | crontab -
    
    log_info "Redis monitoring setup completed"
}

# Main Redis installation
main() {
    log_info "Starting Redis installation and configuration..."
    
    install_redis
    configure_redis
    setup_redis_monitoring
    
    log_info "Redis setup completed successfully!"
    log_warn "Please change the default password in production!"
}

main
"@

    $redisScript | Out-File -FilePath "scripts/install-redis.sh" -Encoding UTF8
    Write-Info "Redis installation script generated: scripts/install-redis.sh"
}

# Generate network configuration script
function Generate-NetworkConfig {
    Write-Step "Generating Network Configuration Script"
    
    $networkScript = @"
#!/bin/bash
# Network Configuration Script for FarmTally Server
# Configures firewall rules and network security

set -e

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

# Configure UFW firewall
configure_firewall() {
    log_info "Configuring UFW firewall..."
    
    # Reset firewall to defaults
    sudo ufw --force reset
    
    # Set default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH (be careful with this)
    sudo ufw allow ssh
    sudo ufw allow 22/tcp
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Allow application ports (restrict to specific IPs in production)
    sudo ufw allow from 172.20.0.0/16 to any port 3000  # Application
    sudo ufw allow from 172.20.0.0/16 to any port 5432  # PostgreSQL
    sudo ufw allow from 172.20.0.0/16 to any port 6379  # Redis
    
    # Allow Docker networks
    sudo ufw allow from 172.17.0.0/16
    sudo ufw allow from 172.20.0.0/16
    
    # Rate limiting for SSH
    sudo ufw limit ssh
    
    # Enable firewall
    sudo ufw --force enable
    
    log_info "Firewall configuration completed"
}

# Configure fail2ban
configure_fail2ban() {
    log_info "Configuring fail2ban..."
    
    # Install fail2ban if not present
    sudo apt-get update
    sudo apt-get install -y fail2ban
    
    # Create custom jail configuration
    sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
# Ban settings
bantime = 3600
findtime = 600
maxretry = 3
backend = auto
usedns = warn
logencoding = auto
enabled = false
mode = normal
filter = %(__name__)s[mode=%(mode)s]

# Email notifications
destemail = admin@farmtally.com
sendername = Fail2Ban-FarmTally
mta = sendmail
action = %(action_mwl)s

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
logpath = /opt/farmtally/logs/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
port = http,https
logpath = /opt/farmtally/logs/nginx/error.log
maxretry = 10
findtime = 600
bantime = 600

[farmtally-auth]
enabled = true
port = http,https
logpath = /opt/farmtally/logs/app/farmtally.log
filter = farmtally-auth
maxretry = 5
bantime = 1800
EOF

    # Create custom filter for FarmTally authentication
    sudo tee /etc/fail2ban/filter.d/farmtally-auth.conf > /dev/null <<EOF
[Definition]
failregex = ^.*Authentication failed.*IP: <HOST>.*`$
            ^.*Invalid login attempt.*from <HOST>.*`$
            ^.*Brute force attempt.*IP: <HOST>.*`$

ignoreregex =
EOF

    # Start and enable fail2ban
    sudo systemctl start fail2ban
    sudo systemctl enable fail2ban
    
    log_info "Fail2ban configuration completed"
}

# Configure network security
configure_network_security() {
    log_info "Configuring network security settings..."
    
    # Kernel network security parameters
    sudo tee -a /etc/sysctl.conf > /dev/null <<EOF

# FarmTally Network Security Settings
# IP Spoofing protection
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Ignore ICMP ping requests
net.ipv4.icmp_echo_ignore_all = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Ignore bogus ICMP errors
net.ipv4.icmp_ignore_bogus_error_responses = 1

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# TCP connection settings
net.ipv4.tcp_keepalive_time = 7200
net.ipv4.tcp_keepalive_probes = 9
net.ipv4.tcp_keepalive_intvl = 75
net.ipv4.tcp_fin_timeout = 30

# Memory and connection limits
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_window_scaling = 1
EOF

    # Apply sysctl settings
    sudo sysctl -p
    
    log_info "Network security configuration completed"
}

# Setup network monitoring
setup_network_monitoring() {
    log_info "Setting up network monitoring..."
    
    # Install network monitoring tools
    sudo apt-get install -y nethogs iftop nload
    
    # Create network monitoring script
    sudo tee /opt/farmtally/scripts/network-monitor.sh > /dev/null <<'EOF'
#!/bin/bash
# Network Monitoring Script

LOG_FILE="/opt/farmtally/logs/network-monitor.log"

# Check network interfaces
echo "`$(date): Network interface status:" >> `$LOG_FILE
ip addr show | grep -E "^[0-9]+:|inet " >> `$LOG_FILE

# Check network connections
echo "`$(date): Active network connections:" >> `$LOG_FILE
ss -tuln | grep -E ":80|:443|:3000|:5432|:6379" >> `$LOG_FILE

# Check firewall status
echo "`$(date): Firewall status:" >> `$LOG_FILE
sudo ufw status numbered >> `$LOG_FILE

# Check fail2ban status
echo "`$(date): Fail2ban status:" >> `$LOG_FILE
sudo fail2ban-client status >> `$LOG_FILE

echo "---" >> `$LOG_FILE
EOF

    sudo chmod +x /opt/farmtally/scripts/network-monitor.sh
    
    # Add to cron
    (crontab -l 2>/dev/null; echo "*/10 * * * * /opt/farmtally/scripts/network-monitor.sh") | crontab -
    
    log_info "Network monitoring setup completed"
}

# Main network configuration
main() {
    log_info "Starting network configuration..."
    
    configure_firewall
    configure_fail2ban
    configure_network_security
    setup_network_monitoring
    
    log_info "Network configuration completed successfully!"
    log_warn "Please test all connections after configuration changes"
}

main
"@

    $networkScript | Out-File -FilePath "scripts/configure-network.sh" -Encoding UTF8
    Write-Info "Network configuration script generated: scripts/configure-network.sh"
}

# Generate environment management script
function Generate-EnvironmentConfig {
    Write-Step "Generating Environment Configuration Script"
    
    $envScript = @"
#!/bin/bash
# Environment Configuration Script for FarmTally
# Manages environment variables and secrets

set -e

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

# Generate secure passwords
generate_passwords() {
    log_info "Generating secure passwords..."
    
    # Generate random passwords
    POSTGRES_PASSWORD=`$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    REDIS_PASSWORD=`$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    JWT_SECRET=`$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
    SESSION_SECRET=`$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    log_info "Secure passwords generated"
}

# Create production environment file
create_production_env() {
    log_info "Creating production environment file..."
    
    cat > /opt/farmtally/.env <<EOF
# FarmTally Production Environment Configuration
# Generated on `$(date)
# Server: 147.93.153.247

# Application Settings
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9090

# Database Configuration
DATABASE_URL=postgresql://farmtally_prod_user:`${POSTGRES_PASSWORD}@localhost:5432/farmtally_prod
POSTGRES_DB=farmtally_prod
POSTGRES_USER=farmtally_prod_user
POSTGRES_PASSWORD=`${POSTGRES_PASSWORD}

# Redis Configuration
REDIS_URL=redis://:`${REDIS_PASSWORD}@localhost:6379/0
REDIS_PASSWORD=`${REDIS_PASSWORD}

# JWT Configuration
JWT_SECRET=`${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=`${SESSION_SECRET}

# Authentication Services
MAGIC_LINK_EXPIRES_IN=15m
OTP_EXPIRES_IN=5m
OTP_MAX_ATTEMPTS=3

# Email Service Configuration (UPDATE THESE)
EMAIL_SERVICE_URL=smtp://your-smtp-server:587
EMAIL_FROM=noreply@farmtally.com
EMAIL_FROM_NAME=FarmTally System
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# SMS Service Configuration (UPDATE THESE)
SMS_SERVICE_URL=https://api.your-sms-provider.com
SMS_API_KEY=your-sms-api-key
SMS_FROM=FarmTally

# Google OAuth Configuration (UPDATE THESE)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://147.93.153.247/api/auth/google/callback

# Security Settings
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://147.93.153.247,https://farmtally.local
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload Settings
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/opt/farmtally/uploads
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,doc,docx

# Monitoring and Logging
ENABLE_REQUEST_LOGGING=true
LOG_FILE_PATH=/opt/farmtally/logs/app/farmtally.log
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=5

# Health Check Settings
HEALTH_CHECK_TIMEOUT=5000
DATABASE_HEALTH_CHECK=true
REDIS_HEALTH_CHECK=true

# Performance Settings
CLUSTER_MODE=false
WORKER_PROCESSES=1
KEEP_ALIVE_TIMEOUT=65000
BODY_PARSER_LIMIT=10mb

# SSL/TLS Settings
SSL_CERT_PATH=/opt/farmtally/ssl/farmtally.crt
SSL_KEY_PATH=/opt/farmtally/ssl/farmtally.key
FORCE_HTTPS=true

# Development/Debug Settings (disabled in production)
DEBUG_MODE=false
ENABLE_SWAGGER=false
ENABLE_GRAPHQL_PLAYGROUND=false
EOF

    # Set secure permissions
    chmod 600 /opt/farmtally/.env
    chown farmtally:farmtally /opt/farmtally/.env
    
    log_info "Production environment file created"
}

# Setup secrets management
setup_secrets_management() {
    log_info "Setting up secrets management..."
    
    # Create secrets directory
    mkdir -p /opt/farmtally/secrets
    chmod 700 /opt/farmtally/secrets
    chown farmtally:farmtally /opt/farmtally/secrets
    
    # Store individual secrets
    echo "`$POSTGRES_PASSWORD" > /opt/farmtally/secrets/postgres_password
    echo "`$REDIS_PASSWORD" > /opt/farmtally/secrets/redis_password
    echo "`$JWT_SECRET" > /opt/farmtally/secrets/jwt_secret
    echo "`$SESSION_SECRET" > /opt/farmtally/secrets/session_secret
    
    # Set secure permissions on secrets
    chmod 600 /opt/farmtally/secrets/*
    chown farmtally:farmtally /opt/farmtally/secrets/*
    
    log_info "Secrets management setup completed"
}

# Create environment backup
create_env_backup() {
    log_info "Creating environment backup..."
    
    # Create backup directory
    mkdir -p /opt/farmtally/backups/config
    
    # Backup environment files
    cp /opt/farmtally/.env /opt/farmtally/backups/config/.env.backup.`$(date +%Y%m%d_%H%M%S)
    
    # Keep only last 10 backups
    ls -t /opt/farmtally/backups/config/.env.backup.* | tail -n +11 | xargs -r rm
    
    log_info "Environment backup created"
}

# Main environment setup
main() {
    log_info "Starting environment configuration..."
    
    generate_passwords
    create_production_env
    setup_secrets_management
    create_env_backup
    
    log_info "Environment configuration completed successfully!"
    log_warn "Please update the following in .env file:"
    log_warn "- Email service configuration"
    log_warn "- SMS service configuration"
    log_warn "- Google OAuth credentials"
    log_warn "- External API keys"
    
    log_info "Generated passwords have been saved to /opt/farmtally/secrets/"
}

main
"@

    $envScript | Out-File -FilePath "scripts/configure-environment.sh" -Encoding UTF8
    Write-Info "Environment configuration script generated: scripts/configure-environment.sh"
}

# Main execution
Write-Host "🔧 FarmTally Database and Infrastructure Setup" -ForegroundColor Magenta
Write-Host ""

if ($PostgreSQL) {
    Generate-PostgreSQLInstall
}

if ($Redis) {
    Generate-RedisInstall
}

Generate-NetworkConfig
Generate-EnvironmentConfig

Write-Host ""
Write-Info "Infrastructure configuration scripts generated!"
Write-Info "Generated files:"
if ($PostgreSQL) { Write-Host "  - scripts/install-postgresql.sh" }
if ($Redis) { Write-Host "  - scripts/install-redis.sh" }
Write-Host "  - scripts/configure-network.sh"
Write-Host "  - scripts/configure-environment.sh"
Write-Host ""
Write-Info "Next steps:"
Write-Host "1. Copy scripts to your server"
Write-Host "2. Run scripts in order:"
if ($PostgreSQL) { Write-Host "   - sudo bash install-postgresql.sh" }
if ($Redis) { Write-Host "   - sudo bash install-redis.sh" }
Write-Host "   - sudo bash configure-network.sh"
Write-Host "   - sudo bash configure-environment.sh"
Write-Host "3. Update .env file with your specific configurations"
Write-Host "4. Test database connections"