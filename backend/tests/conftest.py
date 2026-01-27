"""Test fixtures and configuration."""

import os

# Set environment variables BEFORE importing app modules
os.environ["API_KEY"] = "test-api-key"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENVIRONMENT"] = "testing"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


# Create in-memory SQLite engine for testing with StaticPool to share connection
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# Enable foreign keys for SQLite (no WAL for in-memory)
@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# Set the test engine BEFORE importing any app modules
from app.database import Base, get_db, reset_engine, set_engine

set_engine(test_engine)

# Now import models (they will use the Base which is already defined)
from app.models import Category, CategoryLearning, Item, List, User  # noqa: E402, F401


TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    # Reset and set engine for this test
    reset_engine()
    set_engine(test_engine)

    # Create all tables
    Base.metadata.create_all(bind=test_engine)

    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with overridden dependencies."""
    # Import app after engine is set
    from app.main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """Return authentication headers for test requests."""
    return {"X-API-Key": "test-api-key"}


@pytest.fixture
def sample_list_data():
    """Sample list data for testing."""
    return {
        "name": "Test Grocery List",
        "type": "grocery",
    }


@pytest.fixture
def sample_item_data():
    """Sample item data for testing."""
    return {
        "name": "Milk",
        "quantity": 2,
        "notes": "2% fat",
    }
