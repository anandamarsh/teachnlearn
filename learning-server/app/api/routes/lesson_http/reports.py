import json

from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.lesson_store import LessonStore

from .common import json_error, public_report_url


def register_report_routes(mcp, store: LessonStore, settings: Settings) -> None:
    @mcp.custom_route("/lesson/id/{lesson_id}/report", methods=["GET"])
    async def get_lesson_report(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        try:
            exists = store.report_exists(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if not exists:
            return json_error("report not found", 404)
        report_key = store.report_key(email, lesson_id)
        url = public_report_url(settings, report_key)
        return JSONResponse({"url": url})

    @mcp.custom_route("/lesson/id/{lesson_id}/report", methods=["POST"])
    async def create_lesson_report(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        html = payload.get("html")
        if not html:
            return json_error("html is required", 400)
        try:
            report_key = store.put_report(email, lesson_id, str(html))
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        url = public_report_url(settings, report_key)
        return JSONResponse({"url": url})
