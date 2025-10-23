# FarmTally Setup on Shared Server (147.93.153.247)
## Multi-Project Isolation Guide

⚠️ **IMPORTANT**: This server is shared with another team. This guide ensures complete isolation to prevent conflicts.

## 🔍 Pre-Setup Assessment

### 1. Check Current Server Usage
```bash
# SSH into the server first
ssh root@147.93.153.247

# Check what's currently running
sudo netstat -tlnp | grep LISTEN
docker ps -a
sudo systemctl list-units --type=service --state=running | grep -E "(jenkins|nginx|postgres|redis)"

# Check existing directories
ls -la /opt/
ls -la /home/
```

### 2. Identify Conflicts
**Common conflict points to check:**
- Port 8080 (Jenkins) - might be used by other team
- Port 3000 (Application) - might be used by other team  
- Port 5432 (PostgreSQL) - might be shared database
- Port 6379 (Redis) - might be shared cache
- Port 80/443 (HTTP/HTTPS) - might have existing web server
- Port 9000 (Docker Registry) - might conflict

## 🏗️ Isolated FarmTally Setup

### Project Structure
```
/opt/farmtally/           # Our isolated directory
├── app/                  # FarmTally application
├── jenkins/              # Our Jenkins instance
├── registry/             # Our Docker registry
├── databases/            # Our isolated databases
├── ssl/                  # Our SSL certificates
├── logs/                 # Our application logs
├── backups/              # Our backups
└── monitoring/           # Our monitoring stack
```

### Port Allocation (Non-Conflicting)
```
FarmTally Services:
- Application:      3001 (instead of 3000)
- Jenkins:          8081 (instead of 8080) 
- Docker Registry:  9001 (instead of 9000)
- PostgreSQL:       5433 (instead of 5432)
- Redis:           6380 (instead of 6379)
- Nginx:           8082 (instead of 80/443)
- Grafana:         3002 (instead of 3001)
- Prometheus:      9091 (instead of 9090)
- Alertmanager:    9094 (instead of 9093)
```

## 📋 Step-by-Step Isolated Setup

### Step 1: Create Isolated Environment
```bash
# Create our isolated directory structure
sudo mkdir -p /opt/farmtally/{app,jenkins,registry,databases,ssl,logs,backups,monitoring}
sudo useradd -m -s /bin/bash farmtally
sudo usermod -aG docker farmtally
sudo chown -R farmtally:farmtally /opt/farmtally

# Switch to farmtally user for all operations
sudo su - farmtally
cd /opt/farmtally
```

### Step 2: Deploy Application with Custom Ports
```bash
# Copy your application code
# (Upload via SCP or clone from repository)
git clone https://your-repo-url.git /opt/farmtally/app
cd /opt/farmtally/app
```

### Step 3: Update Docker Compose for Isolation
Create `/opt/farmtally/app/docker-compose.isolated.yml`:

```yaml
version: '3.8'

services:
  # FarmTally Application (Port 3001)
  farmtally-user-service:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: farmtally-user-service
    restart: unless-stopped
    ports:
      - "3001:3000"  # External:Internal
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://farmtally_user:${POSTGRES_PASSWORD}@farmtally-postgres:5432/farmtally_db
      - REDIS_URL=redis://:${REDIS_PASSWORD}@farmtally-redis:6379/0
    volumes:
      - /opt/farmtally/logs/app:/app/logs
    networks:
      - farmtally-isolated-network
    depends_on:
      - farmtally-postgres
      - farmtally-redis

  # Isolated PostgreSQL (Port 5433)
  farmtally-postgres:
    image: postgres:15-alpine
    container_name: farmtally-postgres
    restart: unless-stopped
    ports:
      - "5433:5432"  # External:Internal
    environment:
      - POSTGRES_DB=farmtally_db
      - POSTGRES_USER=farmtally_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - /opt/farmtally/databases/postgres:/var/lib/postgresql/data
      - ./src/database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - farmtally-isolated-network

  # Isolated Redis (Port 6380)
  farmtally-redis:
    image: redis:7-alpine
    container_name: farmtally-redis
    restart: unless-stopped
    ports:
      - "6380:6379"  # External:Internal
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - /opt/farmtally/databases/redis:/data
    networks:
      - farmtally-isolated-network

  # Isolated Nginx (Port 8082)
  farmtally-nginx:
    image: nginx:alpine
    container_name: farmtally-nginx
    restart: unless-stopped
    ports:
      - "8082:80"    # HTTP
      - "8443:443"   # HTTPS
    volumes:
      - ./nginx/nginx.isolated.conf:/etc/nginx/nginx.conf:ro
      - /opt/farmtally/ssl:/etc/nginx/ssl:ro
      - /opt/farmtally/logs/nginx:/var/log/nginx
    networks:
      - farmtally-isolated-network
    depends_on:
      - farmtally-user-service

networks:
  farmtally-isolated-network:
    driver: bridge
    name: farmtally-network
    ipam:
      config:
        - subnet: 172.25.0.0/16  # Different subnet to avoid conflicts

volumes:
  farmtally_postgres_data:
    driver: local
  farmtally_redis_data:
    driver: local
```

