import json

from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.otp import verify_otp
from app.core.settings import Settings
from app.services.lesson_store import LessonStore

from .common import json_error


def register_profile_routes(mcp, store: LessonStore, settings: Settings) -> None:
    @mcp.custom_route("/teacher/profile", methods=["GET"])
    async def get_profile(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            profile = store.get_profile(email)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(profile)

    @mcp.custom_route("/teacher/profile", methods=["PUT"])
    async def put_profile(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        name = payload.get("name") if isinstance(payload, dict) else None
        school = payload.get("school") if isinstance(payload, dict) else None
        try:
            profile = store.put_profile(email, name, school)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(profile)

    @mcp.custom_route("/teacher/profile/lookup", methods=["POST"])
    async def lookup_profile(request: Request) -> JSONResponse:
        email = str(request.query_params.get("email") or "").strip()
        passcode = request.query_params.get("passcode")
        passcode = str(passcode or "").strip()
        if not email or not passcode:
            return json_error("email and passcode are required", 400)
        if not verify_otp(email, passcode, settings):
            return json_error("invalid or expired passcode", 403)
        try:
            profile = store.get_profile(email)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(profile)
