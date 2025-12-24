import json
import os
from datetime import datetime, timezone
from functools import lru_cache

import boto3
import requests
from botocore.exceptions import ClientError
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from jose.exceptions import JWTError
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.auth0_domain = os.getenv("AUTH0_DOMAIN", "")
        self.auth0_audience = os.getenv("AUTH0_AUDIENCE", "")
        self.aws_region = os.getenv("AWS_REGION", "ap-southeast-2")
        self.s3_bucket = os.getenv("S3_BUCKET", "")
        self.s3_prefix = os.getenv("S3_PREFIX", "client_data")
        self.cors_origins = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "").split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_s3_client(settings: Settings) -> boto3.client:
    return boto3.client("s3", region_name=settings.aws_region)


def sanitize_email(email: str) -> str:
    email = email.strip().lower()
    sanitized = []
    for ch in email:
        if ch.isalnum():
            sanitized.append(ch)
        elif ch == "@":
            sanitized.append("_at_")
        elif ch == ".":
            sanitized.append("_dot_")
        else:
            sanitized.append("_")
    result = "".join(sanitized).strip("_")
    print(f"[CA] Sanitized {email} -> {result}")
    return result


def get_jwks(domain: str) -> dict:
    jwks_url = f"https://{domain}/.well-known/jwks.json"
    response = requests.get(jwks_url, timeout=10)
    response.raise_for_status()
    return response.json()


def get_token_auth_header(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return auth.split(" ", 1)[1]


def decode_jwt(token: str, settings: Settings) -> dict:
    if not settings.auth0_domain or not settings.auth0_audience:
        raise HTTPException(status_code=500, detail="Auth0 settings not configured")

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
        raise HTTPException(status_code=401, detail="Unable to find appropriate key")

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Token verification failed") from exc

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


def get_current_user(request: Request, settings: Settings = Depends(get_settings)) -> dict:
    token = get_token_auth_header(request)
    payload = decode_jwt(token, settings)
    if not payload.get("email"):
        email = fetch_userinfo_email(token, settings.auth0_domain)
        if email:
            payload["email"] = email
    return payload


app = FastAPI()
settings = get_settings()
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/create")
def create_folder(user: dict = Depends(get_current_user), settings: Settings = Depends(get_settings)) -> dict:
    if not settings.s3_bucket:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email claim missing")

    sanitized = sanitize_email(email)
    timestamp = datetime.now(timezone.utc).isoformat()
    key = f"{settings.s3_prefix}/{sanitized}/timestamp.json"

    payload = json.dumps({"timestamp": timestamp})
    s3_client = get_s3_client(settings)
    s3_client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=payload.encode("utf-8"),
        ContentType="application/json",
    )

    return {"status": "created", "folder": sanitized, "timestamp": timestamp}


@app.get("/api/timestamp")
def read_timestamp(user: dict = Depends(get_current_user), settings: Settings = Depends(get_settings)) -> dict:
    if not settings.s3_bucket:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email claim missing")

    sanitized = sanitize_email(email)
    key = f"{settings.s3_prefix}/{sanitized}/timestamp.json"

    s3_client = get_s3_client(settings)
    try:
        obj = s3_client.get_object(Bucket=settings.s3_bucket, Key=key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
            raise HTTPException(status_code=404, detail="timestamp.json not found") from exc
        raise

    body = obj["Body"].read().decode("utf-8")
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        data = {"timestamp": body}

    return {"folder": sanitized, "data": data}


@app.get("/")
def root() -> dict:
    return {"service": "learning-server"}
