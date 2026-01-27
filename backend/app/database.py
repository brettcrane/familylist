"""SQLite database connection and session management."""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import get_settings

Base = declarative_base()

# Module-level state that can be overridden for testing
_engine: Engine | None = None
_SessionLocal: sessionmaker | None = None


def _setup_sqlite_pragmas(dbapi_connection, connection_record):
    """Enable foreign keys and WAL mode for SQLite."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def get_engine() -> Engine:
    """Get or create the database engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            echo=settings.is_development,
        )
        event.listen(_engine, "connect", _setup_sqlite_pragmas)
    return _engine


def set_engine(engine: Engine) -> None:
    """Set a custom engine (for testing)."""
    global _engine, _SessionLocal
    _engine = engine
    _SessionLocal = None  # Reset session local to use new engine


def get_session_local() -> sessionmaker:
    """Get or create the session factory."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Dependency for getting database sessions."""
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for database sessions (for use outside of FastAPI)."""
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables."""
    Base.metadata.create_all(bind=get_engine())


def create_indexes(db: Session) -> None:
    """Create additional indexes not handled by SQLAlchemy."""
    # Partial indexes for SQLite (SQLAlchemy doesn't support these directly)
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_items_unchecked ON items(list_id, is_checked) WHERE is_checked = 0",
        "CREATE INDEX IF NOT EXISTS idx_items_checked ON items(list_id, checked_at DESC) WHERE is_checked = 1",
    ]
    for idx_sql in indexes:
        db.execute(text(idx_sql))
    db.commit()


def reset_engine() -> None:
    """Reset the engine and session (for testing cleanup)."""
    global _engine, _SessionLocal
    _engine = None
    _SessionLocal = None
