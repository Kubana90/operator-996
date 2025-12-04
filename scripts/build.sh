#!/bin/bash

# operator-996 Build Script
# Builds Docker images and Helm packages

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="operator996/app"
REGISTRY="ghcr.io"
HELM_CHART_PATH="infra/helm/operator996"
DOCKERFILE="Dockerfile"

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

# Parse arguments
ENVIRONMENT="${1:-dev}"
IMAGE_TAG="${2:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
BUILD_ARGS="${3:-}"

log "Building operator-996 for environment: ${ENVIRONMENT}"
log "Image tag: ${IMAGE_TAG}"

# Validate prerequisites
log "Checking prerequisites..."

for cmd in docker helm git; do
    if ! command -v $cmd &> /dev/null; then
        error "$cmd is not installed"
        exit 1
    fi
done

success "All prerequisites met"

# Build Docker image
log "Building Docker image..."

DOCKER_BUILD_CMD="docker build \
    --build-arg NODE_ENV=${ENVIRONMENT} \
    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
    --build-arg VCS_REF=$(git rev-parse HEAD 2>/dev/null || echo 'unknown') \
    --tag ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} \
    --tag ${REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}-latest \
    ${BUILD_ARGS} \
    ."

log "Executing: ${DOCKER_BUILD_CMD}"

if eval ${DOCKER_BUILD_CMD}; then
    success "Docker image built successfully"
else
    error "Docker build failed"
    exit 1
fi

# Show image details
log "Image details:"
docker images ${REGISTRY}/${IMAGE_NAME} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Optional: Run security scan
if command -v trivy &> /dev/null; then
    log "Running security scan with Trivy..."
    trivy image --severity HIGH,CRITICAL ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} || warning "Vulnerabilities found"
else
    warning "Trivy not installed, skipping security scan"
fi

# Package Helm chart
log "Packaging Helm chart..."

if [ -d "${HELM_CHART_PATH}" ]; then
    helm package ${HELM_CHART_PATH} --destination ./dist/
    success "Helm chart packaged"
else
    warning "Helm chart directory not found at ${HELM_CHART_PATH}"
fi

# Optional: Lint Helm chart
log "Linting Helm chart..."
helm lint ${HELM_CHART_PATH} --values ${HELM_CHART_PATH}/values-${ENVIRONMENT}.yaml || warning "Helm lint found issues"

# Optional: Push image
if [ "${PUSH_IMAGE:-false}" = "true" ]; then
    log "Pushing Docker image to registry..."
    
    docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    docker push ${REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}-latest
    
    success "Image pushed to registry"
fi

# Generate build metadata
BUILD_INFO="build-info-${IMAGE_TAG}.json"
log "Generating build metadata: ${BUILD_INFO}"

cat > ${BUILD_INFO} <<EOF
{
  "image": "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}",
  "environment": "${ENVIRONMENT}",
  "buildDate": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "builder": "${USER}@$(hostname)",
  "dockerVersion": "$(docker --version | awk '{print $3}' | tr -d ',')",
  "helmVersion": "$(helm version --short | awk '{print $1}')"
}
EOF

success "Build completed successfully!"

log "Summary:"
echo "  - Image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
echo "  - Environment: ${ENVIRONMENT}"
echo "  - Build info: ${BUILD_INFO}"

exit 0
