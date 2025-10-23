# FarmTally Production Environment Setup Script
# Configures all environment variables and service configurations for server 147.93.153.247

param(
    [string]$ServerIP = "147.93.153.247",
    [switch]$GenerateSecrets = $true,
    [switch]$CreateSSLCerts = $false,
    [switch]$ValidateConfig = $true,
    [string]$ConfigDir = "config"
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

# Generate secure random passwords and secrets
function Generate-SecureSecrets {
    Write-Step "Generating Secure Secrets"
    
    # Generate random values
    $postgresPassword = -join ((1..32) | ForEach {[char]((65..90) + (97..122) + (48..57) | Get-Random)})
    $redisPassword = -join ((1..32) | ForEach {[char]((65..90) + (97..122) + (48..57) | Get-Random)})
    $jwtSecret = -join ((1..64) | ForEach {[char]((65..90) + (97..122) + (48..57) | Get-Random)})
    $sessionSecret = -join ((1..32) | ForEach {[char]((65..90) + (97..122) + (48..57) | Get-Random)})
    $magicLinkSecret = -join ((1..32) | ForEach {[char]((65..90) + (97..122) + (48..57) | Get-Random)})
    
    # Store secrets in a secure file
    $secretsContent = @"
# FarmTally Production Secrets
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# Server: $ServerIP

POSTGRES_PASSWORD=$postgresPassword
REDIS_PASSWORD=$redisPassword
JWT_SECRET=$jwtSecret
SESSION_SECRET=$sessionSecret
MAGIC_LINK_SECRET=$magicLinkSecret

# Email Configuration (Hostinger)
SMTP_USER=noreply@farmtally.in
SMTP_PASS=2t/!P1K]w

# SMS Configuration (UPDATE THESE)
SMS_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
SMS_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
SMS_FROM_NUMBER=+1234567890

# OAuth Configuration (UPDATE THESE)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# External APIs (UPDATE THESE)
WEATHER_API_KEY=YOUR_WEATHER_API_KEY
MARKET_API_KEY=YOUR_MARKET_API_KEY
GEO_API_KEY=YOUR_GEOLOCATION_API_KEY

# Cloud Storage (UPDATE THESE)
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
"@

    $secretsContent | Out-File -FilePath "$ConfigDir/secrets.env" -Encoding UTF8
    
    Write-Info "Secure secrets generated and saved to $ConfigDir/secrets.env"
    Write-Warn "Please update the placeholder values in secrets.env with your actual credentials"
    
    return @{
        PostgresPassword = $postgresPassword
        RedisPassword = $redisPassword
        JwtSecret = $jwtSecret
        SessionSecret = $sessionSecret
        MagicLinkSecret = $magicLinkSecret
    }
}

# Create production environment file with generated secrets
function Create-ProductionEnvironment {
    param($Secrets)
    
    Write-Step "Creating Production Environment File"
    
    # Read the template and replace placeholders
    $envTemplate = Get-Content "$ConfigDir/production.env" -Raw
    
    # Replace secret placeholders
    $envContent = $envTemplate -replace 'CHANGE_THIS_SECURE_PASSWORD_IN_PRODUCTION', $Secrets.PostgresPassword
    $envContent = $envContent -replace 'CHANGE_THIS_REDIS_PASSWORD_IN_PRODUCTION', $Secrets.RedisPassword
    $envContent = $envContent -replace 'CHANGE_THIS_JWT_SECRET_MINIMUM_32_CHARACTERS_LONG', $Secrets.JwtSecret
    $envContent = $envContent -replace 'CHANGE_THIS_SESSION_SECRET_FOR_PRODUCTION', $Secrets.SessionSecret
    $envContent = $envContent -replace 'CHANGE_THIS_MAGIC_LINK_SECRET', $Secrets.MagicLinkSecret
    
    # Replace server IP placeholders
    $envContent = $envContent -replace '147\.93\.153\.247', $ServerIP
    
    # Save the final environment file
    $envContent | Out-File -FilePath ".env.production" -Encoding UTF8
    
    Write-Info "Production environment file created: .env.production"
}

# Create service configuration files
function Create-ServiceConfigurations {
    param($Secrets)
    
    Write-Step "Creating Service Configuration Files"
    
    # Update database configuration
    $dbConfig = Get-Content "$ConfigDir/database.production.json" -Raw
    $dbConfig = $dbConfig -replace '\$\{POSTGRES_PASSWORD\}', $Secrets.PostgresPassword
    $dbConfig = $dbConfig -replace '147\.93\.153\.247', $ServerIP
    $dbConfig | Out-File -FilePath "config/database.json" -Encoding UTF8
    
    # Update Redis configuration
    $redisConfig = Get-Content "$ConfigDir/redis.production.json" -Raw
    $redisConfig = $redisConfig -replace '\$\{REDIS_PASSWORD\}', $Secrets.RedisPassword
    $redisConfig = $redisConfig -replace '147\.93\.153\.247', $ServerIP
    $redisConfig | Out-File -FilePath "config/redis.json" -Encoding UTF8
    
    Write-Info "Service configuration files created"
}

