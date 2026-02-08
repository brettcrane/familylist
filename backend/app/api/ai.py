"""AI API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_auth
from app.database import get_db
from app.schemas import (
    CategorizeRequest,
    CategorizeResponse,
    FeedbackRequest,
    FeedbackResponse,
    ParseRequest,
    ParseResponse,
    ParsedItemResponse,
)
from app.services.ai_service import ai_service
from app.services.llm_service import llm_service

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_auth)])


@router.post("/categorize", response_model=CategorizeResponse, operation_id="categorize_item")
def categorize_item(data: CategorizeRequest, db: Session = Depends(get_db)):
    """Categorize a single item using AI embeddings.

    Returns the suggested category and confidence score (0-1).
    """
    category, confidence = ai_service.categorize(
        item_name=data.item_name,
        list_type=data.list_type,
        db=db,
    )
    return CategorizeResponse(category=category, confidence=confidence)


@router.post("/feedback", response_model=FeedbackResponse, operation_id="record_feedback")
def record_feedback(data: FeedbackRequest, db: Session = Depends(get_db)):
    """Record user feedback for AI learning.

    When a user corrects a category suggestion, this endpoint stores
    the correction to improve future suggestions.
    """
    normalized_name = ai_service.record_feedback(
        db=db,
        item_name=data.item_name,
        list_type=data.list_type,
        correct_category=data.correct_category,
    )
    return FeedbackResponse(
        message="Feedback recorded successfully",
        item_name_normalized=normalized_name,
    )


@router.post("/parse", response_model=ParseResponse, operation_id="parse_natural_language")
def parse_natural_language(data: ParseRequest, db: Session = Depends(get_db)):
    """Parse natural language input into multiple items.

    Takes inputs like "stuff for tacos" and returns a list of items
    with suggested categories. Uses LLM for parsing and embedding
    model for category assignment.

    Returns 503 if LLM service is not available.
    """
    if not llm_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Natural language parsing is not available. Please add items individually.",
        )

    # Parse input into items using LLM
    parsed_items = llm_service.parse(data.input, data.list_type)

    if not parsed_items:
        # Return empty list if parsing failed or no items found
        return ParseResponse(
            original_input=data.input,
            items=[],
            confidence=0.0,
        )

    # Use embedding model to categorize each item
    categorized_items = []
    total_confidence = 0.0

    for item in parsed_items:
        category, confidence = ai_service.categorize(
            item_name=item.name,
            list_type=data.list_type,
            db=db,
        )
        categorized_items.append(
            ParsedItemResponse(
                name=item.name,
                category=category,
                quantity=item.quantity,
            )
        )
        total_confidence += confidence

    avg_confidence = total_confidence / len(categorized_items) if categorized_items else 0.0

    return ParseResponse(
        original_input=data.input,
        items=categorized_items,
        confidence=avg_confidence,
    )
