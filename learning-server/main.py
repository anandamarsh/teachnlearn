import json
import os
import secrets
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import boto3
import requests
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from fastmcp import FastMCP
from jose import jwt
from jose.exceptions import JWTError
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

load_dotenv()


@dataclass
class Lesson:
    id: str
    title: str
    status: str
    content: str | None
    created_at: str
    updated_at: str


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


class LessonStore:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._s3_client = get_s3_client(settings)

    def _ensure_bucket(self) -> None:
        if not self._settings.s3_bucket:
            raise RuntimeError("S3 bucket not configured")

    def _index_key(self, sanitized_email: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/lessons/_meta/index.json"

    def _lesson_key(self, sanitized_email: str, lesson_id: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/lesson.json"

    def _load_index(self, sanitized_email: str) -> list[dict[str, Any]]:
        self._ensure_bucket()
        key = self._index_key(sanitized_email)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return []
            raise
        body = obj["Body"].read().decode("utf-8")
        payload = json.loads(body) if body else {}
        return payload.get("lessons", [])

    def _save_index(self, sanitized_email: str, entries: list[dict[str, Any]]) -> None:
        self._ensure_bucket()
        key = self._index_key(sanitized_email)
        payload = json.dumps({"lessons": entries}, indent=2)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=payload.encode("utf-8"),
            ContentType="application/json",
        )

    def _generate_id(self, entries: list[dict[str, Any]]) -> str:
        existing = {entry.get("id") for entry in entries}
        for _ in range(100):
            candidate = f"{secrets.randbelow(1_000_000):06d}"
            if candidate not in existing:
                return candidate
        raise RuntimeError("Unable to generate unique lesson id")

    def list_all(self, email: str) -> list[dict[str, Any]]:
        sanitized = sanitize_email(email)
        with self._lock:
            return self._load_index(sanitized)

    def list_by_status(self, email: str, status: str) -> list[dict[str, Any]]:
        sanitized = sanitize_email(email)
        with self._lock:
            return [entry for entry in self._load_index(sanitized) if entry.get("status") == status]

    def get(self, email: str, lesson_id: str) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        key = self._lesson_key(sanitized, lesson_id)
        self._ensure_bucket()
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return None
            raise
        body = obj["Body"].read().decode("utf-8")
        return json.loads(body) if body else None

    def create(self, email: str, title: str, status: str, content: str | None) -> dict[str, Any]:
        sanitized = sanitize_email(email)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._ensure_bucket()
            entries = self._load_index(sanitized)
            lesson_id = self._generate_id(entries)
            lesson = Lesson(
                id=lesson_id,
                title=title,
                status=status,
                content=content,
                created_at=now,
                updated_at=now,
            )
            ensure_lesson_prefix(sanitized, lesson_id, self._settings)
            lesson_key = self._lesson_key(sanitized, lesson_id)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=lesson_key,
                Body=json.dumps(lesson.__dict__, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            entries.append(
                {
                    "id": lesson_id,
                    "title": title,
                    "status": status,
                    "updated_at": now,
                }
            )
            self._save_index(sanitized, entries)
        return lesson.__dict__

    def update(
        self,
        email: str,
        lesson_id: str,
        title: str | None,
        status: str | None,
        content: str | None,
    ) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        with self._lock:
            self._ensure_bucket()
            lesson = self.get(email, lesson_id)
            if lesson is None:
                return None
            if title is not None:
                lesson["title"] = title
            if status is not None:
                lesson["status"] = status
            if content is not None:
                lesson["content"] = content
            lesson["updated_at"] = datetime.now(timezone.utc).isoformat()
            lesson_key = self._lesson_key(sanitized, lesson_id)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=lesson_key,
                Body=json.dumps(lesson, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            entries = self._load_index(sanitized)
            updated = False
            for entry in entries:
                if entry.get("id") == lesson_id:
                    if title is not None:
                        entry["title"] = title
                    if status is not None:
                        entry["status"] = status
                    entry["updated_at"] = lesson["updated_at"]
                    updated = True
                    break
            if not updated:
                entries.append(
                    {
                        "id": lesson_id,
                        "title": lesson.get("title"),
                        "status": lesson.get("status"),
                        "updated_at": lesson["updated_at"],
                    }
                )
            self._save_index(sanitized, entries)
        return lesson

    def delete(self, email: str, lesson_id: str) -> bool:
        sanitized = sanitize_email(email)
        with self._lock:
            self._ensure_bucket()
            entries = self._load_index(sanitized)
            remaining = [entry for entry in entries if entry.get("id") != lesson_id]
            prefix = f"{self._settings.s3_prefix}/{sanitized}/lessons/{lesson_id}/"
            exists = False
            try:
                response = self._s3_client.list_objects_v2(
                    Bucket=self._settings.s3_bucket,
                    Prefix=prefix,
                    MaxKeys=1,
                )
                exists = bool(response.get("Contents"))
            except ClientError as exc:
                raise exc
            if len(remaining) == len(entries) and not exists:
                return False
            if len(remaining) != len(entries):
                self._save_index(sanitized, remaining)
            delete_lesson_prefix(sanitized, lesson_id, self._settings)
        return True


def sanitize_email(email: str) -> str:
    email = email.strip().lower()
    sanitized: list[str] = []
    for ch in email:
        if ch.isalnum():
            sanitized.append(ch)
        elif ch == "@":
            sanitized.append("_at_")
        elif ch == ".":
            sanitized.append("_dot_")
        else:
            sanitized.append("_")
    return "".join(sanitized).strip("_")


def _parse_cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]


def get_s3_client(settings: Settings) -> boto3.client:
    return boto3.client("s3", region_name=settings.aws_region)


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


def get_request_email(request: Request, payload: dict[str, Any] | None, settings: Settings) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header and settings.auth0_domain and settings.auth0_audience:
        try:
            token = get_token_auth_header(request)
            payload_data = decode_jwt(token, settings)
            email = payload_data.get("email")
            if not email:
                email = fetch_userinfo_email(token, settings.auth0_domain)
            return email
        except ValueError:
            return None
    if payload and payload.get("email"):
        return str(payload["email"]).strip()
    return request.headers.get("x-user-email")


def ensure_lesson_prefix(sanitized_email: str, lesson_id: str, settings: Settings) -> None:
    if not settings.s3_bucket:
        raise RuntimeError("S3 bucket not configured")
    s3_client = get_s3_client(settings)
    key = f"{settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/"
    s3_client.put_object(Bucket=settings.s3_bucket, Key=key, Body=b"")


def delete_lesson_prefix(sanitized_email: str, lesson_id: str, settings: Settings) -> None:
    if not settings.s3_bucket:
        raise RuntimeError("S3 bucket not configured")
    s3_client = get_s3_client(settings)
    prefix = f"{settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/"
    lesson_key = f"{prefix}lesson.json"
    # Best-effort deletes for common objects in the lesson folder.
    for key in (lesson_key, prefix):
        try:
            s3_client.delete_object(Bucket=settings.s3_bucket, Key=key)
        except ClientError:
            pass

    # Remove all versions/delete markers when bucket versioning is enabled.
    versions_paginator = s3_client.get_paginator("list_object_versions")
    version_items: list[dict[str, str]] = []
    for page in versions_paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Versions", []):
            version_items.append({"Key": obj["Key"], "VersionId": obj["VersionId"]})
        for marker in page.get("DeleteMarkers", []):
            version_items.append({"Key": marker["Key"], "VersionId": marker["VersionId"]})
    if version_items:
        s3_client.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": version_items})
        return

    paginator = s3_client.get_paginator("list_objects_v2")
    keys: list[dict[str, str]] = []
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append({"Key": obj["Key"]})
    if keys:
        s3_client.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": keys})


settings = get_settings()
store = LessonStore(settings)

mcp = FastMCP("learning-server")
cors_origins = settings.cors_origins or _parse_cors_origins()
middleware: list[Middleware] | None = None
if cors_origins:
    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "Authorization",
                "mcp-protocol-version",
                "mcp-session-id",
            ],
            expose_headers=["mcp-session-id"],
        )
    ]


