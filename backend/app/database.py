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
    # Run migrations for schema changes
    _run_migrations()


def _run_migrations() -> None:
    """Run schema migrations for existing databases.

    This handles adding new columns to existing tables that create_all() won't update.
    Uses IF NOT EXISTS patterns for idempotency.
    """
    import logging
    logger = logging.getLogger(__name__)

    engine = get_engine()
    with engine.connect() as conn:
        # Check if users table exists and has the right columns
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = {row[1] for row in result.fetchall()}

        if columns:  # Table exists
            # Add missing columns for Clerk integration
            migrations = []

            if "clerk_user_id" not in columns:
                migrations.append(
                    "ALTER TABLE users ADD COLUMN clerk_user_id VARCHAR(255)"
                )
            if "display_name" not in columns:
                migrations.append(
                    "ALTER TABLE users ADD COLUMN display_name VARCHAR(255) DEFAULT 'User'"
                )
            if "email" not in columns:
                migrations.append(
                    "ALTER TABLE users ADD COLUMN email VARCHAR(255)"
                )
            if "avatar_url" not in columns:
                migrations.append(
                    "ALTER TABLE users ADD COLUMN avatar_url TEXT"
                )
            if "updated_at" not in columns:
                migrations.append(
                    "ALTER TABLE users ADD COLUMN updated_at TEXT"
                )

            for migration in migrations:
                try:
                    conn.execute(text(migration))
                    logger.info(f"Migration applied: {migration}")
                except Exception as e:
                    logger.warning(f"Migration skipped (may already exist): {e}")

            if migrations:
                conn.commit()
                logger.info(f"Applied {len(migrations)} migrations to users table")


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
