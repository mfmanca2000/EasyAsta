# Docker Registry Guide for EasyAsta

This guide explains how to push your EasyAsta Docker image to different registries.

## Quick Commands

```bash
# 1. Build the image
./docker-scripts.sh build

# 2. Tag for your registry
./docker-scripts.sh tag <registry>/<image>:<tag>

# 3. Push to registry
./docker-scripts.sh push <registry>/<image>:<tag>
```

## Supported Registries

### 1. Docker Hub (docker.io)

**Setup:**
```bash
# Login to Docker Hub
docker login

# Tag and push
./docker-scripts.sh tag docker.io/yourusername/easyasta:1.0.0
./docker-scripts.sh push docker.io/yourusername/easyasta:1.0.0
```

**Usage:**
```bash
# Others can pull with:
docker pull yourusername/easyasta:1.0.0
```

### 2. GitHub Container Registry (ghcr.io)

**Setup:**
```bash
# Create GitHub Personal Access Token with 'write:packages' scope
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Tag and push
./docker-scripts.sh tag ghcr.io/yourusername/easyasta:latest
./docker-scripts.sh push ghcr.io/yourusername/easyasta:latest
```

**Usage:**
```bash
# Others can pull with:
docker pull ghcr.io/yourusername/easyasta:latest
```

### 3. AWS Elastic Container Registry (ECR)

**Setup:**
```bash
# Install AWS CLI and configure
aws configure

# Login to ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-west-2.amazonaws.com

# Create repository (first time only)
aws ecr create-repository --repository-name easyasta --region us-west-2

# Tag and push
./docker-scripts.sh tag 123456789.dkr.ecr.us-west-2.amazonaws.com/easyasta:1.0.0
./docker-scripts.sh push 123456789.dkr.ecr.us-west-2.amazonaws.com/easyasta:1.0.0
```

### 4. Google Container Registry (gcr.io)

**Setup:**
```bash
# Configure gcloud and authenticate
gcloud auth configure-docker

# Tag and push
./docker-scripts.sh tag gcr.io/your-project-id/easyasta:1.0.0
./docker-scripts.sh push gcr.io/your-project-id/easyasta:1.0.0
```

### 5. Azure Container Registry (ACR)

**Setup:**
```bash
# Login to Azure
az acr login --name yourregistry

# Tag and push
./docker-scripts.sh tag yourregistry.azurecr.io/easyasta:1.0.0
./docker-scripts.sh push yourregistry.azurecr.io/easyasta:1.0.0
```

## Complete Workflow Example

### For Docker Hub:

```bash
# 1. Build the image
./docker-scripts.sh build

# 2. Login to Docker Hub
docker login
# Enter your Docker Hub username and password

# 3. Tag with version
./docker-scripts.sh tag docker.io/myusername/easyasta:1.0.0
./docker-scripts.sh tag docker.io/myusername/easyasta:latest

# 4. Push both tags
./docker-scripts.sh push docker.io/myusername/easyasta:1.0.0
./docker-scripts.sh push docker.io/myusername/easyasta:latest
```

### For GitHub Container Registry:

```bash
# 1. Create GitHub Token
# Go to GitHub → Settings → Developer settings → Personal access tokens
# Create token with 'write:packages' scope

# 2. Login to GHCR
export GITHUB_TOKEN=ghp_your_token_here
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 3. Build and push
./docker-scripts.sh build
./docker-scripts.sh tag ghcr.io/yourusername/easyasta:latest
./docker-scripts.sh push ghcr.io/yourusername/easyasta:latest
```

## Production Deployment

### Using Registry Image in docker-compose.yml:

```yaml
version: '3.8'
services:
  app:
    image: docker.io/yourusername/easyasta:1.0.0  # Use registry image
    # Remove build: . line
    container_name: easyasta-app
    # ... rest of configuration
```

### Update Deployment Scripts:

```bash
# Pull latest image from registry
./docker-scripts.sh pull docker.io/yourusername/easyasta:latest

# Start with latest image
./docker-scripts.sh prod
```

## CI/CD Integration

### GitHub Actions Example:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

## Best Practices

### Tagging Strategy:

```bash
# Semantic versioning
./docker-scripts.sh tag registry/easyasta:1.0.0
./docker-scripts.sh tag registry/easyasta:1.0
./docker-scripts.sh tag registry/easyasta:1
./docker-scripts.sh tag registry/easyasta:latest

# Environment-specific tags
./docker-scripts.sh tag registry/easyasta:staging
./docker-scripts.sh tag registry/easyasta:production

# Git-based tags
./docker-scripts.sh tag registry/easyasta:commit-abc123
./docker-scripts.sh tag registry/easyasta:branch-feature-x
```

### Multi-architecture Builds:

```bash
# Build for multiple architectures
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yourusername/easyasta:1.0.0 --push .
```

## Registry Management

### View Images:
```bash
# Docker Hub
# Visit: https://hub.docker.com/repository/docker/yourusername/easyasta

# GHCR
# Visit: https://github.com/yourusername/yourrepo/pkgs/container/easyasta
```

### Delete Images:
```bash
# Docker Hub - use web interface or API
# GHCR
gh api -X DELETE /user/packages/container/easyasta/versions/VERSION_ID
```

### Private vs Public:
- **Docker Hub**: Public by default, paid plans for private
- **GHCR**: Public for open source, private for organizations
- **Cloud registries**: Usually private by default

## Troubleshooting

### Authentication Issues:
```bash
# Check if logged in
docker info | grep -i registry

# Re-login
docker logout
docker login
```

### Permission Denied:
```bash
# Make sure you have push permissions to the repository
# For Docker Hub: verify repository ownership
# For GHCR: verify token has 'write:packages' scope
```

### Image Not Found:
```bash
# Verify tag exists locally
docker images | grep easyasta

# Verify registry URL is correct
docker pull your-registry/easyasta:tag
```

### Push Size Issues:
```bash
# Check image size
docker images easyasta:latest

# Optimize Dockerfile if image is too large
# Use .dockerignore to exclude unnecessary files
```

## Security Considerations

1. **Never include secrets in images**
2. **Use specific tags instead of 'latest' in production**
3. **Regularly update base images for security patches**
4. **Scan images for vulnerabilities**
5. **Use private registries for proprietary code**
6. **Rotate authentication tokens regularly**

## Registry Costs

- **Docker Hub**: Free for public repos, $5/month for private
- **GHCR**: Free for public repos, included with GitHub plans
- **AWS ECR**: $0.10/GB/month storage, $0.09/GB transfer
- **Google GCR**: $0.026/GB/month storage
- **Azure ACR**: $5/month basic tier

Choose based on your deployment platform and budget!