def _json_error(detail: str, status_code: int) -> JSONResponse:
    return JSONResponse({"detail": detail}, status_code=status_code)


@mcp.custom_route("/health", methods=["GET"])
async def health_check(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "learning-server"})


@mcp.custom_route("/lesson", methods=["GET"])
async def list_lessons(request: Request) -> JSONResponse:
    email = get_request_email(request, None, settings)
    if not email:
        return _json_error("email is required", 400)
    try:
        return JSONResponse({"lessons": store.list_all(email)})
    except (RuntimeError, ClientError) as exc:
        return _json_error(str(exc), 500)


@mcp.custom_route("/lesson/{status}", methods=["GET"])
async def list_lessons_by_status(request: Request) -> JSONResponse:
    email = get_request_email(request, None, settings)
    if not email:
        return _json_error("email is required", 400)
    status = request.path_params.get("status", "").strip()
    if not status:
        return _json_error("status is required", 400)
    try:
        return JSONResponse({"lessons": store.list_by_status(email, status)})
    except (RuntimeError, ClientError) as exc:
        return _json_error(str(exc), 500)


@mcp.custom_route("/lesson/id/{lesson_id}", methods=["GET"])
async def get_lesson(request: Request) -> JSONResponse:
    email = get_request_email(request, None, settings)
    if not email:
        return _json_error("email is required", 400)
    lesson_id = request.path_params.get("lesson_id", "").strip()
    if not lesson_id:
        return _json_error("lesson_id is required", 400)
    try:
        lesson = store.get(email, lesson_id)
    except (RuntimeError, ClientError) as exc:
        return _json_error(str(exc), 500)
    if lesson is None:
        return _json_error("lesson not found", 404)
    return JSONResponse(lesson)


