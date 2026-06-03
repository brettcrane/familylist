"""Tests for MCP server endpoint."""


class TestMCPEndpoint:
    """Test suite for MCP server integration."""

    def test_mcp_route_registered(self, client):
        """Test that the Streamable HTTP /mcp route is registered for POST.

        Streamable-HTTP-only clients (e.g. Hermes) POST JSON-RPC to /mcp,
        so the route must exist and accept POST.
        """
        from app.main import app

        mcp_post = [
            r
            for r in app.routes
            if getattr(r, "path", None) == "/mcp" and "POST" in getattr(r, "methods", set())
        ]
        assert mcp_post, "No POST /mcp route found — Streamable HTTP transport not mounted"

    def test_legacy_sse_route_registered(self, client):
        """Test that the legacy SSE transport is retained at /sse as a fallback."""
        from app.main import app

        sse_paths = {
            getattr(r, "path", None)
            for r in app.routes
            if getattr(r, "path", "").startswith("/sse")
        }
        assert "/sse" in sse_paths, "Legacy SSE connection route /sse not found"
        assert "/sse/messages/" in sse_paths, "Legacy SSE messages route not found"

    def test_operation_ids_set(self, client):
        """Test that all API endpoints have explicit operation_ids in the OpenAPI schema."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        paths = schema["paths"]

        # Collect all operation_ids
        operation_ids = set()
        for path_obj in paths.values():
            for method_obj in path_obj.values():
                if isinstance(method_obj, dict) and "operationId" in method_obj:
                    operation_ids.add(method_obj["operationId"])

        # Verify key endpoints have clean operation_ids
        expected_ids = {
            # Lists
            "get_lists",
            "create_list",
            "get_list",
            "update_list",
            "delete_list",
            "duplicate_list",
            # Items
            "get_items",
            "create_item",
            "create_items",
            "update_item",
            "delete_item",
            "check_item",
            "uncheck_item",
            "clear_checked_items",
            "restore_checked_items",
            # Categories
            "get_categories",
            "create_category",
            "update_category",
            "delete_category",
            "reorder_categories",
            # Users
            "get_me",
            "lookup_users",
            "get_user",
            # AI
            "categorize_item",
            "record_feedback",
            "parse_natural_language",
            # Shares
            "get_list_shares",
            "share_list",
            "update_share_permission",
            "revoke_share",
            # Health
            "health_check",
        }
        for op_id in expected_ids:
            assert op_id in operation_ids, f"Missing operation_id: {op_id}"

    def test_operation_ids_unique(self, client):
        """Test that no two endpoints share the same operation_id."""
        response = client.get("/openapi.json")
        schema = response.json()
        paths = schema["paths"]

        seen: dict[str, str] = {}  # operation_id -> "METHOD /path"
        for path, path_obj in paths.items():
            for method, method_obj in path_obj.items():
                if isinstance(method_obj, dict) and "operationId" in method_obj:
                    op_id = method_obj["operationId"]
                    route = f"{method.upper()} {path}"
                    assert op_id not in seen, (
                        f"Duplicate operation_id '{op_id}': {seen[op_id]} and {route}"
                    )
                    seen[op_id] = route
