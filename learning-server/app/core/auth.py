import requests
from jose import jwt
from jose.exceptions import JWTError
from starlette.requests import Request

from app.core.settings import Settings


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


def get_request_email(request: Request, payload: dict | None, settings: Settings) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header and settings.auth0_domain and settings.auth0_audience:
        try:
            token = get_token_auth_header(request)
            payload_data = decode_jwt(token, settings)
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
            return email
        except ValueError:
            return None
    if payload and payload.get("email"):
        return str(payload["email"]).strip()
    return request.headers.get("x-user-email")


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
        return str(email)
    return fetch_userinfo_email(token, settings.auth0_domain)
