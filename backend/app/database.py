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
    SQLite doesn't support ALTER COLUMN, so we recreate tables when needed.
    """
    import logging
    logger = logging.getLogger(__name__)

    engine = get_engine()
    with engine.connect() as conn:
        # ONE-TIME MIGRATION: Clear old data for fresh Clerk auth setup
        # Check if we need to do this (migration marker)
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='_migration_clerk_reset_done'"
        ))
        if not result.fetchone():
            logger.info("Running one-time data reset for Clerk auth migration...")
            try:
                # Clear all data from tables (order matters due to foreign keys)
                conn.execute(text("DELETE FROM items"))
                conn.execute(text("DELETE FROM categories"))
                conn.execute(text("DELETE FROM list_shares"))
                conn.execute(text("DELETE FROM lists"))
                conn.execute(text("DELETE FROM users"))
                conn.execute(text("DELETE FROM category_learnings"))

                # Mark migration as done
                conn.execute(text("CREATE TABLE _migration_clerk_reset_done (done INTEGER)"))
                conn.execute(text("INSERT INTO _migration_clerk_reset_done VALUES (1)"))
                conn.commit()
                logger.info("Data reset complete - ready for fresh Clerk auth")
            except Exception as e:
                logger.error(f"Failed to reset data: {e}")
                conn.rollback()
                # Don't raise - continue with other migrations

        # Check if users table exists and has the right columns
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns_info = {row[1]: {"type": row[2], "notnull": row[3]} for row in result.fetchall()}
        columns = set(columns_info.keys())

        if not columns:
            return  # Table doesn't exist yet, create_all will handle it

        # Check if we have the old ha_user_id column with NOT NULL constraint
        # This requires recreating the table since SQLite doesn't support DROP COLUMN NOT NULL
        if "ha_user_id" in columns and columns_info["ha_user_id"]["notnull"]:
            logger.info("Migrating users table: removing ha_user_id NOT NULL constraint")
            try:
                # SQLite migration: create new table, copy data, drop old, rename
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS users_new (
                        id VARCHAR(36) PRIMARY KEY,
                        clerk_user_id VARCHAR(255) UNIQUE,
                        display_name VARCHAR(255) NOT NULL DEFAULT 'User',
                        email VARCHAR(255),
                        avatar_url TEXT,
                        created_at TEXT,
                        updated_at TEXT
                    )
                """))

                # Copy data from old table (only columns that exist in both)
                conn.execute(text("""
                    INSERT OR IGNORE INTO users_new (id, clerk_user_id, display_name, email, avatar_url, created_at, updated_at)
                    SELECT id,
                           COALESCE(clerk_user_id, ha_user_id),
                           COALESCE(display_name, 'User'),
                           email,
                           avatar_url,
                           created_at,
                           updated_at
                    FROM users
                """))

                conn.execute(text("DROP TABLE users"))
                conn.execute(text("ALTER TABLE users_new RENAME TO users"))
                conn.commit()
                logger.info("Successfully migrated users table to new schema")
                return  # Migration complete

            except Exception as e:
                logger.error(f"Failed to migrate users table: {e}")
                conn.rollback()
                raise

        # Standard column additions for tables without ha_user_id issue
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

        # Add new columns to items table
        result = conn.execute(text("PRAGMA table_info(items)"))
        item_columns = {row[1] for row in result.fetchall()}

        item_migrations = []
        if "magnitude" not in item_columns:
            item_migrations.append(
                "ALTER TABLE items ADD COLUMN magnitude VARCHAR(1)"
            )
        if "assigned_to" not in item_columns:
            item_migrations.append(
                "ALTER TABLE items ADD COLUMN assigned_to VARCHAR(36) REFERENCES users(id)"
            )
        if "priority" not in item_columns:
            item_migrations.append(
                "ALTER TABLE items ADD COLUMN priority VARCHAR(6)"
            )
        if "due_date" not in item_columns:
            item_migrations.append(
                "ALTER TABLE items ADD COLUMN due_date VARCHAR(10)"
            )
        if "status" not in item_columns:
            item_migrations.append(
                "ALTER TABLE items ADD COLUMN status VARCHAR(11)"
            )
        if "created_by" not in item_columns:
            item_migrations.append(
                "ALTER TABLE items ADD COLUMN created_by VARCHAR(36) REFERENCES users(id)"
            )
        if "unit" not in item_columns:
            item_migrations.append(
                "ALTER TABLE items ADD COLUMN unit VARCHAR(20)"
            )

        for migration in item_migrations:
            try:
                conn.execute(text(migration))
                logger.info(f"Migration applied: {migration}")
            except Exception as e:
                logger.warning(f"Item migration skipped (may already exist): {e}")

        if item_migrations:
            conn.commit()
            logger.info(f"Applied {len(item_migrations)} migrations to items table")

        # Seed Claude system user if not exists.
        # This user row is used as the created_by value for items created via the
        # Cowork MCP integration. The frontend shows an "AI" badge for items with
        # this created_by ID (see CLAUDE_SYSTEM_USER_ID in models.py and api.ts).
        from app.models import CLAUDE_SYSTEM_USER_ID

        try:
            result = conn.execute(text(
                "SELECT id FROM users WHERE id = :id"
            ), {"id": CLAUDE_SYSTEM_USER_ID})
            if not result.fetchone():
                from app.models import utc_now
                now = utc_now()
                conn.execute(text(
                    "INSERT INTO users (id, clerk_user_id, display_name, email, created_at, updated_at) "
                    "VALUES (:id, :clerk_id, :name, :email, :now, :now)"
                ), {
                    "id": CLAUDE_SYSTEM_USER_ID,
                    "clerk_id": "claude-system",
                    "name": "Claude",
                    "email": "claude@system.local",
                    "now": now,
                })
                conn.commit()
                logger.info("Created Claude system user")
        except Exception as e:
            conn.rollback()
            logger.warning(f"Claude system user seed skipped: {e}")


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
