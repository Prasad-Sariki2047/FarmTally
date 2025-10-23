# Jenkins Setup Script for FarmTally CI/CD Pipeline
# Configures Jenkins server on 147.93.153.247:8080

param(
    [string]$JenkinsURL = "http://147.93.153.247:8080",
    [string]$DockerRegistryURL = "147.93.153.247:9000",
    [switch]$InstallPlugins = $true,
    [switch]$CreateJobs = $true
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

# Generate Jenkins Docker Compose configuration
function Create-JenkinsDockerCompose {
    Write-Step "Creating Jenkins Docker Compose Configuration"
    
    $jenkinsCompose = @"
version: '3.8'

services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: farmtally-jenkins
    restart: unless-stopped
    ports:
      - "8081:8080"   # External:Internal - Isolated Jenkins port
      - "50001:50000"  # External:Internal - Isolated agent port
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - ./jenkins/casc.yaml:/var/jenkins_home/casc_configs/jenkins.yaml:ro
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=false
      - CASC_JENKINS_CONFIG=/var/jenkins_home/casc_configs/jenkins.yaml
    networks:
      - jenkins-network
    user: root

  # Docker Registry for storing images
  docker-registry:
    image: registry:2
    container_name: farmtally-docker-registry
    restart: unless-stopped
    ports:
      - "9001:5000"  # External:Internal - Isolated registry port
    volumes:
      - registry_data:/var/lib/registry
      - ./jenkins/registry-config.yml:/etc/docker/registry/config.yml:ro
    environment:
      - REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY=/var/lib/registry
    networks:
      - jenkins-network

volumes:
  jenkins_home:
    driver: local
  registry_data:
    driver: local

networks:
  jenkins-network:
    driver: bridge
"@

    $jenkinsCompose | Out-File -FilePath "jenkins/docker-compose.jenkins.yml" -Encoding UTF8
    Write-Info "Jenkins Docker Compose configuration created"
}

# Create Jenkins Configuration as Code (JCasC) file
function Create-JenkinsConfiguration {
    Write-Step "Creating Jenkins Configuration as Code"
    
    $jenkinsCasC = @"
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
            - "hudson.security.HudsonPrivateSecurityRealm\$Details"
  
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

  nodes:
    - permanent:
        name: "farmtally-agent"
        remoteFS: "/home/jenkins/agent"
        launcher:
          ssh:
            host: "147.93.153.247"
            port: 22
            credentialsId: "server-ssh-key"

jobs:
  - script: |
      multibranchPipelineJob('farmtally-user-service') {
        displayName('FarmTally User Service')
        description('CI/CD pipeline for FarmTally User Role Management Service')
        
        branchSources {
          git {
            id('farmtally-repo')
            remote('https://github.com/Prasad-Sariki2047/FarmTally.git')
            credentialsId('github-credentials')
          }
        }
        
        factory {
          workflowBranchProjectFactory {
            scriptPath('Jenkinsfile')
          }
        }
        
        triggers {
          periodicFolderTrigger {
            interval('5m')
          }
        }
        
        orphanedItemStrategy {
          discardOldItems {
            numToKeep(10)
          }
        }
      }

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
          
          - basicSSHUserPrivateKey:
              scope: GLOBAL
              id: "server-ssh-credentials"
              username: "farmtally"
              privateKeySource:
                directEntry:
                  privateKey: |
                    -----BEGIN OPENSSH PRIVATE KEY-----
                    # Replace with actual SSH private key
                    -----END OPENSSH PRIVATE KEY-----
              description: "Server SSH Key"
          
          - usernamePassword:
              scope: GLOBAL
              id: "github-credentials"
              username: "farmtally-bot"
              password: "github_token_here"
              description: "GitHub Credentials"

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
    smtpHost: "smtp.gmail.com"
    smtpPort: 587
    useSsl: false
    useTls: true
    charset: "UTF-8"
    authentication:
      username: "jenkins@farmtally.com"
      password: "email_password_here"
    defaultSuffix: "@farmtally.com"
  
  slackNotifier:
    baseUrl: "https://hooks.slack.com/services/"
    teamDomain: "farmtally"
    token: "slack_token_here"
    room: "#deployments"
  
  globalLibraries:
    libraries:
      - name: "farmtally-pipeline-library"
        defaultVersion: "main"
        retriever:
          modernSCM:
            scm:
              git:
                remote: "https://github.com/farmtally/jenkins-pipeline-library.git"
                credentialsId: "github-credentials"
"@

    $jenkinsCasC | Out-File -FilePath "jenkins/casc.yaml" -Encoding UTF8
    Write-Info "Jenkins Configuration as Code file created"
}

# Create Docker Registry configuration
function Create-RegistryConfiguration {
    Write-Step "Creating Docker Registry Configuration"
    
    $registryConfig = @"
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
"@

    $registryConfig | Out-File -FilePath "jenkins/registry-config.yml" -Encoding UTF8
    Write-Info "Docker Registry configuration created"
}

# Create Jenkins plugins list
function Create-PluginsList {
    Write-Step "Creating Jenkins Plugins List"
    
    $pluginsList = @"
# Essential Jenkins Plugins for FarmTally CI/CD

# Core Pipeline Plugins
workflow-aggregator:latest
pipeline-stage-view:latest
pipeline-build-step:latest
pipeline-input-step:latest
pipeline-milestone-step:latest

# SCM Plugins
git:latest
github:latest
github-branch-source:latest
multibranch-scan-webhook-trigger:latest

# Build Tools
nodejs:latest
docker-workflow:latest
docker-build-step:latest

# Testing and Quality
junit:latest
jacoco:latest
htmlpublisher:latest
warnings-ng:latest
sonar:latest

# Notifications
mailer:latest
slack:latest
email-ext:latest

# Security
credentials:latest
credentials-binding:latest
ssh-credentials:latest
plain-credentials:latest

# Utilities
build-timeout:latest
timestamper:latest
ws-cleanup:latest
build-name-setter:latest
build-user-vars-plugin:latest

# Configuration as Code
configuration-as-code:latest
configuration-as-code-support:latest

# Monitoring
prometheus:latest
monitoring:latest

# Deployment
ssh-agent:latest
publish-over-ssh:latest
"@

    $pluginsList | Out-File -FilePath "jenkins/plugins.txt" -Encoding UTF8
    Write-Info "Jenkins plugins list created"
}

# Create Jenkins startup script
function Create-JenkinsStartupScript {
    Write-Step "Creating Jenkins Startup Script"
    
    $startupScript = @"
#!/bin/bash
# Jenkins Startup Script for FarmTally CI/CD

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Start Jenkins services
start_jenkins() {
    log_info "Starting Jenkins CI/CD services..."
    
    # Create necessary directories
    mkdir -p jenkins_home registry_data
    
    # Set proper permissions
    sudo chown -R 1000:1000 jenkins_home
    
    # Start services
    docker-compose -f jenkins/docker-compose.jenkins.yml up -d
    
    log_info "Jenkins services started"
}

# Wait for Jenkins to be ready
wait_for_jenkins() {
    log_info "Waiting for Jenkins to be ready..."
    
    timeout=300
    while [ `$timeout -gt 0 ]; do
        if curl -f -s http://localhost:8080/login > /dev/null; then
            log_info "Jenkins is ready!"
            break
        fi
        sleep 5
        timeout=`$((timeout - 5))
    done
    
    if [ `$timeout -le 0 ]; then
        log_error "Jenkins failed to start within timeout"
        exit 1
    fi
}

# Display access information
show_access_info() {
    log_info "Jenkins CI/CD Setup Complete!"
    echo ""
    echo "Jenkins Dashboard: http://147.93.153.247:8080"
    echo "Docker Registry:   http://147.93.153.247:9000"
    echo ""
    echo "Default Jenkins Credentials:"
    echo "  Username: admin"
    echo "  Password: farmtally_jenkins_admin_2024"
    echo ""
    log_warn "Please change the default password after first login!"
    echo ""
    echo "Next Steps:"
    echo "1. Access Jenkins dashboard and complete setup"
    echo "2. Configure GitHub webhook for automatic builds"
    echo "3. Update credentials in Jenkins"
    echo "4. Test the pipeline with a sample build"
}

# Main execution
main() {
    check_prerequisites
    start_jenkins
    wait_for_jenkins
    show_access_info
}

main
"@

    $startupScript | Out-File -FilePath "jenkins/start-jenkins.sh" -Encoding UTF8
    Write-Info "Jenkins startup script created"
}

# Create webhook configuration
function Create-WebhookConfiguration {
    Write-Step "Creating Webhook Configuration"
    
    $webhookConfig = @"
# GitHub Webhook Configuration for FarmTally Jenkins

## Webhook URL
http://147.93.153.247:8080/github-webhook/

## Webhook Settings
- Content type: application/json
- Secret: farmtally_webhook_secret_2024
- SSL verification: Enable SSL verification (if using HTTPS)

## Events to trigger
- [x] Push events
- [x] Pull request events
- [x] Branch or tag creation
- [x] Branch or tag deletion

## Payload Example
{
  "ref": "refs/heads/main",
  "before": "abc123...",
  "after": "def456...",
  "repository": {
    "name": "farmtally-user-service",
    "full_name": "farmtally/user-service",
    "clone_url": "https://github.com/farmtally/user-service.git"
  },
  "pusher": {
    "name": "developer",
    "email": "dev@farmtally.com"
  },
  "commits": [
    {
      "id": "def456...",
      "message": "Update user authentication",
      "author": {
        "name": "Developer",
        "email": "dev@farmtally.com"
      }
    }
  ]
}

## Jenkins Pipeline Trigger
The webhook will automatically trigger the Jenkins pipeline when:
1. Code is pushed to any branch
2. Pull requests are created or updated
3. New tags are created

## Security Considerations
- Use HTTPS for webhook URL in production
- Validate webhook signatures
- Restrict webhook access by IP if possible
- Use strong webhook secrets
"@

    $webhookConfig | Out-File -FilePath "jenkins/webhook-config.md" -Encoding UTF8
    Write-Info "Webhook configuration documentation created"
}

# Main execution
Write-Host "🔧 Jenkins CI/CD Pipeline Setup for FarmTally" -ForegroundColor Magenta
Write-Host "Target Server: 147.93.153.247:8080" -ForegroundColor Magenta
Write-Host "Docker Registry: $DockerRegistryURL" -ForegroundColor Magenta
Write-Host ""

# Create jenkins directory
New-Item -ItemType Directory -Path "jenkins" -Force | Out-Null

Create-JenkinsDockerCompose
Create-JenkinsConfiguration
Create-RegistryConfiguration
Create-PluginsList
Create-JenkinsStartupScript
Create-WebhookConfiguration

Write-Host ""
Write-Info "Jenkins CI/CD pipeline setup completed!"
Write-Info "Generated files:"
Write-Host "  - Jenkinsfile (main pipeline configuration)"
Write-Host "  - jenkins/docker-compose.jenkins.yml (Jenkins services)"
Write-Host "  - jenkins/casc.yaml (Jenkins Configuration as Code)"
Write-Host "  - jenkins/registry-config.yml (Docker Registry config)"
Write-Host "  - jenkins/plugins.txt (Required plugins list)"
Write-Host "  - jenkins/start-jenkins.sh (Startup script)"
Write-Host "  - jenkins/webhook-config.md (Webhook documentation)"
Write-Host ""
Write-Info "Next steps:"
Write-Host "1. Copy jenkins/ directory to your server"
Write-Host "2. Run: bash jenkins/start-jenkins.sh"
Write-Host "3. Access Jenkins at http://147.93.153.247:8080"
Write-Host "4. Configure GitHub webhook for automatic builds"
Write-Host "5. Update credentials and test the pipeline"
Write-Host ""
Write-Warn "Remember to:"
Write-Host "- Change default passwords"
Write-Host "- Configure proper SSH keys"
Write-Host "- Set up GitHub credentials"
Write-Host "- Configure Slack notifications"