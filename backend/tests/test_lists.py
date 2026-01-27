"""Tests for list endpoints."""

import pytest


class TestListEndpoints:
    """Test suite for /api/lists endpoints."""

    def test_health_check(self, client):
        """Test health check endpoint (no auth required)."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

    def test_create_list(self, client, auth_headers, sample_list_data):
        """Test creating a new list."""
        response = client.post("/api/lists", json=sample_list_data, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_list_data["name"]
        assert data["type"] == sample_list_data["type"]
        assert "id" in data
        # Should have default categories for grocery list
        assert len(data["categories"]) > 0

    def test_create_list_no_auth(self, client, sample_list_data):
        """Test creating a list without authentication fails."""
        response = client.post("/api/lists", json=sample_list_data)
        assert response.status_code == 401

    def test_create_list_invalid_auth(self, client, sample_list_data):
        """Test creating a list with invalid API key fails."""
        response = client.post(
            "/api/lists", json=sample_list_data, headers={"X-API-Key": "wrong-key"}
        )
        assert response.status_code == 401

    def test_get_lists(self, client, auth_headers, sample_list_data):
        """Test getting all lists."""
        # Create a list first
        client.post("/api/lists", json=sample_list_data, headers=auth_headers)

        response = client.get("/api/lists", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_list_data["name"]

    def test_get_list_by_id(self, client, auth_headers, sample_list_data):
        """Test getting a specific list."""
        # Create a list
        create_response = client.post("/api/lists", json=sample_list_data, headers=auth_headers)
        list_id = create_response.json()["id"]

        response = client.get(f"/api/lists/{list_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == list_id
        assert data["name"] == sample_list_data["name"]
        assert "categories" in data
        assert "items" in data

    def test_get_list_not_found(self, client, auth_headers):
        """Test getting a non-existent list."""
        response = client.get("/api/lists/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404

    def test_update_list(self, client, auth_headers, sample_list_data):
        """Test updating a list."""
        # Create a list
        create_response = client.post("/api/lists", json=sample_list_data, headers=auth_headers)
        list_id = create_response.json()["id"]

        # Update it
        update_data = {"name": "Updated List Name"}
        response = client.put(f"/api/lists/{list_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated List Name"

    def test_delete_list(self, client, auth_headers, sample_list_data):
        """Test deleting a list."""
        # Create a list
        create_response = client.post("/api/lists", json=sample_list_data, headers=auth_headers)
        list_id = create_response.json()["id"]

        # Delete it
        response = client.delete(f"/api/lists/{list_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/lists/{list_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_duplicate_list(self, client, auth_headers, sample_list_data):
        """Test duplicating a list."""
        # Create a list
        create_response = client.post("/api/lists", json=sample_list_data, headers=auth_headers)
        list_id = create_response.json()["id"]

        # Duplicate it
        duplicate_data = {"name": "Duplicated List", "as_template": False}
        response = client.post(
            f"/api/lists/{list_id}/duplicate", json=duplicate_data, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Duplicated List"
        assert data["id"] != list_id
        # Should have same categories
        original = create_response.json()
        assert len(data["categories"]) == len(original["categories"])


class TestListTypes:
    """Test different list types."""

    @pytest.mark.parametrize(
        "list_type,expected_categories",
        [
            ("grocery", ["Produce", "Dairy", "Meat & Seafood"]),
            ("packing", ["Clothing", "Toiletries", "Electronics"]),
            ("tasks", ["High Priority", "Normal", "Low Priority"]),
        ],
    )
    def test_list_type_categories(
        self, client, auth_headers, list_type, expected_categories
    ):
        """Test that list types get appropriate default categories."""
        list_data = {"name": f"Test {list_type} list", "type": list_type}
        response = client.post("/api/lists", json=list_data, headers=auth_headers)
        assert response.status_code == 201

        categories = [c["name"] for c in response.json()["categories"]]
        for expected in expected_categories:
            assert expected in categories
