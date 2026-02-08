"""MCP server integration for Claude Cowork."""

import logging

from fastapi import FastAPI
from fastapi_mcp import FastApiMCP

logger = logging.getLogger(__name__)


def setup_mcp(app: FastAPI) -> FastApiMCP:
    """Mount MCP server on the FastAPI app.

    Exposes all /api/* endpoints as MCP tools that Claude Cowork
    can call via the FamilyList plugin. Auth headers are forwarded
    so MCP tool calls go through the existing auth middleware.
    """
    mcp = FastApiMCP(
        app,
        name="familylist",
        description="Family list and task management with AI categorization",
        describe_all_responses=True,
        # Forward auth headers so MCP tool calls use existing auth
        headers=["authorization", "x-api-key"],
    )
    mcp.mount_http()  # Mounts at /mcp by default
    logger.info("MCP server mounted at /mcp")
    return mcp
