"""Clerk JWT authentication for FamilyList."""

import logging
import time
from dataclasses import dataclass
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


@dataclass
class ClerkUser:
    """Authenticated Clerk user info extracted from JWT."""

    clerk_user_id: str
    email: str | None
    display_name: str | None
    image_url: str | None


def _get_jwks_url() -> str:
    """Get the JWKS URL from Clerk JWT issuer."""
    settings = get_settings()
    issuer = settings.clerk_jwt_issuer.rstrip("/")
    return f"{issuer}/.well-known/jwks.json"


def _fetch_jwks() -> dict[str, Any]:
    """Fetch JWKS from Clerk with caching."""
    global _jwks_cache, _jwks_cache_time

    now = time.time()
    if _jwks_cache is not None and (now - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    try:
        jwks_url = _get_jwks_url()
        response = requests.get(jwks_url, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = now
        logger.info("Fetched JWKS from Clerk")
        return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        # Return cached version if available, even if stale
        if _jwks_cache is not None:
            logger.warning("Using stale JWKS cache")
            return _jwks_cache
        raise HTTPException(status_code=503, detail="Authentication service unavailable")


def _get_signing_key(token: str) -> jwt.algorithms.RSAAlgorithm:
    """Extract the signing key from JWKS for the given token."""
    try:
        jwks = _fetch_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise HTTPException(status_code=401, detail="Token missing key ID")

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)

        # Key not found - try refreshing JWKS
        global _jwks_cache_time
        _jwks_cache_time = 0  # Force refresh
        jwks = _fetch_jwks()

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)

        raise HTTPException(status_code=401, detail="Token signing key not found")
    except jwt.exceptions.DecodeError as e:
        logger.error(f"Failed to decode token header: {e}")
        raise HTTPException(status_code=401, detail="Invalid token format")


def verify_clerk_token(token: str) -> ClerkUser:
    """Verify a Clerk JWT token and return user info.

    Args:
        token: The JWT token (without 'Bearer ' prefix)

    Returns:
        ClerkUser with user info from the token

    Raises:
        HTTPException: If token is invalid or expired
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
        # Clerk includes user metadata in the JWT
        clerk_user_id = payload.get("sub")
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Token missing user ID")

        # Clerk custom claims for user metadata
        email = payload.get("email") or payload.get("primary_email_address")
        display_name = payload.get("name") or payload.get("full_name")
        image_url = payload.get("image_url") or payload.get("profile_image_url")

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
            image_url=image_url,
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidIssuerError:
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
