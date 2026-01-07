from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.lesson_store import LessonStore

from .common import json_error


def register_catalog_routes(mcp, store: LessonStore, settings: Settings) -> None:
    @mcp.custom_route("/catalog/lessons", methods=["GET"])
    async def list_catalog_lessons(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            lessons = store.list_published_catalog()
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse({"lessons": lessons})

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/sections/{section_key}",
        methods=["GET"],
    )
    async def get_catalog_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not teacher_id:
            return json_error("teacher_id is required", 400)
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not section_key:
            return json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid section_key", 400)
        try:
            section = store.get_section_sanitized(teacher_id, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
        return JSONResponse(section)

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/sections/index",
        methods=["GET"],
    )
    async def get_catalog_sections_index(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not teacher_id:
            return json_error("teacher_id is required", 400)
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        try:
            index = store.get_sections_index_sanitized(teacher_id, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if index is None:
            return json_error("sections index not found", 404)
        return JSONResponse(index)
