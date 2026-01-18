import requests
from fastapi import HTTPException
from jose import jwt
from jose.exceptions import JWTError
from starlette.requests import Request

from app.core.settings import Settings
from app.core.otp import verify_otp


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
    auth = request.headers.get("authorization", "")
    token = None
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    else:
        print("AUTH DEBUG: Authorization header missing or not Bearer")

    if token and token == settings.custom_gpt_api_key:
        email = request.query_params.get("email")
        if not email:
            print("AUTH DEBUG: CustomGPT API key valid, missing email query param")
            raise HTTPException(status_code=400, detail="Missing email query parameter")
        otp = request.query_params.get("otp")
        if not otp:
            otp = request.query_params.get("passcode")
        if not otp:
            print("AUTH DEBUG: CustomGPT API key valid, missing otp query param")
            raise HTTPException(status_code=400, detail="Missing otp query parameter")
        if not verify_otp(email, otp, settings):
            print("AUTH DEBUG: CustomGPT API key valid, invalid OTP for email")
            raise HTTPException(status_code=403, detail="Invalid or expired OTP")
        print(f"AUTH DEBUG: Authorized by CustomGPT API key, email: {email.strip()}")
        return email.strip()

    query_email = request.query_params.get("email")
    query_passcode = request.query_params.get("passcode")
    if query_email and query_passcode:
        if not verify_otp(query_email, query_passcode, settings):
            print("AUTH DEBUG: Query passcode invalid or expired for email")
            raise HTTPException(status_code=403, detail="Invalid or expired OTP")
        print(f"AUTH DEBUG: Authorized by query OTP, email: {query_email.strip()}")
        return query_email.strip()

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
        print(f"AUTH DEBUG: Authorized by Auth0 JWT, email: {str(email).strip()}")
        return str(email).strip()

    if token:
        if not settings.auth0_domain or not settings.auth0_audience:
            print("AUTH DEBUG: Bearer token present but Auth0 settings missing")
        else:
            print("AUTH DEBUG: Bearer token present but did not match CustomGPT key or valid Auth0 JWT")
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
        return str(email)
    return fetch_userinfo_email(token, settings.auth0_domain)
