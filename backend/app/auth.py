"""API key authentication."""

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.config import get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """Verify the API key from request header.

    Returns the API key if valid, raises HTTPException otherwise.
    If API_KEY is set to 'disabled', authentication is skipped.
    """
    settings = get_settings()

    # Allow disabling auth for home/family deployments
    if settings.api_key == "disabled":
        return "disabled"

    if api_key is None:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Include X-API-Key header.",
        )

    if api_key != settings.api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )

    return api_key
