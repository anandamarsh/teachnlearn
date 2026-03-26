import requests
from fastapi import HTTPException
from jose import jwt
from jose.exceptions import JWTError
from starlette.requests import Request

from app.core.settings import Settings
from app.core.otp import verify_otp

SUPERUSER_EMAILS = {"amarsh.anand@gmail.com"}
EFFECTIVE_ACCOUNT_HEADER = "x-effective-account"
EFFECTIVE_ACCOUNT_QUERY_PARAM = "effective_account"


def normalize_email(value: str | None) -> str:
    return str(value or "").strip().lower()


def is_superuser_email(email: str | None) -> bool:
    return normalize_email(email) in SUPERUSER_EMAILS


def resolve_effective_email(
    authenticated_email: str | None,
    requested_email: str | None,
) -> str:
    authenticated = normalize_email(authenticated_email)
    requested = normalize_email(requested_email)
    if not authenticated:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not requested or requested == authenticated:
        return authenticated
    if not is_superuser_email(authenticated):
        raise HTTPException(status_code=403, detail="Impersonation not allowed")
    return requested


def get_jwks(domain: str) -> dict:
    jwks_url = f"https://{domain}/.well-known/jwks.json"
    response = requests.get(jwks_url, timeout=10)
    response.raise_for_status()
    return response.json()


def get_token_auth_header(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")
    return auth.split(" ", 1)[1]


def decode_jwt(token: str, settings: Settings) -> dict:
    jwks = get_jwks(settings.auth0_domain)
    unverified_header = jwt.get_unverified_header(token)

    rsa_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == unverified_header.get("kid"):
            rsa_key = {
                "kty": key.get("kty"),
                "kid": key.get("kid"),
                "use": key.get("use"),
                "n": key.get("n"),
                "e": key.get("e"),
            }
            break

    if rsa_key is None:
        raise ValueError("Unable to find appropriate key")

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )
    except JWTError as exc:
        raise ValueError("Token verification failed") from exc

    return payload


def fetch_userinfo_email(token: str, domain: str) -> str | None:
    userinfo_url = f"https://{domain}/userinfo"
    response = requests.get(
        userinfo_url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if not response.ok:
        return None
    data = response.json()
    return data.get("email")


def get_request_email(request: Request, payload: dict | None, settings: Settings) -> str:
    authenticated_email = get_authenticated_email(request, payload, settings)
    requested_effective_email = request.headers.get(
        EFFECTIVE_ACCOUNT_HEADER
    ) or request.query_params.get(EFFECTIVE_ACCOUNT_QUERY_PARAM)
    effective_email = resolve_effective_email(authenticated_email, requested_effective_email)
    if effective_email != authenticated_email:
        print(
            "AUTH DEBUG: Superuser impersonation active, "
            f"authenticated={authenticated_email}, effective={effective_email}"
        )
    return effective_email


def get_authenticated_email(request: Request, payload: dict | None, settings: Settings) -> str:
    auth = request.headers.get("authorization", "")
    token = None
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    else:
        print("AUTH DEBUG: Authorization header missing or not Bearer")

    query_email = request.query_params.get("email")
    query_passcode = request.query_params.get("passcode")
    if query_email and query_passcode:
        if not verify_otp(query_email, query_passcode, settings):
            print("AUTH DEBUG: Query passcode invalid or expired for email")
            raise HTTPException(status_code=403, detail="Invalid or expired OTP")
        normalized = normalize_email(query_email)
        print(f"AUTH DEBUG: Authorized by query OTP, email: {normalized}")
        return normalized

    if token and settings.auth0_domain and settings.auth0_audience:
        print("AUTH DEBUG: Bearer token present, attempting Auth0 JWT validation")
        try:
            payload_data = decode_jwt(token, settings)
        except HTTPException:
            print("AUTH DEBUG: Auth0 JWT invalid")
            raise
        except ValueError:
            print("AUTH DEBUG: Auth0 JWT invalid")
            raise HTTPException(status_code=401, detail="Invalid token")
        email = payload_data.get("email")
        if not email:
            email = payload_data.get("https://sitnstudy.com/email")
        if not email:
            for key, value in payload_data.items():
                if key.endswith("/email"):
                    email = value
                    break
        if not email:
            email = fetch_userinfo_email(token, settings.auth0_domain)
        if not email:
            print("AUTH DEBUG: Auth0 JWT validated but email not found in token or userinfo")
            raise HTTPException(status_code=401, detail="Email not found in token")
        normalized = normalize_email(email)
        print(f"AUTH DEBUG: Authorized by Auth0 JWT, email: {normalized}")
        return normalized

    if token:
        if not settings.auth0_domain or not settings.auth0_audience:
            print("AUTH DEBUG: Bearer token present but Auth0 settings missing")
        else:
            print("AUTH DEBUG: Bearer token present but did not match a valid Auth0 JWT")
    else:
        print("AUTH DEBUG: No bearer token provided")
    raise HTTPException(status_code=401, detail="Unauthorized")


def get_email_from_token(token: str, settings: Settings) -> str | None:
    if not token or not settings.auth0_domain or not settings.auth0_audience:
        return None
    try:
        payload_data = decode_jwt(token, settings)
    except ValueError:
        return None
    email = payload_data.get("email")
    if not email:
        email = payload_data.get("https://sitnstudy.com/email")
    if not email:
        for key, value in payload_data.items():
            if key.endswith("/email"):
                email = value
                break
    if email:
        return normalize_email(email)
    fetched = fetch_userinfo_email(token, settings.auth0_domain)
    return normalize_email(fetched) if fetched else None


def is_auth0_bearer_request(request: Request, settings: Settings) -> bool:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return False
    token = auth.split(" ", 1)[1].strip()
    if not token:
        return False
    if not settings.auth0_domain or not settings.auth0_audience:
        return False
    try:
        decode_jwt(token, settings)
    except (ValueError, HTTPException):
        return False
    return True
