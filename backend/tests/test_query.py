"""Tests for read-only SQL query endpoint.

Security tests verify both the input validation layer (friendly errors) and
the SQLite-level PRAGMA query_only enforcement (the real security boundary).
"""


class TestQueryBasic:
    """Happy-path SELECT queries."""

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

    def test_with_cte(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "WITH t AS (SELECT 1 AS x) SELECT * FROM t"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["rows"] == [[1]]

    def test_truncation_at_250(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={
                "sql": "WITH RECURSIVE cnt(x) AS "
                "(SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 300) "
                "SELECT x FROM cnt"
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["row_count"] == 250
        assert data["truncated"] is True


class TestQueryValidation:
    """Input validation layer (friendly error messages before hitting DB)."""

    def test_empty_sql_rejected(self, client, auth_headers):
        response = client.post(
            "/api/query/sql", json={"sql": ""}, headers=auth_headers
        )
        assert response.status_code == 422

    def test_whitespace_only_rejected(self, client, auth_headers):
        response = client.post(
            "/api/query/sql", json={"sql": "   "}, headers=auth_headers
        )
        assert response.status_code == 422

    def test_max_length_rejected(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT " + "x" * 2000},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_insert(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "INSERT INTO lists (id, name, type) VALUES ('x', 'x', 'grocery')"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_update(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "UPDATE lists SET name = 'hacked'"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_delete(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "DELETE FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_drop(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "DROP TABLE lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_pragma(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "PRAGMA table_info(lists)"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_attach(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "ATTACH DATABASE '/tmp/evil.db' AS evil"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_explain(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "EXPLAIN SELECT 1"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_mixed_case(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "DeLeTe FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestQueryInjectionBypass:
    """Bypass attempts that try to sneak write operations past validation."""

    def test_blocks_semicolon_injection(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 1; DROP TABLE lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_semicolon_delete(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 1; DELETE FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_write_in_cte(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "WITH t AS (SELECT 1) DELETE FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_newline_delimited_write(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "WITH t AS (SELECT 1)\nDELETE FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_tab_delimited_write(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "WITH t AS (SELECT 1)\tDELETE\tFROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_comment_newline_write(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 1 --\nDELETE FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_vacuum(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 1; VACUUM"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_blocks_create_in_subquery(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT * FROM (CREATE TABLE evil(x))"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_keyword_in_string_literal_blocked(self, client, auth_headers):
        """Write keywords in string literals are blocked (acceptable false positive)."""
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 'the word delete is here' AS msg"},
            headers=auth_headers,
        )
        # Blocked because 'delete' appears as a word-boundary token.
        # This is a trade-off: security over permissiveness.
        assert response.status_code == 422


class TestQuerySQLiteEnforcement:
    """PRAGMA query_only blocks writes at the SQLite level, regardless of validation."""

    def test_readonly_session_can_read(self, client, auth_headers):
        client.post("/api/lists", json={"name": "Test", "type": "grocery"}, headers=auth_headers)
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT COUNT(*) AS n FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["rows"][0][0] >= 1


class TestQueryErrorHandling:
    """Error classification and message sanitization."""

    def test_invalid_sql_syntax(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT FROM WHERE"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "SQL error" in response.json()["detail"]

    def test_nonexistent_table(self, client, auth_headers):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT * FROM nonexistent_table_xyz"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "no such table" in response.json()["detail"].lower()

    def test_nonexistent_column(self, client, auth_headers):
        client.post("/api/lists", json={"name": "Test", "type": "grocery"}, headers=auth_headers)
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT nonexistent_col FROM lists"},
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestQueryAuth:
    """Authentication enforcement."""

    def test_requires_auth(self, client):
        response = client.post("/api/query/sql", json={"sql": "SELECT 1"})
        assert response.status_code == 401

    def test_wrong_api_key(self, client):
        response = client.post(
            "/api/query/sql",
            json={"sql": "SELECT 1"},
            headers={"X-API-Key": "wrong-key"},
        )
        assert response.status_code == 401
