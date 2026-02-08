"""Tests for MCP server endpoint."""


class TestMCPEndpoint:
    """Test suite for MCP server integration."""

    def test_mcp_endpoint_exists(self, client):
        """Test that the MCP endpoint is mounted and responds."""
        response = client.get("/mcp")
        # MCP endpoint should respond (not 404)
        assert response.status_code != 404

    def test_operation_ids_set(self, client):
        """Test that key endpoints have explicit operation_ids by checking OpenAPI schema."""
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
            "get_lists",
            "create_list",
            "get_list",
            "update_list",
            "delete_list",
            "get_items",
            "create_items",
            "update_item",
            "delete_item",
            "check_item",
            "uncheck_item",
            "lookup_users",
            "get_categories",
            "create_category",
            "health_check",
        }
        for op_id in expected_ids:
            assert op_id in operation_ids, f"Missing operation_id: {op_id}"
