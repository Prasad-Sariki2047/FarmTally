# 🚀 FarmTally Deployment Guide with GitHub Integration

## Repository Information
- **GitHub Repository**: https://github.com/Prasad-Sariki2047/FarmTally.git
- **Target Server**: 147.93.153.247
- **Deployment Strategy**: Shared infrastructure with isolated application

---

## 📋 Pre-Deployment Checklist

### 1. GitHub Repository Setup ✅
- [x] Repository URL: https://github.com/Prasad-Sariki2047/FarmTally.git
- [ ] Repository is public or team has access
- [ ] Main branch contains latest code
- [ ] Jenkinsfile is in repository root
- [ ] Docker files are configured

### 2. Server Access
- [ ] SSH access to 147.93.153.247
- [ ] Coordination with other team completed
- [ ] Resource allocation agreed upon

### 3. Infrastructure Requirements
- [ ] Jenkins available (shared)
- [ ] Docker installed (shared)
- [ ] Ports available: 3001, 5433, 6380, 8082, 8443

---

## 🔧 Step 1: Server Preparation

### Connect to Server
```bash
# SSH into the shared server
ssh root@147.93.153.247

# Check current infrastructure
curl -I http://localhost:8080  # Check Jenkins
docker --version              # Check Docker
docker ps -a                  # See running containers
```

### Create FarmTally Directory
```bash
# Create isolated directory for FarmTally
mkdir -p /opt/farmtally
cd /opt/farmtally

# Clone the repository
git clone https://github.com/Prasad-Sariki2047/FarmTally.git .

# Verify files are present
ls -la
cat Jenkinsfile  # Verify Jenkinsfile exists
```

### Set Up Environment
```bash
# Copy production environment template
cp config/production.env .env

# Update environment variables (see next section)
nano .env
```

---

## ⚙️ Step 2: Environment Configuration

### Update .env File
```bash
# Edit the environment file
nano /opt/farmtally/.env

# Update these critical values:
```

```bash
# Database Configuration
DATABASE_URL=postgresql://farmtally_user:YOUR_SECURE_DB_PASSWORD@localhost:5433/farmtally_db
POSTGRES_PASSWORD=YOUR_SECURE_DB_PASSWORD

# Redis Configuration  
REDIS_PASSWORD=YOUR_SECURE_REDIS_PASSWORD

# JWT Security
JWT_SECRET=YOUR_64_CHARACTER_JWT_SECRET_HERE
SESSION_SECRET=YOUR_32_CHARACTER_SESSION_SECRET_HERE

# Email Configuration (Already configured with Hostinger)
SMTP_HOST=smtp.hostinger.com
SMTP_USER=noreply@farmtally.in
SMTP_PASS=2t/!P1K]w

# Server Configuration
SERVER_IP=147.93.153.247
PORT=3000  # Internal port (mapped to 3001 externally)
```

### Generate Secure Secrets
```bash
# Generate secure passwords
openssl rand -base64 32  # For database password
openssl rand -base64 32  # For Redis password  
openssl rand -base64 64  # For JWT secret
openssl rand -base64 32  # For session secret
```

---

## 🐳 Step 3: Docker Setup

### Check Existing Docker Registry
```bash
# Check if shared registry exists
curl -s http://localhost:5000/v2/ && echo "Registry available" || echo "No registry"

# If no registry, create shared one (coordinate with other team)
docker run -d \
  --name shared-registry \
  --restart=unless-stopped \
  -p 5000:5000 \
  -v /opt/shared/registry:/var/lib/registry \
  registry:2
```

### Create Isolated Docker Network
```bash
# Create FarmTally network (isolated from other projects)
docker network create farmtally-network \
  --driver bridge \
  --subnet=172.25.0.0/16

# Verify network created
docker network ls | grep farmtally
```

### Deploy FarmTally Application
```bash
cd /opt/farmtally

# Build and deploy using isolated ports
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services to start
sleep 60

# Verify deployment
curl http://localhost:3001/health
```

---

## 🔨 Step 4: Jenkins Configuration