### Step 4: Create Isolated Jenkins Setup
Create `/opt/farmtally/jenkins/docker-compose.jenkins.yml`:

```yaml
version: '3.8'

services:
  farmtally-jenkins:
    image: jenkins/jenkins:lts
    container_name: farmtally-jenkins
    restart: unless-stopped
    ports:
      - "8081:8080"  # External:Internal
      - "50001:50000"  # Agent port
    volumes:
      - /opt/farmtally/jenkins/home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - /opt/farmtally/jenkins/casc:/var/jenkins_home/casc_configs
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=false -Xmx1g
      - CASC_JENKINS_CONFIG=/var/jenkins_home/casc_configs/jenkins.yaml
      - JENKINS_OPTS=--httpPort=8080 --prefix=/farmtally-jenkins
    networks:
      - farmtally-jenkins-network
    user: root

  # Isolated Docker Registry (Port 9001)
  farmtally-registry:
    image: registry:2
    container_name: farmtally-registry
    restart: unless-stopped
    ports:
      - "9001:5000"  # External:Internal
    volumes:
      - /opt/farmtally/registry/data:/var/lib/registry
      - /opt/farmtally/registry/config.yml:/etc/docker/registry/config.yml:ro
    networks:
      - farmtally-jenkins-network

networks:
  farmtally-jenkins-network:
    driver: bridge
    name: farmtally-jenkins-network
    ipam:
      config:
        - subnet: 172.26.0.0/16  # Different subnet
```

### Step 5: Create Isolated Monitoring Stack
Create `/opt/farmtally/monitoring/docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  farmtally-prometheus:
    image: prom/prometheus:latest
    container_name: farmtally-prometheus
    restart: unless-stopped
    ports:
      - "9091:9090"  # External:Internal
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - /opt/farmtally/monitoring/prometheus:/prometheus
    networks:
      - farmtally-monitoring-network

  farmtally-grafana:
    image: grafana/grafana:latest
    container_name: farmtally-grafana
    restart: unless-stopped
    ports:
      - "3002:3000"  # External:Internal
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=farmtally_grafana_admin_2024
      - GF_SERVER_ROOT_URL=http://147.93.153.247:3002
    volumes:
      - /opt/farmtally/monitoring/grafana:/var/lib/grafana
    networks:
      - farmtally-monitoring-network

  farmtally-alertmanager:
    image: prom/alertmanager:latest
    container_name: farmtally-alertmanager
    restart: unless-stopped
    ports:
      - "9094:9093"  # External:Internal
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    networks:
      - farmtally-monitoring-network

networks:
  farmtally-monitoring-network:
    driver: bridge
    name: farmtally-monitoring-network
    ipam:
      config:
        - subnet: 172.27.0.0/16  # Different subnet
```

### Step 6: Update Environment Configuration
Create `/opt/farmtally/app/.env.isolated`:

```bash
# FarmTally Isolated Environment Configuration
NODE_ENV=production
PORT=3000  # Internal port (mapped to 3001 externally)

# Isolated Database Configuration
DATABASE_URL=postgresql://farmtally_user:${POSTGRES_PASSWORD}@localhost:5433/farmtally_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=farmtally_db
POSTGRES_USER=farmtally_user
POSTGRES_PASSWORD=your_secure_farmtally_db_password

# Isolated Redis Configuration  
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6380/0
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=your_secure_farmtally_redis_password

# Server Configuration (Isolated)
SERVER_IP=147.93.153.247
SERVER_PORT=3001  # External port
JENKINS_URL=http://147.93.153.247:8081
REGISTRY_URL=http://147.93.153.247:9001

# Email Configuration (Hostinger)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=noreply@farmtally.in
SMTP_PASS=2t/!P1K]w
EMAIL_FROM=noreply@farmtally.in

# Security
JWT_SECRET=your_unique_farmtally_jwt_secret_64_chars
SESSION_SECRET=your_unique_farmtally_session_secret_32_chars

# Monitoring URLs
GRAFANA_URL=http://147.93.153.247:3002
PROMETHEUS_URL=http://147.93.153.247:9091
```

### Step 7: Create Isolated Nginx Configuration
Create `/opt/farmtally/app/nginx/nginx.isolated.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream farmtally_backend {
        server farmtally-user-service:3000;
    }

    server {
        listen 80;
        server_name 147.93.153.247;
        
        location /farmtally/ {
            proxy_pass http://farmtally_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /farmtally/health {
            proxy_pass http://farmtally_backend/health;
        }
    }
}
```

## 🚀 Deployment Commands

### Deploy Application Stack
```bash
cd /opt/farmtally/app

# Copy environment file
cp .env.isolated .env

# Deploy application with isolated configuration
docker-compose -f docker-compose.isolated.yml up -d
```

### Deploy Jenkins Stack
```bash
cd /opt/farmtally/jenkins

# Create Jenkins directories
mkdir -p home casc
sudo chown -R 1000:1000 home

# Deploy Jenkins with isolated configuration
docker-compose -f docker-compose.jenkins.yml up -d
```

