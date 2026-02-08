"""Tests for user endpoints."""


class TestUserLookup:
    """Test suite for user lookup endpoint."""

    def test_lookup_by_name(self, client, auth_headers, db_session):
        """Test looking up users by partial name match."""
        from app.models import User

        user = User(clerk_user_id="clerk_lookup_1", display_name="Brett Crane")
        db_session.add(user)
        db_session.commit()

        response = client.get("/api/users/lookup?name=Brett", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["display_name"] == "Brett Crane"
        assert data[0]["id"] == user.id
        # Should not expose email
        assert "email" not in data[0]

    def test_lookup_case_insensitive(self, client, auth_headers, db_session):
        """Test that name lookup is case insensitive."""
        from app.models import User

        user = User(clerk_user_id="clerk_lookup_2", display_name="Aly Crane")
        db_session.add(user)
        db_session.commit()

        response = client.get("/api/users/lookup?name=aly", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["display_name"] == "Aly Crane"

    def test_lookup_partial_match(self, client, auth_headers, db_session):
        """Test that partial name matches work."""
        from app.models import User

        db_session.add(User(clerk_user_id="clerk_l3", display_name="Brett Crane"))
        db_session.add(User(clerk_user_id="clerk_l4", display_name="Aly Crane"))
        db_session.commit()

        response = client.get("/api/users/lookup?name=Crane", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_lookup_no_results(self, client, auth_headers):
        """Test lookup with no matching users."""
        response = client.get("/api/users/lookup?name=Nobody", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 0

    def test_lookup_requires_name(self, client, auth_headers):
        """Test that name parameter is required."""
        response = client.get("/api/users/lookup", headers=auth_headers)
        assert response.status_code == 422

    def test_lookup_requires_auth(self, client):
        """Test that lookup requires authentication."""
        response = client.get("/api/users/lookup?name=Brett")
        assert response.status_code == 401
