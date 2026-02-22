"""LLM service for natural language parsing."""

import json
import logging
import re
from typing import ClassVar

import requests
from openai import OpenAI

from app.config import get_settings
from app.schemas import ListType

logger = logging.getLogger(__name__)

# Prompt for normalizing raw recipe ingredient strings into grocery items.
RECIPE_NORMALIZE_PROMPT = """Convert these recipe ingredients into grocery list items.

Ingredients:
{ingredients}

Return a JSON array of items to buy. Each item has:
- "name": grocery item name, lowercase
- "quantity": numeric amount (e.g., 2, 0.5, 1)
- "unit": unit of measure. Must be one of: each, tsp, tbsp, cup, fl oz, pint, quart, gallon, ml, L, oz, lb, g, kg, can, bottle, jar, bag, box, pkg, bunch, dozen, clove, pinch

Examples:
- "1 cup all-purpose flour" → {{"name": "all-purpose flour", "quantity": 1, "unit": "cup"}}
- "2 large eggs" → {{"name": "eggs", "quantity": 2, "unit": "each"}}
- "3 cloves garlic, minced" → {{"name": "garlic", "quantity": 3, "unit": "clove"}}
- "2 (14 oz) cans diced tomatoes" → {{"name": "diced tomatoes", "quantity": 2, "unit": "can"}}
- "salt and pepper to taste" → {{"name": "salt", "quantity": 1, "unit": "pinch"}}, {{"name": "pepper", "quantity": 1, "unit": "pinch"}}
- "1 lb ground beef" → {{"name": "ground beef", "quantity": 1, "unit": "lb"}}
- "1/2 cup sugar" → {{"name": "sugar", "quantity": 0.5, "unit": "cup"}}

JSON array:"""

# Prompt for extracting ingredients from raw page text (fallback when no JSON-LD).
RECIPE_EXTRACT_PROMPT = """Extract the recipe ingredients from this webpage text.

Text:
{text}

Return a JSON array of grocery items to buy. Each item has:
- "name": grocery item name, lowercase
- "quantity": numeric amount (e.g., 2, 0.5, 1)
- "unit": unit of measure. Must be one of: each, tsp, tbsp, cup, fl oz, pint, quart, gallon, ml, L, oz, lb, g, kg, can, bottle, jar, bag, box, pkg, bunch, dozen, clove, pinch

Only include food ingredients, not equipment or serving suggestions.

JSON array:"""

# Prompt templates for parsing natural language into items, keyed by list type.
# Note: For GPT-5 models, the response_format schema constrains output to
# {"items": [...]}, superseding the prompt's "JSON array" instruction.
# The _extract_json() method handles both formats.
PARSE_PROMPTS: dict[str, str] = {
    "grocery": """Parse this into grocery/shopping items.

"stuff for X" or "things for X" means ingredients to make X.
"we need X, Y, Z" means items X, Y, and Z.

Input: "{input}"

Return a JSON array of items. Each item has "name" (lowercase) and "quantity" (default 1).

Examples:
- "stuff for tacos" → [{{"name": "tortillas", "quantity": 1}}, {{"name": "ground beef", "quantity": 1}}, {{"name": "cheese", "quantity": 1}}, {{"name": "salsa", "quantity": 1}}]
- "stuff for chili" → [{{"name": "ground beef", "quantity": 1}}, {{"name": "kidney beans", "quantity": 2}}, {{"name": "diced tomatoes", "quantity": 1}}, {{"name": "chili powder", "quantity": 1}}, {{"name": "onion", "quantity": 1}}]
- "milk and eggs" → [{{"name": "milk", "quantity": 1}}, {{"name": "eggs", "quantity": 1}}]

JSON array:""",
    "packing": """Parse this into packing list items.

"stuff for X" or "things for X" means items you need to pack for X.
"we need X, Y, Z" means items X, Y, and Z.

Input: "{input}"

Return a JSON array of items. Each item has "name" (lowercase) and "quantity" (default 1).

Examples:
- "stuff for a beach trip" → [{{"name": "sunscreen", "quantity": 1}}, {{"name": "towel", "quantity": 1}}, {{"name": "swimsuit", "quantity": 1}}, {{"name": "sunglasses", "quantity": 1}}]
- "things for camping" → [{{"name": "tent", "quantity": 1}}, {{"name": "sleeping bag", "quantity": 1}}, {{"name": "flashlight", "quantity": 1}}, {{"name": "matches", "quantity": 1}}, {{"name": "cooler", "quantity": 1}}]
- "toiletries and chargers" → [{{"name": "toothbrush", "quantity": 1}}, {{"name": "phone charger", "quantity": 1}}]

JSON array:""",
    "tasks": """Parse this into individual tasks or action items.

"stuff for X" or "things for X" means steps or tasks needed for X.
"we need to X, Y, Z" means tasks X, Y, and Z.

Input: "{input}"

Return a JSON array of items. Each item has "name" (lowercase action/task) and "quantity" (always 1 for tasks).

Examples:
- "things for hanging a picture" → [{{"name": "find a stud in the wall", "quantity": 1}}, {{"name": "buy picture hooks", "quantity": 1}}, {{"name": "measure and mark position", "quantity": 1}}, {{"name": "hang the picture", "quantity": 1}}]
- "prep for a dinner party" → [{{"name": "plan the menu", "quantity": 1}}, {{"name": "buy groceries", "quantity": 1}}, {{"name": "clean the house", "quantity": 1}}, {{"name": "set the table", "quantity": 1}}]
- "fix the leaky faucet and paint the bedroom" → [{{"name": "fix the leaky faucet", "quantity": 1}}, {{"name": "paint the bedroom", "quantity": 1}}]

JSON array:""",
}


