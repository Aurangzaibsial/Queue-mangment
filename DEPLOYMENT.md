# Deployment Guide

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space

## Quick Start

```bash
# Clone repository
git clone <repository-url>
cd Queue-mangment

# Copy environment files
cp smart-queue-backend/.env.example smart-queue-backend/.env
cp ai-service/.env.example ai-service/.env

# Edit environment variables
# Update MONGODB_URI, REDIS_URI, JWT_SECRET, etc.

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Services

- **API Service**: http://localhost:5000
- **AI Service**: http://localhost:8000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Environment Variables

### API Service (.env)
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://mongodb:27017/booking_db
REDIS_URI=redis://redis:6379/0
JWT_SECRET=your-jwt-secret-change-in-production
```

### AI Service (.env)
```
HOST=0.0.0.0
PORT=8000
DEBUG=False
MONGODB_URI=mongodb://mongodb:27017/booking_db
REDIS_URI=redis://redis:6379/0
AI_SERVICE_API_KEY=your-api-key-change-in-production
```

## Production Deployment

### Security

1. **Change all default passwords and secrets**
2. **Enable HTTPS** - Configure SSL certificates in nginx
3. **Use secrets management** - Docker secrets or Vault
4. **Enable firewall rules** - Restrict access to necessary ports
5. **Regular security updates** - Keep images updated

### Scaling

```bash
# Scale API service
docker-compose up -d --scale api-service=3

# Scale AI service
docker-compose up -d --scale ai-service=2
```

### Monitoring

- **Prometheus**: http://localhost:9090 - Metrics collection
- **Grafana**: http://localhost:3000 - Visualization dashboards

### Backup

```bash
# Backup MongoDB
docker exec booking_mongodb mongodump --out /backup

# Backup Redis
docker exec booking_redis redis-cli SAVE
docker cp booking_redis:/data/dump.rdb ./backup/

# Backup models
docker cp booking_ai_service:/app/models ./backup/
```

### Health Checks

```bash
# API Service
curl http://localhost:5000/health

# AI Service
curl http://localhost:8000/health
```

## Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs <service-name>

# Rebuild service
docker-compose up -d --build <service-name>
```

### Database connection issues
```bash
# Check MongoDB status
docker-compose exec mongodb mongosh

# Check Redis status
docker-compose exec redis redis-cli ping
```

### Out of memory
```bash
# Increase Docker memory limit in Docker Desktop settings
# Or reduce container resource limits in docker-compose.yml
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to production
        run: |
          docker-compose up -d --build
```

## Maintenance

### Update services
```bash
# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up -d
```

### Clean up
```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune
```

### Log rotation
```bash
# Configure log rotation in docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```
