# operator-996 Setup Guide

Detaillierte Anleitung für die Einrichtung der operator-996 Platform.

---

## Voraussetzungen

### Erforderliche Tools

| Tool | Version | Installation |
|------|---------|-------------|
| **Kubernetes** | 1.28+ | [Installation Guide](https://kubernetes.io/docs/setup/) |
| **Helm** | 3.12+ | `brew install helm` oder [helm.sh](https://helm.sh/docs/intro/install/) |
| **kubectl** | 1.28+ | `brew install kubectl` |
| **Docker** | 20.10+ | [docker.com](https://docs.docker.com/get-docker/) |
| **Python** | 3.9+ | `brew install python3` |
| **Node.js** | 20+ | `brew install node` oder [nodejs.org](https://nodejs.org/) |

### Optional (empfohlen)

- **k9s** - Kubernetes CLI UI (`brew install k9s`)
- **Trivy** - Security Scanner (`brew install trivy`)
- **PostgreSQL Client** - `brew install postgresql@14`

---

## 1. Repository Setup

### Repository klonen

```bash
git clone https://github.com/Kubana90/operator-996.git
cd operator-996
```

### Dependencies installieren

```bash
# Node.js Dependencies
npm install

# Python Dependencies (für Scripts)
pip3 install -r requirements.txt  # Falls vorhanden
```

---

## 2. Lokale Entwicklungsumgebung

### Docker Compose starten

```bash
# Test-Environment starten
docker-compose -f docker-compose.test.yml up -d

# Status prüfen
docker-compose -f docker-compose.test.yml ps

# Logs anschauen
docker-compose -f docker-compose.test.yml logs -f
```

### Datenbank initialisieren

```bash
# Mit Make
make db-init ENV=dev

# Oder manuell
cp .env.dev .env
source .env
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f infra/db/kpi-schema.sql
```

### Application starten

```bash
# Development Mode
make dev

# Oder direkt
npm run dev
```

### Verifizierung

```bash
# Health Check
curl http://localhost:3000/health

# Response sollte sein:
# {"status":"ok","timestamp":"..."}
```

---

## 3. Kubernetes Cluster Setup

### Lokales Cluster (Minikube/Kind)

```bash
# Minikube starten
minikube start --cpus 4 --memory 8192 --disk-size 50g

# Oder Kind
kind create cluster --name operator996 --config kind-config.yaml
```

### Namespaces erstellen

```bash
kubectl create namespace operator996-dev
kubectl create namespace operator996-stage
kubectl create namespace operator996-prod
```

### Secrets konfigurieren

```bash
# Database Secret
kubectl create secret generic operator996-dev-secrets \
  --from-literal=DB_PASSWORD=secure_password \
  --from-literal=REDIS_PASSWORD=redis_password \
  --from-literal=JWT_SECRET=jwt_secret \
  -n operator996-dev

# Docker Registry Secret (falls private registry)
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<USERNAME> \
  --docker-password=<TOKEN> \
  -n operator996-dev
```

---

## 4. Helm Deployment

### Download Helm Chart Dependencies

Before installing the chart, you need to download the dependencies (PostgreSQL and Redis):

```bash
# Download dependencies
make helm-deps

# Or manually
cd infra/helm/operator996
helm dependency build
```

### Helm Charts installieren

```bash
# Development
helm upgrade --install operator996 \
  infra/helm/operator996/ \
  --namespace operator996-dev \
  --create-namespace \
  --values infra/helm/operator996/values-dev.yaml \
  --wait

# Deployment Status
kubectl rollout status deployment/operator996 -n operator996-dev

# Pods anzeigen
kubectl get pods -n operator996-dev
```

### Port Forwarding (lokal testen)

```bash
# Application
kubectl port-forward -n operator996-dev svc/operator996 3000:3000

# Grafana
kubectl port-forward -n operator996-dev svc/grafana 3001:3000

# Prometheus
kubectl port-forward -n operator996-dev svc/prometheus 9090:9090
```

---

## 5. Kong Gateway Setup

### Kong installieren

```bash
# Kong Namespace
kubectl create namespace kong

# Kong mit Helm
helm repo add kong https://charts.konghq.com
helm repo update

helm install kong kong/kong \
  --namespace kong \
  --values infra/gateway/kong-values.yaml
```

### Kong Konfiguration anwenden

```bash
# Kong Admin URL ermitteln
export KONG_ADMIN_URL=$(kubectl get svc -n kong kong-kong-admin -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Konfiguration anwenden
deck sync --kong-addr http://$KONG_ADMIN_URL:8001 --state infra/gateway/kong.yml
```

---

## 6. Monitoring Setup

### Prometheus Operator installieren

```bash
# Prometheus Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

### Grafana Dashboards importieren

```bash
# Grafana Admin Password ermitteln
kubectl get secret -n monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d

# Port Forward
kubectl port-forward -n monitoring svc/prometheus-grafana 3001:80

# Browser: http://localhost:3001
# User: admin
# Password: <siehe oben>

# Dashboard importieren: ops/observability/grafana/grafana-biofeedback-dashboard.json
```

---

## 7. CI/CD Setup (GitHub Actions)

### Repository Secrets konfigurieren

In GitHub Repository Settings → Secrets and variables → Actions:

```yaml
GITHUB_TOKEN: <auto-generated>
KUBE_CONFIG_DEV: <base64 encoded kubeconfig>
KUBE_CONFIG_STAGE: <base64 encoded kubeconfig>
KUBE_CONFIG_PROD: <base64 encoded kubeconfig>
VAULT_TOKEN: <vault token>
SLACK_WEBHOOK_URL: <slack webhook>
PAGERDUTY_INTEGRATION_KEY: <pagerduty key>
```

### Kubeconfig Base64 enkodieren

```bash
cat ~/.kube/config | base64
```

---

## 8. Vault Setup (Optional)

### Vault installieren

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace
```

### Vault initialisieren

```bash
# Vault Pod Shell
kubectl exec -it vault-0 -n vault -- /bin/sh

# Initialize
vault operator init

# Unseal (mit den Keys vom init)
vault operator unseal <KEY1>
vault operator unseal <KEY2>
vault operator unseal <KEY3>

# Login
vault login <ROOT_TOKEN>
```

### Secrets konfigurieren

```bash
# Database Credentials
vault kv put operator996/prod/database \
  host=postgres-prod.operator996.svc \
  user=prod_user \
  password=secure_password

# JWT Secret
vault kv put operator996/prod/auth \
  jwt_secret=very_secure_secret_key
```

---

## 9. Testing

### Alle Tests ausführen

```bash
# Mit Make
make test

# Oder manuell
./scripts/test.sh all
```

### Spezifische Tests

```bash
# Unit Tests
make test-unit

# Integration Tests
make test-integration

# E2E Tests
make test-e2e

# Linting
make lint
```

---

## 10. Production Deployment

### Pre-Deployment Checklist

- [ ] Alle Tests bestanden
- [ ] Security Scan erfolgreich
- [ ] Secrets in Vault konfiguriert
- [ ] Backup erstellt
- [ ] Rollback-Plan vorhanden
- [ ] Monitoring aktiv
- [ ] Alerts konfiguriert

### Deployment

```bash
# Mit Make
make deploy ENV=prod TAG=v1.0.0

# Oder mit CLI
python scripts/deploy_cli.py deploy --env prod --tag v1.0.0
```

### Post-Deployment

```bash
# Status prüfen
make status ENV=prod

# Smoke Tests
make test ENV=prod

# Logs überwachen
make logs ENV=prod

# Monitoring Dashboard
make grafana ENV=prod
```

---

## Troubleshooting

### Pod startet nicht

```bash
# Describe Pod
kubectl describe pod <POD_NAME> -n operator996-dev

# Logs anzeigen
kubectl logs <POD_NAME> -n operator996-dev --previous

# Events anzeigen
kubectl get events -n operator996-dev --sort-by='.lastTimestamp'
```

### Database Connection Fehler

```bash
# Port Forward zu Database
kubectl port-forward -n operator996-dev svc/postgres 5432:5432

# Verbindung testen
psql -h localhost -U $DB_USER -d $DB_NAME
```

### Kong Gateway Fehler

```bash
# Kong Logs
kubectl logs -n kong -l app=kong

# Kong Admin API testen
curl http://<KONG_ADMIN_URL>:8001/status
```

---

## Support & Resources

- **Documentation**: [GitHub Wiki](https://github.com/Kubana90/operator-996/wiki)
- **Issues**: [GitHub Issues](https://github.com/Kubana90/operator-996/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Kubana90/operator-996/discussions)

---

**operator-996** • Built by Operator-996
