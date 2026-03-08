"""Read-only SQL query endpoint for efficient MCP access."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_auth
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/query", tags=["query"], dependencies=[Depends(get_auth)])

MAX_ROWS = 250
QUERY_TIMEOUT_MS = 5000

# Disallowed statements (case-insensitive check on stripped query)
_WRITE_PREFIXES = (
    "insert", "update", "delete", "drop", "alter", "create",
    "replace", "attach", "detach", "reindex", "vacuum", "pragma",
)


class QueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=2000, description="SELECT query to execute")


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool = Field(description="True if results were capped at 250 rows")


@router.post("/sql", response_model=QueryResponse, operation_id="query_sql")
def query_sql(data: QueryRequest, db: Session = Depends(get_db)):
    """Execute a read-only SQL query against the database.

    Returns up to 250 rows. Only SELECT statements are allowed.
    Tables: users, lists, categories, items, list_shares, category_learnings.
    """
    sql = data.sql.strip()

    # Block non-SELECT statements
    first_word = sql.split()[0].lower() if sql.split() else ""
    if first_word in _WRITE_PREFIXES or first_word not in ("select", "with", "explain"):
        raise HTTPException(status_code=400, detail="Only SELECT queries are allowed")

    # Defense-in-depth: check for write keywords after CTEs or subqueries
    sql_lower = sql.lower()
    for prefix in _WRITE_PREFIXES:
        # Check for standalone write keywords (not inside column/table names)
        if f" {prefix} " in f" {sql_lower} ":
            raise HTTPException(status_code=400, detail=f"Write operation '{prefix}' not allowed")

    try:
        start = time.monotonic()
        result = db.execute(text(sql))
        elapsed_ms = (time.monotonic() - start) * 1000

        if elapsed_ms > QUERY_TIMEOUT_MS:
            logger.warning(f"Slow query ({elapsed_ms:.0f}ms): {sql[:100]}")

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
    except Exception as e:
        logger.warning(f"Query failed: {e}")
        raise HTTPException(status_code=400, detail=f"Query error: {e}")
