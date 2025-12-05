# operator-996 Platform

<div align="center">

**Advanced DevOps Infrastructure Platform**

[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Helm-3.12+-0F1689?logo=helm)](https://helm.sh/)
[![Kong Gateway](https://img.shields.io/badge/Kong-3.4+-003459?logo=kong)](https://konghq.com/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-PostgreSQL%2014+-FDB515?logo=timescale)](https://www.timescale.com/)

</div>

---

## 🚀 Übersicht

**operator-996** ist eine produktionsreife Enterprise-DevOps-Plattform:

- 🔐 **Secure API Gateway** mit Kong und mTLS
- 📊 **Advanced Monitoring** mit Grafana & Prometheus
- ⚒️ **Kubernetes-native** mit Helm Charts
- 💾 **TimescaleDB** (PostgreSQL 14+)
- 🔄 **Automated CI/CD** mit GitHub Actions
- 🧠 **Biofeedback Analytics** Echtzeit-Metriken
- 🛡️ **Enterprise Security** mit Vault

---

## ⚡ Quick Start

```bash
# Repository klonen
git clone https://github.com/Kubana90/operator-996.git
cd operator-996

# Environment konfigurieren
cp .env.dev .env

# Helm Dependencies herunterladen
make helm-deps

# Deployment
python scripts/deploy_cli.py deploy --env dev

# Oder mit Helm direkt
helm upgrade --install operator996 infra/helm/operator996/ \
  --namespace operator996-dev --create-namespace \
  --values infra/helm/operator996/values-dev.yaml
```

---

## 📁 Projektstruktur

```
operator-996/
├── .env.{dev,stage,prod}       # Environment Variables
├── infra/
│   ├── helm/operator996/       # Helm Charts
│   ├── gateway/                # Kong Konfiguration
│   ├── db/kpi-schema.sql       # TimescaleDB Schema
│   └── vault/policies/         # Vault Policies
├── ops/
│   ├── observability/grafana/  # Grafana Dashboards & Alerts
│   ├── ci/ci-cd.yml            # CI/CD Pipeline
│   └── security/
├── scripts/                    # Automation Scripts
│   ├── deploy_cli.py           # Deployment CLI
│   ├── build.sh                # Build Script
│   ├── backup.sh               # Database Backup
│   ├── restore.sh              # Database Restore
│   └── test.sh                 # Test Runner
└── tests/integration/          # Integration Tests
```

---

## 🚀 Deployment

### Deployment CLI

```bash
# Deploy
python scripts/deploy_cli.py deploy --env {dev|stage|prod} --tag v1.2.3

# Status
python scripts/deploy_cli.py status --env prod

# Rollback
python scripts/deploy_cli.py rollback --env prod

# Scale
python scripts/deploy_cli.py scale --env prod --replicas 5

# Logs
python scripts/deploy_cli.py logs --env prod --tail 100
```

---

## 📊 Monitoring

### Grafana Dashboards

1. **Biofeedback Analytics** - Echtzeit Health-Metriken
2. **System Performance** - Infrastruktur-Metriken  
3. **API Gateway** - Kong Traffic & Metriken
4. **Database Performance** - TimescaleDB Metriken

### Key Metrics

- API Response Time (p95): <200ms
- Error Rate: <0.1%
- Active Users: Echtzeit
- CPU/Memory: Per Service
- DB Connections: Active Pool

---

## 💾 Database

### TimescaleDB Features

**Hypertables:**
- `events` - Event-Tracking (90d retention)
- `biofeedback_metrics` - Health-Daten (30d)
- `system_metrics` - Infrastruktur (7d)
- `kpi_measurements` - KPIs (365d)

**Continuous Aggregates:**
- 5-min Biofeedback Averages
- 1-min System Metrics

### Backup & Restore

```bash
# Backup
./scripts/backup.sh prod

# Restore  
./scripts/restore.sh prod /backups/backup_file.sql
```

---

## 🔐 Security

- **mTLS** für Service-to-Service Communication
- **HashiCorp Vault** für Secret Management
- **Network Policies** für Pod-Isolation
- **JWT Authentication** über Kong Gateway
- **Rate Limiting** & Bot Detection

---

## 🔄 CI/CD

### GitHub Actions Pipeline

**Trigger:**
- `main` → Staging
- `develop` → Dev
- `v*` tag → Production

**Stages:**
1. Validation (Lint, Tests, Security Scan)
2. Build (Docker Image, Helm Package)
3. Deploy (Automated + Canary für Prod)

---

## 🛠️ Scripts

```bash
# Build
./scripts/build.sh prod v1.2.3

# Test
./scripts/test.sh all
./scripts/test.sh {unit|integration|e2e|lint}

# Backup/Restore
./scripts/backup.sh prod
./scripts/restore.sh prod /path/to/backup.sql
```

---

## 📧 Contact

- **Author**: Operator-996  
- **GitHub**: [@Kubana90](https://github.com/Kubana90)
- **Repository**: [operator-996](https://github.com/Kubana90/operator-996)

---

<div align="center">

**Built by operator-996** • **Systems breaker and builder**

[![GitHub](https://img.shields.io/github/stars/Kubana90/operator-996?style=social)](https://github.com/Kubana90/operator-996)

</div>
