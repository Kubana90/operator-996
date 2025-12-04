#!/bin/bash

# operator-996 Test Runner
# Runs unit tests, integration tests, and e2e tests

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TEST_TYPE="${1:-all}"
COVERAGE="${COVERAGE:-true}"
VERBOSE="${VERBOSE:-false}"

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

run_unit_tests() {
    log "Running unit tests..."
    
    if [ "${COVERAGE}" = "true" ]; then
        npm run test:unit -- --coverage --passWithNoTests
    else
        npm run test:unit -- --passWithNoTests
    fi
    
    if [ $? -eq 0 ]; then
        success "Unit tests passed"
        return 0
    else
        error "Unit tests failed"
        return 1
    fi
}

run_integration_tests() {
    log "Running integration tests..."
    
    # Check if docker-compose is available for test dependencies
    if command -v docker-compose &> /dev/null; then
        log "Starting test dependencies with docker-compose..."
        docker-compose -f docker-compose.test.yml up -d
        sleep 10
    else
        warning "docker-compose not found, assuming dependencies are already running"
    fi
    
    # Run integration tests
    npm run test:integration
    TEST_RESULT=$?
    
    # Cleanup
    if command -v docker-compose &> /dev/null; then
        log "Stopping test dependencies..."
        docker-compose -f docker-compose.test.yml down
    fi
    
    if [ ${TEST_RESULT} -eq 0 ]; then
        success "Integration tests passed"
        return 0
    else
        error "Integration tests failed"
        return 1
    fi
}

run_e2e_tests() {
    log "Running end-to-end tests..."
    
    if [ -f "package.json" ] && grep -q "test:e2e" package.json; then
        npm run test:e2e
        
        if [ $? -eq 0 ]; then
            success "E2E tests passed"
            return 0
        else
            error "E2E tests failed"
            return 1
        fi
    else
        warning "No E2E tests configured"
        return 0
    fi
}

run_lint() {
    log "Running linters..."
    
    # ESLint
    if [ -f "package.json" ] && grep -q "lint" package.json; then
        npm run lint
        LINT_RESULT=$?
    else
        warning "No lint script found"
        LINT_RESULT=0
    fi
    
    # Prettier
    if [ -f "package.json" ] && grep -q "format:check" package.json; then
        npm run format:check
        FORMAT_RESULT=$?
    else
        warning "No format check script found"
        FORMAT_RESULT=0
    fi
    
    if [ ${LINT_RESULT} -eq 0 ] && [ ${FORMAT_RESULT} -eq 0 ]; then
        success "Linting passed"
        return 0
    else
        error "Linting failed"
        return 1
    fi
}

generate_coverage_report() {
    log "Generating coverage report..."
    
    if [ -d "coverage" ]; then
        if command -v open &> /dev/null; then
            open coverage/lcov-report/index.html
        elif command -v xdg-open &> /dev/null; then
            xdg-open coverage/lcov-report/index.html
        else
            log "Coverage report available at: coverage/lcov-report/index.html"
        fi
    else
        warning "No coverage report found"
    fi
}

# Main execution
log "operator-996 Test Runner"
log "Test type: ${TEST_TYPE}"
log "Coverage: ${COVERAGE}"

# Validate prerequisites
if ! command -v npm &> /dev/null; then
    error "npm is not installed"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    log "Installing dependencies..."
    npm ci
fi

# Run tests based on type
FAILED_TESTS=()

case ${TEST_TYPE} in
    unit)
        run_unit_tests || FAILED_TESTS+=("unit")
        ;;
    integration)
        run_integration_tests || FAILED_TESTS+=("integration")
        ;;
    e2e)
        run_e2e_tests || FAILED_TESTS+=("e2e")
        ;;
    lint)
        run_lint || FAILED_TESTS+=("lint")
        ;;
    all)
        log "Running all test suites..."
        
        run_lint || FAILED_TESTS+=("lint")
        run_unit_tests || FAILED_TESTS+=("unit")
        run_integration_tests || FAILED_TESTS+=("integration")
        run_e2e_tests || FAILED_TESTS+=("e2e")
        ;;
    *)
        error "Unknown test type: ${TEST_TYPE}"
        echo "Available types: unit, integration, e2e, lint, all"
        exit 1
        ;;
esac

# Generate coverage report if enabled
if [ "${COVERAGE}" = "true" ]; then
    generate_coverage_report
fi

# Summary
echo ""
log "Test Summary:"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    success "All tests passed! ✨"
    exit 0
else
    error "Some tests failed: ${FAILED_TESTS[*]}"
    exit 1
fi
