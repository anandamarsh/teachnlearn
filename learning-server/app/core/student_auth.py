import base64
import hashlib
import hmac
import json
import time
from typing import Any

from starlette.requests import Request

from app.core.settings import Settings

STUDENT_SESSION_COOKIE = "tnl_student_session"


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def _get_student_session_secret(settings: Settings) -> str:
    return settings.student_session_secret or "dev-insecure-student-session-secret"


def create_student_session_token(
    teacher: str, student_id: str, student_name: str, settings: Settings
) -> str:
    payload = {
        "teacher": str(teacher or "").strip(),
        "studentId": str(student_id or "").strip(),
        "studentName": str(student_name or "").strip(),
        "exp": int(time.time()) + settings.student_session_ttl_seconds,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_part = _b64url_encode(payload_json)
    signature = hmac.new(
        _get_student_session_secret(settings).encode("utf-8"),
        payload_part.encode("ascii"),
        hashlib.sha256,
    ).digest()
    signature_part = _b64url_encode(signature)
    return f"{payload_part}.{signature_part}"


def parse_student_session_token(token: str, settings: Settings) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    payload_part, signature_part = token.split(".", 1)
    expected_signature = hmac.new(
        _get_student_session_secret(settings).encode("utf-8"),
        payload_part.encode("ascii"),
        hashlib.sha256,
    ).digest()
    provided_signature = _b64url_decode(signature_part)
    if not hmac.compare_digest(expected_signature, provided_signature):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_part).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    expires_at = payload.get("exp")
    if not isinstance(expires_at, int) or expires_at < int(time.time()):
        return None
    teacher = str(payload.get("teacher") or "").strip()
    student_id = str(payload.get("studentId") or "").strip()
    student_name = str(payload.get("studentName") or "").strip()
    if not teacher or not student_id or not student_name:
        return None
    return {
        "teacher": teacher,
        "studentId": student_id,
        "studentName": student_name,
        "exp": expires_at,
    }


def get_student_session(request: Request, settings: Settings) -> dict[str, Any] | None:
    token = str(request.cookies.get(STUDENT_SESSION_COOKIE) or "").strip()
    if not token:
        return None
    return parse_student_session_token(token, settings)
