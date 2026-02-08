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
    middleware applies unchanged.

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
    logger.info("MCP server mounted at /mcp")
    return mcp
