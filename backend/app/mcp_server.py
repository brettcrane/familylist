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

    # Hide the bulk get_* read tools. They return every field on every item
    # with no pagination, which overflows MCP clients' per-tool-result token
    # limits on large lists (get_list/get_items embed the full item array;
    # get_lists is banned by policy). Reads must go through query_sql, whose
    # description carries the full schema so even clients without our skills
    # (e.g. Hermes) can use it. Writes and small lookups (get_categories,
    # get_me, lookup_users) stay available.
    #
    # We post-filter rather than pass exclude_operations because fastapi-mcp
    # 0.4.0 unions exclude_operations with exclude_tags instead of intersecting
    # them, so the two can't be combined — the tag filter would re-add these.
    # list_tools() returns self.tools and call_tool() reads self.operation_map,
    # both at call time, so trimming them here fully removes the tools.
    _HIDDEN_TOOLS = {"get_lists", "get_list", "get_items"}
    mcp.tools = [t for t in mcp.tools if t.name not in _HIDDEN_TOOLS]
    mcp.operation_map = {
        op_id: details
        for op_id, details in mcp.operation_map.items()
        if op_id not in _HIDDEN_TOOLS
    }

    mcp.mount_http(mount_path="/mcp")
    mcp.mount_sse(mount_path="/sse")
    logger.info("MCP server mounted: Streamable HTTP at /mcp, legacy SSE at /sse")
    return mcp
