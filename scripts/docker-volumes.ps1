# Docker Volume Management Script for FarmTally (Windows PowerShell)
# Manages persistent data storage for server deployment

param(
    [string]$Action = "setup",
    [string]$BackupFile = "",
    [int]$Days = 7
)

# Configuration
$DATA_DIR = "C:\opt\farmtally\data"
$BACKUP_DIR = "C:\opt\farmtally\backups"
$LOG_DIR = "C:\opt\farmtally\logs"

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

# Create directory structure
function Create-Directories {
    Write-Info "Creating directory structure for persistent data"
    
    # Create main directories
    New-Item -ItemType Directory -Path "$DATA_DIR\postgres" -Force | Out-Null
    New-Item -ItemType Directory -Path "$DATA_DIR\redis" -Force | Out-Null
    New-Item -ItemType Directory -Path "$BACKUP_DIR\postgres" -Force | Out-Null
    New-Item -ItemType Directory -Path "$BACKUP_DIR\redis" -Force | Out-Null
    New-Item -ItemType Directory -Path "$LOG_DIR\nginx" -Force | Out-Null
    New-Item -ItemType Directory -Path "$LOG_DIR\app" -Force | Out-Null
    
    Write-Info "Directory structure created successfully"
}

# Setup volume mounts
function Setup-Volumes {
    Write-Info "Setting up Docker volume mounts"
    
    # Create Docker volumes if they don't exist
    docker volume create farmtally_postgres_data
    docker volume create farmtally_redis_data
    
    Write-Info "Docker volumes created successfully"
}

# Backup data
function Backup-Data {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    
    Write-Info "Creating backup with timestamp: $timestamp"
    
    # Backup PostgreSQL data
    if (Test-Path "$DATA_DIR\postgres") {
        Write-Info "Backing up PostgreSQL data"
        Compress-Archive -Path "$DATA_DIR\postgres\*" -DestinationPath "$BACKUP_DIR\postgres\postgres_backup_$timestamp.zip" -Force
    }
    
    # Backup Redis data
    if (Test-Path "$DATA_DIR\redis") {
        Write-Info "Backing up Redis data"
        Compress-Archive -Path "$DATA_DIR\redis\*" -DestinationPath "$BACKUP_DIR\redis\redis_backup_$timestamp.zip" -Force
    }
    
    Write-Info "Backup completed successfully"
}

# Restore data
function Restore-Data {
    param([string]$BackupFilePath)
    
    if ([string]::IsNullOrEmpty($BackupFilePath)) {
        Write-Error "Please specify backup file to restore"
        exit 1
    }
    
    if (-not (Test-Path $BackupFilePath)) {
        Write-Error "Backup file not found: $BackupFilePath"
        exit 1
    }
    
    Write-Info "Restoring data from: $BackupFilePath"
    
    # Stop containers before restore
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
    
    # Extract backup
    $backupDir = Split-Path $BackupFilePath -Parent
    $serviceName = if ($BackupFilePath -match "postgres") { "postgres" } else { "redis" }
    
    Expand-Archive -Path $BackupFilePath -DestinationPath "$DATA_DIR\$serviceName" -Force
    
    Write-Info "Data restored successfully"
    Write-Warn "Please restart the containers: docker-compose up -d"
}

# Clean old backups
function Cleanup-Backups {
    param([int]$DaysOld)
    
    Write-Info "Cleaning up backups older than $DaysOld days"
    
    $cutoffDate = (Get-Date).AddDays(-$DaysOld)
    
    Get-ChildItem -Path $BACKUP_DIR -Recurse -Filter "*.zip" | 
        Where-Object { $_.LastWriteTime -lt $cutoffDate } | 
        Remove-Item -Force
    
    Write-Info "Backup cleanup completed"
}

# Check disk usage
function Check-DiskUsage {
    Write-Info "Checking disk usage for FarmTally data directories"
    
    Write-Host "Data directory usage:"
    if (Test-Path $DATA_DIR) {
        Get-ChildItem -Path $DATA_DIR -Recurse | 
            Measure-Object -Property Length -Sum | 
            ForEach-Object { "Total Size: {0:N2} MB" -f ($_.Sum / 1MB) }
    } else {
        Write-Host "No data directories found"
    }
    
    Write-Host ""
    Write-Host "Backup directory usage:"
    if (Test-Path $BACKUP_DIR) {
        Get-ChildItem -Path $BACKUP_DIR -Recurse | 
            Measure-Object -Property Length -Sum | 
            ForEach-Object { "Total Size: {0:N2} MB" -f ($_.Sum / 1MB) }
    } else {
        Write-Host "No backup directories found"
    }
    
    Write-Host ""
    Write-Host "Available disk space:"
    Get-WmiObject -Class Win32_LogicalDisk | 
        Where-Object { $_.DeviceID -eq "C:" } | 
        ForEach-Object { 
            "Drive C: - Free: {0:N2} GB / Total: {1:N2} GB" -f ($_.FreeSpace / 1GB), ($_.Size / 1GB)
        }
}

# Main script logic
switch ($Action.ToLower()) {
    "setup" {
        Create-Directories
        Setup-Volumes
    }
    "backup" {
        Backup-Data
    }
    "restore" {
        Restore-Data -BackupFilePath $BackupFile
    }
    "cleanup" {
        Cleanup-Backups -DaysOld $Days
    }
    "usage" {
        Check-DiskUsage
    }
    default {
        Write-Host "Usage: .\docker-volumes.ps1 -Action [setup|backup|restore|cleanup|usage] [options]"
        Write-Host "  Action:     Volume operation to perform"
        Write-Host "    setup:    Create directory structure and Docker volumes"
        Write-Host "    backup:   Create backup of all data"
        Write-Host "    restore:  Restore data from backup file (-BackupFile required)"
        Write-Host "    cleanup:  Clean up old backups (-Days, default: 7)"
        Write-Host "    usage:    Check disk usage for data directories"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\docker-volumes.ps1 -Action setup"
        Write-Host "  .\docker-volumes.ps1 -Action backup"
        Write-Host "  .\docker-volumes.ps1 -Action restore -BackupFile 'C:\path\to\backup.zip'"
        Write-Host "  .\docker-volumes.ps1 -Action cleanup -Days 14"
        exit 1
    }
}

Write-Info "Volume management operation completed successfully"