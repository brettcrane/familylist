"""Authentication module supporting API key and Clerk JWT authentication.

Provides hybrid authentication supporting both API key (legacy) and Clerk JWT modes.
Configure via AUTH_MODE environment variable:
- "api_key": Only API key authentication (default, legacy)
- "clerk": Only Clerk JWT authentication
- "hybrid": Accept either method (for migration periods)

Security Notes:
- In hybrid mode, if a Bearer token is provided but invalid, the request is logged
  and falls through to API key authentication. This allows gradual migration but
  means invalid JWTs don't fail-fast when a valid API key is also provided.
- Set AUTH_MODE=clerk for strict JWT-only authentication in production.
"""

import logging
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from app.clerk_auth import ClerkUser, extract_bearer_token, verify_clerk_token
from app.config import get_settings

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass
class AuthResult:
    """Result of authentication - contains either API key or Clerk user.

    Invariants:
    - When authenticated, exactly one of api_key or clerk_user is set
    - api_key="disabled" is a special value indicating auth is disabled
    - is_authenticated returns True iff at least one auth method succeeded
    """

    api_key: str | None = None
    clerk_user: ClerkUser | None = None

    def __post_init__(self):
        """Validate that the auth result is in a valid state."""
        # Both being set is invalid (except we allow it during construction
        # since dataclass doesn't support this well without frozen=True)
        pass

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

    Supports three modes configured via AUTH_MODE:
    - "api_key": Only API key authentication (legacy)
    - "clerk": Only Clerk JWT authentication
    - "hybrid": Accept either (for migration)

    Returns AuthResult with either api_key or clerk_user populated.

    Security Note:
        In hybrid mode, invalid Bearer tokens are logged and fall through to
        API key authentication. This is intentional for migration but means
        a request with both an invalid JWT and valid API key will succeed.
    """
    settings = get_settings()
    auth_mode = settings.auth_mode

    # Check for Bearer token first (Clerk JWT)
    bearer_token = extract_bearer_token(request)

    # Debug logging for auth troubleshooting
    logger.info(
        f"Auth attempt: mode={auth_mode}, "
        f"has_bearer={bearer_token is not None}, "
        f"has_api_key={api_key is not None}, "
        f"api_key_disabled={settings.api_key == 'disabled'}"
    )

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
        # Hybrid mode - accept either method
        # Note: If Bearer token is provided but invalid, we log and fall through to API key
        if bearer_token:
            logger.info("Hybrid mode: attempting JWT verification")
            try:
                clerk_user = verify_clerk_token(bearer_token)
                logger.info(f"JWT verification succeeded for user: {clerk_user.clerk_user_id}")
                return AuthResult(clerk_user=clerk_user)
            except HTTPException as e:
                # Log the JWT failure for debugging - this helps diagnose auth issues
                logger.warning(
                    f"JWT verification failed in hybrid mode (status={e.status_code}): {e.detail}. "
                    "Falling back to API key authentication."
                )
            except Exception as e:
                # Catch any unexpected exceptions
                logger.error(f"Unexpected error during JWT verification: {type(e).__name__}: {e}")

        if api_key and api_key == settings.api_key:
            logger.info("Hybrid mode: API key authentication succeeded")
            return AuthResult(api_key=api_key)

        # Neither worked
        logger.warning("Hybrid mode: both JWT and API key authentication failed")
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
