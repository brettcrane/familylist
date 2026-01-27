# Claude Code Context

## Project Overview

FamilyList is a family-friendly list management PWA with AI-powered features:
- Multiple list types (grocery, packing, tasks)
- AI categorization using sentence-transformers embeddings
- Natural language parsing via OpenAI (e.g., "stuff for tacos" → ingredients)
- Learning system that remembers user corrections

## Architecture

- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
- **AI**: sentence-transformers for embeddings, OpenAI GPT-4o-mini for NL parsing
- **Deployment**: Docker via GitHub Actions CI/CD → Portainer

## Key Files

- `backend/app/services/llm_service.py` - LLM integration for natural language parsing
- `backend/app/services/ai_service.py` - Embedding-based categorization
- `frontend/src/components/items/ItemInput.tsx` - Item input with meal mode toggle
- `docker-compose.yml` - Production deployment config

## Environment Variables

Required for AI features:
- `OPENAI_API_KEY` - For natural language parsing
- `ENABLE_LLM_PARSING=true` - Enable NL parsing
- `LLM_BACKEND=openai` - Use OpenAI backend
- `LLM_OPENAI_MODEL=gpt-4o-mini` - Model to use

## Known Issues

See [TODO.md](./TODO.md) for current bugs and tasks.

## Development

```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

## Testing

```bash
cd backend && uv run pytest
```
