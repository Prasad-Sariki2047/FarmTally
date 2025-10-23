# FarmTally Shared Infrastructure Setup
## Using Existing Jenkins & Docker on 147.93.153.247

✅ **Smart Approach**: Share Jenkins and Docker infrastructure between teams  
✅ **Cost Effective**: Reduce resource usage and maintenance overhead  
✅ **Team Collaboration**: Easier coordination and shared best practices  

---

## 🔍 Pre-Setup Discovery

### 1. Check Existing Infrastructure
```bash
# SSH into the server
ssh root@147.93.153.247

# Check if Jenkins is already running
sudo systemctl status jenkins
curl -I http://localhost:8080 2>/dev/null || echo "Jenkins not on port 8080"

# Check Docker installation
docker --version
docker-compose --version
docker ps

# Check existing Docker networks
docker network ls

# Check existing Jenkins jobs
ls -la /var/lib/jenkins/jobs/ 2>/dev/null || echo "Jenkins not in standard location"
```

### 2. Identify Shared Resources
```bash
# Check what's already running
sudo netstat -tlnp | grep LISTEN
docker ps -a
sudo systemctl list-units --type=service --state=running | grep -E "(jenkins|docker)"

# Check existing Docker registries
curl -s http://localhost:5000/v2/ && echo "Registry on 5000" || echo "No registry on 5000"
curl -s http://localhost:9000/v2/ && echo "Registry on 9000" || echo "No registry on 9000"
```

---

## 🤝 Shared Infrastructure Strategy

### What to Share
✅ **Jenkins Server** - Single Jenkins instance for all projects  
✅ **Docker Engine** - Shared Docker daemon  
✅ **Docker Registry** - Shared private registry  
✅ **Base Infrastructure** - Nginx, monitoring tools  
✅ **System Resources** - CPU, memory, disk efficiently used  

### What to Keep Separate
🔒 **Application Ports** - Each project uses different ports  
🔒 **Database Instances** - Separate PostgreSQL/Redis per project  
🔒 **Application Data** - Isolated directories and volumes  
🔒 **Environment Variables** - Project-specific configurations  
🔒 **Docker Networks** - Isolated networks per project  

---

## 📋 Shared Setup Plan

### Scenario A: Jenkins Already Exists
If the other team already has Jenkins running:

#### 1. Access Existing Jenkins
```bash
# Find Jenkins URL (common locations)
curl -I http://147.93.153.247:8080  # Standard port
curl -I http://147.93.153.247:8081  # Alternative port
curl -I http://147.93.153.247:9090  # Alternative port

# Check Jenkins home directory
sudo find / -name "jenkins" -type d 2>/dev/null
```

#### 2. Add FarmTally to Existing Jenkins
- **Access Jenkins Dashboard**: Use existing URL
- **Create new folder**: "FarmTally Projects"
- **Add your pipeline**: As a new job in the folder
- **Use existing credentials**: Share Docker registry access
- **Coordinate deployments**: Schedule builds to avoid conflicts

### Scenario B: No Jenkins Yet
If no Jenkins exists, set up shared Jenkins:

