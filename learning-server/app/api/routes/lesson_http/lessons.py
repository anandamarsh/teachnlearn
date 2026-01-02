import json

from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .common import json_error


def register_lesson_routes(
    mcp, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    @mcp.custom_route("/lesson", methods=["GET"])
    async def list_lessons(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            return JSONResponse({"lessons": store.list_all(email)})
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)

    @mcp.custom_route("/lesson/{status}", methods=["GET"])
    async def list_lessons_by_status(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        status = request.path_params.get("status", "").strip()
        if not status:
            return json_error("status is required", 400)
        try:
            return JSONResponse({"lessons": store.list_by_status(email, status)})
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)

    @mcp.custom_route("/lesson/id/{lesson_id}", methods=["GET"])
    async def get_lesson(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        try:
            lesson = store.get(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if lesson is None:
            return json_error("lesson not found", 404)
        return JSONResponse(lesson)

    @mcp.custom_route("/lesson", methods=["POST"])
    async def create_lesson(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        email = get_request_email(request, payload, settings)
        if not email:
            return json_error("email is required", 400)
        title = str(payload.get("title", "")).strip()
        if not title:
            return json_error("title is required", 400)
        status = str(payload.get("status", "draft")).strip() or "draft"
        content = payload.get("content")
        try:
            lesson = store.create(email, title=title, status=status, content=content)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if events:
            events.publish(
                email,
                {"type": "lesson.created", "lessonId": lesson.get("id")},
            )
        return JSONResponse(lesson, status_code=201)

    @mcp.custom_route("/lesson/id/{lesson_id}", methods=["PUT"])
    async def update_lesson(request: Request) -> JSONResponse:
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        if not payload:
            return json_error("update payload is required", 400)
        email = get_request_email(request, payload, settings)
        if not email:
            return json_error("email is required", 400)
        title = payload.get("title")
        status = payload.get("status")
        content = payload.get("content")
        try:
            lesson = store.update(email, lesson_id, title=title, status=status, content=content)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if lesson is None:
            return json_error("lesson not found", 404)
        if events:
            events.publish(
                email,
                {"type": "lesson.updated", "lessonId": lesson_id},
            )
        return JSONResponse(lesson)

    @mcp.custom_route("/lesson/id/{lesson_id}", methods=["DELETE"])
    async def delete_lesson(request: Request) -> JSONResponse:
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            deleted = store.delete(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if not deleted:
            return json_error("lesson not found", 404)
        if events:
            events.publish(email, {"type": "lesson.deleted", "lessonId": lesson_id})
        return JSONResponse({"status": "deleted", "id": lesson_id})

    @mcp.custom_route("/lesson/id/{lesson_id}/duplicate", methods=["POST"])
    async def duplicate_lesson(request: Request) -> JSONResponse:
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            lesson = store.duplicate(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if lesson is None:
            return json_error("lesson not found", 404)
        if events:
            events.publish(
                email,
                {"type": "lesson.created", "lessonId": lesson.get("id")},
            )
        return JSONResponse(lesson, status_code=201)