### Deploy Monitoring Stack (Optional)
```bash
cd /opt/farmtally/monitoring

# Deploy monitoring with isolated configuration
docker-compose -f docker-compose.monitoring.yml up -d
```

## 🔍 Verification & Access

### Service Access URLs
```
FarmTally Application:    http://147.93.153.247:3001
FarmTally Jenkins:        http://147.93.153.247:8081
FarmTally Registry:       http://147.93.153.247:9001
FarmTally Nginx:          http://147.93.153.247:8082
FarmTally Grafana:        http://147.93.153.247:3002
FarmTally Prometheus:     http://147.93.153.247:9091
```

### Health Checks
```bash
# Application health
curl http://147.93.153.247:3001/health

# Jenkins health
curl http://147.93.153.247:8081/login

# Registry health
curl http://147.93.153.247:9001/v2/

# Database connection (from inside container)
docker exec farmtally-postgres psql -U farmtally_user -d farmtally_db -c "SELECT 1;"
```

## 🛡️ Isolation Verification

### Check No Conflicts
```bash
# Verify our services don't conflict with existing ones
sudo netstat -tlnp | grep -E ":3001|:8081|:9001|:5433|:6380|:8082|:3002|:9091"

# Check Docker networks are isolated
docker network ls | grep farmtally

# Verify containers are running in isolation
docker ps | grep farmtally
```

### Resource Usage Check
```bash
# Monitor resource usage to ensure we're not overloading
htop
docker stats
df -h
```

## 🔧 Firewall Configuration (Isolated Ports)

```bash
# Only open our specific ports
sudo ufw allow 3001/tcp comment "FarmTally App"
sudo ufw allow 8081/tcp comment "FarmTally Jenkins"  
sudo ufw allow 9001/tcp comment "FarmTally Registry"
sudo ufw allow 8082/tcp comment "FarmTally Nginx"
sudo ufw allow 3002/tcp comment "FarmTally Grafana"

# Check firewall status
sudo ufw status numbered
```

## 📊 Monitoring Other Team's Impact

### Create Monitoring Script
Create `/opt/farmtally/scripts/monitor-server-resources.sh`:

```bash
#!/bin/bash
# Monitor server resources to ensure we don't impact other team

LOG_FILE="/opt/farmtally/logs/resource-monitor.log"

while true; do
    echo "$(date): Resource Check" >> $LOG_FILE
    
    # CPU Usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    echo "CPU Usage: ${CPU_USAGE}%" >> $LOG_FILE
    
    # Memory Usage  
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    echo "Memory Usage: ${MEMORY_USAGE}%" >> $LOG_FILE
    
    # Disk Usage
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}')
    echo "Disk Usage: ${DISK_USAGE}" >> $LOG_FILE
    
    # FarmTally Container Resource Usage
    echo "FarmTally Containers:" >> $LOG_FILE
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep farmtally >> $LOG_FILE
    
    echo "---" >> $LOG_FILE
    
    # Alert if usage is too high
    if (( $(echo "$CPU_USAGE > 70" | bc -l) )); then
        echo "WARNING: High CPU usage detected: ${CPU_USAGE}%" | mail -s "FarmTally Resource Alert" admin@farmtally.in
    fi
    
    sleep 300  # Check every 5 minutes
done
```

## 🚨 Emergency Procedures

### Quick Shutdown (If Impacting Other Team)
```bash
# Stop all FarmTally services immediately
cd /opt/farmtally/app && docker-compose -f docker-compose.isolated.yml down
cd /opt/farmtally/jenkins && docker-compose -f docker-compose.jenkins.yml down  
cd /opt/farmtally/monitoring && docker-compose -f docker-compose.monitoring.yml down

# Verify all stopped
docker ps | grep farmtally
```

### Resource Cleanup
```bash
# Clean up Docker resources
docker system prune -f
docker volume prune -f
docker network prune -f
```

## 📞 Coordination with Other Team

### Communication Checklist
- [ ] Inform other team about our deployment schedule
- [ ] Share our port allocation (3001, 8081, 9001, 5433, 6380, 8082, 3002, 9091)
- [ ] Agree on resource usage limits (CPU < 70%, Memory < 80%)
- [ ] Exchange emergency contact information
- [ ] Set up shared monitoring alerts for server resources

### Shared Resource Agreement
```bash
# Suggested resource limits for FarmTally
# CPU: Maximum 50% usage during business hours
# Memory: Maximum 4GB (if server has 8GB+)
# Disk: Maximum 20GB for our /opt/farmtally directory
# Network: Avoid peak hours for large deployments
```

## 🔄 Maintenance Schedule

### Coordinate with Other Team
- **Deployments**: Off-hours (evenings/weekends)
- **Updates**: Coordinate 24h in advance
- **Restarts**: During agreed maintenance windows
- **Backups**: Schedule during low-usage periods

---

**This setup ensures complete isolation while sharing the server safely with another team. All services use different ports, networks, and directories to prevent any conflicts.**