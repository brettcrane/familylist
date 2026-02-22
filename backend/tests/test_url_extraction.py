"""Tests for URL recipe extraction and unit of measure features."""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.llm_service import LLMParsingService, ParsedItem


# ============================================================================
# ParsedItem unit tests
# ============================================================================


class TestParsedItem:
    """Test ParsedItem class construction and serialization."""

    def test_default_values(self):
        item = ParsedItem(name="milk")
        assert item.name == "milk"
        assert item.quantity == 1
        assert item.category == ""
        assert item.unit == "each"

    def test_with_unit(self):
        item = ParsedItem(name="flour", quantity=2.0, unit="cup")
        assert item.name == "flour"
        assert item.quantity == 2.0
        assert item.unit == "cup"

    def test_to_dict_includes_unit(self):
        item = ParsedItem(name="sugar", quantity=0.5, unit="cup")
        d = item.to_dict()
        assert d == {
            "name": "sugar",
            "quantity": 0.5,
            "category": "",
            "unit": "cup",
        }

    def test_float_quantity(self):
        item = ParsedItem(name="butter", quantity=0.25)
        assert item.quantity == 0.25


# ============================================================================
# JSON-LD extraction tests
# ============================================================================


class TestJsonLdExtraction:
    """Test JSON-LD recipe extraction from HTML."""

    def setup_method(self):
        # Create a fresh instance for each test (bypass singleton)
        self.service = LLMParsingService.__new__(LLMParsingService)

    def test_standard_recipe_jsonld(self):
        html = '''
        <html><head>
        <script type="application/ld+json">
        {
            "@type": "Recipe",
            "name": "Chocolate Cake",
            "recipeIngredient": ["2 cups flour", "1 cup sugar", "3 eggs"]
        }
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == ["2 cups flour", "1 cup sugar", "3 eggs"]
        assert title == "Chocolate Cake"

    def test_recipe_in_graph(self):
        html = '''
        <html><head>
        <script type="application/ld+json">
        {
            "@graph": [
                {"@type": "WebPage", "name": "Page"},
                {"@type": "Recipe", "name": "Pasta", "recipeIngredient": ["1 lb pasta", "2 cups sauce"]}
            ]
        }
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == ["1 lb pasta", "2 cups sauce"]
        assert title == "Pasta"

    def test_recipe_type_as_list(self):
        html = '''
        <html><head>
        <script type="application/ld+json">
        {
            "@type": ["WebPage", "Recipe"],
            "name": "Salad",
            "recipeIngredient": ["lettuce", "tomato"]
        }
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == ["lettuce", "tomato"]
        assert title == "Salad"

    def test_no_recipe_returns_empty(self):
        html = '''
        <html><head>
        <script type="application/ld+json">
        {"@type": "WebPage", "name": "Some Page"}
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == []
        assert title is None

    def test_malformed_json_skipped(self):
        html = '''
        <html><head>
        <script type="application/ld+json">
        {not valid json}
        </script>
        <script type="application/ld+json">
        {"@type": "Recipe", "name": "Good Recipe", "recipeIngredient": ["1 egg"]}
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == ["1 egg"]
        assert title == "Good Recipe"

    def test_no_jsonld_at_all(self):
        html = "<html><body><h1>No recipes here</h1></body></html>"
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == []
        assert title is None

    def test_recipe_without_ingredients(self):
        html = '''
        <html><head>
        <script type="application/ld+json">
        {"@type": "Recipe", "name": "Empty Recipe"}
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == []
        assert title is None

    def test_null_type_handled(self):
        """TypeError from @type: null should be caught gracefully."""
        html = '''
        <html><head>
        <script type="application/ld+json">
        {"@type": null, "name": "Bad Data"}
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == []
        assert title is None


# ============================================================================
# Page title extraction tests
# ============================================================================


class TestPageTitleExtraction:
    """Test HTML title extraction."""

    def setup_method(self):
        self.service = LLMParsingService.__new__(LLMParsingService)

    def test_simple_title(self):
        html = "<html><head><title>My Recipe</title></head></html>"
        assert self.service._extract_page_title(html) == "My Recipe"

    def test_title_with_site_suffix(self):
        html = "<html><head><title>Chocolate Cake | AllRecipes</title></head></html>"
        assert self.service._extract_page_title(html) == "Chocolate Cake"

    def test_no_title(self):
        html = "<html><body>No title here</body></html>"
        assert self.service._extract_page_title(html) is None


# ============================================================================
# SSRF protection tests
# ============================================================================


class TestSsrfProtection:
    """Test URL validation against internal networks."""

    def setup_method(self):
        self.service = LLMParsingService.__new__(LLMParsingService)

    @patch("app.services.llm_service.socket.getaddrinfo")
    def test_rejects_localhost(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [(None, None, None, None, ("127.0.0.1", 80))]
        with pytest.raises(ValueError, match="public address"):
            self.service._validate_url_target("http://localhost/recipe")

    @patch("app.services.llm_service.socket.getaddrinfo")
    def test_rejects_private_ip(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [(None, None, None, None, ("192.168.1.1", 80))]
        with pytest.raises(ValueError, match="public address"):
            self.service._validate_url_target("http://192.168.1.1/admin")

    @patch("app.services.llm_service.socket.getaddrinfo")
    def test_rejects_metadata_endpoint(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [(None, None, None, None, ("169.254.169.254", 80))]
        with pytest.raises(ValueError, match="public address"):
            self.service._validate_url_target("http://169.254.169.254/latest/meta-data/")

    def test_rejects_no_hostname(self):
        with pytest.raises(ValueError, match="no hostname"):
            self.service._validate_url_target("http://")

    @patch("app.services.llm_service.socket.getaddrinfo", side_effect=Exception("DNS failed"))
    def test_rejects_unresolvable(self, mock_getaddrinfo):
        """Unresolvable hostnames raise ValueError."""
        from socket import gaierror
        with patch("app.services.llm_service.socket.getaddrinfo", side_effect=gaierror("Name not found")):
            with pytest.raises(ValueError, match="resolve"):
                self.service._validate_url_target("http://nonexistent.invalid/recipe")

    @patch("app.services.llm_service.socket.getaddrinfo")
    def test_allows_public_ip(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [(None, None, None, None, ("93.184.216.34", 80))]
        # Should not raise
        self.service._validate_url_target("http://example.com/recipe")


# ============================================================================
# Extract-URL endpoint tests
# ============================================================================


class TestExtractUrlEndpoint:
    """Test the POST /ai/extract-url API endpoint."""

    def test_no_auth_returns_401(self, client):
        response = client.post("/api/ai/extract-url", json={
            "url": "https://example.com/recipe",
            "list_type": "grocery",
        })
        assert response.status_code == 401

    def test_non_grocery_returns_422(self, client, auth_headers):
        response = client.post("/api/ai/extract-url", json={
            "url": "https://example.com/recipe",
            "list_type": "packing",
        }, headers=auth_headers)
        assert response.status_code == 422
        assert "grocery" in response.json()["detail"].lower()

    def test_invalid_url_scheme(self, client, auth_headers):
        response = client.post("/api/ai/extract-url", json={
            "url": "ftp://example.com/recipe",
            "list_type": "grocery",
        }, headers=auth_headers)
        assert response.status_code == 422

    def test_url_too_short(self, client, auth_headers):
        response = client.post("/api/ai/extract-url", json={
            "url": "http://a",
            "list_type": "grocery",
        }, headers=auth_headers)
        assert response.status_code == 422


# ============================================================================
# Unit field CRUD tests
# ============================================================================


class TestUnitField:
    """Test item creation/update with unit field."""

    def _create_list(self, client, auth_headers):
        response = client.post("/api/lists", json={
            "name": "Test Grocery",
            "type": "grocery",
        }, headers=auth_headers)
        return response.json()["id"]

    def test_create_item_with_unit(self, client, auth_headers):
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Flour",
            "quantity": 2,
            "unit": "cup",
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Flour"
        assert data["quantity"] == 2
        assert data["unit"] == "cup"

    def test_create_item_without_unit(self, client, auth_headers):
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Eggs",
            "quantity": 12,
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["unit"] is None

    def test_create_item_with_invalid_unit(self, client, auth_headers):
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Stuff",
            "quantity": 1,
            "unit": "bucket",
        }, headers=auth_headers)
        assert response.status_code == 422

    def test_create_item_fractional_quantity(self, client, auth_headers):
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Butter",
            "quantity": 0.5,
            "unit": "cup",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["quantity"] == 0.5

    def test_quantity_zero_rejected(self, client, auth_headers):
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Nothing",
            "quantity": 0,
        }, headers=auth_headers)
        assert response.status_code == 422

    def test_update_item_unit(self, client, auth_headers):
        list_id = self._create_list(client, auth_headers)
        # Create item
        create_resp = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Milk",
            "quantity": 1,
        }, headers=auth_headers)
        item_id = create_resp.json()["id"]

        # Update to add unit
        update_resp = client.put(f"/api/items/{item_id}", json={
            "unit": "gallon",
        }, headers=auth_headers)
        assert update_resp.status_code == 200
        assert update_resp.json()["unit"] == "gallon"

    def test_batch_create_with_units(self, client, auth_headers):
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items/batch", json={
            "items": [
                {"name": "Flour", "quantity": 2, "unit": "cup"},
                {"name": "Sugar", "quantity": 0.5, "unit": "cup"},
                {"name": "Eggs", "quantity": 3},
            ],
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 3
        assert data[0]["unit"] == "cup"
        assert data[1]["unit"] == "cup"
        assert data[2]["unit"] is None

    def test_list_items_include_unit(self, client, auth_headers):
        """Unit field appears in list-with-items response."""
        list_id = self._create_list(client, auth_headers)
        client.post(f"/api/lists/{list_id}/items", json={
            "name": "Flour",
            "quantity": 2,
            "unit": "cup",
        }, headers=auth_headers)

        response = client.get(f"/api/lists/{list_id}", headers=auth_headers)
        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) == 1
        assert items[0]["unit"] == "cup"
