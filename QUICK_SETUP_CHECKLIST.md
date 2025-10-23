# FarmTally Quick Setup Checklist

## 🚀 Essential Setup Steps

### 1. Server Preparation (5 minutes)
```bash
# SSH into your server
ssh root@147.93.153.247

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create farmtally user
sudo useradd -m -s /bin/bash farmtally
sudo usermod -aG docker farmtally
sudo usermod -aG sudo farmtally

# Create directories
sudo mkdir -p /opt/farmtally
sudo chown -R farmtally:farmtally /opt/farmtally
```

### 2. Copy Project Files (2 minutes)
```bash
# Copy your project to the server
scp -r /path/to/your/farmtally-project farmtally@147.93.153.247:/opt/farmtally/app/

# Or clone from repository
ssh farmtally@147.93.153.247
cd /opt/farmtally
git clone https://your-repo-url.git app
```

### 3. Database Setup (3 minutes)
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database
sudo -u postgres psql << 'EOF'
CREATE DATABASE farmtally_prod;
CREATE USER farmtally_prod_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE farmtally_prod TO farmtally_prod_user;
\q
EOF

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

### 4. Environment Configuration (2 minutes)
```bash
cd /opt/farmtally/app

# Copy production environment
cp config/production.env .env

# Update critical values in .env:
nano .env
```

**Update these values in .env:**
```bash
# Database
DATABASE_URL=postgresql://farmtally_prod_user:your_secure_password_here@localhost:5432/farmtally_prod
POSTGRES_PASSWORD=your_secure_password_here

# Redis  
REDIS_PASSWORD=your_redis_password_here

# JWT (generate a 64-character random string)
JWT_SECRET=your_64_character_jwt_secret_here

# Session (generate a 32-character random string)
SESSION_SECRET=your_32_character_session_secret_here

# Email is already configured with Hostinger:
SMTP_HOST=smtp.hostinger.com
SMTP_USER=noreply@farmtally.in
SMTP_PASS=2t/!P1K]w
```

### 5. Docker Registry Setup (1 minute)
```bash
# Start Docker Registry
docker run -d \
  --name farmtally-registry \
  --restart=unless-stopped \
  -p 9000:5000 \
  registry:2

# Test registry
curl http://localhost:9000/v2/
```

### 6. Jenkins Setup (3 minutes)
```bash
cd /opt/farmtally/app

# Copy Jenkins configuration
mkdir -p /opt/farmtally/jenkins/{home,casc}
sudo chown -R 1000:1000 /opt/farmtally/jenkins/home

# Copy Jenkins config from your project
cp jenkins/casc.yaml /opt/farmtally/jenkins/casc/jenkins.yaml
cp jenkins/docker-compose.jenkins.yml /opt/farmtally/jenkins/docker-compose.yml

# Start Jenkins
cd /opt/farmtally/jenkins
docker-compose up -d

# Wait for Jenkins to start (2-3 minutes)
sleep 180
```

### 7. Application Deployment (2 minutes)
```bash
cd /opt/farmtally/app

# Build and deploy
docker build -t farmtally/user-service:latest .
docker tag farmtally/user-service:latest localhost:9000/farmtally/user-service:latest
docker push localhost:9000/farmtally/user-service:latest

# Deploy application
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 8. Firewall Configuration (1 minute)
```bash
# Configure firewall
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp  # Jenkins
sudo ufw allow 9000/tcp  # Docker Registry
sudo ufw allow 3000/tcp  # Application
sudo ufw --force enable
```

## 🔍 Verification Steps

### Test Jenkins
- Open: `http://147.93.153.247:8080`
- Login: `admin` / `farmtally_jenkins_admin_2024`

### Test Application
```bash
# Health check
curl http://147.93.153.247:3000/health

# Should return: {"status":"healthy","timestamp":"...","service":"FarmTally User Role Management"}
```

### Test Docker Registry
```bash
curl http://147.93.153.247:9000/v2/
# Should return: {}
```

### Test Email (Optional)
```bash
# Test email configuration
curl -X POST http://147.93.153.247:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com","subject":"Test","message":"Hello from FarmTally"}'
```

## 🔧 Jenkins Pipeline Setup

### 1. Access Jenkins Dashboard
- URL: `http://147.93.153.247:8080`
- Username: `admin`
- Password: `farmtally_jenkins_admin_2024`

### 2. Install Required Plugins
Go to: Manage Jenkins → Manage Plugins → Available

Install:
- ✅ Pipeline
- ✅ Git
- ✅ GitHub
- ✅ Docker Pipeline
- ✅ NodeJS
- ✅ Email Extension

### 3. Configure Credentials
Go to: Manage Jenkins → Manage Credentials → System → Global credentials

**Add Docker Registry Credentials:**
- Kind: Username with password
- ID: `docker-registry-credentials`
- Username: `farmtally`
- Password: `farmtally_registry_2024`

**Add GitHub Credentials (if private repo):**
- Kind: Username with password
- ID: `github-credentials`
- Username: `your-github-username`
- Password: `your-github-token`

### 4. Create Pipeline Job
1. New Item → Multibranch Pipeline
2. Name: `farmtally-user-service`
3. Branch Sources → Add source → Git
4. Repository URL: `https://github.com/your-org/farmtally-user-service.git`
5. Credentials: Select GitHub credentials
6. Save

### 5. Test Pipeline
- Click "Scan Multibranch Pipeline Now"
- Should detect your Jenkinsfile and start building

## 📧 Email Configuration Details

Your email is already configured with Hostinger:

```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=noreply@farmtally.in
SMTP_PASS=2t/!P1K]w
```

**Email Features Available:**
- ✅ User registration confirmations
- ✅ Password reset emails
- ✅ OTP delivery via email
- ✅ Magic link authentication
- ✅ System notifications

## 🚨 Security Notes

### Immediate Actions Required:
1. **Change Jenkins Password**: Go to Jenkins → Manage Jenkins → Manage Users → admin → Configure
2. **Generate Strong Database Password**: Replace `your_secure_password_here` with a strong password
3. **Generate JWT Secret**: Use a 64-character random string for JWT_SECRET
4. **Setup SSH Keys**: Configure SSH key authentication and disable password auth

### Recommended Security:
```bash
# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd

# Setup fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```

## 📊 Monitoring Setup (Optional)

If you want monitoring dashboards:

```bash
cd /opt/farmtally/app

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana
# URL: http://147.93.153.247:3001
# Username: admin
# Password: farmtally_grafana_admin_2024
```

## 🆘 Troubleshooting

### Jenkins Won't Start
```bash
# Check logs
docker logs farmtally-jenkins

# Fix permissions
sudo chown -R 1000:1000 /opt/farmtally/jenkins/home
```

### Application Won't Start
```bash
# Check logs
docker-compose logs farmtally-user-service

# Check environment
cat .env | grep -E "DATABASE_URL|REDIS_URL"
```

### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U farmtally_prod_user -d farmtally_prod

# Check PostgreSQL status
sudo systemctl status postgresql
```

## 📞 Support

If you encounter issues:
1. Check the detailed setup guide: `JENKINS_DOCKER_SETUP_GUIDE.md`
2. Review application logs: `docker-compose logs -f`
3. Check system logs: `sudo journalctl -f`

---

**Total Setup Time: ~20 minutes**

**Next Steps After Setup:**
1. Configure GitHub webhooks for automatic deployments
2. Set up proper domain name and SSL certificates  
3. Configure monitoring alerts
4. Implement automated backups