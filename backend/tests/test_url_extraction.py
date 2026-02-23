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

    def test_freeform_unit_accepted(self):
        """Any string is valid as a unit — not restricted to enum."""
        item = ParsedItem(name="olive oil", quantity=2, unit="tablespoons")
        assert item.unit == "tablespoons"


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

    def test_recipe_in_top_level_array(self):
        """JSON-LD can be a top-level array — common on some sites."""
        html = '''
        <html><head>
        <script type="application/ld+json">
        [
            {"@type": "WebPage", "name": "Page"},
            {"@type": "Recipe", "name": "Soup", "recipeIngredient": ["1 onion"]}
        ]
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert ingredients == ["1 onion"]
        assert title == "Soup"

    def test_non_string_ingredients_coerced(self):
        """recipeIngredient with non-string values should be coerced to strings."""
        html = '''
        <html><head>
        <script type="application/ld+json">
        {"@type": "Recipe", "name": "Odd", "recipeIngredient": [42, "1 egg"]}
        </script>
        </head></html>
        '''
        ingredients, title = self.service._extract_jsonld_recipe(html)
        assert len(ingredients) == 2
        assert ingredients[0] == "42"
        assert ingredients[1] == "1 egg"


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

    def test_whitespace_only_title(self):
        html = "<html><head><title>   </title></head></html>"
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
    def test_rejects_10_network(self, mock_getaddrinfo):
        """10.x.x.x (common in cloud VPCs) should be rejected."""
        mock_getaddrinfo.return_value = [(None, None, None, None, ("10.0.0.1", 80))]
        with pytest.raises(ValueError, match="public address"):
            self.service._validate_url_target("http://internal-service/api")

    @patch("app.services.llm_service.socket.getaddrinfo")
    def test_rejects_ipv6_loopback(self, mock_getaddrinfo):
        """IPv6 loopback (::1) should be rejected."""
        mock_getaddrinfo.return_value = [(None, None, None, None, ("::1", 80, 0, 0))]
        with pytest.raises(ValueError, match="public address"):
            self.service._validate_url_target("http://localhost/recipe")

    @patch("app.services.llm_service.socket.getaddrinfo")
    def test_rejects_metadata_endpoint(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [(None, None, None, None, ("169.254.169.254", 80))]
        with pytest.raises(ValueError, match="public address"):
            self.service._validate_url_target("http://169.254.169.254/latest/meta-data/")

    def test_rejects_no_hostname(self):
        with pytest.raises(ValueError, match="no hostname"):
            self.service._validate_url_target("http://")

    def test_rejects_unresolvable(self):
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

    @patch("app.services.llm_service.socket.getaddrinfo")
    def test_unexpected_exception_becomes_value_error(self, mock_getaddrinfo):
        """Non-DNS exceptions in validation are converted to ValueError."""
        mock_getaddrinfo.side_effect = RuntimeError("unexpected")
        with pytest.raises(ValueError, match="Could not validate"):
            self.service._validate_url_target("http://example.com/recipe")


# ============================================================================
# _fetch_url tests
# ============================================================================


class TestFetchUrl:
    """Test URL fetching with SSRF, size limits, and redirect validation."""

    def setup_method(self):
        self.service = LLMParsingService.__new__(LLMParsingService)

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_rejects_non_html_content_type(self, mock_validate, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_redirect = False
        mock_response.headers = {"Content-Type": "application/pdf"}
        mock_get.return_value = mock_response
        with pytest.raises(ValueError, match="web page"):
            self.service._fetch_url("https://example.com/file.pdf")

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_rejects_oversized_streaming(self, mock_validate, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_redirect = False
        mock_response.headers = {"Content-Type": "text/html"}
        # Simulate streaming 3MB in 8KB chunks
        chunk = b"x" * 8192
        mock_response.iter_content.return_value = iter([chunk] * 400)  # ~3.2MB
        mock_get.return_value = mock_response
        with pytest.raises(ValueError, match="too large"):
            self.service._fetch_url("https://example.com/huge")

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_rejects_oversized_content_length(self, mock_validate, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_redirect = False
        mock_response.headers = {"Content-Type": "text/html", "Content-Length": "10000000"}
        mock_get.return_value = mock_response
        with pytest.raises(ValueError, match="too large"):
            self.service._fetch_url("https://example.com/huge")

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_redirect_validates_each_hop(self, mock_validate, mock_get):
        """Each redirect hop must pass SSRF validation."""
        # First response: redirect
        redirect_response = MagicMock()
        redirect_response.is_redirect = True
        redirect_response.headers = {"Location": "http://evil.internal/secret"}

        # Second call: the redirect target (after validation)
        final_response = MagicMock()
        final_response.is_redirect = False
        final_response.status_code = 200
        final_response.headers = {"Content-Type": "text/html"}
        final_response.iter_content.return_value = iter([b"<html></html>"])
        final_response.encoding = "utf-8"

        mock_get.side_effect = [redirect_response, final_response]

        # Make validate raise on the redirect target
        def validate_side_effect(url):
            if "evil.internal" in url:
                raise ValueError("URL must point to a public address")
        mock_validate.side_effect = validate_side_effect

        with pytest.raises(ValueError, match="public address"):
            self.service._fetch_url("https://example.com/recipe")

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_timeout_gives_friendly_error(self, mock_validate, mock_get):
        import requests as req
        mock_get.side_effect = req.Timeout()
        with pytest.raises(ValueError, match="too long"):
            self.service._fetch_url("https://example.com/slow")

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_connection_error_gives_friendly_message(self, mock_validate, mock_get):
        import requests as req
        mock_get.side_effect = req.ConnectionError()
        with pytest.raises(ValueError, match="Could not connect"):
            self.service._fetch_url("https://example.com/down")

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_too_many_redirects_gives_friendly_error(self, mock_validate, mock_get):
        """Redirect limit exhaustion produces a clear error, not a silent empty result."""
        redirect_response = MagicMock()
        redirect_response.is_redirect = True
        redirect_response.headers = {"Location": "https://example.com/next"}
        # Return redirect responses for initial + 5 hops (exceeds max_redirects=5)
        mock_get.return_value = redirect_response
        with pytest.raises(ValueError, match="Too many redirects"):
            self.service._fetch_url("https://example.com/loop")

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_relative_redirect_resolved(self, mock_validate, mock_get):
        """Relative redirects (no leading slash) are properly resolved."""
        redirect_response = MagicMock()
        redirect_response.is_redirect = True
        redirect_response.headers = {"Location": "recipe.html"}

        final_response = MagicMock()
        final_response.is_redirect = False
        final_response.status_code = 200
        final_response.headers = {"Content-Type": "text/html"}
        final_response.iter_content.return_value = iter([b"<html></html>"])
        final_response.encoding = "utf-8"

        mock_get.side_effect = [redirect_response, final_response]

        result = self.service._fetch_url("https://example.com/dir/page")
        # The relative redirect should resolve to https://example.com/dir/recipe.html
        second_call_url = mock_get.call_args_list[1][0][0]
        assert second_call_url == "https://example.com/dir/recipe.html"

    @patch("app.services.llm_service.requests.get")
    @patch.object(LLMParsingService, "_validate_url_target")
    def test_unexpected_request_error_gives_friendly_message(self, mock_validate, mock_get):
        """Unexpected RequestException subclasses get a user-friendly message."""
        import requests as req
        mock_get.side_effect = req.RequestException("something weird")
        with pytest.raises(ValueError, match="Could not fetch"):
            self.service._fetch_url("https://example.com/weird")


# ============================================================================
# extract_from_url orchestration tests
# ============================================================================


class TestExtractFromUrl:
    """Test the extract_from_url orchestration method."""

    def setup_method(self):
        self.service = LLMParsingService.__new__(LLMParsingService)

    @patch.object(LLMParsingService, "_fetch_url")
    @patch.object(LLMParsingService, "load", return_value=True)
    def test_no_jsonld_returns_empty_without_llm_call(self, mock_load, mock_fetch):
        """No JSON-LD recipe = no LLM call = zero cost."""
        mock_fetch.return_value = "<html><body>No recipe here</body></html>"
        items, title = self.service.extract_from_url("https://example.com/page", "grocery")
        assert items == []

    @patch.object(LLMParsingService, "_call_backend")
    @patch.object(LLMParsingService, "_fetch_url")
    @patch.object(LLMParsingService, "load", return_value=True)
    def test_jsonld_triggers_llm_normalization(self, mock_load, mock_fetch, mock_call):
        """When JSON-LD recipe is found, LLM is called to normalize."""
        mock_fetch.return_value = '''
        <html><head>
        <script type="application/ld+json">
        {"@type": "Recipe", "name": "Tacos", "recipeIngredient": ["1 lb beef", "2 cups cheese"]}
        </script>
        </head></html>
        '''
        mock_call.return_value = json.dumps({
            "items": [
                {"name": "ground beef", "quantity": 1, "unit": "lb"},
                {"name": "cheese", "quantity": 2, "unit": "cups"},
            ]
        })
        items, title = self.service.extract_from_url("https://example.com/tacos", "grocery")
        assert len(items) == 2
        assert items[0].name == "ground beef"
        assert items[0].unit == "lb"
        assert items[1].unit == "cups"  # Freeform unit — "cups" is valid
        assert title == "Tacos"
        mock_call.assert_called_once()

    @patch.object(LLMParsingService, "load", return_value=False)
    def test_llm_unavailable_raises_value_error(self, mock_load):
        with pytest.raises(ValueError, match="not available"):
            self.service.extract_from_url("https://example.com/recipe", "grocery")


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

    def test_tasks_also_returns_422(self, client, auth_headers):
        response = client.post("/api/ai/extract-url", json={
            "url": "https://example.com/recipe",
            "list_type": "tasks",
        }, headers=auth_headers)
        assert response.status_code == 422

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

    @patch("app.api.ai.llm_service")
    def test_llm_unavailable_returns_503(self, mock_llm, client, auth_headers):
        mock_llm.is_available.return_value = False
        response = client.post("/api/ai/extract-url", json={
            "url": "https://example.com/recipe",
            "list_type": "grocery",
        }, headers=auth_headers)
        assert response.status_code == 503

    @patch("app.api.ai.llm_service")
    def test_value_error_returns_422(self, mock_llm, client, auth_headers):
        mock_llm.is_available.return_value = True
        mock_llm.extract_from_url.side_effect = ValueError("URL must point to a public address")
        response = client.post("/api/ai/extract-url", json={
            "url": "https://evil.com/recipe",
            "list_type": "grocery",
        }, headers=auth_headers)
        assert response.status_code == 422
        assert "public address" in response.json()["detail"]

    @patch("app.api.ai.llm_service")
    def test_generic_error_returns_502(self, mock_llm, client, auth_headers):
        mock_llm.is_available.return_value = True
        mock_llm.extract_from_url.side_effect = ConnectionError("timeout")
        response = client.post("/api/ai/extract-url", json={
            "url": "https://example.com/recipe",
            "list_type": "grocery",
        }, headers=auth_headers)
        assert response.status_code == 502

    @patch("app.api.ai.ai_service")
    @patch("app.api.ai.llm_service")
    def test_success_returns_categorized_items(self, mock_llm, mock_ai, client, auth_headers):
        """Happy path: LLM extracts items, they get categorized, response is correct."""
        mock_llm.is_available.return_value = True
        mock_llm.extract_from_url.return_value = (
            [ParsedItem(name="flour", quantity=2, unit="cup"),
             ParsedItem(name="eggs", quantity=3, unit="each")],
            "Chocolate Cake",
        )
        mock_ai.categorize.return_value = ("Baking", 0.9)
        response = client.post("/api/ai/extract-url", json={
            "url": "https://example.com/recipe",
            "list_type": "grocery",
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["original_input"] == "Chocolate Cake"
        assert len(data["items"]) == 2
        assert data["items"][0]["name"] == "flour"
        assert data["items"][0]["unit"] == "cup"
        assert data["items"][0]["quantity"] == 2
        assert data["items"][1]["unit"] == "each"
        assert data["confidence"] > 0

    @patch("app.api.ai.llm_service")
    def test_empty_result_returns_display_title(self, mock_llm, client, auth_headers):
        """When no recipe is found, response includes the display title."""
        mock_llm.is_available.return_value = True
        mock_llm.extract_from_url.return_value = ([], "Some Page Title")
        response = client.post("/api/ai/extract-url", json={
            "url": "https://example.com/recipe",
            "list_type": "grocery",
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["original_input"] == "Some Page Title"
        assert data["items"] == []
        assert data["confidence"] == 0.0


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

    def test_create_item_with_freeform_unit(self, client, auth_headers):
        """Any string up to 20 chars is valid as a unit (not restricted to enum)."""
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Olive Oil",
            "quantity": 2,
            "unit": "tablespoons",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["unit"] == "tablespoons"

    def test_create_item_unit_too_long_rejected(self, client, auth_headers):
        """Unit strings over 20 chars are rejected."""
        list_id = self._create_list(client, auth_headers)
        response = client.post(f"/api/lists/{list_id}/items", json={
            "name": "Stuff",
            "quantity": 1,
            "unit": "a" * 21,
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