# Create SSL certificate configuration
function Create-SSLConfiguration {
    Write-Step "Creating SSL Certificate Configuration"
    
    $sslConfig = @"
# SSL Certificate Configuration for FarmTally Production
# Server: $ServerIP

# Certificate Paths
SSL_CERT_PATH=/opt/farmtally/ssl/farmtally.crt
SSL_KEY_PATH=/opt/farmtally/ssl/farmtally.key
SSL_CA_PATH=/opt/farmtally/ssl/ca.crt

# SSL Settings
SSL_PROTOCOLS=TLSv1.2 TLSv1.3
SSL_CIPHERS=ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384
SSL_PREFER_SERVER_CIPHERS=off
SSL_SESSION_CACHE=shared:SSL:10m
SSL_SESSION_TIMEOUT=10m

# HSTS Settings
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true

# Certificate Information
CERT_COUNTRY=US
CERT_STATE=State
CERT_CITY=City
CERT_ORGANIZATION=FarmTally
CERT_ORGANIZATIONAL_UNIT=IT Department
CERT_COMMON_NAME=$ServerIP
CERT_EMAIL=admin@farmtally.com

# Subject Alternative Names
CERT_SAN_DNS=farmtally.local,www.farmtally.com,api.farmtally.com
CERT_SAN_IP=$ServerIP,127.0.0.1
"@

    $sslConfig | Out-File -FilePath "$ConfigDir/ssl.conf" -Encoding UTF8
    
    if ($CreateSSLCerts) {
        Write-Info "Generating SSL certificates..."
        & ".\scripts\generate-ssl.ps1" -Domain $ServerIP -OutputDir "ssl" -ValidDays 365
    }
    
    Write-Info "SSL configuration created"
}

# Create Docker environment file
function Create-DockerEnvironment {
    param($Secrets)
    
    Write-Step "Creating Docker Environment File"
    
    $dockerEnv = @"
# Docker Environment Variables for FarmTally Production
# Server: $ServerIP

# Database
POSTGRES_DB=farmtally_prod
POSTGRES_USER=farmtally_prod_user
POSTGRES_PASSWORD=$($Secrets.PostgresPassword)

# Redis
REDIS_PASSWORD=$($Secrets.RedisPassword)

# Application
JWT_SECRET=$($Secrets.JwtSecret)
SESSION_SECRET=$($Secrets.SessionSecret)

# Server Configuration
SERVER_IP=$ServerIP
NODE_ENV=production
PORT=3000

# SSL
SSL_ENABLED=true
FORCE_HTTPS=true

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
"@

    $dockerEnv | Out-File -FilePath ".env.docker" -Encoding UTF8
    
    Write-Info "Docker environment file created: .env.docker"
}

# Validate configuration files
function Test-Configuration {
    Write-Step "Validating Configuration Files"
    
    $errors = @()
    
    # Check required files exist
    $requiredFiles = @(
        ".env.production",
        "config/database.json",
        "config/redis.json",
        "$ConfigDir/secrets.env"
    )
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            $errors += "Missing required file: $file"
        }
    }
    
    # Validate environment file
    if (Test-Path ".env.production") {
        $envContent = Get-Content ".env.production" -Raw
        
        # Check for placeholder values
        if ($envContent -match "CHANGE_THIS|YOUR_|UPDATE_THESE") {
            $errors += "Environment file contains placeholder values that need to be updated"
        }
        
        # Check for required variables
        $requiredVars = @("NODE_ENV", "DATABASE_URL", "REDIS_URL", "JWT_SECRET")
        foreach ($var in $requiredVars) {
            if ($envContent -notmatch "$var=") {
                $errors += "Missing required environment variable: $var"
            }
        }
    }
    
    # Validate JSON configuration files
    $jsonFiles = @("config/database.json", "config/redis.json")
    foreach ($jsonFile in $jsonFiles) {
        if (Test-Path $jsonFile) {
            try {
                Get-Content $jsonFile | ConvertFrom-Json | Out-Null
            } catch {
                $errors += "Invalid JSON in file: $jsonFile"
            }
        }
    }
    
    if ($errors.Count -eq 0) {
        Write-Info "Configuration validation passed"
        return $true
    } else {
        Write-Error "Configuration validation failed:"
        foreach ($error in $errors) {
            Write-Error "  - $error"
        }
        return $false
    }
}

