#!/bin/bash

# EasyAsta Docker Management Scripts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    echo -e "${BLUE}EasyAsta Docker Management Scripts${NC}"
    echo ""
    echo "Usage: ./docker-scripts.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build         Build the Docker image"
    echo "  tag           Tag image for registry push"
    echo "  push          Push image to registry"
    echo "  pull          Pull image from registry"
    echo "  dev           Start development environment (PostgreSQL + Redis only)"
    echo "  prod          Start production environment (full stack)"
    echo "  stop          Stop all containers"
    echo "  clean         Stop and remove all containers and volumes"
    echo "  logs          Show application logs"
    echo "  db-migrate    Run Prisma migrations"
    echo "  db-reset      Reset database (WARNING: destroys all data)"
    echo "  health        Check application health"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./docker-scripts.sh build"
    echo "  ./docker-scripts.sh tag myregistry/easyasta:1.0.0"
    echo "  ./docker-scripts.sh push myregistry/easyasta:1.0.0"
    echo "  ./docker-scripts.sh dev"
    echo "  ./docker-scripts.sh prod"
}

# Build Docker image
build_image() {
    print_status "Building EasyAsta Docker image..."
    docker build -t easyasta:latest .
    print_status "Build completed successfully!"
}

# Tag image for registry
tag_image() {
    local registry_tag=${1}
    
    if [ -z "$registry_tag" ]; then
        print_error "Registry tag required. Usage: ./docker-scripts.sh tag <registry>/<image>:<tag>"
        print_error "Examples:"
        print_error "  ./docker-scripts.sh tag docker.io/myuser/easyasta:1.0.0"
        print_error "  ./docker-scripts.sh tag ghcr.io/myuser/easyasta:latest"
        print_error "  ./docker-scripts.sh tag myregistry.com/easyasta:v1.0.0"
        exit 1
    fi
    
    print_status "Tagging image easyasta:latest as $registry_tag..."
    docker tag easyasta:latest "$registry_tag"
    print_status "Image tagged successfully!"
}

# Push image to registry
push_image() {
    local registry_tag=${1}
    
    if [ -z "$registry_tag" ]; then
        print_error "Registry tag required. Usage: ./docker-scripts.sh push <registry>/<image>:<tag>"
        print_error "Make sure to run 'tag' command first or provide the same tag used in tagging."
        exit 1
    fi
    
    # Check if image exists locally
    if ! docker image inspect "$registry_tag" >/dev/null 2>&1; then
        print_error "Image $registry_tag not found locally. Run 'tag' command first."
        exit 1
    fi
    
    print_status "Pushing image $registry_tag to registry..."
    print_warning "Make sure you're logged in to the registry (docker login)"
    
    if docker push "$registry_tag"; then
        print_status "Image pushed successfully!"
        print_status "You can now pull it with: docker pull $registry_tag"
    else
        print_error "Push failed. Make sure you're authenticated with the registry."
        exit 1
    fi
}

# Pull image from registry
pull_image() {
    local registry_tag=${1}
    
    if [ -z "$registry_tag" ]; then
        print_error "Registry tag required. Usage: ./docker-scripts.sh pull <registry>/<image>:<tag>"
        exit 1
    fi
    
    print_status "Pulling image $registry_tag from registry..."
    docker pull "$registry_tag"
    
    # Tag as local latest for convenience
    print_status "Tagging pulled image as easyasta:latest..."
    docker tag "$registry_tag" easyasta:latest
    print_status "Image pulled and tagged successfully!"
}

# Start development environment
start_dev() {
    print_status "Starting development environment..."
    docker-compose -f docker-compose.dev.yml up -d
    print_status "Development environment started!"
    print_status "PostgreSQL: localhost:5433"
    print_status "Redis: localhost:6380"
    print_warning "Remember to update your .env file with the development database URL:"
    echo "DATABASE_URL=\"postgresql://easyasta_user:easyasta_dev_password@localhost:5433/easyasta_dev?schema=public\""
}

# Start production environment
start_prod() {
    print_status "Starting production environment..."
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from template..."
        cp .env.docker.example .env
        print_error "Please configure your .env file with proper values before starting the application!"
        exit 1
    fi
    
    docker-compose up -d
    print_status "Production environment started!"
    print_status "Application: http://localhost:3000"
    print_status "PostgreSQL: localhost:5432"
    print_status "Redis: localhost:6379"
}

# Stop containers
stop_containers() {
    print_status "Stopping containers..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down
    print_status "All containers stopped!"
}

# Clean environment
clean_environment() {
    print_warning "This will remove all containers, images, and volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning environment..."
        docker-compose down -v --remove-orphans
        docker-compose -f docker-compose.dev.yml down -v --remove-orphans
        docker image rm easyasta:latest 2>/dev/null || true
        docker system prune -f
        print_status "Environment cleaned!"
    else
        print_status "Operation cancelled."
    fi
}

# Show logs
show_logs() {
    print_status "Showing application logs..."
    docker-compose logs -f app
}

# Run database migrations
run_migrations() {
    print_status "Running Prisma migrations..."
    docker-compose exec app npx prisma migrate deploy
    print_status "Migrations completed!"
}

# Reset database
reset_database() {
    print_warning "This will destroy all data in the database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Resetting database..."
        docker-compose exec app npx prisma migrate reset --force
        print_status "Database reset completed!"
    else
        print_status "Operation cancelled."
    fi
}

# Check application health
check_health() {
    print_status "Checking application health..."
    
    # Check if containers are running
    if ! docker-compose ps | grep -q "Up"; then
        print_error "Application containers are not running!"
        exit 1
    fi
    
    # Check health endpoint
    if curl -f -s http://localhost:3000/api/health > /dev/null; then
        print_status "Application is healthy!"
        curl -s http://localhost:3000/api/health | jq '.'
    else
        print_error "Application health check failed!"
        exit 1
    fi
}

# Main script logic
case ${1:-help} in
    build)
        build_image
        ;;
    tag)
        tag_image "$2"
        ;;
    push)
        push_image "$2"
        ;;
    pull)
        pull_image "$2"
        ;;
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    stop)
        stop_containers
        ;;
    clean)
        clean_environment
        ;;
    logs)
        show_logs
        ;;
    db-migrate)
        run_migrations
        ;;
    db-reset)
        reset_database
        ;;
    health)
        check_health
        ;;
    help)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac