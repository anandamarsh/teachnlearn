import json
from typing import Any

from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore


def _json_error(detail: str, status_code: int) -> JSONResponse:
    return JSONResponse({"detail": detail}, status_code=status_code)


def _public_report_url(settings: Settings, key: str) -> str:
    region = settings.aws_region or "ap-southeast-2"
    bucket = settings.s3_bucket
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def register_routes(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    @mcp.custom_route("/health", methods=["GET"])
    async def health_check(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "learning-server"})

    @mcp.custom_route("/lesson/sections/list", methods=["GET"])
    async def list_configured_sections(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        return JSONResponse(
            {
                "sections": settings.lesson_sections,
                "descriptions": settings.lesson_section_descriptions,
            }
        )

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

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/index", methods=["GET"])
    async def get_sections_index(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return _json_error("lesson_id is required", 400)
        try:
            index = store.get_sections_index(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return _json_error(str(exc), 500)
        if index is None:
            return _json_error("sections index not found", 404)
        return JSONResponse(index)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}", methods=["GET"])
    async def get_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return _json_error("lesson_id is required", 400)
        if not section_key:
            return _json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return _json_error("invalid section_key", 400)
        try:
            section = store.get_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return _json_error(str(exc), 500)
        if section is None:
            return _json_error("section not found", 404)
        return JSONResponse(section)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}/meta", methods=["GET"])
    async def get_section_meta(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return _json_error("lesson_id is required", 400)
        if not section_key:
            return _json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return _json_error("invalid section_key", 400)
        try:
            meta = store.get_section_meta(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return _json_error(str(exc), 500)
        if meta is None:
            return _json_error("section meta not found", 404)
        return JSONResponse(meta)

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
        if events:
            events.publish(
                email,
                {"type": "lesson.updated", "lessonId": lesson_id},
            )
        return JSONResponse(lesson)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}", methods=["PUT"])
    async def update_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return _json_error("lesson_id is required", 400)
        if not section_key:
            return _json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return _json_error("invalid section_key", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return _json_error("invalid JSON body", 400)
        content_md = payload.get("contentMd")
        if content_md is None:
            return _json_error("contentMd is required", 400)
        try:
            section = store.put_section(email, lesson_id, section_key, str(content_md), allow_create=False)
        except (RuntimeError, ClientError) as exc:
            return _json_error(str(exc), 500)
        if section is None:
            return _json_error("section not found", 404)
        if events:
            events.publish(
                email,
                {
                    "type": "section.updated",
                    "lessonId": lesson_id,
                    "sectionKey": section_key,
                },
            )
        return JSONResponse(section)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}", methods=["POST"])
    async def create_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return _json_error("lesson_id is required", 400)
        if not section_key:
            return _json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return _json_error("invalid section_key", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return _json_error("invalid JSON body", 400)
        content_md = payload.get("contentMd", "")
        try:
            section = store.put_section(email, lesson_id, section_key, str(content_md), allow_create=True)
        except (RuntimeError, ClientError) as exc:
            return _json_error(str(exc), 500)
        if section is None:
            return _json_error("section not found", 404)
        if events:
            events.publish(
                email,
                {
                    "type": "section.created",
                    "lessonId": lesson_id,
                    "sectionKey": section_key,
                },
            )
        return JSONResponse(section, status_code=201)

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
        if events:
            events.publish(email, {"type": "lesson.deleted", "lessonId": lesson_id})
        return JSONResponse({"status": "deleted", "id": lesson_id})

    @mcp.custom_route("/lesson/id/{lesson_id}/report", methods=["GET"])
    async def get_lesson_report(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return _json_error("lesson_id is required", 400)
        try:
            exists = store.report_exists(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return _json_error(str(exc), 500)
        if not exists:
            return _json_error("report not found", 404)
        report_key = store.report_key(email, lesson_id)
        url = _public_report_url(settings, report_key)
        return JSONResponse({"url": url})

    @mcp.custom_route("/lesson/id/{lesson_id}/report", methods=["POST"])
    async def create_lesson_report(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return _json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return _json_error("lesson_id is required", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return _json_error("invalid JSON body", 400)
        html = payload.get("html")
        if not html:
            return _json_error("html is required", 400)
        try:
            report_key = store.put_report(email, lesson_id, str(html))
        except (RuntimeError, ClientError) as exc:
            return _json_error(str(exc), 500)
        url = _public_report_url(settings, report_key)
        return JSONResponse({"url": url})
