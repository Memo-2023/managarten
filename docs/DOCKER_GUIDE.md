# Docker Guide

Comprehensive guide for working with Docker in the managarten.

## Table of Contents

- [Overview](#overview)
- [Docker Templates](#docker-templates)
- [Building Images](#building-images)
- [Running Containers](#running-containers)
- [Docker Compose](#docker-compose)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The monorepo uses Docker for:

- **Development**: Local service orchestration
- **CI/CD**: Automated builds and tests
- **Production**: Deployment and scaling

### Image Strategy

All images use:

- **Multi-stage builds**: Smaller production images
- **Alpine Linux**: Minimal base images
- **Non-root users**: Enhanced security
- **Health checks**: Automatic monitoring
- **Layer caching**: Faster builds

## Docker Templates

Templates are located in `docker/templates/`. Use these as starting points for new services.

### NestJS Backend Template

**File**: `docker/templates/Dockerfile.nestjs`

**Usage**:

```dockerfile
# Copy template
cp docker/templates/Dockerfile.nestjs apps/myproject/apps/backend/Dockerfile

# Customize for your service
```

**Build Arguments**:

- `SERVICE_PATH`: Path to service (e.g., `apps/chat/apps/backend`)
- `PORT`: Service port (default: 3000)
- `HEALTH_PATH`: Health check endpoint (default: `/health`)

**Example**:

```bash
docker build \
  --build-arg SERVICE_PATH=apps/chat/apps/backend \
  --build-arg PORT=3002 \
  --build-arg HEALTH_PATH=/api/health \
  -t chat-backend:latest \
  -f docker/templates/Dockerfile.nestjs \
  .
```

### SvelteKit Web Template

**File**: `docker/templates/Dockerfile.sveltekit`

**Features**:

- SSR support
- Environment variable injection
- Static asset optimization
- Health endpoint

**Usage**:

```bash
docker build \
  --build-arg SERVICE_PATH=apps/chat/apps/web \
  --build-arg PORT=3000 \
  -t chat-web:latest \
  -f docker/templates/Dockerfile.sveltekit \
  .
```

### Astro Landing Page Template

**File**: `docker/templates/Dockerfile.astro`

**Features**:

- Static site serving with Nginx
- Gzip compression
- Security headers
- Asset caching

**Nginx Configuration**: `docker/nginx/astro.conf`

**Usage**:

```bash
docker build \
  --build-arg SERVICE_PATH=apps/chat/apps/landing \
  -t chat-landing:latest \
  -f docker/templates/Dockerfile.astro \
  .
```

## Building Images

### Local Development Builds

```bash
# Build single service
docker build -t service-name:dev -f apps/project/apps/service/Dockerfile .

# Build with cache
docker build --cache-from service-name:latest -t service-name:dev .

# Build without cache
docker build --no-cache -t service-name:dev .
```

### Production Builds

```bash
# Build for production
docker build \
  --build-arg NODE_ENV=production \
  -t service-name:latest \
  -f Dockerfile .

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t service-name:latest \
  .
```

### Using Build Script

```bash
# Build all services
./scripts/deploy/build-and-push.sh all latest

# Build specific service
./scripts/deploy/build-and-push.sh chat-backend v1.0.0

# Build without pushing
DOCKER_PUSH=false ./scripts/deploy/build-and-push.sh chat-backend dev
```

## Running Containers

### Run Single Container

```bash
# Run with environment file
docker run -d \
  --name chat-backend \
  --env-file .env.production \
  -p 3002:3002 \
  chat-backend:latest

# Run with environment variables
docker run -d \
  --name chat-backend \
  -e NODE_ENV=production \
  -e PORT=3002 \
  -p 3002:3002 \
  chat-backend:latest

# Run with volume mount
docker run -d \
  --name chat-backend \
  -v $(pwd)/logs:/app/logs \
  -p 3002:3002 \
  chat-backend:latest
```

### Interactive Debugging

```bash
# Run with shell
docker run -it --rm chat-backend:latest /bin/sh

# Execute command in running container
docker exec -it chat-backend sh

# View logs
docker logs -f chat-backend

# View last 100 lines
docker logs --tail=100 chat-backend
```

### Health Checks

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' chat-backend

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' chat-backend
```

## Docker Compose

### Development Environment

**File**: `docker-compose.dev.yml`

Start services for local development:

```bash
# Start all services
pnpm run docker:up

# Start with specific profile
pnpm run docker:up:auth
pnpm run docker:up:chat

# View logs
pnpm run docker:logs

# Stop all services
pnpm run docker:down
```

### Staging Environment

**File**: `docker-compose.staging.yml`

```bash
# Deploy to staging
docker compose -f docker-compose.staging.yml up -d

# Scale service
docker compose -f docker-compose.staging.yml up -d --scale chat-backend=3

# View status
docker compose -f docker-compose.staging.yml ps

# View logs
docker compose -f docker-compose.staging.yml logs -f chat-backend
```

### Production Environment

**File**: `docker-compose.production.yml`

```bash
# Deploy to production
docker compose -f docker-compose.production.yml up -d

# Rolling update
docker compose -f docker-compose.production.yml up -d --no-deps service-name

# Zero-downtime deployment
docker compose up -d --scale service=2 service
sleep 30
docker compose up -d --scale service=1 service
```

### Common Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose stop

# Restart service
docker compose restart service-name

# View logs
docker compose logs -f

# Execute command
docker compose exec service-name sh

# Remove all containers
docker compose down

# Remove containers and volumes
docker compose down -v
```

## Best Practices

### 1. Optimize Layer Caching

Order Dockerfile commands from least to most frequently changing:

```dockerfile
# Good
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .

# Bad (cache invalidated on every code change)
COPY . .
RUN pnpm install
```

### 2. Use .dockerignore

Create `.dockerignore` to exclude unnecessary files:

```
node_modules
dist
.git
.env
*.log
```

### 3. Multi-Stage Builds

Always use multi-stage builds for smaller images:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build

# Production stage
FROM node:20-alpine AS production
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/main.js"]
```

### 4. Security Best Practices

```dockerfile
# Use non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001
USER nestjs

# Don't include secrets
# Use environment variables or Docker secrets

# Scan images for vulnerabilities
docker scan image-name:latest
```

### 5. Health Checks

Always include health checks:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

### 6. Resource Limits

Set resource limits in docker-compose:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 7. Logging

Configure logging drivers:

```yaml
services:
  backend:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

### 8. Environment Variables

Use environment files:

```bash
# .env.production
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
```

```yaml
services:
  backend:
    env_file:
      - .env.production
```

## Troubleshooting

### Container Won't Start

**Issue**: Container exits immediately

**Debug**:

```bash
# View container logs
docker logs container-name

# Check exit code
docker inspect --format='{{.State.ExitCode}}' container-name

# Run interactively
docker run -it --rm image-name sh
```

### Out of Disk Space

**Issue**: Docker runs out of disk space

**Solution**:

```bash
# Check disk usage
docker system df

# Remove unused containers
docker container prune

# Remove unused images
docker image prune -a

# Remove everything unused
docker system prune -a --volumes

# Remove specific resources
docker rm $(docker ps -aq)
docker rmi $(docker images -q)
```

### Build Fails

**Issue**: Docker build fails

**Debug**:

```bash
# Build with verbose output
docker build --progress=plain --no-cache -t image-name .

# Check build context
docker build --dry-run .

# Build specific stage
docker build --target builder -t image-name .
```

### Network Issues

**Issue**: Containers can't communicate

**Debug**:

```bash
# List networks
docker network ls

# Inspect network
docker network inspect bridge

# Test connectivity
docker exec container1 ping container2

# Check DNS
docker exec container1 nslookup container2
```

### Performance Issues

**Issue**: Container runs slowly

**Debug**:

```bash
# Check resource usage
docker stats

# Check container processes
docker top container-name

# Analyze image layers
docker history image-name
```

### Permission Issues

**Issue**: Permission denied errors

**Solution**:

```bash
# Check file ownership
docker exec container-name ls -la /app

# Fix ownership in Dockerfile
RUN chown -R nodejs:nodejs /app
USER nodejs
```

### Environment Variables Not Working

**Issue**: Env vars not available in container

**Debug**:

```bash
# Check environment
docker exec container-name env

# Verify env file
cat .env.production

# Test with explicit vars
docker run -e VAR=value image-name
```

## Advanced Topics

### Docker BuildKit

Enable for better builds:

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with BuildKit
docker build .

# Use buildx for multi-platform
docker buildx build --platform linux/amd64,linux/arm64 .
```

### Docker Secrets

For sensitive data:

```bash
# Create secret
echo "secret-value" | docker secret create my_secret -

# Use in service
docker service create \
  --secret my_secret \
  --name my-service \
  image-name
```

### Docker Volumes

Persist data:

```bash
# Create volume
docker volume create my-data

# Use volume
docker run -v my-data:/app/data image-name

# Backup volume
docker run --rm -v my-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data
```

### Custom Networks

Isolate services:

```bash
# Create network
docker network create --driver bridge my-network

# Run container on network
docker run --network my-network image-name

# Connect existing container
docker network connect my-network container-name
```

## Resources

- [Docker Documentation](https://docs.docker.com)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
