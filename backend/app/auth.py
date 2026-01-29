"""Authentication module supporting API key and Clerk JWT authentication."""

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from app.clerk_auth import ClerkUser, extract_bearer_token, verify_clerk_token
from app.config import get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass
class AuthResult:
    """Result of authentication - contains either API key or Clerk user."""

    api_key: str | None = None
    clerk_user: ClerkUser | None = None

    @property
    def is_authenticated(self) -> bool:
        """Check if authentication was successful."""
        return self.api_key is not None or self.clerk_user is not None

    @property
    def user_id(self) -> str | None:
        """Get user ID (Clerk user ID if available)."""
        if self.clerk_user:
            return self.clerk_user.clerk_user_id
        return None


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


async def get_auth(
    request: Request,
    api_key: str | None = Security(api_key_header),
) -> AuthResult:
    """Get authentication result from either API key or Bearer token.

    Supports three modes:
    - "api_key": Only API key authentication (legacy)
    - "clerk": Only Clerk JWT authentication
    - "hybrid": Accept either (for migration)

    Returns AuthResult with either api_key or clerk_user populated.
    """
    settings = get_settings()
    auth_mode = settings.auth_mode

    # Check for Bearer token first (Clerk JWT)
    bearer_token = extract_bearer_token(request)

    # API key disabled mode
    if settings.api_key == "disabled":
        return AuthResult(api_key="disabled")

    # Handle based on auth mode
    if auth_mode == "clerk":
        # Clerk-only mode
        if not bearer_token:
            raise HTTPException(
                status_code=401,
                detail="Missing authentication. Include Authorization: Bearer <token> header.",
            )
        clerk_user = verify_clerk_token(bearer_token)
        return AuthResult(clerk_user=clerk_user)

    elif auth_mode == "hybrid":
        # Hybrid mode - accept either
        if bearer_token:
            try:
                clerk_user = verify_clerk_token(bearer_token)
                return AuthResult(clerk_user=clerk_user)
            except HTTPException:
                # If JWT verification fails, fall through to API key
                pass

        if api_key and api_key == settings.api_key:
            return AuthResult(api_key=api_key)

        # Neither worked
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication. Provide valid API key or Bearer token.",
        )

    else:
        # API key mode (default/legacy)
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

        return AuthResult(api_key=api_key)


# Convenience dependency that requires authentication
def require_auth() -> AuthResult:
    """Dependency that requires valid authentication."""
    return Depends(get_auth)
