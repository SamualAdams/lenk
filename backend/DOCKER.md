# Docker setup instructions

This document explains how to set up and use Docker for local development.

## Prerequisites

1. Install [Docker](https://docs.docker.com/get-docker/)
2. Install [Docker Compose](https://docs.docker.com/compose/install/)

## Files in this setup

- `docker-compose.yml` - Defines services, networks, and volumes
- `backend/Dockerfile` - Instructions to build the Django backend container
- `frontend/Dockerfile` - Instructions to build the React frontend container
- `backend/requirements.txt` - Python dependencies for the backend

## Getting started

1. Clone the repository
2. Place these Docker files in your project directory
3. Run the following commands:

```bash
# Start all services
docker-compose up

# Run in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f
```

## Accessing the applications

- Django backend: http://localhost:8000
- React frontend: http://localhost:3000

## Running commands inside containers

```bash
# Django commands (e.g., migrations)
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser

# Frontend commands (e.g., install packages)
docker-compose exec frontend npm install <package-name>
```

## Development workflow

1. The Docker volumes map your local directories to the containers
2. Changes you make locally are reflected in the containers
3. The Django runserver and React development server will auto-reload on changes

## Shutting down

```bash
# Stop all containers
docker-compose down

# Remove volumes (caution: this will delete your database data)
docker-compose down -v
```

## Next steps

- For production, update SECRET_KEY in docker-compose.yml
- Consider using PostgreSQL instead of SQLite for production
- Set up environment variables for sensitive information