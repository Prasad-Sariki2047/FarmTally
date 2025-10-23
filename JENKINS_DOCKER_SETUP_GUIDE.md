# FarmTally Jenkins & Docker Setup Guide
Complete setup instructions for Jenkins CI/CD and Docker deployment on server 147.93.153.247

## Prerequisites

### System Requirements
- Ubuntu 20.04+ or similar Linux distribution
- Minimum 4GB RAM, 8GB recommended
- 50GB+ available disk space
- Docker and Docker Compose installed
- Git installed

### Network Requirements
- Port 8080 (Jenkins)
- Port 9000 (Docker Registry)
- Port 3000 (Application)
- Port 443/80 (HTTPS/HTTP)

## Step 1: Initial Server Setup

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip
```

### 1.2 Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 1.3 Create FarmTally User
```bash
sudo useradd -m -s /bin/bash farmtally
sudo usermod -aG docker farmtally
sudo usermod -aG sudo farmtally
```

### 1.4 Setup Directory Structure
```bash
sudo mkdir -p /opt/farmtally/{jenkins,registry,ssl,logs,backups}
sudo chown -R farmtally:farmtally /opt/farmtally
```

## Step 2: Docker Registry Setup

### 2.1 Create Registry Directory
```bash
cd /opt/farmtally
mkdir -p registry/data registry/auth
```

### 2.2 Create Registry Configuration
```bash
cat > registry/config.yml << 'EOF'
version: 0.1
log:
  fields:
    service: registry
storage:
  cache:
    blobdescriptor: inmemory
  filesystem:
    rootdirectory: /var/lib/registry
  delete:
    enabled: true
http:
  addr: :5000
  headers:
    X-Content-Type-Options: [nosniff]
    Access-Control-Allow-Origin: ['*']
    Access-Control-Allow-Methods: ['HEAD', 'GET', 'OPTIONS', 'DELETE']
    Access-Control-Allow-Headers: ['Authorization', 'Accept', 'Cache-Control']
health:
  storagedriver:
    enabled: true
    interval: 10s
    threshold: 3
EOF
```

### 2.3 Start Docker Registry
```bash
docker run -d \
  --name farmtally-registry \
  --restart=unless-stopped \
  -p 9000:5000 \
  -v /opt/farmtally/registry/data:/var/lib/registry \
  -v /opt/farmtally/registry/config.yml:/etc/docker/registry/config.yml \
  registry:2
```

### 2.4 Test Registry
```bash
# Test registry is running
curl http://localhost:9000/v2/

# Should return: {}
```

## Step 3: Jenkins Setup

### 3.1 Create Jenkins Directories
```bash
mkdir -p /opt/farmtally/jenkins/{home,casc}
sudo chown -R 1000:1000 /opt/farmtally/jenkins/home
```

### 3.2 Create Jenkins Configuration as Code
```bash
cat > /opt/farmtally/jenkins/casc/jenkins.yaml << 'EOF'
jenkins:
  systemMessage: "FarmTally CI/CD Server - 147.93.153.247"
  numExecutors: 2
  mode: NORMAL
  
  securityRealm:
    local:
      allowsSignup: false
      users:
        - id: "admin"
          password: "farmtally_jenkins_admin_2024"
          properties:
            - "hudson.model.MyViewsProperty"
            - "hudson.security.HudsonPrivateSecurityRealm$Details"
  
  authorizationStrategy:
    globalMatrix:
      permissions:
        - "Overall/Administer:admin"
        - "Overall/Read:authenticated"
        - "Job/Build:authenticated"
        - "Job/Cancel:authenticated"
        - "Job/Read:authenticated"

  remotingSecurity:
    enabled: true

  crumbIssuer:
    standard:
      excludeClientIPFromCrumb: false

credentials:
  system:
    domainCredentials:
      - credentials:
          - usernamePassword:
              scope: GLOBAL
              id: "docker-registry-credentials"
              username: "farmtally"
              password: "farmtally_registry_2024"
              description: "Docker Registry Credentials"

tool:
  nodejs:
    installations:
      - name: "NodeJS 18"
        properties:
          - installSource:
              installers:
                - nodeJSInstaller:
                    id: "18.17.0"
                    npmPackagesRefreshHours: 72

  dockerTool:
    installations:
      - name: "Docker"
        properties:
          - installSource:
              installers:
                - dockerInstaller:
                    version: "latest"

unclassified:
  location:
    url: "http://147.93.153.247:8080/"
    adminAddress: "admin@farmtally.com"
  
  mailer:
    smtpHost: "smtp.hostinger.com"
    smtpPort: 587
    useSsl: false
    useTls: true
    charset: "UTF-8"
    authentication:
      username: "noreply@farmtally.in"
      password: "2t/!P1K]w"
    defaultSuffix: "@farmtally.in"