@mcp.custom_route("/lesson", methods=["POST"])
async def create_lesson(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return _json_error("invalid JSON body", 400)
    email = get_request_email(request, payload, settings)
    if not email:
        return _json_error("email is required", 400)
    title = str(payload.get("title", "")).strip()
    if not title:
        return _json_error("title is required", 400)
    status = str(payload.get("status", "draft")).strip() or "draft"
    content = payload.get("content")
    try:
        lesson = store.create(email, title=title, status=status, content=content)
    except (RuntimeError, ClientError) as exc:
        return _json_error(str(exc), 500)
    return JSONResponse(lesson, status_code=201)


@mcp.custom_route("/lesson/id/{lesson_id}", methods=["PUT"])
async def update_lesson(request: Request) -> JSONResponse:
    lesson_id = request.path_params.get("lesson_id", "").strip()
    if not lesson_id:
        return _json_error("lesson_id is required", 400)
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return _json_error("invalid JSON body", 400)
    if not payload:
        return _json_error("update payload is required", 400)
    email = get_request_email(request, payload, settings)
    if not email:
        return _json_error("email is required", 400)
    title = payload.get("title")
    status = payload.get("status")
    content = payload.get("content")
    try:
        lesson = store.update(email, lesson_id, title=title, status=status, content=content)
    except (RuntimeError, ClientError) as exc:
        return _json_error(str(exc), 500)
    if lesson is None:
        return _json_error("lesson not found", 404)
    return JSONResponse(lesson)


@mcp.custom_route("/lesson/id/{lesson_id}", methods=["DELETE"])
async def delete_lesson(request: Request) -> JSONResponse:
    lesson_id = request.path_params.get("lesson_id", "").strip()
    if not lesson_id:
        return _json_error("lesson_id is required", 400)
    email = get_request_email(request, None, settings)
    if not email:
        return _json_error("email is required", 400)
    try:
        deleted = store.delete(email, lesson_id)
    except (RuntimeError, ClientError) as exc:
        return _json_error(str(exc), 500)
    if not deleted:
        return _json_error("lesson not found", 404)
    return JSONResponse({"status": "deleted", "id": lesson_id})


@mcp.resource("lesson://user/{email}/list")
def mcp_list_lessons(email: str) -> dict[str, Any]:
    try:
        return {"lessons": store.list_all(email)}
    except (RuntimeError, ClientError) as exc:
        return {"error": str(exc)}


@mcp.resource("lesson://user/{email}/status/{status}")
def mcp_list_lessons_by_status(email: str, status: str) -> dict[str, Any]:
    try:
        return {"lessons": store.list_by_status(email, status)}
    except (RuntimeError, ClientError) as exc:
        return {"error": str(exc)}


@mcp.resource("lesson://user/{email}/id/{lesson_id}")
def mcp_get_lesson(email: str, lesson_id: str) -> dict[str, Any]:
    try:
        lesson = store.get(email, lesson_id)
    except (RuntimeError, ClientError) as exc:
        return {"error": str(exc), "id": lesson_id}
    if lesson is None:
        return {"error": "lesson not found", "id": lesson_id}
    return lesson


@mcp.tool()
def lesson_create(
    title: str,
    status: str = "draft",
    content: str | None = None,
    email: str | None = None,
) -> dict[str, Any]:
    """Create a lesson."""
    if not email:
        return {"error": "email is required"}
    try:
        lesson = store.create(email, title=title, status=status, content=content)
    except (RuntimeError, ClientError) as exc:
        return {"error": str(exc)}
    return lesson


@mcp.tool()
def lesson_update(
    lesson_id: str,
    title: str | None = None,
    status: str | None = None,
    content: str | None = None,
    email: str | None = None,
) -> dict[str, Any]:
    """Update a lesson."""
    if not email:
        return {"error": "email is required"}
    try:
        lesson = store.update(email, lesson_id, title=title, status=status, content=content)
    except (RuntimeError, ClientError) as exc:
        return {"error": str(exc), "id": lesson_id}
    if lesson is None:
        return {"error": "lesson not found", "id": lesson_id}
    return lesson


@mcp.tool()
def lesson_delete(lesson_id: str, email: str | None = None) -> dict[str, Any]:
    """Delete a lesson."""
    if not email:
        return {"error": "email is required"}
    try:
        deleted = store.delete(email, lesson_id)
    except (RuntimeError, ClientError) as exc:
        return {"error": str(exc), "id": lesson_id}
    if not deleted:
        return {"error": "lesson not found", "id": lesson_id}
    return {"status": "deleted", "id": lesson_id}


app = mcp.http_app(middleware=middleware)


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000)
