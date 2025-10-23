# 🤝 FarmTally Shared Infrastructure - Quick Setup

## ✅ Smart Approach: Share Jenkins & Docker

**Benefits:**
- 50% less resource usage
- Easier team coordination  
- Shared best practices
- Reduced maintenance overhead

---

## 🔍 Step 1: Discover Existing Infrastructure

```bash
# SSH into shared server
ssh root@147.93.153.247

# Check what's already running
sudo netstat -tlnp | grep LISTEN
docker ps -a
curl -I http://localhost:8080  # Check for Jenkins
curl -s http://localhost:5000/v2/  # Check for Docker registry
```

**Common scenarios:**
- ✅ Jenkins already exists → Use existing Jenkins
- ✅ Docker registry exists → Use existing registry  
- ✅ Monitoring exists → Add FarmTally dashboards
- ❌ Nothing exists → Set up shared infrastructure

---

## 🚀 Step 2: Quick Deployment (Shared Mode)

### If Jenkins Exists (Most Common)
```bash
# 1. Access existing Jenkins
# URL: http://147.93.153.247:8080 (or whatever port they use)

# 2. Create FarmTally folder in Jenkins
# Dashboard → New Item → Folder → "FarmTally Projects"

# 3. Add your pipeline job
# In FarmTally folder → New Item → Pipeline → "farmtally-user-service"
```

### Deploy FarmTally Application
```bash
# 1. Create project directory (coordinate with other team)
ssh root@147.93.153.247 "mkdir -p /opt/farmtally"

# 2. Upload your code
scp -r . root@147.93.153.247:/opt/farmtally/

# 3. Use isolated ports to avoid conflicts
cd /opt/farmtally
docker-compose -f docker-compose.yml up -d

# Your services will run on:
# - Application: http://147.93.153.247:3001
# - Database: localhost:5433 (internal)
# - Redis: localhost:6380 (internal)
```

---

## 📋 Step 3: Coordinate with Other Team

### Before Deployment
```bash
# 1. Check server resources
htop
df -h

# 2. Verify port availability
sudo netstat -tlnp | grep -E ":3001|:5433|:6380"

# 3. Inform other team
# "Hi team, deploying FarmTally on ports 3001, 5433, 6380. ETA: 30 mins"
```

### Resource Agreement
```yaml
# Suggested allocation
FarmTally:
  - Ports: 3001, 5433, 6380, 8082, 8443
  - CPU: Max 50% during business hours
  - Memory: Max 4GB
  - Disk: /opt/farmtally (max 20GB)

Other Team:
  - Ports: 3000, 5432, 6379, 80, 443  
  - CPU: Max 50% during business hours
  - Memory: Max 4GB
  - Disk: /opt/their-project

Shared:
  - Jenkins: http://147.93.153.247:8080
  - Docker Registry: http://147.93.153.247:5000
  - Monitoring: http://147.93.153.247:3000 (Grafana)
```

---

## 🔧 Step 4: Jenkins Configuration (Shared)

### Access Existing Jenkins
1. **URL**: http://147.93.153.247:8080
2. **Login**: Ask other team for credentials or create your account
3. **Permissions**: Request access to create jobs

### Create FarmTally Pipeline
```groovy
// Jenkinsfile for shared environment
pipeline {
    agent any
    
    environment {
        PROJECT_NAME = 'farmtally'
        DOCKER_REGISTRY = 'localhost:5000'  // Shared registry
        IMAGE_NAME = 'farmtally/user-service'
    }
    
    stages {
        stage('Build') {
            steps {
                sh 'docker build -t ${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER} .'
                sh 'docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}'
            }
        }
        
        stage('Deploy') {
            steps {
                sh '''
                    cd /opt/farmtally
                    docker-compose pull
                    docker-compose up -d
                    sleep 30
                    curl -f http://localhost:3001/health
                '''
            }
        }
    }
}
```

