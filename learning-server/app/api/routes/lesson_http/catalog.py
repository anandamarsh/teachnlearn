from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.lesson_store import LessonStore

from .common import json_error


def register_catalog_routes(mcp, store: LessonStore, settings: Settings) -> None:
    def is_exercise_key(value: str) -> bool:
        return "exercise" in value.lower()

    def normalize_exercise_key(exercise_id: str) -> str:
        candidate = exercise_id.strip()
        lowered = candidate.lower()
        if lowered.startswith("exercises"):
            return candidate
        if lowered.startswith("exercise-"):
            suffix = candidate.split("-", 1)[1]
            if suffix.isdigit():
                index = int(suffix)
                return "exercises" if index == 1 else f"exercises-{index}"
        if lowered == "exercise":
            return "exercises"
        return candidate
    @mcp.custom_route("/catalog/lessons", methods=["GET"])
    async def list_catalog_lessons(request: Request) -> JSONResponse:
        try:
            lessons = store.list_published_catalog()
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse({"lessons": lessons})

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/sections/index",
        methods=["GET"],
    )
    async def get_catalog_sections_index(request: Request) -> JSONResponse:
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not teacher_id:
            return json_error("teacher_id is required", 400)
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        lesson = store.get_sanitized(teacher_id, lesson_id)
        if not lesson:
            return json_error("lesson not found", 404)
        requires_login = bool(lesson.get("requires_login"))
        if requires_login and not get_request_email(request, None, settings):
            return json_error("authentication required", 401)
        try:
            index = store.get_sections_index_sanitized(teacher_id, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if index is None:
            return json_error("sections index not found", 404)
        return JSONResponse(index)

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/sections/{section_key}",
        methods=["GET"],
    )
    async def get_catalog_section(request: Request) -> JSONResponse:
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not teacher_id:
            return json_error("teacher_id is required", 400)
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not section_key:
            return json_error("section_key is required", 400)
        if is_exercise_key(section_key):
            return json_error("exercise sections use /sections/exercises endpoints", 400)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid section_key", 400)
        lesson = store.get_sanitized(teacher_id, lesson_id)
        if not lesson:
            return json_error("lesson not found", 404)
        requires_login = bool(lesson.get("requires_login"))
        if requires_login and not get_request_email(request, None, settings):
            return json_error("authentication required", 401)
        try:
            section = store.get_section_sanitized(teacher_id, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
        return JSONResponse(section)

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/sections/exercises/{exercise_id}",
        methods=["GET"],
    )
    async def get_catalog_exercise_section(request: Request) -> JSONResponse:
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        exercise_id = request.path_params.get("exercise_id", "").strip()
        if not teacher_id:
            return json_error("teacher_id is required", 400)
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not exercise_id:
            return json_error("exercise_id is required", 400)
        section_key = normalize_exercise_key(exercise_id)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid exercise_id", 400)
        lesson = store.get_sanitized(teacher_id, lesson_id)
        if not lesson:
            return json_error("lesson not found", 404)
        requires_login = bool(lesson.get("requires_login"))
        if requires_login and not get_request_email(request, None, settings):
            return json_error("authentication required", 401)
        try:
            section = store.get_section_sanitized(teacher_id, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
        return JSONResponse(section)

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/exercise/generator",
        methods=["GET"],
    )
    async def get_catalog_exercise_generator(request: Request) -> Response:
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not teacher_id:
            return json_error("teacher_id is required", 400)
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        lesson = store.get_sanitized(teacher_id, lesson_id)
        if not lesson:
            return json_error("lesson not found", 404)
        requires_login = bool(lesson.get("requires_login"))
        if requires_login and not get_request_email(request, None, settings):
            return json_error("authentication required", 401)
        try:
            payload = store.get_exercise_generator_sanitized(teacher_id, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if payload is None:
            return json_error("exercise generator not found", 404)
        meta = payload.get("meta") or {}
        headers = {
            "Cache-Control": "no-store",
            "X-Exercise-Generator-Filename": str(meta.get("filename") or ""),
            "X-Exercise-Generator-Updated-At": str(meta.get("updatedAt") or ""),
        }
        return Response(
            payload.get("content", b""),
            media_type=payload.get("contentType") or "application/javascript",
            headers=headers,
        )
