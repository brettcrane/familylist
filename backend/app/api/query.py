"""Read-only SQL query endpoint for efficient MCP access.

Security model (defense-in-depth):
  1. PRAGMA query_only = ON — SQLite-level enforcement, cannot be bypassed via SQL
  2. Input validation — blocks obvious write attempts with friendly error messages
  3. Semicolon blocking — prevents multi-statement injection
  4. progress_handler timeout — kills runaway queries after 5 seconds
  5. Row limit — caps results at 250 rows
"""

import logging
import re
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, sessionmaker

from app.auth import get_auth
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/query", tags=["query"], dependencies=[Depends(get_auth)])

MAX_ROWS = 250
QUERY_TIMEOUT_SECONDS = 5
# SQLite progress_handler is called every N virtual machine instructions.
# 1000 gives sub-millisecond granularity without measurable overhead.
_PROGRESS_HANDLER_INTERVAL = 1000

# Write keywords that should never appear as standalone tokens in a query.
_WRITE_KEYWORDS = frozenset({
    "insert", "update", "delete", "drop", "alter", "create",
    "replace", "attach", "detach", "reindex", "vacuum", "pragma",
})


def _setup_readonly_pragmas(dbapi_connection, connection_record):
    """Set query_only on every connection from the read-only pool."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA query_only = ON")
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


# Read-only engine (lazy singleton)
_ro_engine = None
_ro_session_factory = None


def _get_ro_engine():
    global _ro_engine
    if _ro_engine is None:
        settings = get_settings()
        _ro_engine = create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            echo=False,
        )
        event.listen(_ro_engine, "connect", _setup_readonly_pragmas)
    return _ro_engine


def _get_ro_session_factory():
    global _ro_session_factory
    if _ro_session_factory is None:
        _ro_session_factory = sessionmaker(
            autocommit=False, autoflush=False, bind=_get_ro_engine()
        )
    return _ro_session_factory


def set_ro_engine(engine):
    """Override the read-only engine (for testing)."""
    global _ro_engine, _ro_session_factory
    _ro_engine = engine
    _ro_session_factory = None


def get_readonly_db():
    """FastAPI dependency: yields a read-only database session."""
    factory = _get_ro_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()


def _normalize_sql(sql: str) -> str:
    """Collapse all whitespace (tabs, newlines, etc.) to single spaces."""
    return re.sub(r"\s+", " ", sql.strip())


def _validate_readonly(sql: str) -> None:
    """Validate that SQL is read-only. Raises ValueError on violation.

    This is a UX layer for friendly error messages. The real enforcement
    is PRAGMA query_only = ON at the SQLite level.
    """
    if ";" in sql:
        raise ValueError("Multiple statements are not allowed")

    normalized = _normalize_sql(sql).lower()
    first_word = normalized.split()[0] if normalized else ""

    if first_word not in ("select", "with"):
        raise ValueError("Only SELECT queries are allowed")

    # Tokenize on word boundaries and check for write keywords
    tokens = set(re.findall(r"\b[a-z]+\b", normalized))
    found = tokens & _WRITE_KEYWORDS
    if found:
        raise ValueError(f"Write operation not allowed: {', '.join(sorted(found))}")


class QueryRequest(BaseModel):
    sql: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Read-only SQL query (SELECT only)",
    )

    @field_validator("sql")
    @classmethod
    def must_be_readonly(cls, v: str) -> str:
        _validate_readonly(v)
        return v


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    truncated: bool = Field(
        description=f"True if results were capped at {MAX_ROWS} rows"
    )


@router.post("/sql", response_model=QueryResponse, operation_id="query_sql")
def query_sql(data: QueryRequest, db: Session = Depends(get_readonly_db)):
    """Execute a read-only SQL query against the database.

    Returns up to 250 rows. Only SELECT statements are allowed.
    Tables: users, lists, categories, items, list_shares, category_learnings.
    """
    sql = data.sql.strip()

    try:
        # Set a real timeout via progress_handler on the raw SQLite connection
        raw_conn = db.connection().connection.dbapi_connection
        deadline = time.monotonic() + QUERY_TIMEOUT_SECONDS

        def _timeout_check():
            if time.monotonic() > deadline:
                return 1  # non-zero cancels the query
            return 0

        raw_conn.set_progress_handler(_timeout_check, _PROGRESS_HANDLER_INTERVAL)
        try:
            start = time.monotonic()
            result = db.execute(text(sql))
            elapsed_ms = (time.monotonic() - start) * 1000

            if elapsed_ms > 1000:
                logger.info("Slow query (%dms): %.200s", int(elapsed_ms), sql)

            columns = list(result.keys())
            rows = [list(row) for row in result.fetchmany(MAX_ROWS + 1)]
            truncated = len(rows) > MAX_ROWS
            if truncated:
                rows = rows[:MAX_ROWS]

            return QueryResponse(
                columns=columns,
                rows=rows,
                row_count=len(rows),
                truncated=truncated,
            )
        finally:
            raw_conn.set_progress_handler(None, 0)

    except OperationalError as e:
        err_msg = str(getattr(e, "orig", e)).lower()
        if "interrupted" in err_msg:
            logger.warning("Query timed out after %ds: %.200s", QUERY_TIMEOUT_SECONDS, sql)
            raise HTTPException(
                status_code=408, detail=f"Query timed out after {QUERY_TIMEOUT_SECONDS}s"
            )
        if "query_only" in err_msg or "read-only" in err_msg or "attempt to write" in err_msg:
            logger.warning("Write attempt blocked by query_only: %.200s", sql)
            raise HTTPException(status_code=403, detail="Write operations are not allowed")
        if any(phrase in err_msg for phrase in (
            "no such table", "no such column", "syntax error",
            "near", "incomplete input", "unrecognized token",
        )):
            raise HTTPException(status_code=400, detail=f"SQL error: {e.orig}")
        logger.error("Database error during query: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Database error")
    except ProgrammingError as e:
        raise HTTPException(status_code=400, detail=f"SQL error: {e.orig}")
    except Exception as e:
        logger.error("Unexpected query error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
