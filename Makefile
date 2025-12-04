# operator-996 Makefile
# Convenience commands for development and operations

.PHONY: help install dev build test deploy clean

# Variables
ENV ?= dev
TAG ?= latest
NAMESPACE = operator996-$(ENV)

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)operator-996 Makefile Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# Development
install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

dev: ## Start development server
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

dev-db: ## Start local database and Redis
	@echo "$(BLUE)Starting local services...$(NC)"
	docker-compose up -d postgres redis
	@echo "$(GREEN)✓ Services started$(NC)"

dev-stop: ## Stop local services
	@echo "$(YELLOW)Stopping local services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

# Database
db-init: ## Initialize database schema
	@echo "$(BLUE)Initializing database...$(NC)"
	@if [ -f .env.$(ENV) ]; then source .env.$(ENV) && \
		PGPASSWORD=$$DB_PASSWORD psql -h $$DB_HOST -U $$DB_USER -d $$DB_NAME -f infra/db/kpi-schema.sql; \
	else \
		echo "$(RED)Error: .env.$(ENV) not found$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✓ Database initialized$(NC)"

db-backup: ## Backup database
	@echo "$(BLUE)Creating database backup...$(NC)"
	./scripts/backup.sh $(ENV)

db-restore: ## Restore database (usage: make db-restore BACKUP=/path/to/backup.sql)
	@echo "$(YELLOW)Restoring database...$(NC)"
	./scripts/restore.sh $(ENV) $(BACKUP)

# Build & Test
build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	./scripts/build.sh $(ENV) $(TAG)

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	./scripts/test.sh all

test-unit: ## Run unit tests
	@echo "$(BLUE)Running unit tests...$(NC)"
	./scripts/test.sh unit

test-integration: ## Run integration tests
	@echo "$(BLUE)Running integration tests...$(NC)"
	./scripts/test.sh integration

test-e2e: ## Run end-to-end tests
	@echo "$(BLUE)Running e2e tests...$(NC)"
	./scripts/test.sh e2e

lint: ## Run linters
	@echo "$(BLUE)Running linters...$(NC)"
	npm run lint

format: ## Format code
	@echo "$(BLUE)Formatting code...$(NC)"
	npm run format

# Deployment
deploy: ## Deploy to environment (usage: make deploy ENV=dev TAG=v1.0.0)
	@echo "$(BLUE)Deploying to $(ENV)...$(NC)"
	python scripts/deploy_cli.py deploy --env $(ENV) --tag $(TAG)

status: ## Check deployment status
	@echo "$(BLUE)Checking deployment status for $(ENV)...$(NC)"
	python scripts/deploy_cli.py status --env $(ENV)

rollback: ## Rollback deployment
	@echo "$(YELLOW)Rolling back $(ENV)...$(NC)"
	python scripts/deploy_cli.py rollback --env $(ENV)

scale: ## Scale deployment (usage: make scale ENV=prod REPLICAS=5)
	@echo "$(BLUE)Scaling $(ENV) to $(REPLICAS) replicas...$(NC)"
	python scripts/deploy_cli.py scale --env $(ENV) --replicas $(REPLICAS)

logs: ## Show application logs
	@echo "$(BLUE)Fetching logs for $(ENV)...$(NC)"
	python scripts/deploy_cli.py logs --env $(ENV) --tail 100

# Kubernetes
k8s-pods: ## List pods
	kubectl get pods -n $(NAMESPACE)

k8s-services: ## List services
	kubectl get services -n $(NAMESPACE)

k8s-describe: ## Describe deployment
	kubectl describe deployment operator996 -n $(NAMESPACE)

k8s-shell: ## Open shell in pod
	@POD=$$(kubectl get pods -n $(NAMESPACE) -l app.kubernetes.io/name=operator996 -o jsonpath='{.items[0].metadata.name}'); \
	echo "Opening shell in pod: $$POD"; \
	kubectl exec -it $$POD -n $(NAMESPACE) -- /bin/sh

# Monitoring
grafana: ## Open Grafana dashboard
	@echo "$(BLUE)Opening Grafana...$(NC)"
	@if [ "$(ENV)" = "prod" ]; then \
		open https://grafana.operator996.io; \
	elif [ "$(ENV)" = "stage" ]; then \
		open https://grafana-stage.operator996.io; \
	else \
		open http://localhost:3001; \
	fi

prometheus: ## Open Prometheus
	@echo "$(BLUE)Opening Prometheus...$(NC)"
	@if [ "$(ENV)" = "prod" ]; then \
		open https://prometheus.operator996.io; \
	else \
		open http://localhost:9090; \
	fi

# Cleanup
clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf node_modules dist build coverage
	rm -f build-info-*.json
	@echo "$(GREEN)✓ Cleaned$(NC)"

clean-docker: ## Remove Docker images
	@echo "$(YELLOW)Removing Docker images...$(NC)"
	docker rmi $$(docker images operator996/* -q) 2>/dev/null || true
	@echo "$(GREEN)✓ Images removed$(NC)"

# Quick Commands
qa: lint test ## Run quality assurance (lint + test)

ci: lint test build ## Run CI pipeline locally

full-deploy: build test deploy ## Full deployment (build, test, deploy)

# Info
info: ## Show environment info
	@echo "$(BLUE)operator-996 Environment Info$(NC)"
	@echo ""
	@echo "Environment: $(ENV)"
	@echo "Tag: $(TAG)"
	@echo "Namespace: $(NAMESPACE)"
	@echo ""
	@echo "Installed Tools:"
	@command -v node >/dev/null 2>&1 && echo "  Node: $$(node --version)" || echo "  Node: Not installed"
	@command -v npm >/dev/null 2>&1 && echo "  npm: $$(npm --version)" || echo "  npm: Not installed"
	@command -v docker >/dev/null 2>&1 && echo "  Docker: $$(docker --version | cut -d' ' -f3 | tr -d ',')" || echo "  Docker: Not installed"
	@command -v kubectl >/dev/null 2>&1 && echo "  kubectl: $$(kubectl version --client --short 2>/dev/null | cut -d' ' -f3)" || echo "  kubectl: Not installed"
	@command -v helm >/dev/null 2>&1 && echo "  Helm: $$(helm version --short | cut -d':' -f2 | tr -d ' ')" || echo "  Helm: Not installed"
