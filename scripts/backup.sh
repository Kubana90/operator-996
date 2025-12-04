#!/bin/bash

# operator-996 Backup Script
# Backs up PostgreSQL database and application state

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/operator996}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ENVIRONMENT="${1:-prod}"

# Database configuration (from environment or .env file)
if [ -f ".env.${ENVIRONMENT}" ]; then
    source .env.${ENVIRONMENT}
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-operator996_${ENVIRONMENT}}"
DB_USER="${DB_USER:-operator996}"

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

log "Starting backup for environment: ${ENVIRONMENT}"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Validate prerequisites
log "Checking prerequisites..."

if ! command -v pg_dump &> /dev/null; then
    error "pg_dump is not installed"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    warning "kubectl not found, skipping Kubernetes state backup"
    SKIP_K8S=true
else
    SKIP_K8S=false
fi

success "Prerequisites check completed"

# Backup PostgreSQL database
BACKUP_FILE="${BACKUP_DIR}/operator996_${ENVIRONMENT}_${TIMESTAMP}.sql"
log "Backing up database to: ${BACKUP_FILE}"

PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h ${DB_HOST} \
    -p ${DB_PORT} \
    -U ${DB_USER} \
    -d ${DB_NAME} \
    --format=custom \
    --compress=9 \
    --file=${BACKUP_FILE}

if [ $? -eq 0 ]; then
    success "Database backup completed"
    BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
    log "Backup size: ${BACKUP_SIZE}"
else
    error "Database backup failed"
    exit 1
fi

# Backup Kubernetes resources
if [ "${SKIP_K8S}" = "false" ]; then
    K8S_BACKUP_DIR="${BACKUP_DIR}/k8s_${TIMESTAMP}"
    mkdir -p ${K8S_BACKUP_DIR}
    
    log "Backing up Kubernetes resources..."
    
    NAMESPACE="operator996-${ENVIRONMENT}"
    
    # Backup deployments
    kubectl get deployments -n ${NAMESPACE} -o yaml > ${K8S_BACKUP_DIR}/deployments.yaml
    
    # Backup services
    kubectl get services -n ${NAMESPACE} -o yaml > ${K8S_BACKUP_DIR}/services.yaml
    
    # Backup configmaps
    kubectl get configmaps -n ${NAMESPACE} -o yaml > ${K8S_BACKUP_DIR}/configmaps.yaml
    
    # Backup secrets (encrypted)
    kubectl get secrets -n ${NAMESPACE} -o yaml > ${K8S_BACKUP_DIR}/secrets.yaml
    
    # Backup PVCs
    kubectl get pvc -n ${NAMESPACE} -o yaml > ${K8S_BACKUP_DIR}/pvcs.yaml
    
    # Compress K8s backup
    tar -czf ${K8S_BACKUP_DIR}.tar.gz -C ${BACKUP_DIR} k8s_${TIMESTAMP}
    rm -rf ${K8S_BACKUP_DIR}
    
    success "Kubernetes resources backed up"
fi

# Create backup manifest
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.json"
log "Creating backup manifest..."

cat > ${MANIFEST_FILE} <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "environment": "${ENVIRONMENT}",
  "database": {
    "host": "${DB_HOST}",
    "name": "${DB_NAME}",
    "file": "${BACKUP_FILE}",
    "size": "${BACKUP_SIZE}"
  },
  "kubernetes": {
    "enabled": $([ "${SKIP_K8S}" = "false" ] && echo "true" || echo "false"),
    "file": "${K8S_BACKUP_DIR}.tar.gz"
  },
  "createdBy": "${USER}@$(hostname)",
  "retentionDays": ${RETENTION_DAYS}
}
EOF

success "Backup manifest created"

# Cleanup old backups
log "Cleaning up backups older than ${RETENTION_DAYS} days..."

find ${BACKUP_DIR} -name "operator996_${ENVIRONMENT}_*.sql" -type f -mtime +${RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "k8s_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "manifest_*.json" -type f -mtime +${RETENTION_DAYS} -delete

success "Old backups cleaned up"

# Optional: Upload to S3/Cloud Storage
if [ "${UPLOAD_TO_S3:-false}" = "true" ] && command -v aws &> /dev/null; then
    log "Uploading backup to S3..."
    
    S3_BUCKET="${S3_BACKUP_BUCKET:-operator996-backups}"
    
    aws s3 cp ${BACKUP_FILE} s3://${S3_BUCKET}/${ENVIRONMENT}/ \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    if [ "${SKIP_K8S}" = "false" ]; then
        aws s3 cp ${K8S_BACKUP_DIR}.tar.gz s3://${S3_BUCKET}/${ENVIRONMENT}/
    fi
    
    aws s3 cp ${MANIFEST_FILE} s3://${S3_BUCKET}/${ENVIRONMENT}/
    
    success "Backup uploaded to S3"
fi

# Send notification
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    log "Sending Slack notification..."
    
    curl -X POST ${SLACK_WEBHOOK_URL} \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"✅ Backup completed for operator-996 ${ENVIRONMENT}\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Environment\", \"value\": \"${ENVIRONMENT}\", \"short\": true},
                    {\"title\": \"Size\", \"value\": \"${BACKUP_SIZE}\", \"short\": true},
                    {\"title\": \"Timestamp\", \"value\": \"${TIMESTAMP}\", \"short\": true}
                ]
            }]
        }" || warning "Failed to send Slack notification"
fi

success "Backup process completed successfully!"

log "Summary:"
echo "  - Database backup: ${BACKUP_FILE}"
[ "${SKIP_K8S}" = "false" ] && echo "  - K8s backup: ${K8S_BACKUP_DIR}.tar.gz"
echo "  - Manifest: ${MANIFEST_FILE}"
echo "  - Retention: ${RETENTION_DAYS} days"

exit 0
