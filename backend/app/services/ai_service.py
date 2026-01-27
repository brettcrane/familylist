"""AI service - embedding-based categorization."""

import logging
import re
from typing import ClassVar

import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import CategoryLearning, utc_now
from app.schemas import ListType

logger = logging.getLogger(__name__)

# Category reference data with example items for each category
CATEGORY_REFERENCES: dict[str, dict[str, list[str]]] = {
    ListType.GROCERY: {
        "Produce": [
            "apples", "bananas", "oranges", "lettuce", "spinach", "tomatoes",
            "onions", "carrots", "broccoli", "peppers", "mushrooms", "potatoes",
            "garlic", "lemons", "limes", "avocados", "cucumbers", "celery",
            "grapes", "strawberries", "blueberries", "raspberries", "watermelon",
            "cantaloupe", "kale", "zucchini", "squash", "cabbage", "cauliflower",
        ],
        "Dairy": [
            "milk", "cheese", "yogurt", "butter", "eggs", "cream", "sour cream",
            "cottage cheese", "cream cheese", "half and half", "whipped cream",
            "cheddar", "mozzarella", "parmesan", "swiss cheese", "brie",
            "greek yogurt", "almond milk", "oat milk", "heavy cream",
        ],
        "Meat & Seafood": [
            "chicken", "beef", "pork", "salmon", "shrimp", "ground beef",
            "chicken breast", "bacon", "sausage", "steak", "turkey", "ham",
            "tilapia", "tuna", "crab", "lobster", "lamb", "ground turkey",
            "chicken thighs", "pork chops", "hot dogs", "deli meat",
        ],
        "Bakery": [
            "bread", "bagels", "croissants", "muffins", "rolls", "baguette",
            "tortillas", "pita", "english muffins", "donuts", "cake", "pie",
            "cookies", "pastries", "sourdough", "ciabatta", "flatbread",
        ],
        "Frozen": [
            "ice cream", "frozen pizza", "frozen vegetables", "frozen fruit",
            "frozen meals", "popsicles", "frozen waffles", "frozen chicken",
            "frozen fish", "frozen fries", "frozen burritos", "sorbet",
        ],
        "Pantry": [
            "rice", "pasta", "flour", "sugar", "oil", "vinegar", "soy sauce",
            "peanut butter", "jelly", "honey", "maple syrup", "oatmeal",
            "cereal", "canned beans", "canned tomatoes", "soup", "broth",
            "spices", "salt", "pepper", "olive oil", "coconut oil",
            "baking powder", "baking soda", "vanilla extract", "nuts",
        ],
        "Beverages": [
            "water", "juice", "soda", "coffee", "tea", "beer", "wine",
            "sparkling water", "sports drinks", "energy drinks", "lemonade",
            "orange juice", "apple juice", "coconut water", "kombucha",
        ],
        "Snacks": [
            "chips", "crackers", "popcorn", "pretzels", "granola bars",
            "trail mix", "dried fruit", "candy", "chocolate", "gummies",
            "fruit snacks", "nuts", "seeds", "protein bars",
        ],
        "Household": [
            "paper towels", "toilet paper", "napkins", "trash bags",
            "dish soap", "laundry detergent", "cleaning spray", "sponges",
            "aluminum foil", "plastic wrap", "ziplock bags", "light bulbs",
            "batteries", "air freshener", "bleach", "disinfectant",
        ],
        "Personal Care": [
            "shampoo", "conditioner", "soap", "body wash", "toothpaste",
            "toothbrush", "deodorant", "lotion", "sunscreen", "razors",
            "tissues", "cotton balls", "q-tips", "floss", "mouthwash",
        ],
        "Other": [],
    },
    ListType.PACKING: {
        "Clothing": [
            "shirts", "pants", "shorts", "underwear", "socks", "shoes",
            "jacket", "sweater", "dress", "skirt", "pajamas", "swimsuit",
            "hat", "belt", "tie", "jeans", "t-shirts", "hoodie",
        ],
        "Toiletries": [
            "toothbrush", "toothpaste", "shampoo", "conditioner", "soap",
            "deodorant", "razor", "sunscreen", "lotion", "makeup",
            "contact lens solution", "medications", "first aid kit",
        ],
        "Electronics": [
            "phone charger", "laptop", "tablet", "headphones", "camera",
            "power bank", "adapters", "cables", "e-reader", "watch charger",
        ],
        "Documents": [
            "passport", "id", "tickets", "boarding pass", "insurance cards",
            "hotel confirmation", "itinerary", "maps", "guidebook",
        ],
        "Accessories": [
            "sunglasses", "wallet", "keys", "watch", "jewelry", "umbrella",
            "backpack", "purse", "travel pillow", "eye mask", "earplugs",
        ],
        "Other": [],
    },
    ListType.TASKS: {
        "High Priority": [
            "urgent", "asap", "deadline", "important", "critical", "must do",
            "pay bills", "doctor appointment", "meeting",
        ],
        "Normal": [
            "call", "email", "schedule", "order", "buy", "fix", "clean",
            "organize", "return", "pick up", "drop off",
        ],
        "Low Priority": [
            "someday", "maybe", "nice to have", "when possible", "eventually",
            "research", "consider", "think about",
        ],
    },
}