### Access Existing Jenkins
```bash
# Check Jenkins URL (coordinate with other team)
curl -I http://localhost:8080

# Access Jenkins dashboard
# URL: http://147.93.153.247:8080
```

### Configure Jenkins for FarmTally

#### 1. Create Project Folder
1. Go to Jenkins Dashboard
2. Click "New Item"
3. Select "Folder"
4. Name: "FarmTally Projects"
5. Click "OK"

#### 2. Add GitHub Credentials
1. Go to "Manage Jenkins" → "Manage Credentials"
2. Click "System" → "Global credentials"
3. Click "Add Credentials"
4. Select "Username with password"
5. Fill in:
   - **ID**: `farmtally-github-credentials`
   - **Username**: `Prasad-Sariki2047` (or your GitHub username)
   - **Password**: Your GitHub Personal Access Token
   - **Description**: `FarmTally GitHub Access`

#### 3. Add Server SSH Credentials
1. Add new credentials
2. Select "SSH Username with private key"
3. Fill in:
   - **ID**: `farmtally-server-ssh`
   - **Username**: `root`
   - **Private Key**: Enter your SSH private key
   - **Description**: `FarmTally Server SSH`

#### 4. Add Docker Registry Credentials
1. Add new credentials
2. Select "Username with password"
3. Fill in:
   - **ID**: `farmtally-docker-registry`
   - **Username**: `farmtally`
   - **Password**: `farmtally_registry_2024`
   - **Description**: `FarmTally Docker Registry`

#### 5. Create Pipeline Job
1. Go to "FarmTally Projects" folder
2. Click "New Item"
3. Select "Multibranch Pipeline"
4. Name: `farmtally-user-service`
5. Configure:
   - **Branch Sources**: Git
   - **Project Repository**: `https://github.com/Prasad-Sariki2047/FarmTally.git`
   - **Credentials**: Select `farmtally-github-credentials`
   - **Discover branches**: All branches
   - **Script Path**: `Jenkinsfile`
6. Click "Save"

#### 6. Configure Webhook (Optional)
1. Go to GitHub repository settings
2. Click "Webhooks" → "Add webhook"
3. Fill in:
   - **Payload URL**: `http://147.93.153.247:8080/github-webhook/`
   - **Content type**: `application/json`
   - **Events**: Push events, Pull requests
4. Click "Add webhook"

---

## 🧪 Step 5: Testing and Verification

### Test Application
```bash
# Health check
curl http://147.93.153.247:3001/health

# Expected response:
# {"status":"healthy","timestamp":"...","service":"FarmTally User Role Management"}

# Test API endpoints
curl http://147.93.153.247:3001/api/auth/health
curl http://147.93.153.247:3001/api/relationships/health
```

### Test Database Connection
```bash
# Connect to FarmTally database
docker exec farmtally-postgres psql -U farmtally_user -d farmtally_db -c "SELECT 1;"

# Should return: 1
```

### Test Redis Connection
```bash
# Test Redis
docker exec farmtally-redis redis-cli -a YOUR_REDIS_PASSWORD ping

# Should return: PONG
```

### Test Jenkins Pipeline
1. Go to Jenkins → FarmTally Projects → farmtally-user-service
2. Click "Scan Multibranch Pipeline Now"
3. Should detect main branch and start building
4. Monitor build progress
5. Verify successful deployment

### Test Email (Optional)
```bash
# Test email functionality
curl -X POST http://147.93.153.247:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","message":"Hello from FarmTally"}'
```

---

## 📊 Step 6: Monitoring Setup

### Check Existing Monitoring
```bash
# Check if Grafana exists
curl -I http://localhost:3000

# Check if Prometheus exists  
curl -I http://localhost:9090
```

### Add FarmTally to Existing Monitoring
If monitoring exists:
1. Access Grafana dashboard
2. Create "FarmTally" folder
3. Import FarmTally dashboards from `monitoring/grafana-dashboards/`
4. Add FarmTally metrics to Prometheus configuration