EOF
```

### 3.3 Create Jenkins Docker Compose
```bash
cat > /opt/farmtally/jenkins/docker-compose.yml << 'EOF'
version: '3.8'

services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: farmtally-jenkins
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - /opt/farmtally/jenkins/home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - /opt/farmtally/jenkins/casc:/var/jenkins_home/casc_configs
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=false -Xmx2g
      - CASC_JENKINS_CONFIG=/var/jenkins_home/casc_configs/jenkins.yaml
    networks:
      - jenkins-network
    user: root

networks:
  jenkins-network:
    driver: bridge
EOF
```

### 3.4 Start Jenkins
```bash
cd /opt/farmtally/jenkins
docker-compose up -d

# Wait for Jenkins to start (about 2-3 minutes)
sleep 180

# Check if Jenkins is running
curl -I http://localhost:8080
```

### 3.5 Access Jenkins
1. Open browser: `http://147.93.153.247:8080`
2. Login with:
   - Username: `admin`
   - Password: `farmtally_jenkins_admin_2024`

## Step 4: Jenkins Pipeline Configuration

### 4.1 Install Required Plugins
Go to Jenkins Dashboard → Manage Jenkins → Manage Plugins → Available

Install these plugins:
- Pipeline
- Git
- GitHub
- Docker Pipeline
- NodeJS
- Email Extension
- Slack Notification (optional)

### 4.2 Configure Global Tools
Go to Manage Jenkins → Global Tool Configuration:

**NodeJS:**
- Name: `NodeJS 18`
- Version: `18.17.0`
- ✅ Install automatically

**Docker:**
- Name: `Docker`
- ✅ Install automatically

### 4.3 Configure Credentials
Go to Manage Jenkins → Manage Credentials → System → Global credentials:

**Add Docker Registry Credentials:**
- Kind: Username with password
- ID: `docker-registry-credentials`
- Username: `farmtally`
- Password: `farmtally_registry_2024`
- Description: `Docker Registry Credentials`

**Add GitHub Credentials (if using private repo):**
- Kind: Username with password
- ID: `github-credentials`
- Username: `your-github-username`
- Password: `your-github-token`
- Description: `GitHub Credentials`

**Add Server SSH Key:**
- Kind: SSH Username with private key
- ID: `server-ssh-credentials`
- Username: `farmtally`
- Private Key: Enter directly (your SSH private key)
- Description: `Server SSH Key`

### 4.4 Create Pipeline Job
1. New Item → Multibranch Pipeline
2. Name: `farmtally-user-service`
3. Branch Sources → Add source → Git
4. Project Repository: `https://github.com/your-org/farmtally-user-service.git`
5. Credentials: Select your GitHub credentials
6. Save

## Step 5: Application Deployment Setup

### 5.1 Copy Application Files
```bash
# Copy your application code to the server
scp -r /path/to/farmtally-code farmtally@147.93.153.247:/opt/farmtally/app/

# Or clone from repository
cd /opt/farmtally
git clone https://github.com/your-org/farmtally-user-service.git app
```

### 5.2 Create Production Environment File
```bash
cd /opt/farmtally/app

# Copy the production environment template
cp config/production.env .env

# Update with actual values (see next section)
nano .env
```

### 5.3 Update Environment Variables
Edit `/opt/farmtally/app/.env` with these values:

```bash
# Database (update with your actual database credentials)
DATABASE_URL=postgresql://farmtally_prod_user:YOUR_DB_PASSWORD@147.93.153.247:5432/farmtally_prod
POSTGRES_PASSWORD=YOUR_SECURE_DB_PASSWORD

# Redis (update with your actual Redis password)
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@147.93.153.247:6379/0
REDIS_PASSWORD=YOUR_SECURE_REDIS_PASSWORD

# JWT and Security
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_64_CHARS_LONG
SESSION_SECRET=YOUR_GENERATED_SESSION_SECRET

# Email Configuration (Hostinger)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@farmtally.in
SMTP_PASS=2t/!P1K]w
EMAIL_FROM=noreply@farmtally.in
EMAIL_FROM_NAME=FarmTally System

# Server Configuration
SERVER_IP=147.93.153.247
NODE_ENV=production
PORT=3000
```

## Step 6: Database Setup

### 6.1 Install PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 6.2 Create Database and User
```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE farmtally_prod;
CREATE USER farmtally_prod_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE farmtally_prod TO farmtally_prod_user;
ALTER USER farmtally_prod_user CREATEDB;
\q
EOF
```

### 6.3 Install Redis
```bash
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf

# Add/update these lines:
# requirepass YOUR_SECURE_REDIS_PASSWORD
# bind 127.0.0.1 147.93.153.247

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

## Step 7: SSL Certificate Setup

### 7.1 Generate Self-Signed Certificate (for testing)
```bash
cd /opt/farmtally/ssl