#### 1. Install Shared Jenkins
```bash
# Install Jenkins (if not exists)
wget -q -O - https://pkg.jenkins.io/debian/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb http://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt update
sudo apt install jenkins

# Start Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Get initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

#### 2. Configure for Multi-Project Use
```bash
# Create project-specific directories
sudo mkdir -p /var/lib/jenkins/projects/{farmtally,other-project}
sudo chown jenkins:jenkins /var/lib/jenkins/projects/*

# Configure Jenkins for multiple teams
# (Access via http://147.93.153.247:8080)
```

---

## 🐳 Shared Docker Setup

### 1. Use Existing Docker Registry
```bash
# Check if registry exists
curl -s http://localhost:5000/v2/ || curl -s http://localhost:9000/v2/

# If registry exists, use it
REGISTRY_URL="localhost:5000"  # or whatever port is used

# If no registry, create shared one
docker run -d \
  --name shared-registry \
  --restart=unless-stopped \
  -p 5000:5000 \
  -v /opt/shared/registry:/var/lib/registry \
  registry:2
```

### 2. Create Project-Specific Docker Networks
```bash
# Create isolated network for FarmTally
docker network create farmtally-network \
  --driver bridge \
  --subnet=172.25.0.0/16

# Verify network isolation
docker network ls
```

### 3. Shared Docker Compose Strategy
Create `/opt/farmtally/docker-compose.shared.yml`:

```yaml
version: '3.8'

services:
  # FarmTally Application (isolated ports)
  farmtally-user-service:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: farmtally-user-service
    restart: unless-stopped
    ports:
      - "3001:3000"  # Isolated port
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://farmtally_user:${POSTGRES_PASSWORD}@farmtally-postgres:5432/farmtally_db
    volumes:
      - /opt/farmtally/logs:/app/logs
    networks:
      - farmtally-network  # Isolated network
    depends_on:
      - farmtally-postgres
      - farmtally-redis

  # FarmTally Database (isolated)
  farmtally-postgres:
    image: postgres:15-alpine
    container_name: farmtally-postgres
    restart: unless-stopped
    ports:
      - "5433:5432"  # Isolated port
    environment:
      - POSTGRES_DB=farmtally_db
      - POSTGRES_USER=farmtally_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - farmtally_postgres_data:/var/lib/postgresql/data
    networks:
      - farmtally-network

  # FarmTally Redis (isolated)
  farmtally-redis:
    image: redis:7-alpine
    container_name: farmtally-redis
    restart: unless-stopped
    ports:
      - "6380:6379"  # Isolated port
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - farmtally_redis_data:/data
    networks:
      - farmtally-network

volumes:
  farmtally_postgres_data:
    name: farmtally_postgres_data
  farmtally_redis_data:
    name: farmtally_redis_data

networks:
  farmtally-network:
    external: true  # Use pre-created network
```

---

## 🔧 Jenkins Pipeline for Shared Environment

Update `Jenkinsfile` for shared Jenkins:

```groovy
pipeline {
    agent any
    
    environment {
        // Shared infrastructure
        DOCKER_REGISTRY = 'localhost:5000'  // Shared registry
        PROJECT_NAME = 'farmtally'
        
        // Project-specific settings
        IMAGE_NAME = "${PROJECT_NAME}/user-service"
        CONTAINER_PREFIX = "${PROJECT_NAME}"
        
        // Shared credentials
        REGISTRY_CREDENTIALS = credentials('shared-docker-registry')
        SERVER_SSH_KEY = credentials('shared-server-ssh')
    }
    
    options {
        // Prevent concurrent builds to avoid conflicts
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.BUILD_TAG = "${PROJECT_NAME}-${env.BUILD_NUMBER}-${sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()}"
                }
            }
        }
        
        stage('Build') {
            steps {
                script {
                    // Build with project-specific tag
                    def imageTag = "${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_TAG}"
                    def latestTag = "${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                    
                    sh """
                        docker build -t ${imageTag} -t ${latestTag} .
                        docker push ${imageTag}
                        docker push ${latestTag}
                    """
                }
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sshagent([env.SERVER_SSH_KEY]) {
                        sh """
                            ssh -o StrictHostKeyChecking=no root@147.93.153.247 '
                                cd /opt/${PROJECT_NAME} &&
                                docker-compose -f docker-compose.shared.yml pull &&
                                docker-compose -f docker-compose.shared.yml up -d &&
                                sleep 30 &&
                                curl -f http://localhost:3001/health
                            '
                        """
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Clean up project-specific resources only
            sh "docker image prune -f --filter label=project=${PROJECT_NAME}"
        }
    }
}
```

---

## 👥 Team Coordination Setup

### 1. Jenkins Project Organization
```
Jenkins Dashboard
├── 📁 FarmTally Projects/
│   ├── farmtally-user-service
│   ├── farmtally-api-gateway
│   └── farmtally-monitoring
├── 📁 Other Team Projects/
│   ├── other-project-backend
│   └── other-project-frontend
└── 📁 Shared Infrastructure/
    ├── docker-registry-maintenance
    └── server-monitoring
```

### 2. Shared Credentials Management
```bash
# In Jenkins: Manage Jenkins → Manage Credentials

# Shared credentials (both teams can use):
- shared-docker-registry (Docker registry access)
- shared-server-ssh (Server SSH key)
- shared-monitoring (Grafana, Prometheus)

# Project-specific credentials:
- farmtally-database (FarmTally DB credentials)
- farmtally-email (Hostinger email)
- farmtally-github (FarmTally repo access)
```

### 3. Resource Allocation Agreement
```yaml
# /opt/shared/resource-agreement.yml
teams:
  farmtally:
    ports: [3001, 5433, 6380, 8082, 8443]
    cpu_limit: "50%"
    memory_limit: "4GB"
    disk_limit: "20GB"
    directories: ["/opt/farmtally"]
    
  other_team:
    ports: [3000, 5432, 6379, 80, 443]
    cpu_limit: "50%" 
    memory_limit: "4GB"
    disk_limit: "20GB"
    directories: ["/opt/other-project"]

shared_resources:
  jenkins:
    url: "http://147.93.153.247:8080"
    admin: "shared-admin"
    
  docker_registry:
    url: "http://147.93.153.247:5000"
    
  monitoring:
    grafana: "http://147.93.153.247:3000"
    prometheus: "http://147.93.153.247:9090"
```

---

## 🚀 Deployment Steps (Shared Infrastructure)

### 1. Coordinate with Other Team
```bash
# Check current server load
ssh root@147.93.153.247 "htop -n 1"

# Check Jenkins availability
curl -I http://147.93.153.247:8080

# Inform other team of deployment window
# Slack/Email: "Deploying FarmTally at 6 PM, estimated 30 minutes"
```

### 2. Deploy FarmTally
```bash
# Create project directory
ssh root@147.93.153.247 "mkdir -p /opt/farmtally"

# Upload project files
scp -r . root@147.93.153.247:/opt/farmtally/

# Create isolated network
ssh root@147.93.153.247 "docker network create farmtally-network --subnet=172.25.0.0/16"

# Deploy with shared infrastructure
ssh root@147.93.153.247 "cd /opt/farmtally && docker-compose -f docker-compose.shared.yml up -d"
```

### 3. Configure Jenkins Job
1. **Access Jenkins**: http://147.93.153.247:8080
2. **Create Folder**: "FarmTally Projects"
3. **New Pipeline**: "farmtally-user-service"
4. **Configure SCM**: Point to your repository
5. **Add Webhooks**: For automatic builds

### 4. Verify Deployment
```bash
# Check FarmTally services
curl http://147.93.153.247:3001/health

# Verify no impact on other services
curl http://147.93.153.247:3000/health  # Other team's service

# Check resource usage
ssh root@147.93.153.247 "docker stats --no-stream"
```

---

## 📊 Shared Monitoring Setup

### 1. Use Existing Monitoring
If Grafana/Prometheus already exists:
```bash
# Access existing Grafana
curl -I http://147.93.153.247:3000

# Add FarmTally dashboard to existing Grafana
# Create separate folder: "FarmTally Dashboards"
```

### 2. Add FarmTally Metrics to Existing Prometheus
```yaml
# Add to existing prometheus.yml
scrape_configs:
  - job_name: 'farmtally-app'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /metrics
    scrape_interval: 30s
```

---

## 🔒 Security & Access Control

### 1. Jenkins Security
```bash
# Role-based access in Jenkins
# FarmTally Team: Full access to FarmTally folder
# Other Team: Full access to their folder
# Shared Admin: Access to everything
```

### 2. Docker Security
```bash
# Project-specific Docker networks prevent cross-access
# Shared registry with project namespaces:
# - farmtally/user-service:latest
# - other-project/backend:latest
```

### 3. Server Access
```bash
# Shared SSH access with sudo restrictions
# Each team can only modify their /opt/{project} directory
```

---

## 💡 Benefits of Shared Infrastructure

### Cost Savings
- **50% less resource usage** (shared Jenkins, Docker, monitoring)
- **Reduced maintenance overhead**
- **Shared security updates and patches**

### Team Collaboration  
- **Shared best practices** and pipeline templates
- **Cross-team knowledge sharing**
- **Coordinated deployment schedules**

### Operational Efficiency
- **Single Jenkins to maintain**
- **Shared monitoring and alerting**
- **Centralized backup and disaster recovery**

---

## 🚨 Coordination Protocols

### Daily Operations
- **Morning standup**: Check shared resource usage
- **Deployment coordination**: Use shared calendar
- **Issue escalation**: Shared Slack channel

### Weekly Planning
- **Resource review**: Monitor usage trends
- **Maintenance windows**: Coordinate updates
- **Capacity planning**: Plan for growth

### Emergency Procedures
- **Shared incident response**: Both teams notified
- **Resource conflicts**: Escalation to tech lead
- **Quick rollback**: Standardized procedures

---

This shared infrastructure approach is much more efficient and promotes better team collaboration while maintaining proper isolation where needed. Would you like me to help you coordinate with the other team or set up any specific part of this shared infrastructure?