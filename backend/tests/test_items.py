"""Tests for item endpoints."""

import pytest


@pytest.fixture
def created_list(client, auth_headers, sample_list_data):
    """Create a list and return its data."""
    response = client.post("/api/lists", json=sample_list_data, headers=auth_headers)
    return response.json()


class TestItemEndpoints:
    """Test suite for item endpoints."""

    def test_create_item(self, client, auth_headers, created_list, sample_item_data):
        """Test creating a single item."""
        list_id = created_list["id"]
        response = client.post(
            f"/api/lists/{list_id}/items", json=sample_item_data, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_item_data["name"]
        assert data[0]["quantity"] == sample_item_data["quantity"]
        assert data[0]["is_checked"] is False

    def test_create_item_batch(self, client, auth_headers, created_list):
        """Test creating multiple items at once."""
        list_id = created_list["id"]
        batch_data = {
            "items": [
                {"name": "Apples", "quantity": 6},
                {"name": "Bananas", "quantity": 4},
                {"name": "Oranges", "quantity": 5},
            ]
        }
        response = client.post(
            f"/api/lists/{list_id}/items", json=batch_data, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 3

    def test_get_items(self, client, auth_headers, created_list, sample_item_data):
        """Test getting items from a list."""
        list_id = created_list["id"]
        # Create an item
        client.post(f"/api/lists/{list_id}/items", json=sample_item_data, headers=auth_headers)

        response = client.get(f"/api/lists/{list_id}/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_get_items_filtered(self, client, auth_headers, created_list, sample_item_data):
        """Test getting items with status filter."""
        list_id = created_list["id"]
        # Create an item
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=sample_item_data, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        # Check it
        client.post(f"/api/items/{item_id}/check", headers=auth_headers)

        # Get unchecked items (should be empty)
        response = client.get(
            f"/api/lists/{list_id}/items?status=unchecked", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 0

        # Get checked items (should have 1)
        response = client.get(
            f"/api/lists/{list_id}/items?status=checked", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_update_item(self, client, auth_headers, created_list, sample_item_data):
        """Test updating an item."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=sample_item_data, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        update_data = {"name": "Updated Item", "quantity": 10}
        response = client.put(f"/api/items/{item_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Item"
        assert data["quantity"] == 10

    def test_delete_item(self, client, auth_headers, created_list, sample_item_data):
        """Test deleting an item."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=sample_item_data, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        response = client.delete(f"/api/items/{item_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/lists/{list_id}/items", headers=auth_headers)
        assert len(get_response.json()) == 0

    def test_check_item(self, client, auth_headers, created_list, sample_item_data):
        """Test checking an item."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=sample_item_data, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        response = client.post(f"/api/items/{item_id}/check", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_checked"] is True
        assert data["checked_at"] is not None

    def test_uncheck_item(self, client, auth_headers, created_list, sample_item_data):
        """Test unchecking an item."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=sample_item_data, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        # Check then uncheck
        client.post(f"/api/items/{item_id}/check", headers=auth_headers)
        response = client.post(f"/api/items/{item_id}/uncheck", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_checked"] is False
        assert data["checked_at"] is None

    def test_clear_checked_items(self, client, auth_headers, created_list):
        """Test clearing checked items from a list."""
        list_id = created_list["id"]

        # Create two items
        batch_data = {"items": [{"name": "Item 1"}, {"name": "Item 2"}]}
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=batch_data, headers=auth_headers
        )
        items = create_response.json()

        # Check one item
        client.post(f"/api/items/{items[0]['id']}/check", headers=auth_headers)

        # Clear checked items
        response = client.post(f"/api/lists/{list_id}/clear", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["deleted_count"] == 1

        # Verify only unchecked item remains
        get_response = client.get(f"/api/lists/{list_id}/items", headers=auth_headers)
        remaining = get_response.json()
        assert len(remaining) == 1
        assert remaining[0]["name"] == "Item 2"

    def test_restore_checked_items(self, client, auth_headers, created_list):
        """Test restoring (unchecking) all checked items in a list."""
        list_id = created_list["id"]

        # Create two items
        batch_data = {"items": [{"name": "Item 1"}, {"name": "Item 2"}]}
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=batch_data, headers=auth_headers
        )
        items = create_response.json()

        # Check both items
        client.post(f"/api/items/{items[0]['id']}/check", headers=auth_headers)
        client.post(f"/api/items/{items[1]['id']}/check", headers=auth_headers)

        # Verify both are checked
        get_response = client.get(
            f"/api/lists/{list_id}/items?status=checked", headers=auth_headers
        )
        assert len(get_response.json()) == 2

        # Restore checked items
        response = client.post(f"/api/lists/{list_id}/restore", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["restored_count"] == 2

        # Verify all items are now unchecked
        get_response = client.get(
            f"/api/lists/{list_id}/items?status=unchecked", headers=auth_headers
        )
        assert len(get_response.json()) == 2

        # Verify no items are checked
        get_response = client.get(
            f"/api/lists/{list_id}/items?status=checked", headers=auth_headers
        )
        assert len(get_response.json()) == 0

    def test_restore_clears_timestamps(self, client, auth_headers, created_list):
        """Test that restore properly clears checked_at timestamps."""
        list_id = created_list["id"]

        # Create and check an item
        item_data = {"name": "Test Item"}
        create_response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        # Check the item and verify timestamp is set
        check_response = client.post(f"/api/items/{item_id}/check", headers=auth_headers)
        assert check_response.json()["checked_at"] is not None

        # Restore and verify timestamp is cleared
        client.post(f"/api/lists/{list_id}/restore", headers=auth_headers)

        get_response = client.get(f"/api/lists/{list_id}/items", headers=auth_headers)
        item = get_response.json()[0]
        assert item["is_checked"] is False
        assert item["checked_at"] is None

    def test_restore_no_checked_items(self, client, auth_headers, created_list):
        """Test restore when there are no checked items returns zero count."""
        list_id = created_list["id"]

        # Create an unchecked item
        item_data = {"name": "Unchecked Item"}
        client.post(f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers)

        # Restore should return 0
        response = client.post(f"/api/lists/{list_id}/restore", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["restored_count"] == 0

    def test_restore_empty_list(self, client, auth_headers, created_list):
        """Test restore on an empty list returns zero count."""
        list_id = created_list["id"]

        response = client.post(f"/api/lists/{list_id}/restore", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["restored_count"] == 0

    def test_create_item_with_magnitude(self, client, auth_headers, created_list):
        """Test creating an item with magnitude set."""
        list_id = created_list["id"]
        item_data = {"name": "Big Task", "magnitude": "L"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data[0]["magnitude"] == "L"

    def test_update_item_magnitude(self, client, auth_headers, created_list):
        """Test updating item magnitude through its lifecycle."""
        list_id = created_list["id"]
        # Create item without magnitude
        create_response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Task"}, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]
        assert create_response.json()[0]["magnitude"] is None

        # Set to S
        response = client.put(
            f"/api/items/{item_id}", json={"magnitude": "S"}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["magnitude"] == "S"

        # Change to M
        response = client.put(
            f"/api/items/{item_id}", json={"magnitude": "M"}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["magnitude"] == "M"

        # Clear magnitude
        response = client.put(
            f"/api/items/{item_id}", json={"magnitude": None}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["magnitude"] is None

    def test_invalid_magnitude_rejected(self, client, auth_headers, created_list):
        """Test that invalid magnitude values are rejected."""
        list_id = created_list["id"]
        item_data = {"name": "Bad Item", "magnitude": "X"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_item_response_includes_assigned_fields(self, client, auth_headers, created_list):
        """Test that item response includes assigned_to fields."""
        list_id = created_list["id"]
        response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Test"}, headers=auth_headers
        )
        data = response.json()[0]
        assert "assigned_to" in data
        assert data["assigned_to"] is None
        assert "assigned_to_name" in data
        assert data["assigned_to_name"] is None


class TestCategoryEndpoints:
    """Test suite for category endpoints."""

    def test_get_categories(self, client, auth_headers, created_list):
        """Test getting categories for a list."""
        list_id = created_list["id"]
        response = client.get(f"/api/lists/{list_id}/categories", headers=auth_headers)
        assert response.status_code == 200
        # Grocery list should have default categories
        assert len(response.json()) > 0

    def test_create_category(self, client, auth_headers, created_list):
        """Test creating a new category."""
        list_id = created_list["id"]
        category_data = {"name": "New Category"}
        response = client.post(
            f"/api/lists/{list_id}/categories", json=category_data, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Category"

    def test_create_duplicate_category(self, client, auth_headers, created_list):
        """Test creating a duplicate category fails."""
        list_id = created_list["id"]
        # Try to create a category with same name as existing
        existing_name = created_list["categories"][0]["name"]
        category_data = {"name": existing_name}
        response = client.post(
            f"/api/lists/{list_id}/categories", json=category_data, headers=auth_headers
        )
        assert response.status_code == 409

    def test_update_category(self, client, auth_headers, created_list):
        """Test updating a category."""
        category_id = created_list["categories"][0]["id"]
        update_data = {"name": "Renamed Category"}
        response = client.put(
            f"/api/categories/{category_id}", json=update_data, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Renamed Category"

    def test_delete_category(self, client, auth_headers, created_list):
        """Test deleting a category."""
        list_id = created_list["id"]
        category_id = created_list["categories"][0]["id"]

        response = client.delete(f"/api/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/lists/{list_id}/categories", headers=auth_headers)
        category_ids = [c["id"] for c in get_response.json()]
        assert category_id not in category_ids

    def test_reorder_categories(self, client, auth_headers, created_list):
        """Test reordering categories."""
        list_id = created_list["id"]
        categories = created_list["categories"]

        # Reverse the order
        reversed_ids = [c["id"] for c in reversed(categories)]
        reorder_data = {"category_ids": reversed_ids}

        response = client.post(
            f"/api/lists/{list_id}/categories/reorder", json=reorder_data, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()

        # Verify new order
        for idx, cat in enumerate(data):
            assert cat["sort_order"] == idx
