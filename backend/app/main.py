"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, categories, items, lists
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


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health_check():
    """Health check endpoint (no authentication required)."""
    settings = get_settings()
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.environment,
    )


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
    )
