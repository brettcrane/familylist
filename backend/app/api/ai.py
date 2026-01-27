"""AI API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import verify_api_key
from app.database import get_db
from app.schemas import (
    CategorizeRequest,
    CategorizeResponse,
    FeedbackRequest,
    FeedbackResponse,
)
from app.services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(verify_api_key)])


@router.post("/categorize", response_model=CategorizeResponse)
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


@router.post("/feedback", response_model=FeedbackResponse)
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
