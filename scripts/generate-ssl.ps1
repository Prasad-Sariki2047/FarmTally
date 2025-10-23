# SSL Certificate Generation Script for FarmTally
# Creates self-signed certificates for development and testing

param(
    [string]$Domain = "147.93.153.247",
    [string]$OutputDir = "nginx/ssl",
    [int]$ValidDays = 365
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

# Create output directory
Write-Info "Creating SSL certificate directory: $OutputDir"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Check if OpenSSL is available
try {
    openssl version | Out-Null
    Write-Info "OpenSSL is available"
} catch {
    Write-Error "OpenSSL is not installed or not in PATH"
    Write-Info "Please install OpenSSL or use Windows Subsystem for Linux (WSL)"
    Write-Info "Alternative: Use existing certificates or Let's Encrypt for production"
    exit 1
}

# Create OpenSSL configuration file
$opensslConfig = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=FarmTally
OU=IT Department
CN=$Domain

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $Domain
DNS.2 = farmtally.local
DNS.3 = localhost
IP.1 = 147.93.153.247
IP.2 = 127.0.0.1
"@

$configFile = "$OutputDir/openssl.conf"
$opensslConfig | Out-File -FilePath $configFile -Encoding UTF8

Write-Info "Created OpenSSL configuration file"

# Generate private key
Write-Info "Generating private key..."
$keyFile = "$OutputDir/farmtally.key"
openssl genrsa -out $keyFile 2048

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate private key"
    exit 1
}

# Generate certificate signing request
Write-Info "Generating certificate signing request..."
$csrFile = "$OutputDir/farmtally.csr"
openssl req -new -key $keyFile -out $csrFile -config $configFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate certificate signing request"
    exit 1
}

# Generate self-signed certificate
Write-Info "Generating self-signed certificate (valid for $ValidDays days)..."
$certFile = "$OutputDir/farmtally.crt"
openssl x509 -req -in $csrFile -signkey $keyFile -out $certFile -days $ValidDays -extensions v3_req -extfile $configFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate certificate"
    exit 1
}

# Set appropriate permissions (Windows)
Write-Info "Setting file permissions..."
icacls $keyFile /inheritance:r /grant:r "Administrators:F" /grant:r "SYSTEM:F" | Out-Null
icacls $certFile /inheritance:r /grant:r "Administrators:F" /grant:r "SYSTEM:F" /grant:r "Users:R" | Out-Null

# Verify certificate
Write-Info "Verifying certificate..."
openssl x509 -in $certFile -text -noout | Select-String -Pattern "Subject:|Issuer:|Not Before:|Not After:|DNS:|IP Address:"

# Clean up temporary files
Remove-Item $csrFile -Force
Remove-Item $configFile -Force

Write-Info "SSL certificate generation completed successfully!"
Write-Info "Certificate: $certFile"
Write-Info "Private Key: $keyFile"
Write-Warn "This is a self-signed certificate suitable for development/testing only"
Write-Warn "For production, use certificates from a trusted Certificate Authority"

# Display next steps
Write-Host ""
Write-Info "Next steps:"
Write-Host "1. Copy certificates to your server: scp $OutputDir/* user@147.93.153.247:/opt/farmtally/ssl/"
Write-Host "2. Update docker-compose.prod.yml to mount the SSL directory"
Write-Host "3. Restart Nginx container: docker-compose restart nginx"
Write-Host "4. Test HTTPS access: https://147.93.153.247/health"