### Deploy FarmTally Monitoring (If Needed)
```bash
cd /opt/farmtally

# Deploy monitoring stack on isolated ports
docker-compose -f docker-compose.monitoring.yml up -d

# Access FarmTally monitoring
# Grafana: http://147.93.153.247:3002
# Prometheus: http://147.93.153.247:9091
```

---

## 🔒 Step 7: Security Configuration

### Firewall Configuration
```bash
# Add FarmTally ports to firewall (coordinate with other team)
sudo ufw allow 3001/tcp comment "FarmTally App"
sudo ufw allow 5433/tcp comment "FarmTally DB"  
sudo ufw allow 6380/tcp comment "FarmTally Redis"
sudo ufw allow 8082/tcp comment "FarmTally HTTP"
sudo ufw allow 8443/tcp comment "FarmTally HTTPS"

# Check firewall status
sudo ufw status numbered
```

### SSL Certificate Setup (Optional)
```bash
# Generate self-signed certificate for testing
cd /opt/farmtally
./scripts/generate-ssl.ps1 -Domain 147.93.153.247

# Or use Let's Encrypt for production
# certbot certonly --standalone -d your-domain.com
```

---

## 🚀 Step 8: Go Live

### Final Verification
```bash
# Check all services are running
docker ps | grep farmtally

# Check resource usage
htop
docker stats --no-stream

# Verify no impact on other team
curl http://147.93.153.247:3000/health  # Other team's service
```

### Access URLs
- **FarmTally Application**: http://147.93.153.247:3001
- **Jenkins Pipeline**: http://147.93.153.247:8080/job/FarmTally%20Projects/job/farmtally-user-service/
- **FarmTally Monitoring**: http://147.93.153.247:3002 (if deployed)

### Notify Team
```bash
# Send notification
echo "FarmTally deployment completed successfully!
Application: http://147.93.153.247:3001
Jenkins: http://147.93.153.247:8080
Status: All services running normally
Resource usage: CPU < 50%, Memory < 4GB" | mail -s "FarmTally Deployment Complete" team@farmtally.in
```

---

## 🔄 Step 9: Ongoing Operations

### Daily Monitoring
```bash
# Check application health
curl http://147.93.153.247:3001/health

# Check resource usage
htop
df -h /opt/farmtally

# Check logs
docker-compose -f /opt/farmtally/docker-compose.yml logs --tail=50
```

### Weekly Maintenance
```bash
# Update application
cd /opt/farmtally
git pull origin main
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Clean up Docker resources
docker system prune -f
docker image prune -f
```

### Backup Procedures
```bash
# Run backup script
cd /opt/farmtally
./scripts/disaster-recovery.sh full-backup

# Verify backup
ls -la /opt/farmtally/backups/
```

---

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose logs farmtally-user-service

# Check environment variables
cat /opt/farmtally/.env | grep -E "DATABASE_URL|REDIS_URL"

# Restart services
docker-compose restart
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker exec farmtally-postgres pg_isready -U farmtally_user

# Check database exists
docker exec farmtally-postgres psql -U farmtally_user -l

# Reset database if needed
docker-compose down
docker volume rm farmtally_postgres_data
docker-compose up -d
```

#### Jenkins Build Failures
```bash
# Check Jenkins logs
docker logs jenkins-container-name

# Verify GitHub credentials
# Go to Jenkins → Credentials → Test connection

# Check Jenkinsfile syntax
# Use Jenkins → Pipeline Syntax validator
```

#### Port Conflicts
```bash
# Check what's using ports
sudo netstat -tlnp | grep -E ":3001|:5433|:6380"

# If conflicts, update docker-compose.yml ports
# Coordinate with other team for resolution
```

---

## 📞 Support Contacts

### FarmTally Team
- **Email**: admin@farmtally.in
- **Repository**: https://github.com/Prasad-Sariki2047/FarmTally.git
- **Server**: root@147.93.153.247

### Emergency Procedures
```bash
# Quick shutdown if impacting other team
cd /opt/farmtally
docker-compose down

# Quick restart
docker-compose up -d

# Check status
curl http://147.93.153.247:3001/health
```

---

**Deployment completed! FarmTally is now running on the shared server with proper isolation and GitHub integration.**