class AICategorizationService:
    """Service for AI-based item categorization using embeddings."""

    _instance: ClassVar["AICategorizationService | None"] = None
    _model: SentenceTransformer | None = None
    _category_embeddings: dict[str, dict[str, np.ndarray]] = {}

    def __new__(cls) -> "AICategorizationService":
        """Singleton pattern for model loading."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load_model(self) -> None:
        """Load the embedding model and precompute category embeddings."""
        if self._model is not None:
            return

        settings = get_settings()
        logger.info(f"Loading embedding model: {settings.embedding_model}")

        self._model = SentenceTransformer(settings.embedding_model)

        # Precompute embeddings for each category
        for list_type, categories in CATEGORY_REFERENCES.items():
            self._category_embeddings[list_type] = {}
            for category_name, example_items in categories.items():
                if not example_items:
                    # For empty categories like "Other", use the category name
                    texts = [category_name.lower()]
                else:
                    # Combine category name with examples
                    texts = [category_name.lower()] + [item.lower() for item in example_items]

                # Compute embedding as mean of all texts
                embeddings = self._model.encode(texts, convert_to_numpy=True)
                self._category_embeddings[list_type][category_name] = np.mean(embeddings, axis=0)

        logger.info("Category embeddings precomputed")

    def _normalize_item_name(self, name: str) -> str:
        """Normalize item name for matching and learning."""
        # Lowercase and strip
        normalized = name.lower().strip()
        # Remove quantities (e.g., "2 apples" -> "apples")
        normalized = re.sub(r"^\d+\s*", "", normalized)
        # Remove common units
        normalized = re.sub(r"\b(lb|lbs|oz|kg|g|ml|l|gallon|quart|pint)\b", "", normalized)
        # Clean up extra whitespace
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized

    def categorize(
        self,
        item_name: str,
        list_type: ListType,
        db: Session | None = None,
    ) -> tuple[str, float]:
        """Categorize an item and return (category_name, confidence).

        Args:
            item_name: The name of the item to categorize
            list_type: The type of list (grocery, packing, tasks)
            db: Optional database session for learning lookup

        Returns:
            Tuple of (category_name, confidence_score)
        """
        if self._model is None:
            self.load_model()

        normalized_name = self._normalize_item_name(item_name)
        list_type_str = list_type.value if isinstance(list_type, ListType) else list_type

        # Check for learned category first
        learned_category = None
        learned_boost = 0.0
        if db:
            learning = (
                db.query(CategoryLearning)
                .filter(
                    CategoryLearning.item_name_normalized == normalized_name,
                    CategoryLearning.list_type == list_type_str,
                )
                .first()
            )
            if learning:
                learned_category = learning.category_name
                learned_boost = learning.confidence_boost

        # Compute embedding for the item
        item_embedding = self._model.encode([normalized_name], convert_to_numpy=True)[0]

        # Find best matching category
        best_category = "Other"
        best_score = 0.0

        category_embeddings = self._category_embeddings.get(list_type_str, {})
        for category_name, category_embedding in category_embeddings.items():
            # Cosine similarity
            similarity = np.dot(item_embedding, category_embedding) / (
                np.linalg.norm(item_embedding) * np.linalg.norm(category_embedding)
            )

            # Apply learned boost if this is the learned category
            if learned_category and category_name == learned_category:
                similarity = min(1.0, similarity + learned_boost)

            if similarity > best_score:
                best_score = similarity
                best_category = category_name

        # If we have a strong learned preference, use it even if embedding disagrees
        if learned_category and learned_boost >= 0.2:
            # Check if learned category exists
            if learned_category in category_embeddings:
                return learned_category, min(1.0, best_score + learned_boost)

        return best_category, float(best_score)

    def record_feedback(
        self,
        db: Session,
        item_name: str,
        list_type: ListType,
        correct_category: str,
    ) -> str:
        """Record user feedback for learning.

        Args:
            db: Database session
            item_name: The item name
            list_type: The list type
            correct_category: The correct category as specified by user

        Returns:
            The normalized item name that was stored
        """
        normalized_name = self._normalize_item_name(item_name)
        list_type_str = list_type.value if isinstance(list_type, ListType) else list_type

        # Check for existing learning
        existing = (
            db.query(CategoryLearning)
            .filter(
                CategoryLearning.item_name_normalized == normalized_name,
                CategoryLearning.list_type == list_type_str,
            )
            .first()
        )

        if existing:
            # Update existing learning
            if existing.category_name == correct_category:
                # Same category - increase confidence
                existing.confidence_boost = min(0.5, existing.confidence_boost + 0.1)
            else:
                # Different category - reset to new category
                existing.category_name = correct_category
                existing.confidence_boost = 0.1
            existing.updated_at = utc_now()
        else:
            # Create new learning
            learning = CategoryLearning(
                item_name_normalized=normalized_name,
                list_type=list_type_str,
                category_name=correct_category,
                confidence_boost=0.1,
            )
            db.add(learning)

        db.commit()
        return normalized_name


# Global service instance
ai_service = AICategorizationService()
