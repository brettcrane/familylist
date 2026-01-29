"""Clerk JWT authentication for FamilyList.

This module handles JWT verification for Clerk authentication, including:
- JWKS (JSON Web Key Set) fetching with caching
- RS256 signature verification
- Token claim validation (issuer, expiration, authorized parties)

Security Notes:
- Uses RS256 algorithm only to prevent algorithm confusion attacks
- Validates issuer claim against configured CLERK_JWT_ISSUER
- Validates exp/iat to prevent expired or future-dated tokens
- Optionally validates azp (authorized party) to prevent cross-app token replay
- JWKS is cached for 6 hours with stale fallback on fetch failure
"""

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import jwt
import requests
from fastapi import HTTPException, Request

from app.config import get_settings

logger = logging.getLogger(__name__)

# JWKS cache
_jwks_cache: dict[str, Any] | None = None
_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 6 * 60 * 60  # 6 hours


@dataclass(frozen=True)
class ClerkUser:
    """Authenticated Clerk user info extracted from JWT.

    This is an immutable dataclass representing a verified Clerk user.
    The clerk_user_id is guaranteed to be non-empty when constructed
    via verify_clerk_token().

    Attributes:
        clerk_user_id: Clerk's "sub" claim - unique user identifier
        email: User's primary email address (may be None)
        display_name: User's display name (may be None)
        avatar_url: URL to user's profile image (may be None)
    """

    clerk_user_id: str
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None

    def __post_init__(self):
        """Validate that clerk_user_id is non-empty."""
        if not self.clerk_user_id:
            raise ValueError("clerk_user_id cannot be empty")


def _get_jwks_url() -> str:
    """Get the JWKS URL from Clerk JWT issuer."""
    settings = get_settings()
    issuer = settings.clerk_jwt_issuer.rstrip("/")
    return f"{issuer}/.well-known/jwks.json"


def _fetch_jwks() -> dict[str, Any]:
    """Fetch JWKS from Clerk with caching.

    Returns cached JWKS if still valid. On fetch failure, returns stale cache
    if available, otherwise raises HTTPException.

    Raises:
        HTTPException: 503 if JWKS fetch fails and no cache available
    """
    global _jwks_cache, _jwks_cache_time

    now = time.time()
    if _jwks_cache is not None and (now - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    jwks_url = _get_jwks_url()

    try:
        response = requests.get(jwks_url, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = now
        logger.info("Fetched JWKS from Clerk")
        return _jwks_cache

    except requests.exceptions.Timeout as e:
        logger.error(f"JWKS fetch timed out after 10s: {e}")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Failed to connect to Clerk JWKS endpoint ({jwks_url}): {e}")
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error fetching JWKS (status={e.response.status_code}): {e}")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in JWKS response: {e}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error fetching JWKS: {e}")
    except Exception as e:
        logger.error(f"Unexpected error fetching JWKS: {type(e).__name__}: {e}", exc_info=True)

    # Return cached version if available, even if stale
    if _jwks_cache is not None:
        cache_age_hours = (now - _jwks_cache_time) / 3600
        logger.warning(f"Using stale JWKS cache (age: {cache_age_hours:.1f} hours)")
        return _jwks_cache

    raise HTTPException(status_code=503, detail="Authentication service unavailable")


def _get_signing_key(token: str) -> Any:
    """Extract the RSA public key from JWKS for the given token.

    Args:
        token: The JWT token to get the signing key for

    Returns:
        RSA public key object for signature verification

    Raises:
        HTTPException: If token format is invalid or key not found
    """
    try:
        jwks = _fetch_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise HTTPException(status_code=401, detail="Token missing key ID")

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)

        # Key not found - try refreshing JWKS (key rotation may have occurred)
        logger.info(f"Key ID '{kid}' not found in JWKS cache, forcing refresh")
        global _jwks_cache_time
        _jwks_cache_time = 0  # Force refresh
        jwks = _fetch_jwks()

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)

        logger.warning(f"Token signing key not found after JWKS refresh (kid={kid})")
        raise HTTPException(status_code=401, detail="Token signing key not found")

    except jwt.exceptions.DecodeError as e:
        logger.error(f"Failed to decode token header: {e}")
        raise HTTPException(status_code=401, detail="Invalid token format")


def verify_clerk_token(token: str) -> ClerkUser:
    """Verify a Clerk JWT token and return user info.

    Performs full JWT verification including:
    - RS256 signature verification using Clerk's JWKS
    - Issuer validation against CLERK_JWT_ISSUER
    - Expiration (exp) and issued-at (iat) validation
    - Optional authorized party (azp) validation

    Args:
        token: The JWT token (without 'Bearer ' prefix)

    Returns:
        ClerkUser with verified user info from the token

    Raises:
        HTTPException: 401 if token is invalid, expired, or unauthorized
        HTTPException: 500 if Clerk is not configured
        HTTPException: 503 if JWKS fetch fails
    """
    settings = get_settings()

    if not settings.clerk_jwt_issuer:
        raise HTTPException(status_code=500, detail="Clerk authentication not configured")

    try:
        signing_key = _get_signing_key(token)

        # Build verification options
        options = {
            "verify_signature": True,
            "verify_exp": True,
            "verify_iat": True,
            "require": ["exp", "iat", "sub"],
        }

        # Decode and verify
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=settings.clerk_jwt_issuer,
            options=options,
        )

        # Verify authorized parties (azp claim) if configured
        if settings.clerk_authorized_parties:
            azp = payload.get("azp")
            if azp and azp not in settings.clerk_authorized_parties:
                logger.warning(f"Token azp '{azp}' not in authorized parties")
                raise HTTPException(status_code=401, detail="Token not authorized for this application")

        # Extract user info from claims
        clerk_user_id = payload.get("sub")
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Token missing user ID")

        # Clerk custom claims for user metadata
        email = payload.get("email") or payload.get("primary_email_address")
        display_name = payload.get("name") or payload.get("full_name")
        avatar_url = payload.get("image_url") or payload.get("profile_image_url")

        # If no name, try to construct from first/last
        if not display_name:
            first = payload.get("first_name", "")
            last = payload.get("last_name", "")
            if first or last:
                display_name = f"{first} {last}".strip()

        return ClerkUser(
            clerk_user_id=clerk_user_id,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
        )

    except jwt.ExpiredSignatureError:
        logger.info("Token expired for request")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidIssuerError as e:
        logger.warning(f"Invalid token issuer: {e}")
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


def extract_bearer_token(request: Request) -> str | None:
    """Extract Bearer token from Authorization header.

    Returns None if no Authorization header or not a Bearer token.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1]
