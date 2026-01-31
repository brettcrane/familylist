"""SSE streaming endpoint for real-time list updates."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import AuthResult, get_auth
from app.clerk_auth import verify_clerk_token
from app.config import get_settings
from app.database import get_db
from app.dependencies import check_list_access, get_current_user
from app.models import User
from app.services import list_service
from app.services.event_broadcaster import event_broadcaster

logger = logging.getLogger(__name__)

router = APIRouter(tags=["stream"])


async def get_auth_for_sse(
    request: Request,
    token: str | None = Query(None, description="JWT token for SSE authentication"),
) -> AuthResult:
    """Get authentication for SSE endpoint.

    SSE (EventSource) doesn't support custom headers, so we accept
    the JWT token as a query parameter as a fallback.

    Priority:
    1. Authorization header (if present)
    2. Query parameter token
    3. API key header (X-API-Key)
    """
    settings = get_settings()

    # Check Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        bearer_token = auth_header[7:]
        clerk_user = verify_clerk_token(bearer_token)
        return AuthResult(clerk_user=clerk_user)

    # Check query parameter token
    if token:
        clerk_user = verify_clerk_token(token)
        return AuthResult(clerk_user=clerk_user)

    # Check API key header
    api_key = request.headers.get("X-API-Key")
    if api_key:
        if settings.api_key == "disabled":
            return AuthResult(api_key="disabled")
        if api_key == settings.api_key:
            return AuthResult(api_key=api_key)

    # API key disabled mode
    if settings.api_key == "disabled":
        return AuthResult(api_key="disabled")

    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide token query parameter or X-API-Key header.",
    )


async def get_current_user_for_sse(
    auth: AuthResult = Depends(get_auth_for_sse),
    db: Session = Depends(get_db),
) -> User | None:
    """Get current user for SSE endpoint."""
    from app.services import user_service

    if auth.clerk_user:
        return user_service.get_or_create_user(db, auth.clerk_user)
    return None


@router.get("/lists/{list_id}/stream")
async def stream_list_events(
    list_id: str,
    request: Request,
    current_user: User | None = Depends(get_current_user_for_sse),
    db: Session = Depends(get_db),
):
    """Stream real-time events for a list via Server-Sent Events (SSE).

    Events include:
    - item_checked: An item was marked as checked
    - item_unchecked: An item was marked as unchecked
    - item_created: A new item was added
    - item_deleted: An item was removed
    - items_cleared: Checked items were cleared

    Authentication:
    - Pass JWT token as `token` query parameter (EventSource doesn't support headers)
    - Or use X-API-Key header if API key auth is enabled

    Example:
        const eventSource = new EventSource(`/api/lists/${listId}/stream?token=${jwt}`);
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Event:', data.event_type, data.item_name);
        };
    """
    # Verify list exists
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Check access permission
    check_list_access(db, list_id, current_user, require_edit=False)

    logger.info(
        f"SSE connection opened for list {list_id} "
        f"by user {current_user.id if current_user else 'anonymous'}"
    )

    async def event_generator():
        """Generate SSE events."""
        # Send initial connection confirmation
        yield f"event: connected\ndata: {{\"list_id\": \"{list_id}\"}}\n\n"

        # Subscribe and stream events
        try:
            async for event in event_broadcaster.subscribe(list_id):
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info(f"SSE client disconnected for list {list_id}")
                    break

                # Format as SSE
                yield f"event: {event.event_type}\ndata: {event.to_sse_data()}\n\n"
        except Exception as e:
            logger.error(f"SSE error for list {list_id}: {e}")
            raise

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