# Create deployment checklist
function Create-DeploymentChecklist {
    Write-Step "Creating Deployment Checklist"
    
    $checklist = @"
# FarmTally Production Deployment Checklist
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Server: $ServerIP

## Pre-Deployment
- [ ] Update secrets.env with actual credentials
- [ ] Configure email service (SMTP settings)
- [ ] Configure SMS service (Twilio credentials)
- [ ] Set up Google OAuth credentials
- [ ] Generate or obtain SSL certificates
- [ ] Configure external API keys
- [ ] Set up cloud storage (AWS S3)
- [ ] Configure monitoring alerts

## Environment Configuration
- [ ] Copy .env.production to server as .env
- [ ] Copy config files to /opt/farmtally/config/
- [ ] Set proper file permissions (600 for .env, 644 for configs)
- [ ] Verify environment variables are loaded correctly

## Database Setup
- [ ] Install PostgreSQL on server
- [ ] Create production database and user
- [ ] Configure PostgreSQL for production (postgresql.conf, pg_hba.conf)
- [ ] Test database connectivity
- [ ] Run database migrations
- [ ] Set up database backups

## Redis Setup
- [ ] Install Redis on server
- [ ] Configure Redis for production (redis.conf)
- [ ] Set Redis password
- [ ] Test Redis connectivity
- [ ] Configure Redis persistence

## SSL/TLS Configuration
- [ ] Generate or install SSL certificates
- [ ] Configure Nginx with SSL
- [ ] Test HTTPS connectivity
- [ ] Verify SSL certificate validity
- [ ] Set up certificate renewal (if using Let's Encrypt)

## Application Deployment
- [ ] Build Docker images
- [ ] Deploy application containers
- [ ] Configure reverse proxy (Nginx)
- [ ] Test application endpoints
- [ ] Verify health checks

## Security Configuration
- [ ] Configure firewall rules
- [ ] Set up fail2ban
- [ ] Configure rate limiting
- [ ] Test security headers
- [ ] Verify CORS settings

## Monitoring Setup
- [ ] Deploy monitoring stack (Prometheus, Grafana)
- [ ] Configure alerting rules
- [ ] Set up log aggregation
- [ ] Test monitoring dashboards
- [ ] Configure notification channels

## Performance Optimization
- [ ] Configure connection pooling
- [ ] Set up caching strategies
- [ ] Optimize database queries
- [ ] Configure CDN (if applicable)
- [ ] Test load balancing

## Backup and Recovery
- [ ] Set up automated backups
- [ ] Test backup restoration
- [ ] Configure disaster recovery procedures
- [ ] Document recovery processes

## Final Testing
- [ ] Run end-to-end tests
- [ ] Test all authentication methods
- [ ] Verify all API endpoints
- [ ] Test error handling
- [ ] Performance testing
- [ ] Security testing

## Go-Live
- [ ] Update DNS records
- [ ] Monitor application logs
- [ ] Monitor system metrics
- [ ] Verify all services are running
- [ ] Notify stakeholders

## Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Review logs for errors
- [ ] Check performance metrics
- [ ] Verify backup completion
- [ ] Update documentation
"@

    $checklist | Out-File -FilePath "DEPLOYMENT_CHECKLIST.md" -Encoding UTF8
    
    Write-Info "Deployment checklist created: DEPLOYMENT_CHECKLIST.md"
}

# Main execution
Write-Host "🔧 FarmTally Production Environment Setup" -ForegroundColor Magenta
Write-Host "Target Server: $ServerIP" -ForegroundColor Magenta
Write-Host ""

# Create config directory if it doesn't exist
New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null

$secrets = $null
if ($GenerateSecrets) {
    $secrets = Generate-SecureSecrets
    Create-ProductionEnvironment -Secrets $secrets
    Create-ServiceConfigurations -Secrets $secrets
    Create-DockerEnvironment -Secrets $secrets
}

Create-SSLConfiguration
Create-DeploymentChecklist

if ($ValidateConfig -and $secrets) {
    $validationResult = Test-Configuration
    if (-not $validationResult) {
        Write-Warn "Configuration validation failed. Please review and fix the issues before deployment."
    }
}

Write-Host ""
Write-Info "Production environment setup completed!"
Write-Info "Generated files:"
Write-Host "  - .env.production (main environment file)"
Write-Host "  - .env.docker (Docker environment)"
Write-Host "  - config/secrets.env (secure secrets)"
Write-Host "  - config/database.json (database configuration)"
Write-Host "  - config/redis.json (Redis configuration)"
Write-Host "  - config/ssl.conf (SSL configuration)"
Write-Host "  - DEPLOYMENT_CHECKLIST.md (deployment guide)"
Write-Host ""
Write-Warn "IMPORTANT NEXT STEPS:"
Write-Host "1. Review and update config/secrets.env with your actual credentials"
Write-Host "2. Follow the deployment checklist in DEPLOYMENT_CHECKLIST.md"
Write-Host "3. Test all configurations before deploying to production"
Write-Host "4. Secure the secrets.env file with proper permissions (600)"
Write-Host "5. Never commit secrets.env to version control"