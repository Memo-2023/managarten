# Monitoring Stack Documentation

This document describes the Mana monitoring infrastructure, including metrics collection, business analytics, and long-term data retention.

## Quick Access

All monitoring tools are publicly accessible - no login required (except GlitchTip).

| Tool | URL | Access |
|------|-----|--------|
| **Grafana** | https://grafana.mana.how | No login needed (Anonymous Viewer) |
| **Umami** | [Public Dashboard](https://stats.mana.how/share/face76f42d3e42beb8c80ea03f33a462/mana-webapp) | No login needed (Public Share) |
| **GlitchTip** | https://glitchtip.mana.how | `guest@mana.how` / `guestguest` |

### Grafana Dashboards

| Dashboard | Description |
|-----------|-------------|
| Master Overview | CPU, RAM, Disk, Container Status |
| Error Tracking | GlitchTip errors via PostgreSQL datasource |
| Backend Metrics | Request rates, latency, error rates |
| Database Details | PostgreSQL connections, queries |

### Umami Public Share Links

| App | Share URL |
|-----|-----------|
| Mana | https://stats.mana.how/share/face76f42d3e42beb8c80ea03f33a462/mana-webapp |
| Calendar | https://stats.mana.how/share/772d2510c5bb47e0b490267f2821510a/calendar-webapp |
| Todo | https://stats.mana.how/share/ec1bb158d8714bc6bdbc147c97b9c1c7/todo-webapp |
| Chat | https://stats.mana.how/share/1c43fd9847674f899dc2ebdfbd8960db/chat-webapp |
| Contacts | https://stats.mana.how/share/d2cc0f019e464a88a49ba365f58b78e7/contacts-webapp |
| Clock | https://stats.mana.how/share/f893945efea7449382abf04812a54bea/clock-webapp |
| Quotes | https://stats.mana.how/share/6a86139ad8e2469c97541c40a70397fa/quotes-webapp |
| Picture | https://stats.mana.how/share/273f67fa569940f6b85e7a7a0a003539/picture-webapp |
| Photos | https://stats.mana.how/share/dc201d685f784716a0b8587376eca7a1/photos-webapp |
| Storage | https://stats.mana.how/share/392ff51d11f14f0c9d556af1402a3ee6/storage-webapp |
| Food | https://stats.mana.how/share/33dfae72f8e24aaa8008cbbceeaf072d/food-webapp |
| Planta | https://stats.mana.how/share/1e83a8a67fa84d3995455c21dedbe3a2/plants-webapp |
| Presi | https://stats.mana.how/share/a1eb8d1fa4d543e6b97ac41351fe1c6f/presi-webapp |
| Skilltree | https://stats.mana.how/share/5de13e0895ae4a69aa2a834f985be14d/skilltree-webapp |
| Cardecky | https://stats.mana.how/share/1c1d54c4782943e58dde0a6db7c86ec6/cards-webapp |

### GlitchTip Error Tracking

18 backend projects configured. See [ERROR_TRACKING.md](ERROR_TRACKING.md) for DSNs and integration details.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Mana Monitoring Stack                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐        │
│  │   Services   │────▶│  VictoriaMetrics │────▶│     Grafana      │        │
│  │  (Backends)  │     │   (2yr retention) │     │   (Dashboards)   │        │
│  └──────────────┘     └──────────────────┘     └──────────────────┘        │
│         │                                              ▲                    │
│         │                                              │                    │
│         ▼                                              │                    │
│  ┌──────────────┐     ┌──────────────────┐            │                    │
│  │  PostgreSQL  │────▶│      DuckDB      │────────────┘                    │
│  │   (Source)   │     │  (Business KPIs) │                                 │
│  └──────────────┘     └──────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. VictoriaMetrics (Operative Metrics)

**Purpose:** High-performance time-series database for operational metrics (CPU, memory, request latency, etc.)

| Property | Value |
|----------|-------|
| Image | `victoriametrics/victoria-metrics:v1.99.0` |
| Port | 8428 |
| Retention | 2 years |
| Storage | Docker volume `mana-victoriametrics` |

**Why VictoriaMetrics instead of Prometheus?**
- 3-10x better compression
- Lower memory usage
- Faster queries over long time ranges
- Drop-in replacement (PromQL compatible)
- Better suited for long-term retention

**Endpoints:**
```bash
# Health check
curl http://localhost:8428/health

# Query metrics (PromQL)
curl "http://localhost:8428/api/v1/query?query=up"

# Query range
curl "http://localhost:8428/api/v1/query_range?query=auth_users_total&start=-1h&step=1m"
```

### 2. DuckDB Analytics (Business KPIs)

**Purpose:** Embedded OLAP database for business metrics with unlimited retention.

| Property | Value |
|----------|-------|
| Location | `/data/analytics/metrics.duckdb` (in mana-auth container) |
| Storage | Docker volume `mana-analytics` |
| Retention | Unlimited |
| Snapshot | Daily at midnight UTC |

**Tracked Metrics:**
- Total users
- Verified users
- New users (today, this week, this month)
- Database size
- Growth rates

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/health` | GET | Service health and database status |
| `/api/v1/analytics/latest` | GET | Latest metrics snapshot |
| `/api/v1/analytics/growth` | GET | User growth over time |
| `/api/v1/analytics/monthly` | GET | Monthly aggregated metrics |
| `/api/v1/analytics/summary` | GET | Dashboard summary with trends |
| `/api/v1/analytics/snapshot` | POST | Trigger manual snapshot |

**Example Responses:**

```bash
# Health
curl https://auth.mana.how/api/v1/analytics/health
```
```json
{
  "status": "healthy",
  "database_path": "/data/analytics/metrics.duckdb",
  "total_records": 30,
  "latest_snapshot": "2026-01-28"
}
```

```bash
# Latest metrics
curl https://auth.mana.how/api/v1/analytics/latest
```
```json
{
  "date": "2026-01-28",
  "total_users": 9,
  "verified_users": 1,
  "new_users_today": 0,
  "new_users_week": 9,
  "new_users_month": 9,
  "total_db_size_bytes": 9613795,
  "recorded_at": "2026-01-28 11:46:45.440934"
}
```

```bash
# Growth data
curl "https://auth.mana.how/api/v1/analytics/growth?days=30"
```
```json
[
  {"date": "2026-01-01", "total_users": 5, "growth": null, "growth_percent": null},
  {"date": "2026-01-02", "total_users": 6, "growth": 1, "growth_percent": 20.0},
  {"date": "2026-01-03", "total_users": 9, "growth": 3, "growth_percent": 50.0}
]
```

### 3. Grafana (Visualization)

**Purpose:** Dashboard visualization for both operative and business metrics.

| Property | Value |
|----------|-------|
| Image | `grafana/grafana:10.4.1` |
| Port | 3100 (external), 3000 (internal) |
| URL | https://grafana.mana.how |

**Available Dashboards:**

| Dashboard | Description |
|-----------|-------------|
| Master Overview | Combined view of all key metrics |
| Business Metrics | User growth, KPIs from DuckDB |
| System Overview | Infrastructure health |
| Backends | Backend service metrics |
| Application Details | Detailed app metrics |
| Database Details | PostgreSQL metrics |
| User Statistics | User-related metrics |

## Data Retention Strategy

| Data Type | Storage | Retention | Use Case |
|-----------|---------|-----------|----------|
| Operative Metrics | VictoriaMetrics | 2 years | CPU, memory, latency, request rates |
| Business KPIs | DuckDB | Unlimited | User growth, feature usage, revenue |
| Raw Logs | External (optional) | 30 days | Debugging, auditing |

## Deployment

### Starting the Monitoring Stack

```bash
# On Mac Mini server
cd ~/projects/mana-monorepo

# Start all monitoring services
docker compose -f docker-compose.macmini.yml up -d victoriametrics grafana mana-auth

# Check status
docker compose -f docker-compose.macmini.yml ps | grep -E "(victoria|grafana|auth)"
```

### Rebuilding mana-auth (with Analytics)

```bash
# Build from monorepo root
docker build -t ghcr.io/memo-2023/mana-auth:latest -f services/mana-auth/Dockerfile .

# Restart container
docker compose -f docker-compose.macmini.yml up -d mana-auth
```

### Volume Permissions

If DuckDB fails with permission errors, fix the volume ownership:

```bash
docker exec -u root mana-auth chown -R nestjs:nodejs /data/analytics
docker restart mana-auth
```

## Backup

### Manual Backup

```bash
./scripts/backup-monitoring.sh
```

This script backs up:
1. **VictoriaMetrics**: Creates a snapshot and compresses it
2. **DuckDB**: Copies the database file and exports to Parquet

### Backup Location

Default: `/backup/monitoring/`

Files created:
- `victoriametrics-YYYY-MM-DD.tar.gz`
- `analytics-YYYY-MM-DD.duckdb`
- `analytics-YYYY-MM-DD.parquet`

### Automated Backups

Add to crontab for daily backups:

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/mana-monorepo/scripts/backup-monitoring.sh
```

## Troubleshooting

### VictoriaMetrics not scraping targets

```bash
# Check scrape config
docker exec mana-victoriametrics cat /etc/prometheus/prometheus.yml

# Check targets status
curl http://localhost:8428/api/v1/targets
```

### DuckDB initialization fails

1. Check permissions:
```bash
docker exec mana-auth ls -la /data/analytics/
```

2. Fix if needed:
```bash
docker exec -u root mana-auth chown -R nestjs:nodejs /data/analytics
```

3. Restart:
```bash
docker restart mana-auth
```

### Grafana can't connect to VictoriaMetrics

1. Check VictoriaMetrics is running:
```bash
curl http://localhost:8428/health
```

2. Check datasource configuration:
```bash
cat docker/grafana/provisioning/datasources/prometheus.yml
```

3. Restart Grafana:
```bash
docker restart mana-grafana
```

### Missing metrics in Grafana

1. Check if VictoriaMetrics has the data:
```bash
curl "http://localhost:8428/api/v1/query?query=auth_users_total"
```

2. Check service is exposing metrics:
```bash
curl http://localhost:3001/metrics
```

## Environment Variables

### mana-auth

| Variable | Description | Default |
|----------|-------------|---------|
| `DUCKDB_PATH` | Path to DuckDB file | `/data/analytics/metrics.duckdb` |
| `DATABASE_URL` | PostgreSQL connection string | Required |

### VictoriaMetrics

Configured via command-line arguments in docker-compose:
- `-retentionPeriod=2y`
- `-storageDataPath=/storage`
- `-promscrape.config=/etc/prometheus/prometheus.yml`

## Architecture Decision Record

For the full decision rationale, see: [docs/decisions/001-monitoring-stack-upgrade.md](decisions/001-monitoring-stack-upgrade.md)

## Related Documentation

- [Local Development](LOCAL_DEVELOPMENT.md)
- [Mac Mini Server](MAC_MINI_SERVER.md)
- [Database Migrations](DATABASE_MIGRATIONS.md)
