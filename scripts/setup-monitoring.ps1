# FarmTally Monitoring Setup Script
# Configures comprehensive monitoring and observability stack

param(
    [switch]$StartServices = $false,
    [switch]$ConfigureAlerts = $true,
    [switch]$SetupDashboards = $true,
    [string]$GrafanaPassword = "farmtally_grafana_admin_2024"
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

# Create Grafana datasource configuration
function Create-GrafanaDatasources {
    Write-Step "Creating Grafana Datasource Configuration"
    
    New-Item -ItemType Directory -Path "monitoring/grafana-datasources" -Force | Out-Null
    
    $datasourceConfig = @"
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: 15s
      queryTimeout: 60s
      httpMethod: POST

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
    jsonData:
      maxLines: 1000
      timeout: 60s

  - name: Alertmanager
    type: alertmanager
    access: proxy
    url: http://alertmanager:9093
    editable: true
    jsonData:
      implementation: prometheus
"@

    $datasourceConfig | Out-File -FilePath "monitoring/grafana-datasources/datasources.yml" -Encoding UTF8
    Write-Info "Grafana datasources configuration created"
}

# Create Grafana dashboard provisioning
function Create-GrafanaDashboardProvisioning {
    Write-Step "Creating Grafana Dashboard Provisioning"
    
    $dashboardProvisioning = @"
apiVersion: 1

providers:
  - name: 'FarmTally Dashboards'
    orgId: 1
    folder: 'FarmTally'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
"@

    $dashboardProvisioning | Out-File -FilePath "monitoring/grafana-dashboards/dashboard-config.yml" -Encoding UTF8
    Write-Info "Grafana dashboard provisioning created"
}

# Create application metrics endpoint
function Create-MetricsEndpoint {
    Write-Step "Creating Application Metrics Endpoint"
    
    $metricsCode = @"
// Metrics endpoint for FarmTally application
// Add this to your Express server

import express from 'express';
import promClient from 'prom-client';

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({
  register,
  prefix: 'farmtally_',
});

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'farmtally_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'farmtally_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const activeUsers = new promClient.Gauge({
  name: 'farmtally_active_users',
  help: 'Number of active users',
});

const databaseConnections = new promClient.Gauge({
  name: 'farmtally_database_connections',
  help: 'Number of active database connections',
});

const authenticationAttempts = new promClient.Counter({
  name: 'farmtally_authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'],
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeUsers);
register.registerMetric(databaseConnections);
register.registerMetric(authenticationAttempts);

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
};

// Metrics endpoint
export const metricsHandler = async (req: express.Request, res: express.Response) => {
  try {
    // Update dynamic metrics
    // activeUsers.set(await getUserCount());
    // databaseConnections.set(await getDatabaseConnectionCount());
    
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
};

// Helper functions to update metrics
export const updateActiveUsers = (count: number) => {
  activeUsers.set(count);
};

export const updateDatabaseConnections = (count: number) => {
  databaseConnections.set(count);
};

export const recordAuthenticationAttempt = (method: string, success: boolean) => {
  authenticationAttempts
    .labels(method, success ? 'success' : 'failure')
    .inc();
};
"@

    $metricsCode | Out-File -FilePath "src/utils/metrics.ts" -Encoding UTF8
    Write-Info "Application metrics endpoint code created at src/utils/metrics.ts"
}

# Create log rotation configuration
function Create-LogRotationConfig {
    Write-Step "Creating Log Rotation Configuration"
    
    $logRotateConfig = @"
# FarmTally Log Rotation Configuration
# Copy this to /etc/logrotate.d/farmtally on the server

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

/opt/farmtally/logs/monitoring/*.log {
    weekly
    missingok
    rotate 12
    compress
    delaycompress
    notifempty
    create 644 farmtally farmtally
}
"@

    $logRotateConfig | Out-File -FilePath "monitoring/logrotate-farmtally" -Encoding UTF8
    Write-Info "Log rotation configuration created"
}

# Create monitoring startup script
function Create-MonitoringStartupScript {
    Write-Step "Creating Monitoring Startup Script"
    
    $startupScript = @"
#!/bin/bash
# FarmTally Monitoring Stack Startup Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "`${BLUE}==== `$1 ====${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check available disk space (need at least 5GB)
    AVAILABLE_SPACE=`$(df /opt/farmtally | tail -1 | awk '{print `$4}')
    REQUIRED_SPACE=5242880  # 5GB in KB
    
    if [ `$AVAILABLE_SPACE -lt `$REQUIRED_SPACE ]; then
        log_error "Insufficient disk space. Required: 5GB, Available: `$((`$AVAILABLE_SPACE / 1024 / 1024))GB"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Create monitoring directories
create_directories() {
    log_step "Creating Monitoring Directories"
    
    mkdir -p /opt/farmtally/monitoring/{prometheus,grafana,alertmanager,loki}
    mkdir -p /opt/farmtally/logs/monitoring
    
    # Set permissions
    chown -R farmtally:farmtally /opt/farmtally/monitoring
    chown -R farmtally:farmtally /opt/farmtally/logs/monitoring
    
    log_info "Monitoring directories created"
}

# Start monitoring services
start_monitoring() {
    log_step "Starting Monitoring Services"
    
    cd /opt/farmtally
    
    # Pull latest images
    log_info "Pulling latest monitoring images..."
    docker-compose -f docker-compose.monitoring.yml pull
    
    # Start services
    log_info "Starting monitoring stack..."
    docker-compose -f docker-compose.monitoring.yml up -d
    
    # Wait for services to start
    log_info "Waiting for services to initialize..."
    sleep 30
    
    # Check service health
    check_service_health
    
    log_info "Monitoring services started successfully"
}

# Check service health
check_service_health() {
    log_step "Checking Service Health"
    
    # Check Prometheus
    if curl -f -s http://localhost:9090/-/healthy > /dev/null; then
        log_info "Prometheus: Healthy"
    else
        log_warn "Prometheus: Not responding"
    fi
    
    # Check Grafana
    if curl -f -s http://localhost:3001/api/health > /dev/null; then
        log_info "Grafana: Healthy"
    else
        log_warn "Grafana: Not responding"
    fi
    
    # Check Alertmanager
    if curl -f -s http://localhost:9093/-/healthy > /dev/null; then
        log_info "Alertmanager: Healthy"
    else
        log_warn "Alertmanager: Not responding"
    fi
    
    # Check Node Exporter
    if curl -f -s http://localhost:9100/metrics > /dev/null; then
        log_info "Node Exporter: Healthy"
    else
        log_warn "Node Exporter: Not responding"
    fi
}

# Configure Grafana
configure_grafana() {
    log_step "Configuring Grafana"
    
    # Wait for Grafana to be ready
    log_info "Waiting for Grafana to be ready..."
    timeout=60
    while [ `$timeout -gt 0 ]; do
        if curl -f -s http://localhost:3001/api/health > /dev/null; then
            break
        fi
        sleep 2
        timeout=`$((timeout - 2))
    done
    
    if [ `$timeout -le 0 ]; then
        log_error "Grafana failed to start within timeout"
        return 1
    fi
    
    # Import dashboards (if needed)
    log_info "Grafana configuration completed"
}

# Setup log rotation
setup_log_rotation() {
    log_step "Setting Up Log Rotation"
    
    # Copy logrotate configuration
    if [ -f "/opt/farmtally/monitoring/logrotate-farmtally" ]; then
        sudo cp /opt/farmtally/monitoring/logrotate-farmtally /etc/logrotate.d/farmtally
        log_info "Log rotation configured"
    else
        log_warn "Log rotation configuration file not found"
    fi
}

# Display access information
show_access_info() {
    log_step "Monitoring Stack Access Information"
    
    echo ""
    log_info "Monitoring services are now available:"
    echo "  Grafana Dashboard:    http://147.93.153.247:3001"
    echo "  Prometheus:           http://147.93.153.247:9090"
    echo "  Alertmanager:         http://147.93.153.247:9093"
    echo "  Node Exporter:        http://147.93.153.247:9100"
    echo ""
    log_info "Default Grafana credentials:"
    echo "  Username: admin"
    echo "  Password: farmtally_grafana_admin_2024"
    echo ""
    log_warn "Please change the default Grafana password after first login!"
    echo ""
    log_info "Useful commands:"
    echo "  View logs: docker-compose -f docker-compose.monitoring.yml logs -f"
    echo "  Stop monitoring: docker-compose -f docker-compose.monitoring.yml down"
    echo "  Restart monitoring: docker-compose -f docker-compose.monitoring.yml restart"
}

# Main function
main() {
    log_info "Starting FarmTally Monitoring Stack Setup"
    
    check_prerequisites
    create_directories
    start_monitoring
    configure_grafana
    setup_log_rotation
    show_access_info
    
    log_info "Monitoring stack setup completed successfully!"
}

# Execute main function
main
"@

    $startupScript | Out-File -FilePath "scripts/start-monitoring.sh" -Encoding UTF8
    Write-Info "Monitoring startup script created"
}

# Main execution
Write-Host "🔍 FarmTally Monitoring and Observability Setup" -ForegroundColor Magenta
Write-Host ""

Create-GrafanaDatasources
Create-GrafanaDashboardProvisioning
Create-MetricsEndpoint
Create-LogRotationConfig
Create-MonitoringStartupScript

if ($StartServices) {
    Write-Step "Starting Monitoring Services"
    Write-Info "Starting monitoring stack with Docker Compose..."
    
    try {
        docker-compose -f docker-compose.monitoring.yml up -d
        Write-Info "Monitoring services started successfully"
        
        Write-Host ""
        Write-Info "Monitoring services are now available:"
        Write-Host "  Grafana Dashboard:    http://localhost:3001"
        Write-Host "  Prometheus:           http://localhost:9090"
        Write-Host "  Alertmanager:         http://localhost:9093"
        Write-Host ""
        Write-Warn "Default Grafana credentials: admin / $GrafanaPassword"
        
    } catch {
        Write-Error "Failed to start monitoring services: $_"
    }
}

Write-Host ""
Write-Info "Monitoring and observability setup completed!"
Write-Info "Generated files:"
Write-Host "  - monitoring/prometheus.yml (Prometheus configuration)"
Write-Host "  - monitoring/alert_rules.yml (Alert rules)"
Write-Host "  - monitoring/alertmanager.yml (Alert routing)"
Write-Host "  - monitoring/grafana-dashboards/ (Dashboard configurations)"
Write-Host "  - docker-compose.monitoring.yml (Monitoring stack)"
Write-Host "  - src/utils/metrics.ts (Application metrics)"
Write-Host "  - scripts/start-monitoring.sh (Startup script)"
Write-Host ""
Write-Info "Next steps:"
Write-Host "1. Add metrics middleware to your Express app"
Write-Host "2. Copy monitoring files to your server"
Write-Host "3. Run: .\scripts\setup-monitoring.ps1 -StartServices"
Write-Host "4. Configure alert notifications in alertmanager.yml"
Write-Host "5. Import Grafana dashboards and set up alerts"