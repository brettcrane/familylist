"""Tests for read-only SQL query endpoint."""

import pytest


class TestQuerySQL:
    """Test suite for the query_sql endpoint."""

    def test_simple_select(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 1 AS num, 'hello' AS msg"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["columns"] == ["num", "msg"]
        assert data["rows"] == [[1, "hello"]]
        assert data["row_count"] == 1
        assert data["truncated"] is False

    def test_select_from_table(self, client, auth_headers):
        # Create a list first
        client.post("/api/lists", json={"name": "Test", "type": "grocery"}, headers=auth_headers)
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT name, type FROM lists LIMIT 1"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "name" in data["columns"]
        assert data["row_count"] >= 1

    def test_blocks_insert(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "INSERT INTO lists (id, name, type) VALUES ('x', 'x', 'grocery')"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "SELECT" in response.json()["detail"]

    def test_blocks_update(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "UPDATE lists SET name = 'hacked'"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_blocks_delete(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "DELETE FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_blocks_drop(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "DROP TABLE lists"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_blocks_pragma(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "PRAGMA table_info(lists)"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_allows_with_cte(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "WITH t AS (SELECT 1 AS x) SELECT * FROM t"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_blocks_write_in_cte(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "WITH t AS (SELECT 1) DELETE FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_truncation_at_250(self, client, auth_headers):
        # Generate 300 rows with a recursive CTE
        response = client.post(
            "/api/query/sql",
            json={"sql": "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 300) SELECT x FROM cnt"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["row_count"] == 250
        assert data["truncated"] is True

    def test_empty_sql_rejected(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_requires_auth(self, client):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 1"},
        )
        assert response.status_code == 401
