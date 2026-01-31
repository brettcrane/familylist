"""Tests for list sharing endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.clerk_auth import ClerkUser
from app.database import get_db
from app.dependencies import get_current_user, require_user
from app.models import User
from app.services import user_service


def create_test_user(db_session: Session, clerk_user_id: str, display_name: str, email: str) -> User:
    """Create a test user in the database."""
    clerk_user = ClerkUser(
        clerk_user_id=clerk_user_id,
        display_name=display_name,
        email=email,
    )
    return user_service.get_or_create_user(db_session, clerk_user)


@pytest.fixture
def test_user(db_session: Session) -> User:
    """Create a test user for authentication."""
    return create_test_user(db_session, "test-user-123", "Test User", "test@example.com")


@pytest.fixture
def other_user(db_session: Session) -> User:
    """Create another user for sharing tests."""
    return create_test_user(db_session, "other-user-456", "Other User", "other@example.com")


@pytest.fixture
def third_user(db_session: Session) -> User:
    """Create a third user for testing."""
    return create_test_user(db_session, "third-user-789", "Third User", "third@example.com")


@pytest.fixture
def user_client(db_session: Session, test_user: User, auth_headers: dict):
    """Create a test client that authenticates as the test user."""
    from app.main import app

    def override_get_db():
        yield db_session

    def override_require_user():
        return test_user

    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_user] = override_require_user
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app, raise_server_exceptions=False) as test_client:
        # Create a wrapper that adds auth headers to all requests
        class AuthenticatedClient:
            def __init__(self, client, headers):
                self._client = client
                self._headers = headers

            def get(self, url, **kwargs):
                kwargs.setdefault('headers', {}).update(self._headers)
                return self._client.get(url, **kwargs)

            def post(self, url, **kwargs):
                kwargs.setdefault('headers', {}).update(self._headers)
                return self._client.post(url, **kwargs)

            def put(self, url, **kwargs):
                kwargs.setdefault('headers', {}).update(self._headers)
                return self._client.put(url, **kwargs)

            def patch(self, url, **kwargs):
                kwargs.setdefault('headers', {}).update(self._headers)
                return self._client.patch(url, **kwargs)

            def delete(self, url, **kwargs):
                kwargs.setdefault('headers', {}).update(self._headers)
                return self._client.delete(url, **kwargs)

        yield AuthenticatedClient(test_client, auth_headers)

    app.dependency_overrides.clear()


class TestShareEndpoints:
    """Test suite for /api/lists/{list_id}/shares endpoints."""

    def test_share_list_by_email(
        self, user_client, sample_list_data, other_user
    ):
        """Test sharing a list with another user by email."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        assert create_response.status_code == 201
        list_id = create_response.json()["id"]

        # Share with other user
        share_data = {"email": "other@example.com", "permission": "edit"}
        response = user_client.post(
            f"/api/lists/{list_id}/shares", json=share_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["email"] == "other@example.com"
        assert data["permission"] == "edit"

    def test_share_list_user_not_found(
        self, user_client, sample_list_data
    ):
        """Test sharing a list with a non-existent user fails."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Try to share with non-existent user
        share_data = {"email": "nonexistent@example.com", "permission": "view"}
        response = user_client.post(
            f"/api/lists/{list_id}/shares", json=share_data
        )
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    def test_share_list_invalid_email(
        self, user_client, sample_list_data
    ):
        """Test sharing a list with an invalid email fails."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Try to share with invalid email
        share_data = {"email": "not-an-email", "permission": "view"}
        response = user_client.post(
            f"/api/lists/{list_id}/shares", json=share_data
        )
        assert response.status_code == 422  # Validation error

    def test_share_list_already_shared(
        self, user_client, sample_list_data, other_user
    ):
        """Test sharing a list that's already shared with the user fails."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Share with other user
        share_data = {"email": "other@example.com", "permission": "edit"}
        user_client.post(f"/api/lists/{list_id}/shares", json=share_data)

        # Try to share again
        response = user_client.post(
            f"/api/lists/{list_id}/shares", json=share_data
        )
        assert response.status_code == 400
        assert "already shared" in response.json()["detail"]

    def test_get_list_shares(
        self, user_client, sample_list_data, other_user
    ):
        """Test getting all shares for a list."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Share with other user
        share_data = {"email": "other@example.com", "permission": "edit"}
        user_client.post(f"/api/lists/{list_id}/shares", json=share_data)

        # Get shares
        response = user_client.get(f"/api/lists/{list_id}/shares")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["user"]["email"] == "other@example.com"

    def test_get_list_shares_empty(
        self, user_client, sample_list_data
    ):
        """Test getting shares for a list with no shares."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Get shares
        response = user_client.get(f"/api/lists/{list_id}/shares")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    def test_update_share_permission(
        self, user_client, sample_list_data, other_user
    ):
        """Test updating a share's permission."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Share with other user
        share_data = {"email": "other@example.com", "permission": "view"}
        share_response = user_client.post(
            f"/api/lists/{list_id}/shares", json=share_data
        )
        share_id = share_response.json()["id"]

        # Update permission
        update_data = {"permission": "edit"}
        response = user_client.patch(
            f"/api/lists/{list_id}/shares/{share_id}",
            json=update_data,
        )
        assert response.status_code == 200
        assert response.json()["permission"] == "edit"

    def test_revoke_share(
        self, user_client, sample_list_data, other_user
    ):
        """Test revoking a share."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Share with other user
        share_data = {"email": "other@example.com", "permission": "edit"}
        share_response = user_client.post(
            f"/api/lists/{list_id}/shares", json=share_data
        )
        share_id = share_response.json()["id"]

        # Revoke share
        response = user_client.delete(
            f"/api/lists/{list_id}/shares/{share_id}"
        )
        assert response.status_code == 204

        # Verify share is gone
        get_response = user_client.get(f"/api/lists/{list_id}/shares")
        assert len(get_response.json()) == 0

    def test_revoke_share_not_found(
        self, user_client, sample_list_data
    ):
        """Test revoking a non-existent share fails."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Try to revoke non-existent share
        response = user_client.delete(
            f"/api/lists/{list_id}/shares/nonexistent-id"
        )
        assert response.status_code == 404


class TestSharePermissions:
    """Test permission-related behavior for shares."""

    def test_share_count_in_list_response(
        self, user_client, sample_list_data, other_user, third_user
    ):
        """Test that share_count is included in list response."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Initially no shares
        list_response = user_client.get(f"/api/lists/{list_id}")
        assert list_response.json()["share_count"] == 0

        # Share with two users
        user_client.post(
            f"/api/lists/{list_id}/shares",
            json={"email": "other@example.com", "permission": "edit"},
        )
        user_client.post(
            f"/api/lists/{list_id}/shares",
            json={"email": "third@example.com", "permission": "view"},
        )

        # Check share_count
        list_response = user_client.get(f"/api/lists/{list_id}")
        assert list_response.json()["share_count"] == 2

    def test_default_permission_is_view(
        self, user_client, sample_list_data, other_user
    ):
        """Test that default permission when not specified is 'view'."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Share without specifying permission
        share_data = {"email": "other@example.com"}
        response = user_client.post(
            f"/api/lists/{list_id}/shares", json=share_data
        )
        assert response.status_code == 201
        assert response.json()["permission"] == "view"

    def test_permission_values(
        self, user_client, sample_list_data, other_user
    ):
        """Test all valid permission values."""
        # Create a list
        create_response = user_client.post(
            "/api/lists", json=sample_list_data
        )
        list_id = create_response.json()["id"]

        # Test all permission levels
        for permission in ["view", "edit"]:
            # Delete any existing shares first (cleanup)
            shares_response = user_client.get(
                f"/api/lists/{list_id}/shares"
            )
            for share in shares_response.json():
                user_client.delete(
                    f"/api/lists/{list_id}/shares/{share['id']}"
                )

            share_data = {"email": "other@example.com", "permission": permission}
            response = user_client.post(
                f"/api/lists/{list_id}/shares", json=share_data
            )
            assert response.status_code == 201
            assert response.json()["permission"] == permission
