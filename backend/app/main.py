"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api import ai, categories, items, lists, shares, users
from app.config import get_settings
from app.database import create_indexes, get_db_context, init_db
from app.schemas import HealthResponse
from app.services.ai_service import ai_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    settings = get_settings()
    logger.info(f"Starting FamilyList API ({settings.environment})")

    # Initialize database
    init_db()
    with get_db_context() as db:
        create_indexes(db)
    logger.info("Database initialized")

    # Load AI model (this may take a moment on first run)
    logger.info("Loading AI model...")
    ai_service.load_model()
    logger.info("AI model loaded")

    yield

    logger.info("Shutting down FamilyList API")


# Create FastAPI app
app = FastAPI(
    title="FamilyList API",
    description="Family-friendly list management with AI-powered categorization",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(lists.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(shares.router, prefix="/api")


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health_check():
    """Health check endpoint (no authentication required)."""
    settings = get_settings()
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.environment,
    )


# Serve PWA static files
# Look for frontend dist in multiple locations (development vs production)
FRONTEND_PATHS = [
    Path(__file__).parent.parent.parent.parent / "frontend" / "dist",  # Development
    Path("/app/frontend/dist"),  # Docker production
]

frontend_dist = None
for path in FRONTEND_PATHS:
    if path.exists() and path.is_dir():
        frontend_dist = path
        break

if frontend_dist:
    logger.info(f"Serving PWA from: {frontend_dist}")

    # Mount static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    # Serve other static files (icons, manifest, etc.)
    @app.get("/icons/{path:path}")
    async def serve_icon(path: str):
        file_path = frontend_dist / "icons" / path
        if file_path.exists():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

    @app.get("/favicon.svg")
    async def serve_favicon():
        return FileResponse(frontend_dist / "favicon.svg")

    @app.get("/manifest.webmanifest")
    async def serve_manifest():
        return FileResponse(frontend_dist / "manifest.webmanifest")

    @app.get("/sw.js")
    async def serve_sw():
        return FileResponse(frontend_dist / "sw.js", media_type="application/javascript")

    @app.get("/registerSW.js")
    async def serve_register_sw():
        return FileResponse(frontend_dist / "registerSW.js", media_type="application/javascript")

    # Catch-all route for SPA routing (must be last)
    @app.get("/{path:path}")
    async def serve_spa(path: str):
        # Check if file exists in dist
        file_path = frontend_dist / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for SPA routing
        return FileResponse(frontend_dist / "index.html")
else:
    logger.warning("Frontend dist not found. PWA will not be served.")


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
    )