class ParsedItem:
    """Parsed item from LLM."""

    def __init__(self, name: str, quantity: int = 1, category: str = "", notes: str = ""):
        self.name = name
        self.quantity = quantity
        self.category = category
        self.notes = notes

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "category": self.category,
            "notes": self.notes,
        }


class LLMParsingService:
    """Service for LLM-based natural language parsing.

    Supports three backends:
    1. OpenAI API (default; defaults to GPT-5 Nano with structured JSON output,
       configurable via LLM_OPENAI_MODEL)
    2. Local GGUF model via llama-cpp-python
    3. Ollama API
    """

    _instance: ClassVar["LLMParsingService | None"] = None
    _llm = None
    _openai_client: OpenAI | None = None
    _backend: str | None = None
    _loaded = False

    def __new__(cls) -> "LLMParsingService":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _load_openai(self) -> bool:
        """Initialize OpenAI client."""
        settings = get_settings()
        if not settings.llm_openai_api_key:
            return False

        try:
            self._openai_client = OpenAI(api_key=settings.llm_openai_api_key)
            logger.info(f"Using OpenAI API with model: {settings.llm_openai_model}")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            return False

    def _load_local_model(self) -> bool:
        """Load local GGUF model via llama-cpp-python."""
        settings = get_settings()
        if not settings.llm_model_path:
            return False

        try:
            from llama_cpp import Llama
        except ImportError:
            logger.info("llama-cpp-python not installed, skipping local model")
            return False

        try:
            logger.info(f"Loading local LLM: {settings.llm_model_path}")
            self._llm = Llama(
                model_path=settings.llm_model_path,
                n_ctx=2048,
                n_threads=4,
                verbose=False,
            )
            logger.info("Local LLM loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load local LLM: {e}")
            return False

    def _check_ollama(self) -> bool:
        """Check if Ollama is available."""
        settings = get_settings()
        try:
            response = requests.get(f"{settings.llm_ollama_url}/api/tags", timeout=2)
            return response.status_code == 200
        except Exception:
            return False

    def load(self) -> bool:
        """Lazy load the LLM backend."""
        if self._loaded:
            return self._backend is not None

        settings = get_settings()
        if not settings.enable_llm_parsing:
            logger.info("LLM parsing is disabled")
            self._loaded = True
            return False

        backend = settings.llm_backend.lower()

        # Try configured backend first
        if backend == "openai" and self._load_openai():
            self._backend = "openai"
            self._loaded = True
            return True

        if backend == "local" and self._load_local_model():
            self._backend = "local"
            self._loaded = True
            return True

        if backend == "ollama" and self._check_ollama():
            self._backend = "ollama"
            logger.info(f"Using Ollama at {settings.llm_ollama_url}")
            self._loaded = True
            return True

        # Fallback: try all backends in order of preference
        if self._load_openai():
            self._backend = "openai"
            self._loaded = True
            return True

        if self._load_local_model():
            self._backend = "local"
            self._loaded = True
            return True

        if self._check_ollama():
            self._backend = "ollama"
            logger.info(f"Using Ollama at {settings.llm_ollama_url}")
            self._loaded = True
            return True

        logger.warning("No LLM backend available")
        self._loaded = True
        return False

    def _call_openai(self, prompt: str) -> str:
        """Call OpenAI API."""
        settings = get_settings()
        # GPT-5 models use max_completion_tokens, don't support custom temperature,
        # and need response_format for reliable JSON output
        if "gpt-5" in settings.llm_openai_model:
            response = self._openai_client.chat.completions.create(
                model=settings.llm_openai_model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that parses lists into individual items. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                max_completion_tokens=settings.llm_max_tokens,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "parsed_items",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "name": {"type": "string"},
                                            "quantity": {"type": "number"},
                                            "unit": {"type": "string"},
                                        },
                                        "required": ["name", "quantity", "unit"],
                                        "additionalProperties": False,
                                    },
                                }
                            },
                            "required": ["items"],
                            "additionalProperties": False,
                        },
                    },
                },
            )
        else:
            response = self._openai_client.chat.completions.create(
                model=settings.llm_openai_model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that parses lists into individual items. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=settings.llm_max_tokens,
                temperature=settings.llm_temperature,
            )
        if not response.choices:
            logger.error(f"OpenAI returned empty choices array for model {settings.llm_openai_model}")
            return ""
        choice = response.choices[0]
        if choice.finish_reason == "length":
            logger.warning(
                f"OpenAI response truncated (token limit={settings.llm_max_tokens})"
            )
            return ""
        if choice.finish_reason == "content_filter":
            logger.error("OpenAI content filter triggered")
            return ""
        message = choice.message
        if hasattr(message, "refusal") and message.refusal:
            logger.error(f"OpenAI refused structured output: {message.refusal}")
            raise ValueError(f"Model refused to process input: {message.refusal}")
        content = message.content
        return content.strip() if content else ""

    def _call_local(self, prompt: str) -> str:
        """Call local GGUF model."""
        settings = get_settings()
        response = self._llm(
            prompt,
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
            stop=["```", "\n\n"],
        )
        return response["choices"][0]["text"].strip()

    def _call_ollama(self, prompt: str) -> str:
        """Call Ollama API."""
        settings = get_settings()
        response = requests.post(
            f"{settings.llm_ollama_url}/api/generate",
            json={
                "model": settings.llm_ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": settings.llm_temperature,
                    "num_predict": settings.llm_max_tokens,
                },
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.json()["response"].strip()

    def _extract_json(self, text: str) -> list[dict]:
        """Extract JSON array from LLM response.

        Handles both bare arrays and structured output objects like {"items": [...]}.
        """
        text = text.strip()

        # Remove markdown code blocks if present
        if text.startswith("```"):
            text = re.sub(r"```(?:json)?\n?", "", text)
            text = text.strip()

        # Try parsing as a complete JSON object first (structured output format)
        try:
            data = json.loads(text)
            if isinstance(data, dict) and "items" in data:
                if isinstance(data["items"], list):
                    return data["items"]
                logger.warning(f"Expected list for 'items' key, got {type(data['items']).__name__}")
            elif isinstance(data, list):
                return data
            else:
                logger.warning(f"Unexpected JSON structure in LLM response: {text[:200]}")
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse response as JSON, falling back to array extraction: {text[:200]}")

        # Fallback: find array bounds in free-form text
        start = text.find("[")
        end = text.rfind("]")

        if start == -1 or end == -1:
            logger.warning(f"No JSON array found in LLM response: {text[:200]}")
            return []

        json_str = text[start : end + 1]

        try:
            data = json.loads(json_str)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON: {json_str}")

        return []

    def _call_backend(self, prompt: str) -> str:
        """Call the active LLM backend with a prompt and return raw text."""
        if self._backend == "openai":
            return self._call_openai(prompt)
        elif self._backend == "local":
            return self._call_local(prompt)
        else:
            return self._call_ollama(prompt)

    def _fetch_url(self, url: str) -> str:
        """Fetch HTML content from a URL."""
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; FamilyList/1.0; +https://familylist.app)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()
        if len(response.content) > 5 * 1024 * 1024:
            raise ValueError("Page too large to process")
        return response.text

    def _find_recipe_in_jsonld(self, data: dict | list) -> dict | None:
        """Recursively find a Recipe object in JSON-LD data."""
        if isinstance(data, dict):
            type_val = data.get("@type", "")
            if type_val == "Recipe" or (isinstance(type_val, list) and "Recipe" in type_val):
                return data
            if "@graph" in data:
                return self._find_recipe_in_jsonld(data["@graph"])
        elif isinstance(data, list):
            for item in data:
                result = self._find_recipe_in_jsonld(item)
                if result:
                    return result
        return None

    def _extract_jsonld_recipe(self, html: str) -> tuple[list[str], str | None]:
        """Try to extract recipe ingredients from JSON-LD structured data.

        Returns (ingredient_strings, recipe_title) or ([], None).
        """
        pattern = re.compile(
            r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            re.DOTALL | re.IGNORECASE,
        )
        for match in pattern.finditer(html):
            try:
                data = json.loads(match.group(1))
                recipe = self._find_recipe_in_jsonld(data)
                if recipe:
                    ingredients = recipe.get("recipeIngredient", [])
                    title = recipe.get("name")
                    if ingredients and isinstance(ingredients, list):
                        return [str(i) for i in ingredients], title
            except (json.JSONDecodeError, KeyError):
                continue
        return [], None

    def _extract_page_text(self, html: str) -> str:
        """Extract readable text from HTML, stripping tags and scripts."""
        text = re.sub(
            r"<(script|style|noscript)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE
        )
        text = re.sub(r"<[^>]+>", " ", text)
        text = (
            text.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&nbsp;", " ")
        )
        text = re.sub(r"\s+", " ", text).strip()
        return text[:4000]

    def _extract_page_title(self, html: str) -> str | None:
        """Extract page title from HTML."""
        match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            # Clean up common suffixes like " | AllRecipes" or " - Food Network"
            title = re.split(r"\s*[|\-–—]\s*(?=[A-Z])", title)[0].strip()
            return title if title else None
        return None

    def extract_from_url(self, url: str, list_type: ListType) -> tuple[list[ParsedItem], str]:
        """Fetch a URL and extract items (e.g., recipe ingredients).

        Returns (items, display_title) where display_title is the recipe name or URL.
        """
        if not self.load():
            raise ValueError("LLM service not available")

        html = self._fetch_url(url)

        # Try JSON-LD structured data first (most recipe sites)
        ingredients, jsonld_title = self._extract_jsonld_recipe(html)

        if ingredients:
            logger.info(f"Found {len(ingredients)} ingredients via JSON-LD from {url}")
            prompt = RECIPE_NORMALIZE_PROMPT.format(
                ingredients="\n".join(f"- {i}" for i in ingredients)
            )
        else:
            logger.info(f"No JSON-LD recipe found, falling back to text extraction for {url}")
            text = self._extract_page_text(html)
            if len(text) < 50:
                logger.warning(f"Page text too short to extract from: {url}")
                return [], jsonld_title or url
            prompt = RECIPE_EXTRACT_PROMPT.format(text=text)

        display_title = jsonld_title or self._extract_page_title(html) or url

        try:
            response = self._call_backend(prompt)
            logger.info(f"LLM URL extraction response: {response[:200]}")

            items_data = self._extract_json(response)
            items = []
            for item in items_data:
                if isinstance(item, dict) and "name" in item:
                    name = str(item["name"]).strip()
                    if name:
                        quantity = float(item.get("quantity", 1))
                        unit = str(item.get("unit", "each")).strip()
                        items.append(ParsedItem(
                            name=name,
                            quantity=max(0.01, quantity),
                            unit=unit,
                        ))

            logger.info(f"Extracted {len(items)} items from URL: {url}")
            return items, display_title

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"LLM URL extraction failed for '{url}': {type(e).__name__}: {e}")
            return [], display_title

    def parse(self, input_text: str, list_type: ListType) -> list[ParsedItem]:
        """Parse natural language input into a list of items.

        Args:
            input_text: Natural language input (e.g., "stuff for tacos")
            list_type: Type of list (grocery, packing, tasks)

        Returns:
            List of ParsedItem objects
        """
        if not self.load():
            logger.warning("LLM not available, returning empty list")
            return []

        list_type_str = list_type.value if isinstance(list_type, ListType) else list_type

        prompt_template = PARSE_PROMPTS.get(list_type_str)
        if prompt_template is None:
            logger.warning(f"No prompt template for list type '{list_type_str}', falling back to grocery")
            prompt_template = PARSE_PROMPTS["grocery"]
        prompt = prompt_template.format(input=input_text)

        try:
            # Call appropriate backend
            if self._backend == "openai":
                response = self._call_openai(prompt)
            elif self._backend == "local":
                response = self._call_local(prompt)
            else:
                response = self._call_ollama(prompt)

            logger.info(f"LLM response: {response}")

            # Parse JSON from response
            items_data = self._extract_json(response)

            # Convert to ParsedItem objects
            items = []
            for item in items_data:
                if isinstance(item, dict) and "name" in item:
                    name = str(item["name"]).strip()
                    if name:
                        quantity = float(item.get("quantity", 1))
                        unit = str(item.get("unit", "each")).strip()
                        items.append(ParsedItem(
                            name=name,
                            quantity=max(0.01, quantity),
                            unit=unit,
                        ))

            logger.info(f"Parsed {len(items)} items from: {input_text}")
            return items

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"LLM parsing failed for '{input_text[:50]}': {type(e).__name__}: {e}")
            return []

    def is_available(self) -> bool:
        """Check if LLM parsing is available."""
        return self.load()


# Global service instance
llm_service = LLMParsingService()
