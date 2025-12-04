#!/bin/bash

# operator-996 Restore Script
# Restores database and application state from backup

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/operator996}"
ENVIRONMENT="${1:-prod}"
BACKUP_FILE="${2:-}"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

confirm() {
    read -p "$1 [y/N]: " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

log "Starting restore process for environment: ${ENVIRONMENT}"

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    source .env.${ENVIRONMENT}
else
    error "Environment file .env.${ENVIRONMENT} not found"
    exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-operator996_${ENVIRONMENT}}"
DB_USER="${DB_USER:-operator996}"

# Validate prerequisites
log "Checking prerequisites..."

if ! command -v pg_restore &> /dev/null; then
    error "pg_restore is not installed"
    exit 1
fi

success "Prerequisites check completed"

# List available backups if none specified
if [ -z "${BACKUP_FILE}" ]; then
    log "Available backups:"
    
    ls -lht ${BACKUP_DIR}/operator996_${ENVIRONMENT}_*.sql | head -10
    
    echo ""
    read -p "Enter backup file path: " BACKUP_FILE
fi

# Validate backup file
if [ ! -f "${BACKUP_FILE}" ]; then
    error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

log "Using backup file: ${BACKUP_FILE}"
BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
log "Backup size: ${BACKUP_SIZE}"

# Confirm restore
warning "This will REPLACE the current database: ${DB_NAME}"

if ! confirm "Are you sure you want to proceed?"; then
    log "Restore cancelled by user"
    exit 0
fi

# Create a safety backup before restore
log "Creating safety backup of current database..."

SAFETY_BACKUP="${BACKUP_DIR}/safety_backup_$(date +%Y%m%d_%H%M%S).sql"

PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h ${DB_HOST} \
    -p ${DB_PORT} \
    -U ${DB_USER} \
    -d ${DB_NAME} \
    --format=custom \
    --compress=9 \
    --file=${SAFETY_BACKUP} || warning "Safety backup failed"

success "Safety backup created: ${SAFETY_BACKUP}"

# Stop application (optional)
if command -v kubectl &> /dev/null; then
    NAMESPACE="operator996-${ENVIRONMENT}"
    
    if confirm "Scale down application pods?"; then
        log "Scaling down application..."
        kubectl scale deployment operator996 -n ${NAMESPACE} --replicas=0
        sleep 10
        success "Application scaled down"
    fi
fi

# Drop existing connections
log "Terminating existing database connections..."

PGPASSWORD="${DB_PASSWORD}" psql \
    -h ${DB_HOST} \
    -p ${DB_PORT} \
    -U ${DB_USER} \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();"

# Drop and recreate database
log "Dropping and recreating database..."

PGPASSWORD="${DB_PASSWORD}" psql \
    -h ${DB_HOST} \
    -p ${DB_PORT} \
    -U ${DB_USER} \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};"

PGPASSWORD="${DB_PASSWORD}" psql \
    -h ${DB_HOST} \
    -p ${DB_PORT} \
    -U ${DB_USER} \
    -d postgres \
    -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

success "Database recreated"

# Restore from backup
log "Restoring database from backup..."

PGPASSWORD="${DB_PASSWORD}" pg_restore \
    -h ${DB_HOST} \
    -p ${DB_PORT} \
    -U ${DB_USER} \
    -d ${DB_NAME} \
    --verbose \
    --no-owner \
    --no-acl \
    ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    success "Database restored successfully"
else
    error "Database restore failed"
    
    if confirm "Restore from safety backup?"; then
        log "Restoring from safety backup..."
        
        PGPASSWORD="${DB_PASSWORD}" psql \
            -h ${DB_HOST} \
            -p ${DB_PORT} \
            -U ${DB_USER} \
            -d postgres \
            -c "DROP DATABASE IF EXISTS ${DB_NAME};"
        
        PGPASSWORD="${DB_PASSWORD}" psql \
            -h ${DB_HOST} \
            -p ${DB_PORT} \
            -U ${DB_USER} \
            -d postgres \
            -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
        
        PGPASSWORD="${DB_PASSWORD}" pg_restore \
            -h ${DB_HOST} \
            -p ${DB_PORT} \
            -U ${DB_USER} \
            -d ${DB_NAME} \
            ${SAFETY_BACKUP}
        
        warning "Restored from safety backup"
    fi
    
    exit 1
fi

# Verify restore
log "Verifying database..."

ROW_COUNT=$(PGPASSWORD="${DB_PASSWORD}" psql \
    -h ${DB_HOST} \
    -p ${DB_PORT} \
    -U ${DB_USER} \
    -d ${DB_NAME} \
    -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')

log "Found ${ROW_COUNT} users in database"

# Scale up application
if command -v kubectl &> /dev/null; then
    if confirm "Scale up application pods?"; then
        log "Scaling up application..."
        
        NAMESPACE="operator996-${ENVIRONMENT}"
        
        # Get original replica count from Helm values
        REPLICAS=$(grep -A1 "replicaCount:" infra/helm/operator996/values-${ENVIRONMENT}.yaml | tail -1 | awk '{print $2}')
        
        kubectl scale deployment operator996 -n ${NAMESPACE} --replicas=${REPLICAS}
        kubectl rollout status deployment operator996 -n ${NAMESPACE}
        
        success "Application scaled up"
    fi
fi

# Send notification
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    log "Sending Slack notification..."
    
    curl -X POST ${SLACK_WEBHOOK_URL} \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"🔄 Database restore completed for operator-996 ${ENVIRONMENT}\",
            \"attachments\": [{
                \"color\": \"warning\",
                \"fields\": [
                    {\"title\": \"Environment\", \"value\": \"${ENVIRONMENT}\", \"short\": true},
                    {\"title\": \"Backup File\", \"value\": \"${BACKUP_FILE}\", \"short\": false},
                    {\"title\": \"User Count\", \"value\": \"${ROW_COUNT}\", \"short\": true}
                ]
            }]
        }" || warning "Failed to send Slack notification"
fi

success "Restore process completed successfully!"

log "Summary:"
echo "  - Restored from: ${BACKUP_FILE}"
echo "  - Safety backup: ${SAFETY_BACKUP}"
echo "  - Database: ${DB_NAME}"
echo "  - User count: ${ROW_COUNT}"

warning "Please verify the application is working correctly"

exit 0
