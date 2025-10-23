# FarmTally Deployment Plan

## 🎯 Current Status
✅ Jenkins CI/CD Pipeline Working  
✅ Docker Images Building Successfully  
✅ GitHub Integration Complete  
❌ **Next: Deploy to Production Server**

## 🚀 Deployment Steps

### Step 1: Prepare Server Environment
```bash
# SSH to your server
ssh root@147.93.153.247

# Create FarmTally directory structure
mkdir -p /opt/farmtally/{data/postgres,data/redis,logs/nginx,ssl,backups}
cd /opt/farmtally
```

### Step 2: Clone Repository to Server
```bash
# Clone your repository
git clone https://github.com/Prasad-Sariki2047/FarmTally.git .

# Set up environment variables
cp .env.example .env.production
```

### Step 3: Configure Environment Variables
Edit `/opt/farmtally/.env.production`:
```bash
# Database Configuration
POSTGRES_DB=farmtally_prod
POSTGRES_USER=farmtally_prod_user
POSTGRES_PASSWORD=your_secure_password_here

# Redis Configuration  
REDIS_PASSWORD=your_redis_password_here
REDIS_URL=redis://:your_redis_password_here@redis:6379

# Application Configuration
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://farmtally_prod_user:your_secure_password_here@postgres:5432/farmtally_prod

# JWT Secret (generate a strong secret)
JWT_SECRET=your_jwt_secret_here

# External Services (configure as needed)
EMAIL_SERVICE_URL=
SMS_SERVICE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Step 4: Deploy with Docker Compose
```bash
# Pull the latest Docker image built by Jenkins
docker pull farmtally/user-service:latest

# Start the services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker-compose ps
```

### Step 5: Verify Database Setup
```bash
# Check if database is running
docker-compose exec postgres psql -U farmtally_prod_user -d farmtally_prod -c "\dt"

# Verify tables were created
docker-compose exec postgres psql -U farmtally_prod_user -d farmtally_prod -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

### Step 6: Test Application
```bash
# Check application health
curl http://147.93.153.247:3001/health

# Check if app is responding
curl http://147.93.153.247:3001/api/auth/health
```

## 🔧 Database Schema

Your database will include:
- **users** - User accounts and roles
- **user_profiles** - Extended user information
- **business_relationships** - Farm admin to service provider relationships
- **invitations** - Magic link invitations
- **registration_requests** - User registration workflow

## 🌐 Access Points

After deployment:
- **Application**: http://147.93.153.247:3001
- **Nginx Proxy**: http://147.93.153.247:8082
- **Database**: 147.93.153.247:5433 (PostgreSQL)
- **Redis**: 147.93.153.247:6380
- **Jenkins**: http://147.93.153.247:8080

## 🔐 Security Notes

1. **Change default passwords** in .env.production
2. **Generate strong JWT secret**
3. **Set up SSL certificates** for HTTPS
4. **Configure firewall rules** if needed
5. **Set up database backups**

## 📊 Monitoring

The setup includes:
- Health checks for all services
- Log rotation
- Resource limits
- Automatic restart policies

## 🚨 Troubleshooting

If deployment fails:
```bash
# Check logs
docker-compose logs farmtally-user-service
docker-compose logs postgres
docker-compose logs redis

# Restart services
docker-compose restart

# Rebuild if needed
docker-compose down
docker-compose up -d --build
```

## ✅ Success Criteria

Deployment is successful when:
- [ ] All containers are running (`docker-compose ps`)
- [ ] Database tables are created
- [ ] Application responds to health checks
- [ ] API endpoints are accessible
- [ ] Default admin user exists in database