"""LLM service for natural language parsing."""

import json
import logging
import re
from typing import ClassVar

import requests

from app.config import get_settings
from app.schemas import ListType

logger = logging.getLogger(__name__)

# Prompt template for parsing natural language into items
PARSE_PROMPT = """You are a helpful assistant that parses shopping or packing requests into individual items.

Given a natural language input, extract the individual items that should be added to a {list_type} list.
For each item, provide:
- name: The item name (singular, lowercase)
- quantity: Number needed (default 1)

Input: "{input}"

Respond with ONLY a JSON array, no explanation. Example format:
[{{"name": "tortillas", "quantity": 1}}, {{"name": "ground beef", "quantity": 1}}]

If the input is a single item, return an array with one item.
If you cannot parse any items, return an empty array: []

JSON array:"""


class ParsedItem:
    """Parsed item from LLM."""

    def __init__(self, name: str, quantity: int = 1, category: str = ""):
        self.name = name
        self.quantity = quantity
        self.category = category

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "category": self.category,
        }


class LLMParsingService:
    """Service for LLM-based natural language parsing.

    Supports two backends:
    1. Local GGUF model via llama-cpp-python (if llm_model_path is set)
    2. Ollama API (if llm_model_path is empty)
    """

    _instance: ClassVar["LLMParsingService | None"] = None
    _llm = None
    _loaded = False

    def __new__(cls) -> "LLMParsingService":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

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
            return self._llm is not None or self._check_ollama()

        settings = get_settings()
        if not settings.enable_llm_parsing:
            logger.info("LLM parsing is disabled")
            self._loaded = True
            return False

        # Try local model first
        if settings.llm_model_path:
            if self._load_local_model():
                self._loaded = True
                return True

        # Fall back to Ollama
        if self._check_ollama():
            logger.info(f"Using Ollama at {settings.llm_ollama_url}")
            self._loaded = True
            return True

        logger.warning("No LLM backend available")
        self._loaded = True
        return False

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
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["response"].strip()

    def _extract_json(self, text: str) -> list[dict]:
        """Extract JSON array from LLM response."""
        # Try to find JSON array in response
        text = text.strip()

        # Remove markdown code blocks if present
        if text.startswith("```"):
            text = re.sub(r"```(?:json)?\n?", "", text)
            text = text.strip()

        # Find array bounds
        start = text.find("[")
        end = text.rfind("]")

        if start == -1 or end == -1:
            return []

        json_str = text[start : end + 1]

        try:
            data = json.loads(json_str)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON: {json_str}")

        return []

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

        settings = get_settings()
        list_type_str = list_type.value if isinstance(list_type, ListType) else list_type

        prompt = PARSE_PROMPT.format(
            list_type=list_type_str,
            input=input_text,
        )

        try:
            # Call appropriate backend
            if self._llm is not None:
                response = self._call_local(prompt)
            else:
                response = self._call_ollama(prompt)

            logger.debug(f"LLM response: {response}")

            # Parse JSON from response
            items_data = self._extract_json(response)

            # Convert to ParsedItem objects
            items = []
            for item in items_data:
                if isinstance(item, dict) and "name" in item:
                    name = str(item["name"]).strip()
                    if name:
                        quantity = int(item.get("quantity", 1))
                        items.append(ParsedItem(name=name, quantity=max(1, quantity)))

            logger.info(f"Parsed {len(items)} items from: {input_text}")
            return items

        except Exception as e:
            logger.error(f"LLM parsing failed: {e}")
            return []

    def is_available(self) -> bool:
        """Check if LLM parsing is available."""
        return self.load()


# Global service instance
llm_service = LLMParsingService()
