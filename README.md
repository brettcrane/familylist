# FamilyList

A family-friendly list management application with AI-powered categorization, designed for Home Assistant integration.

## Features

- **Multiple List Types**: Grocery, packing, and task lists
- **AI Categorization**: Automatic item categorization using embeddings
- **Natural Language Parsing**: "Meal mode" lets you type dishes and AI extracts ingredients
- **Learning System**: Remembers user corrections to improve over time
- **Home Assistant Ready**: Designed for HA integration via REST API

## Known Issues

See [TODO.md](./TODO.md) for current bugs and planned improvements.

## Quick Start

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) package manager

### Development Setup

```bash
# Clone and enter directory
cd familylist

# Copy environment file
cp .env.example .env
# Edit .env and set your API_KEY

# Install dependencies
cd backend
uv sync

# Run development server
uv run uvicorn app.main:app --reload
```

### API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Running Tests

```bash
cd backend
uv run pytest
```

## Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

### Auto-Updates with Watchtower

The GitHub Actions workflow automatically builds and pushes a new Docker image to `ghcr.io` on every push to master. To auto-update your running container, use [Watchtower](https://containrrr.dev/watchtower/):

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300
```

This checks every 5 minutes for new images and automatically recreates containers with the latest version.

**Manual update (Portainer):**
1. Go to **Containers** → click your familylist container
2. Click **Recreate**
3. Check **"Re-pull image"** before confirming

## API Authentication

All API endpoints (except health check) require an API key:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/lists
```

## Project Structure

```
familylist/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   └── services/  # Business logic
│   └── tests/
├── frontend/          # PWA frontend (Phase 2)
├── data/              # SQLite database
├── Dockerfile
└── docker-compose.yml
```

## License

Private - Family use only
