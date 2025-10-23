# 🔒 FarmTally Isolation Reference Card

## 🚨 CRITICAL: Server Shared with Another Team

**Server**: 147.93.153.247  
**Status**: SHARED - Another team is actively working on this server  
**Approach**: Complete isolation to prevent conflicts

---

## 📍 Port Allocation (Isolated)

### FarmTally Services
| Service | Standard Port | **FarmTally Port** | URL |
|---------|---------------|-------------------|-----|
| Application | 3000 | **3001** | http://147.93.153.247:3001 |
| Jenkins | 8080 | **8081** | http://147.93.153.247:8081 |
| Docker Registry | 9000 | **9001** | http://147.93.153.247:9001 |
| PostgreSQL | 5432 | **5433** | localhost:5433 |
| Redis | 6379 | **6380** | localhost:6380 |
| Nginx HTTP | 80 | **8082** | http://147.93.153.247:8082 |
| Nginx HTTPS | 443 | **8443** | https://147.93.153.247:8443 |
| Grafana | 3000 | **3002** | http://147.93.153.247:3002 |
| Prometheus | 9090 | **9091** | http://147.93.153.247:9091 |
| Alertmanager | 9093 | **9094** | http://147.93.153.247:9094 |

---

## 📁 Directory Structure (Isolated)

```
/opt/farmtally/           # ← OUR ISOLATED DIRECTORY
├── app/                  # Application code
├── jenkins/              # Jenkins CI/CD
├── registry/             # Docker registry
├── databases/            # PostgreSQL & Redis data
├── ssl/                  # SSL certificates
├── logs/                 # Application logs
├── backups/              # Database backups
└── monitoring/           # Grafana, Prometheus
```

**⚠️ NEVER touch directories outside `/opt/farmtally/`**

---

## 🌐 Network Isolation

### Docker Networks
| Network | Subnet | Purpose |
|---------|--------|---------|
| farmtally-network | 172.25.0.0/16 | Main application |
| farmtally-jenkins-network | 172.26.0.0/16 | CI/CD services |
| farmtally-monitoring-network | 172.27.0.0/16 | Monitoring stack |

**⚠️ Different subnets prevent network conflicts**

---

## 🚀 Quick Deployment Commands

### 1. Check Server Status First
```bash
# SSH into server
ssh root@147.93.153.247

# Check what's running (DON'T INTERFERE)
sudo netstat -tlnp | grep LISTEN
docker ps -a
```

### 2. Deploy FarmTally (Isolated)
```bash
# Create isolated environment
sudo mkdir -p /opt/farmtally
sudo useradd -m farmtally
sudo chown -R farmtally:farmtally /opt/farmtally

# Switch to farmtally user
sudo su - farmtally
cd /opt/farmtally

# Deploy application
git clone https://your-repo.git app
cd app
docker-compose -f docker-compose.yml up -d
```

### 3. Deploy Jenkins (Isolated)
```bash
cd /opt/farmtally
mkdir -p jenkins/{home,casc}
sudo chown -R 1000:1000 jenkins/home

# Copy Jenkins config and start
# (Follow detailed guide)
```

---

## 🔍 Health Checks

### Verify Isolation
```bash
# Check our services are running on correct ports
curl http://147.93.153.247:3001/health  # Application
curl http://147.93.153.247:8081/login   # Jenkins
curl http://147.93.153.247:9001/v2/     # Registry

# Verify no conflicts
sudo netstat -tlnp | grep -E ":3001|:8081|:9001|:5433|:6380"
```

### Monitor Resource Usage
```bash
# Check we're not overloading the server
htop
docker stats
df -h /opt/farmtally
```

---

## 🚨 Emergency Procedures

### If Impacting Other Team
```bash
# IMMEDIATE SHUTDOWN
cd /opt/farmtally/app
docker-compose down

# Verify all stopped
docker ps | grep farmtally
```

### Resource Cleanup
```bash
# Clean up if needed
docker system prune -f
docker volume prune -f
```

---

## 👥 Team Coordination

### Before Deployment
- [ ] Check server load: `htop`, `df -h`
- [ ] Verify ports are free: `netstat -tlnp`
- [ ] Inform other team of deployment window
- [ ] Agree on resource limits

### During Deployment
- [ ] Monitor resource usage continuously
- [ ] Deploy during off-peak hours
- [ ] Keep other team informed of progress

### After Deployment
- [ ] Verify no impact on other services
- [ ] Share access URLs with team
- [ ] Set up monitoring alerts

---

## 📊 Resource Limits (Agreed)

### CPU Usage
- **Maximum**: 50% during business hours
- **Peak**: 70% during off-hours only
- **Monitor**: `htop`, `docker stats`

### Memory Usage
- **Maximum**: 4GB (if server has 8GB+)
- **Monitor**: `free -h`, `docker stats`

### Disk Usage
- **Maximum**: 20GB for `/opt/farmtally/`
- **Monitor**: `df -h /opt/farmtally`

### Network
- **Avoid**: Large deployments during peak hours
- **Coordinate**: Database migrations, bulk operations

---

## 🔧 Maintenance Windows

### Agreed Schedule
- **Deployments**: Evenings (6 PM - 10 PM)
- **Updates**: Weekends (Saturday 2 AM - 6 AM)
- **Restarts**: Coordinate 24h in advance
- **Backups**: Daily at 2 AM (low impact)

---

## 📞 Emergency Contacts

### FarmTally Team
- **Primary**: admin@farmtally.in
- **Emergency**: [Your phone number]

### Other Team
- **Primary**: [Other team contact]
- **Emergency**: [Other team emergency contact]

### Server Admin
- **Primary**: [Server admin contact]
- **Emergency**: [Server admin emergency]

---

## ✅ Pre-Deployment Checklist

- [ ] Server resource check completed
- [ ] Port availability verified
- [ ] Other team notified
- [ ] Backup plan ready
- [ ] Monitoring configured
- [ ] Emergency contacts updated
- [ ] Resource limits agreed
- [ ] Rollback procedure tested

---

## 🎯 Success Criteria

### Deployment Success
- [ ] All FarmTally services running on isolated ports
- [ ] No impact on other team's services
- [ ] Resource usage within agreed limits
- [ ] Health checks passing
- [ ] Monitoring active

### Ongoing Operations
- [ ] Daily resource monitoring
- [ ] Weekly coordination with other team
- [ ] Monthly resource usage review
- [ ] Quarterly capacity planning

---

**Remember: We're guests on this server. Always prioritize the other team's work and maintain good communication.**