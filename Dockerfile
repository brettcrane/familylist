# Multi-stage Dockerfile for FamilyList backend + PWA frontend
# CPU-only inference for sentence-transformers

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

# Build arg for Clerk (passed from GitHub Actions)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Build the PWA (VITE_CLERK_PUBLISHABLE_KEY is available here)
RUN npm run build

# Stage 2: Build Python dependencies
FROM python:3.12-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies (production only, no dev)
RUN uv sync --frozen --no-dev --no-install-project

# Stage 2.5: Source the pre-baked embedding model from the last-good image.
# Hugging Face rate-limits (HTTP 429) the shared GitHub Actions runner IPs,
# so downloading the model at build time is unreliable. The previously
# published image already contains the model in appuser's cache; we carry it
# forward instead of re-fetching from HF. The chain is self-sustaining: each
# new image bakes the model in, so it only ever had to be downloaded once.
FROM ghcr.io/brettcrane/familylist:latest AS model-cache

# Stage 3: Runtime
FROM python:3.12-slim AS runtime

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser

# Set working directory
WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Create data and cache directories with correct ownership
RUN mkdir -p /app/data /home/appuser/.cache && chown -R appuser:appuser /app /home/appuser

# Switch to non-root user
USER appuser

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
# Never reach out to Hugging Face — the model is baked in below. This also
# avoids a network HEAD/revalidation on every container startup.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# Bring the embedding model cache in from the last-good image (see model-cache
# stage). Placed BEFORE the app/frontend copies so this layer stays cached
# across code-only changes.
COPY --from=model-cache --chown=appuser:appuser /home/appuser/.cache /home/appuser/.cache

# Verify the model loads fully offline — fails the build fast if the cache
# copy is incomplete, rather than discovering it at runtime.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy application code (changes frequently — kept after the model layer)
COPY --chown=appuser:appuser backend/app ./app

# Copy frontend build from frontend-builder
COPY --chown=appuser:appuser --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
