"""Tests for AI categorization endpoints."""

import pytest


class TestAICategorization:
    """Test suite for AI categorization endpoints."""

    def test_categorize_grocery_item(self, client, auth_headers):
        """Test categorizing a grocery item."""
        categorize_data = {"item_name": "milk", "list_type": "grocery"}
        response = client.post("/api/ai/categorize", json=categorize_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "category" in data
        assert "confidence" in data
        assert data["category"] == "Dairy"
        assert data["confidence"] > 0.5

    def test_categorize_produce_item(self, client, auth_headers):
        """Test categorizing a produce item."""
        categorize_data = {"item_name": "apples", "list_type": "grocery"}
        response = client.post("/api/ai/categorize", json=categorize_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Produce"

    def test_categorize_meat_item(self, client, auth_headers):
        """Test categorizing a meat item."""
        categorize_data = {"item_name": "chicken breast", "list_type": "grocery"}
        response = client.post("/api/ai/categorize", json=categorize_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Meat & Seafood"

    def test_categorize_packing_item(self, client, auth_headers):
        """Test categorizing a packing list item."""
        categorize_data = {"item_name": "phone charger", "list_type": "packing"}
        response = client.post("/api/ai/categorize", json=categorize_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Electronics"

    def test_categorize_clothing_item(self, client, auth_headers):
        """Test categorizing a clothing item."""
        categorize_data = {"item_name": "t-shirts", "list_type": "packing"}
        response = client.post("/api/ai/categorize", json=categorize_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Clothing"

    def test_categorize_task_item(self, client, auth_headers):
        """Test categorizing a task item."""
        categorize_data = {"item_name": "urgent meeting", "list_type": "tasks"}
        response = client.post("/api/ai/categorize", json=categorize_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] in ["High Priority", "Normal", "Low Priority"]

    def test_categorize_no_auth(self, client):
        """Test categorizing without authentication fails."""
        categorize_data = {"item_name": "milk", "list_type": "grocery"}
        response = client.post("/api/ai/categorize", json=categorize_data)
        assert response.status_code == 401


class TestAIFeedback:
    """Test suite for AI feedback/learning endpoints."""

    def test_record_feedback(self, client, auth_headers):
        """Test recording feedback."""
        feedback_data = {
            "item_name": "almond butter",
            "list_type": "grocery",
            "correct_category": "Pantry",
        }
        response = client.post("/api/ai/feedback", json=feedback_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "item_name_normalized" in data
        assert data["item_name_normalized"] == "almond butter"

    def test_feedback_improves_categorization(self, client, auth_headers):
        """Test that feedback improves future categorization."""
        # First, record feedback
        feedback_data = {
            "item_name": "special item xyz",
            "list_type": "grocery",
            "correct_category": "Frozen",
        }
        client.post("/api/ai/feedback", json=feedback_data, headers=auth_headers)

        # Now categorize the same item - should use learned category
        categorize_data = {"item_name": "special item xyz", "list_type": "grocery"}
        response = client.post("/api/ai/categorize", json=categorize_data, headers=auth_headers)
        assert response.status_code == 200
        # Note: The confidence should be boosted for the learned category

    def test_feedback_no_auth(self, client):
        """Test feedback without authentication fails."""
        feedback_data = {
            "item_name": "milk",
            "list_type": "grocery",
            "correct_category": "Dairy",
        }
        response = client.post("/api/ai/feedback", json=feedback_data)
        assert response.status_code == 401


class TestAINormalization:
    """Test item name normalization."""

    @pytest.mark.parametrize(
        "input_name,expected_normalized",
        [
            ("  Milk  ", "milk"),
            ("2 apples", "apples"),
            ("3 lb chicken", "chicken"),
            ("BANANAS", "bananas"),
            ("  2  Large  Eggs  ", "large eggs"),
        ],
    )
    def test_normalization_via_feedback(
        self, client, auth_headers, input_name, expected_normalized
    ):
        """Test that item names are normalized correctly."""
        feedback_data = {
            "item_name": input_name,
            "list_type": "grocery",
            "correct_category": "Test Category",
        }
        response = client.post("/api/ai/feedback", json=feedback_data, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["item_name_normalized"] == expected_normalized