# Generate private key
openssl genrsa -out farmtally.key 2048

# Generate certificate
openssl req -new -x509 -key farmtally.key -out farmtally.crt -days 365 \
  -subj "/C=US/ST=State/L=City/O=FarmTally/CN=147.93.153.247"
```

### 7.2 Or Use Let's Encrypt (for production)
```bash
# Install certbot
sudo apt install -y certbot

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d farmtally.com -d www.farmtally.com

# Copy certificates
sudo cp /etc/letsencrypt/live/farmtally.com/fullchain.pem /opt/farmtally/ssl/farmtally.crt
sudo cp /etc/letsencrypt/live/farmtally.com/privkey.pem /opt/farmtally/ssl/farmtally.key
sudo chown farmtally:farmtally /opt/farmtally/ssl/*
```

## Step 8: Deploy Application

### 8.1 Build and Deploy
```bash
cd /opt/farmtally/app

# Build Docker image
docker build -t farmtally/user-service:latest .

# Tag for local registry
docker tag farmtally/user-service:latest localhost:9000/farmtally/user-service:latest

# Push to local registry
docker push localhost:9000/farmtally/user-service:latest

# Deploy with Docker Compose
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 8.2 Verify Deployment
```bash
# Check containers are running
docker ps

# Check application health
curl http://localhost:3000/health

# Check logs
docker-compose logs -f farmtally-user-service
```

## Step 9: Setup Monitoring (Optional)

### 9.1 Deploy Monitoring Stack
```bash
cd /opt/farmtally/app

# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to start
sleep 60

# Access Grafana
# URL: http://147.93.153.247:3001
# Username: admin
# Password: farmtally_grafana_admin_2024
```

## Step 10: Configure Firewall

### 10.1 Setup UFW Firewall
```bash
# Reset firewall
sudo ufw --force reset

# Set defaults
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Jenkins
sudo ufw allow 8080/tcp

# Allow Docker Registry
sudo ufw allow 9000/tcp

# Allow Application
sudo ufw allow 3000/tcp

# Allow Grafana (optional)
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

## Step 11: Test the Complete Setup

### 11.1 Test Jenkins Pipeline
1. Go to Jenkins: `http://147.93.153.247:8080`
2. Navigate to your pipeline job
3. Click "Build Now"
4. Monitor the build progress

### 11.2 Test Application
```bash
# Health check
curl http://147.93.153.247:3000/health

# API test
curl http://147.93.153.247:3000/api/auth/health
```

### 11.3 Test Email (optional)
```bash
# Test email sending from application
curl -X POST http://147.93.153.247:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "Test", "message": "Hello"}'
```

## Troubleshooting

### Common Issues

**Jenkins won't start:**
```bash
# Check logs
docker logs farmtally-jenkins

# Check permissions
sudo chown -R 1000:1000 /opt/farmtally/jenkins/home
```

**Docker Registry connection issues:**
```bash
# Check registry is running
curl http://localhost:9000/v2/

# Check Docker daemon configuration
sudo nano /etc/docker/daemon.json
# Add: {"insecure-registries": ["147.93.153.247:9000"]}
sudo systemctl restart docker
```

**Application won't connect to database:**
```bash
# Test database connection
psql -h 147.93.153.247 -U farmtally_prod_user -d farmtally_prod

# Check PostgreSQL configuration
sudo nano /etc/postgresql/*/main/pg_hba.conf
sudo nano /etc/postgresql/*/main/postgresql.conf
```

**SSL Certificate issues:**
```bash
# Check certificate validity
openssl x509 -in /opt/farmtally/ssl/farmtally.crt -text -noout

# Test SSL connection
openssl s_client -connect 147.93.153.247:443
```

## Security Recommendations

1. **Change Default Passwords**: Update all default passwords immediately
2. **SSH Key Authentication**: Disable password authentication for SSH
3. **Regular Updates**: Keep system and Docker images updated
4. **Backup Strategy**: Implement regular backups of data and configurations
5. **Monitor Logs**: Set up log monitoring and alerting
6. **Network Security**: Use VPN or restrict access by IP where possible

## Maintenance Tasks

### Daily
- Check application health endpoints
- Monitor disk space usage
- Review error logs

### Weekly
- Update Docker images
- Review security logs
- Test backup restoration

### Monthly
- Update system packages
- Review and rotate logs
- Security audit

## Support

For issues or questions:
- Check application logs: `docker-compose logs`
- Check Jenkins logs: `docker logs farmtally-jenkins`
- Check system logs: `sudo journalctl -f`

---

**Next Steps After Setup:**
1. Configure GitHub webhooks for automatic builds
2. Set up proper domain name and SSL certificates
3. Configure monitoring alerts
4. Implement backup automation
5. Set up staging environment for testing