### Add Shared Credentials
In Jenkins → Manage Credentials:
- **Docker Registry**: `shared-docker-registry`
- **Server SSH**: `shared-server-ssh`  
- **FarmTally DB**: `farmtally-database-credentials`

---

## 🐳 Step 5: Docker Registry (Shared)

### Use Existing Registry
```bash
# Check if registry exists
curl -s http://localhost:5000/v2/

# If exists, use it for FarmTally images
docker tag farmtally/user-service:latest localhost:5000/farmtally/user-service:latest
docker push localhost:5000/farmtally/user-service:latest
```

### If No Registry Exists
```bash
# Create shared registry (coordinate with other team)
docker run -d \
  --name shared-registry \
  --restart=unless-stopped \
  -p 5000:5000 \
  -v /opt/shared/registry:/var/lib/registry \
  registry:2

# Both teams can use: localhost:5000
```

---

## 📊 Step 6: Monitoring (Shared)

### Use Existing Grafana
```bash
# Check if Grafana exists
curl -I http://localhost:3000

# If exists:
# 1. Access Grafana dashboard
# 2. Create "FarmTally" folder
# 3. Import FarmTally dashboards
# 4. Add FarmTally data sources
```

### Add FarmTally Metrics
```yaml
# Add to existing prometheus.yml
scrape_configs:
  - job_name: 'farmtally-app'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /metrics
```

---

## ✅ Verification Checklist

### FarmTally Services Running
```bash
# Application health
curl http://147.93.153.247:3001/health

# Database connection
docker exec farmtally-postgres psql -U farmtally_user -d farmtally_db -c "SELECT 1;"

# Redis connection  
docker exec farmtally-redis redis-cli ping
```

### No Impact on Other Team
```bash
# Other team's services still working
curl http://147.93.153.247:3000/health  # Their app
curl http://147.93.153.247:80/health     # Their web server

# Resource usage reasonable
htop  # CPU < 80%
free -h  # Memory < 80%
df -h  # Disk usage reasonable
```

### Jenkins Integration
- ✅ FarmTally folder created in Jenkins
- ✅ Pipeline job configured and running
- ✅ Automatic builds on code push
- ✅ Successful deployments

---

## 🚨 Emergency Procedures

### If Impacting Other Team
```bash
# Quick shutdown
cd /opt/farmtally
docker-compose down

# Verify stopped
docker ps | grep farmtally
```

### Resource Conflicts
```bash
# Check what's using resources
docker stats --no-stream
htop
iotop

# Scale down if needed
docker-compose -f docker-compose.yml up -d --scale farmtally-user-service=1
```

---

## 📞 Team Communication

### Daily Coordination
- **Morning check**: "Good morning! FarmTally services running normally on ports 3001, 5433, 6380"
- **Deployment notice**: "Deploying FarmTally update at 6 PM, estimated 15 minutes"
- **Issue reporting**: "FarmTally experiencing high CPU, investigating"

### Shared Channels
- **Slack**: #shared-server-147-93-153-247
- **Email**: shared-ops@company.com
- **Emergency**: Both teams' on-call numbers

### Weekly Sync
- **Resource review**: Check usage trends
- **Maintenance planning**: Coordinate updates
- **Capacity planning**: Plan for growth

---

## 💡 Best Practices for Shared Environment

### Resource Management
- **Monitor usage**: Set up alerts for high CPU/memory
- **Schedule deployments**: Avoid peak hours
- **Coordinate restarts**: Give 24h notice for server reboots

### Security
- **Separate credentials**: Each team manages their own secrets
- **Network isolation**: Use Docker networks to prevent cross-access
- **Access control**: Role-based permissions in Jenkins

### Collaboration
- **Share knowledge**: Document shared procedures
- **Help each other**: Cross-team support during incidents
- **Improve together**: Share optimization and security improvements

---

**This shared approach reduces costs, improves collaboration, and makes better use of server resources while maintaining proper isolation between projects.**