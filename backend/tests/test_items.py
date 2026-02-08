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
            f"/api/lists/{list_id}/items?is_checked=unchecked", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 0

        # Get checked items (should have 1)
        response = client.get(
            f"/api/lists/{list_id}/items?is_checked=checked", headers=auth_headers
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
            f"/api/lists/{list_id}/items?is_checked=checked", headers=auth_headers
        )
        assert len(get_response.json()) == 2

        # Restore checked items
        response = client.post(f"/api/lists/{list_id}/restore", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["restored_count"] == 2

        # Verify all items are now unchecked
        get_response = client.get(
            f"/api/lists/{list_id}/items?is_checked=unchecked", headers=auth_headers
        )
        assert len(get_response.json()) == 2

        # Verify no items are checked
        get_response = client.get(
            f"/api/lists/{list_id}/items?is_checked=checked", headers=auth_headers
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

    def test_invalid_magnitude_on_update(self, client, auth_headers, created_list):
        """Test that invalid magnitude values are rejected on update."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Task"}, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        response = client.put(
            f"/api/items/{item_id}", json={"magnitude": "X"}, headers=auth_headers
        )
        assert response.status_code == 422

    def test_create_item_with_assigned_to(self, client, auth_headers, created_list, db_session):
        """Test creating an item assigned to a valid user."""
        from app.models import ListShare, User

        # Create a user and give them access to the list
        user = User(clerk_user_id="clerk_assignee", display_name="Jane Doe")
        db_session.add(user)
        db_session.commit()

        list_id = created_list["id"]
        share = ListShare(list_id=list_id, user_id=user.id, permission="edit")
        db_session.add(share)
        db_session.commit()

        item_data = {"name": "Assigned Task", "assigned_to": user.id}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()[0]
        assert data["assigned_to"] == user.id
        assert data["assigned_to_name"] == "Jane Doe"

    def test_update_item_assigned_to(self, client, auth_headers, created_list, db_session):
        """Test updating an item's assignment to a valid user."""
        from app.models import ListShare, User

        user = User(clerk_user_id="clerk_assignee_2", display_name="Bob Smith")
        db_session.add(user)
        db_session.commit()

        list_id = created_list["id"]
        share = ListShare(list_id=list_id, user_id=user.id, permission="edit")
        db_session.add(share)
        db_session.commit()
        create_response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Task"}, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]
        assert create_response.json()[0]["assigned_to"] is None

        # Assign to user
        response = client.put(
            f"/api/items/{item_id}", json={"assigned_to": user.id}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["assigned_to"] == user.id
        assert response.json()["assigned_to_name"] == "Bob Smith"

        # Unassign
        response = client.put(
            f"/api/items/{item_id}", json={"assigned_to": None}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["assigned_to"] is None
        assert response.json()["assigned_to_name"] is None

    def test_create_item_with_invalid_assigned_to(self, client, auth_headers, created_list):
        """Test that assigning to a non-existent user returns 422."""
        list_id = created_list["id"]
        item_data = {"name": "Bad Assignment", "assigned_to": "00000000-0000-0000-0000-000000000000"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 422
        assert "user not found" in response.json()["detail"].lower()

    def test_update_item_with_invalid_assigned_to(self, client, auth_headers, created_list):
        """Test that updating assignment to a non-existent user returns 422."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Task"}, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        response = client.put(
            f"/api/items/{item_id}",
            json={"assigned_to": "00000000-0000-0000-0000-000000000000"},
            headers=auth_headers,
        )
        assert response.status_code == 422
        assert "user not found" in response.json()["detail"].lower()

    def test_batch_create_with_invalid_assigned_to(self, client, auth_headers, created_list):
        """Test that batch create rejects items with invalid assigned_to."""
        list_id = created_list["id"]
        batch_data = {
            "items": [
                {"name": "Good Item"},
                {"name": "Bad Item", "assigned_to": "00000000-0000-0000-0000-000000000000"},
            ]
        }
        response = client.post(
            f"/api/lists/{list_id}/items", json=batch_data, headers=auth_headers
        )
        assert response.status_code == 422

        # Verify no items leaked (batch is atomic)
        items_response = client.get(f"/api/lists/{list_id}/items", headers=auth_headers)
        assert len(items_response.json()) == 0

    def test_batch_create_with_valid_magnitude_and_assigned_to(
        self, client, auth_headers, created_list, db_session
    ):
        """Test that batch create preserves magnitude and assigned_to on each item."""
        from app.models import User, ListShare

        # Create a user and share the list with them
        user = User(clerk_user_id="clerk_batch_test", display_name="Batch User")
        db_session.add(user)
        db_session.commit()

        list_id = created_list["id"]
        share = ListShare(list_id=list_id, user_id=user.id, permission="edit")
        db_session.add(share)
        db_session.commit()

        batch_data = {
            "items": [
                {"name": "Small Task", "magnitude": "S"},
                {"name": "Large Assigned", "magnitude": "L", "assigned_to": user.id},
                {"name": "Plain Item"},
            ]
        }
        response = client.post(
            f"/api/lists/{list_id}/items", json=batch_data, headers=auth_headers
        )
        assert response.status_code == 201
        items = response.json()
        assert len(items) == 3

        assert items[0]["magnitude"] == "S"
        assert items[0]["assigned_to"] is None

        assert items[1]["magnitude"] == "L"
        assert items[1]["assigned_to"] == user.id
        assert items[1]["assigned_to_name"] == "Batch User"

        assert items[2]["magnitude"] is None
        assert items[2]["assigned_to"] is None


    # ========================================================================
    # Task management fields: priority, due_date, status, created_by
    # ========================================================================

    def test_create_item_with_priority(self, client, auth_headers, created_list):
        """Test creating an item with priority."""
        list_id = created_list["id"]
        item_data = {"name": "Urgent Task", "priority": "urgent"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 201
        assert response.json()[0]["priority"] == "urgent"

    def test_invalid_priority_rejected(self, client, auth_headers, created_list):
        """Test that invalid priority values are rejected."""
        list_id = created_list["id"]
        item_data = {"name": "Bad", "priority": "critical"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_create_item_with_due_date(self, client, auth_headers, created_list):
        """Test creating an item with due date."""
        list_id = created_list["id"]
        item_data = {"name": "Due Task", "due_date": "2026-03-15"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 201
        assert response.json()[0]["due_date"] == "2026-03-15"

    def test_invalid_due_date_format_rejected(self, client, auth_headers, created_list):
        """Test that invalid due date format is rejected."""
        list_id = created_list["id"]
        item_data = {"name": "Bad", "due_date": "March 15"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_create_item_with_status(self, client, auth_headers, created_list):
        """Test creating an item with status."""
        list_id = created_list["id"]
        item_data = {"name": "In Progress", "status": "in_progress"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 201
        assert response.json()[0]["status"] == "in_progress"

    def test_invalid_status_rejected(self, client, auth_headers, created_list):
        """Test that invalid status values are rejected."""
        list_id = created_list["id"]
        item_data = {"name": "Bad", "status": "cancelled"}
        response = client.post(
            f"/api/lists/{list_id}/items", json=item_data, headers=auth_headers
        )
        assert response.status_code == 422

    def test_status_done_syncs_is_checked(self, client, auth_headers, created_list):
        """Test that setting status=done also sets is_checked=True."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items",
            json={"name": "Task", "status": "open"},
            headers=auth_headers,
        )
        item_id = create_response.json()[0]["id"]

        response = client.put(
            f"/api/items/{item_id}", json={"status": "done"}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "done"
        assert response.json()["is_checked"] is True

    def test_status_open_syncs_is_checked_false(self, client, auth_headers, created_list):
        """Test that setting status=open sets is_checked=False."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items",
            json={"name": "Task", "status": "open"},
            headers=auth_headers,
        )
        item_id = create_response.json()[0]["id"]

        # Set to done first
        client.put(f"/api/items/{item_id}", json={"status": "done"}, headers=auth_headers)

        # Set back to in_progress
        response = client.put(
            f"/api/items/{item_id}", json={"status": "in_progress"}, headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"
        assert response.json()["is_checked"] is False

    def test_check_syncs_status_to_done(self, client, auth_headers, created_list):
        """Test that checking a task item syncs status to done."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items",
            json={"name": "Task", "status": "open"},
            headers=auth_headers,
        )
        item_id = create_response.json()[0]["id"]

        response = client.post(f"/api/items/{item_id}/check", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "done"
        assert response.json()["is_checked"] is True

    def test_uncheck_syncs_status_to_open(self, client, auth_headers, created_list):
        """Test that unchecking a task item syncs status to open."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items",
            json={"name": "Task", "status": "open"},
            headers=auth_headers,
        )
        item_id = create_response.json()[0]["id"]

        # Check it first
        client.post(f"/api/items/{item_id}/check", headers=auth_headers)

        response = client.post(f"/api/items/{item_id}/uncheck", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "open"
        assert response.json()["is_checked"] is False

    def test_grocery_item_no_status_sync(self, client, auth_headers, created_list):
        """Test that checking a grocery item (no status) doesn't set status."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Milk"}, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        response = client.post(f"/api/items/{item_id}/check", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] is None
        assert response.json()["is_checked"] is True

    def test_item_response_includes_task_fields(self, client, auth_headers, created_list):
        """Test that item response includes all new task fields."""
        list_id = created_list["id"]
        response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Test"}, headers=auth_headers
        )
        data = response.json()[0]
        assert "priority" in data
        assert "due_date" in data
        assert "status" in data
        assert "created_by" in data
        assert "created_by_name" in data

    def test_update_priority_lifecycle(self, client, auth_headers, created_list):
        """Test setting, changing, and clearing priority."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Task"}, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        # Set priority
        response = client.put(
            f"/api/items/{item_id}", json={"priority": "high"}, headers=auth_headers
        )
        assert response.json()["priority"] == "high"

        # Change priority
        response = client.put(
            f"/api/items/{item_id}", json={"priority": "low"}, headers=auth_headers
        )
        assert response.json()["priority"] == "low"

        # Clear priority
        response = client.put(
            f"/api/items/{item_id}", json={"priority": None}, headers=auth_headers
        )
        assert response.json()["priority"] is None

    def test_invalid_priority_on_update(self, client, auth_headers, created_list):
        """Test that invalid priority values are rejected on update."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items", json={"name": "Task"}, headers=auth_headers
        )
        item_id = create_response.json()[0]["id"]

        response = client.put(
            f"/api/items/{item_id}", json={"priority": "critical"}, headers=auth_headers
        )
        assert response.status_code == 422


class TestItemFiltering:
    """Test suite for item filtering query params."""

    def test_filter_by_task_status(self, client, auth_headers, created_list):
        """Test filtering items by task status."""
        list_id = created_list["id"]
        # Create items with different statuses
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Open Task", "status": "open"},
                {"name": "In Progress", "status": "in_progress"},
                {"name": "Done Task", "status": "done"},
                {"name": "Grocery Item"},
            ]},
            headers=auth_headers,
        )

        # Filter for open items
        response = client.get(
            f"/api/lists/{list_id}/items?status=open", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Open Task"

    def test_filter_by_comma_separated_status(self, client, auth_headers, created_list):
        """Test filtering by multiple statuses."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Open", "status": "open"},
                {"name": "In Progress", "status": "in_progress"},
                {"name": "Done", "status": "done"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?status=open,in_progress", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_filter_by_priority(self, client, auth_headers, created_list):
        """Test filtering items by priority."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Urgent", "priority": "urgent"},
                {"name": "Low", "priority": "low"},
                {"name": "No Priority"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?priority=urgent", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Urgent"

    def test_filter_by_comma_separated_priority(self, client, auth_headers, created_list):
        """Test filtering by multiple priorities."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Urgent", "priority": "urgent"},
                {"name": "High", "priority": "high"},
                {"name": "Low", "priority": "low"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?priority=urgent,high", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_filter_by_due_before(self, client, auth_headers, created_list):
        """Test filtering items due before a date."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Soon", "due_date": "2026-02-10"},
                {"name": "Later", "due_date": "2026-06-15"},
                {"name": "No Date"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?due_before=2026-03-01", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Soon"

    def test_filter_by_due_after(self, client, auth_headers, created_list):
        """Test filtering items due after a date."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Soon", "due_date": "2026-02-10"},
                {"name": "Later", "due_date": "2026-06-15"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?due_after=2026-03-01", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Later"

    def test_filter_by_assigned_to(self, client, auth_headers, created_list, db_session):
        """Test filtering items by assigned_to."""
        from app.models import ListShare, User

        user = User(clerk_user_id="clerk_filter_test", display_name="Filter User")
        db_session.add(user)
        db_session.commit()

        list_id = created_list["id"]
        share = ListShare(list_id=list_id, user_id=user.id, permission="edit")
        db_session.add(share)
        db_session.commit()

        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Assigned", "assigned_to": user.id},
                {"name": "Unassigned"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?assigned_to={user.id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Assigned"

    def test_filter_combines_multiple_params(self, client, auth_headers, created_list):
        """Test combining multiple filter parameters."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Urgent Open", "priority": "urgent", "status": "open"},
                {"name": "Urgent Done", "priority": "urgent", "status": "done"},
                {"name": "Low Open", "priority": "low", "status": "open"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?priority=urgent&status=open",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Urgent Open"

    def test_is_checked_param_replaces_status(self, client, auth_headers, created_list):
        """Test that is_checked param works for checked/unchecked filtering."""
        list_id = created_list["id"]
        create_response = client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [{"name": "Item 1"}, {"name": "Item 2"}]},
            headers=auth_headers,
        )
        item_id = create_response.json()[0]["id"]
        client.post(f"/api/items/{item_id}/check", headers=auth_headers)

        # is_checked=checked
        response = client.get(
            f"/api/lists/{list_id}/items?is_checked=checked", headers=auth_headers
        )
        assert len(response.json()) == 1

        # is_checked=unchecked
        response = client.get(
            f"/api/lists/{list_id}/items?is_checked=unchecked", headers=auth_headers
        )
        assert len(response.json()) == 1

    def test_filter_by_created_by(self, client, auth_headers, created_list, db_session):
        """Test filtering items by created_by user ID."""
        from app.models import User

        creator = User(clerk_user_id="clerk_creator_test", display_name="Creator")
        db_session.add(creator)
        db_session.commit()

        list_id = created_list["id"]
        # Create items - one will have created_by set via direct DB manipulation
        # since API key auth doesn't set created_by
        from app.models import Item
        item = Item(
            list_id=list_id, name="AI Created", created_by=creator.id, sort_order=0
        )
        db_session.add(item)
        db_session.commit()

        # Create a regular item via API (created_by will be None under API key auth)
        client.post(
            f"/api/lists/{list_id}/items",
            json={"name": "Manual Item"},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?created_by={creator.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "AI Created"

    def test_filter_due_date_range(self, client, auth_headers, created_list):
        """Test combining due_before and due_after for a date range."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"items": [
                {"name": "Early", "due_date": "2026-01-15"},
                {"name": "In Range", "due_date": "2026-03-15"},
                {"name": "Late", "due_date": "2026-06-15"},
            ]},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/lists/{list_id}/items?due_after=2026-02-01&due_before=2026-04-01",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "In Range"

    def test_filter_due_date_boundary_inclusive(self, client, auth_headers, created_list):
        """Test that due_before and due_after include the boundary date itself."""
        list_id = created_list["id"]
        client.post(
            f"/api/lists/{list_id}/items",
            json={"name": "Boundary", "due_date": "2026-03-15"},
            headers=auth_headers,
        )

        # due_before=2026-03-15 should include items due ON that date (<=)
        response = client.get(
            f"/api/lists/{list_id}/items?due_before=2026-03-15",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

        # due_after=2026-03-15 should include items due ON that date (>=)
        response = client.get(
            f"/api/lists/{list_id}/items?due_after=2026-03-15",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_filter_invalid_status_rejected(self, client, auth_headers, created_list):
        """Test that invalid status filter values return 422."""
        list_id = created_list["id"]
        response = client.get(
            f"/api/lists/{list_id}/items?status=cancelled",
            headers=auth_headers,
        )
        assert response.status_code == 422
        assert "Invalid status" in response.json()["detail"]

    def test_filter_invalid_priority_rejected(self, client, auth_headers, created_list):
        """Test that invalid priority filter values return 422."""
        list_id = created_list["id"]
        response = client.get(
            f"/api/lists/{list_id}/items?priority=critical",
            headers=auth_headers,
        )
        assert response.status_code == 422
        assert "Invalid priority" in response.json()["detail"]


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
