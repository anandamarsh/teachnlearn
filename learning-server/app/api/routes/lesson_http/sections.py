import json

from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .common import json_error


def register_section_routes(
    mcp, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    @mcp.custom_route("/lesson/sections/list", methods=["GET"])
    async def list_configured_sections(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        return JSONResponse(
            {
                "sections": settings.lesson_sections,
                "descriptions": settings.lesson_section_descriptions,
            }
        )

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/index", methods=["GET"])
    async def get_sections_index(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        try:
            index = store.get_sections_index(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if index is None:
            return json_error("sections index not found", 404)
        return JSONResponse(index)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}", methods=["GET"])
    async def get_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not section_key:
            return json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid section_key", 400)
        try:
            section = store.get_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
        return JSONResponse(section)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}/meta", methods=["GET"])
    async def get_section_meta(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not section_key:
            return json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid section_key", 400)
        try:
            meta = store.get_section_meta(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if meta is None:
            return json_error("section meta not found", 404)
        return JSONResponse(meta)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}", methods=["PUT"])
    async def update_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not section_key:
            return json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid section_key", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        content_html = payload.get("contentHtml")
        if content_html is None:
            content_html = payload.get("contentMd")
        if content_html is None:
            return json_error("contentHtml is required", 400)
        try:
            section = store.put_section(
                email, lesson_id, section_key, str(content_html), allow_create=False
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
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
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not section_key:
            return json_error("section_key is required", 400)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid section_key", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        content_html = payload.get("contentHtml")
        if content_html is None:
            content_html = payload.get("contentMd", "")
        try:
            section = store.put_section(
                email, lesson_id, section_key, str(content_html), allow_create=True
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
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
