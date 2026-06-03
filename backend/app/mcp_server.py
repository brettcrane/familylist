"""MCP (Model Context Protocol) server, exposing API endpoints as tools for AI agents."""

import logging

from fastapi import FastAPI
from fastapi_mcp import FastApiMCP

logger = logging.getLogger(__name__)


def setup_mcp(app: FastAPI) -> FastApiMCP:
    """Mount MCP server on the FastAPI app.

    Exposes API endpoints as MCP tools that any MCP client (e.g. Claude
    Cowork) can call. Auth headers are forwarded from the MCP HTTP
    request into each tool's internal API call, so existing auth
    middleware applies unchanged — this is transport-independent, so
    X-API-Key enforcement covers both transports below.

    Dual-transport:
    - Streamable HTTP on /mcp (primary). Serves Streamable-HTTP-only
      clients, and mcp-remote (http-first) reconnects here transparently.
    - Legacy SSE on /sse (fallback). Retained for any pure-SSE client.
      SSE cannot share /mcp with Streamable HTTP (GET would collide), so
      it moves to its own path.

    Must be called after router includes but before the SPA catch-all,
    since FastApiMCP snapshots routes at construction time.
    """
    mcp = FastApiMCP(
        app,
        name="familylist",
        description="Family list and task management with AI categorization",
        describe_all_responses=True,
        exclude_tags=["stream", "push"],
        headers=["authorization", "x-api-key"],
    )
    mcp.mount_http(mount_path="/mcp")
    mcp.mount_sse(mount_path="/sse")
    logger.info("MCP server mounted: Streamable HTTP at /mcp, legacy SSE at /sse")
    return mcp
