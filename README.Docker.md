# EasyAsta Docker Setup

This guide explains how to run EasyAsta using Docker containers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.0+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.0+
- At least 2GB RAM available for containers

## Quick Start

### 1. Development Environment (Database Only)

For local development with hot reload:

```bash
# Start PostgreSQL and Redis containers only
./docker-scripts.sh dev

# Update your .env file:
DATABASE_URL="postgresql://easyasta_user:easyasta_dev_password@localhost:5433/easyasta_dev?schema=public"

# Run the app locally
npm run dev
```

### 2. Production Environment (Full Stack)

For production deployment:

```bash
# Copy environment template
cp .env.docker.example .env

# Configure your .env file (see Configuration section)

# Build and start all services
./docker-scripts.sh build
./docker-scripts.sh prod
```

Your application will be available at http://localhost:3000

## Docker Scripts

The included `docker-scripts.sh` provides convenient commands:

```bash
# Build the Docker image
./docker-scripts.sh build

# Start development environment (DB only)
./docker-scripts.sh dev

# Start production environment (full stack)
./docker-scripts.sh prod

# Stop all containers
./docker-scripts.sh stop

# Clean everything (containers, volumes, images)
./docker-scripts.sh clean

# Show application logs
./docker-scripts.sh logs

# Run database migrations
./docker-scripts.sh db-migrate

# Reset database (WARNING: destroys data)
./docker-scripts.sh db-reset

# Check application health
./docker-scripts.sh health
```

## Configuration

### Environment Variables

Copy `.env.docker.example` to `.env` and configure:

```env
# Database
DATABASE_URL="postgresql://easyasta_user:easyasta_password@postgres:5432/easyasta?schema=public"

# NextAuth (required)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-key-here"

# Google OAuth (required)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

## Services

### Application (port 3000)
- Main EasyAsta web application
- Socket.io real-time communication
- Health check endpoint: `/api/health`

### PostgreSQL (port 5432)
- Primary database
- Automatic migrations on startup
- Data persistence in named volume

### Redis (port 6379)
- Session storage (optional)
- Caching layer
- Data persistence in named volume

## Development vs Production

### Development Setup
```bash
# Start only database containers
./docker-scripts.sh dev

# Run app locally with hot reload
npm run dev
```

**Benefits:**
- Fast hot reload
- Direct file system access
- Easy debugging
- Reduced resource usage

### Production Setup
```bash
# Start full containerized stack
./docker-scripts.sh prod
```

**Benefits:**
- Production-like environment
- Container isolation
- Automatic restarts
- Health monitoring

## Volume Management

### Named Volumes
- `postgres_data`: Database files
- `redis_data`: Redis persistence
- `app_logs`: Application logs

### Backup Database
```bash
# Export database
docker-compose exec postgres pg_dump -U easyasta_user easyasta > backup.sql

# Import database
docker-compose exec -T postgres psql -U easyasta_user easyasta < backup.sql
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
./docker-scripts.sh logs

# Check individual service
docker-compose logs postgres
docker-compose logs app
```

### Database Connection Issues
```bash
# Check database health
docker-compose exec postgres pg_isready -U easyasta_user

# Reset database
./docker-scripts.sh db-reset
```

### Port Conflicts
If ports 3000, 5432, or 6379 are already in use, modify `docker-compose.yml`:

```yaml
services:
  app:
    ports:
      - "3001:3000"  # Use port 3001 instead
```

### Application Health
```bash
# Manual health check
curl http://localhost:3000/api/health

# Automated health check
./docker-scripts.sh health
```

## Performance Optimization

### Resource Limits
Add to `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

### Multi-stage Build
The Dockerfile uses multi-stage builds to:
- Reduce final image size
- Exclude development dependencies
- Optimize layers for caching

## Security

### Production Checklist
- [ ] Change default passwords
- [ ] Use strong NEXTAUTH_SECRET
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS in production
- [ ] Regular security updates
- [ ] Monitor container logs

### Network Security
Containers communicate via isolated Docker network `easyasta-network`.

## Monitoring

### Health Checks
- Application: HTTP health endpoint
- Database: PostgreSQL readiness probe
- Redis: PING command

### Logs
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f postgres

# All services
docker-compose logs -f
```

## Deployment

### Production Deployment
1. Copy files to server
2. Configure `.env` with production values
3. Update `NEXTAUTH_URL` to your domain
4. Run: `./docker-scripts.sh prod`
5. Set up reverse proxy (Nginx/Traefik)
6. Configure SSL certificates

### CI/CD Integration
Example GitHub Actions workflow:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and Deploy
        run: |
          ./docker-scripts.sh build
          ./docker-scripts.sh prod
```

## Support

For issues specific to Docker setup:
1. Check container logs: `./docker-scripts.sh logs`
2. Verify health: `./docker-scripts.sh health`
3. Review this documentation
4. Open issue with logs and configuration details