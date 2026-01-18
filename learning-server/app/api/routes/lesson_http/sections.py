import json

from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email, is_auth0_bearer_request
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
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        if store._section_base_key(section_key) == "exercises":
            content_type = str(payload.get("contentType") or payload.get("type") or "json")
            if content_type.lower() in ("js", "javascript"):
                code = payload.get("code")
                if code is None:
                    code = payload.get("content")
                if code is None:
                    code = payload.get("contentHtml")
                if not code:
                    return json_error("code is required", 400)
                try:
                    meta = store.put_exercise_generator(email, lesson_id, str(code))
                except (RuntimeError, ClientError) as exc:
                    return json_error(str(exc), 500)
                if meta is None:
                    return json_error("lesson not found", 404)
                if events:
                        events.publish(
                            email,
                            {
                                "type": "exercise.generator.updated",
                                "lessonId": lesson_id,
                                "updatedAt": meta.get("updatedAt"),
                            },
                        )
                return JSONResponse({"generator": meta})
            content_json = payload.get("content")
            if content_json is None:
                content_json = payload.get("contentJson")
            if content_json is None:
                content_html = payload.get("contentHtml")
                if content_html is None:
                    return json_error("content is required for exercises", 400)
            else:
                if not isinstance(content_json, list):
                    return json_error("content must be a JSON array", 400)
                content_html = json.dumps(content_json, indent=2)
        else:
            content_html = payload.get("contentHtml")
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
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        if store._section_base_key(section_key) == "exercises":
            content_type = str(payload.get("contentType") or payload.get("type") or "json")
            if content_type.lower() in ("js", "javascript"):
                code = payload.get("code")
                if code is None:
                    code = payload.get("content")
                if code is None:
                    code = payload.get("contentHtml")
                if not code:
                    return json_error("code is required", 400)
                try:
                    meta = store.put_exercise_generator(email, lesson_id, str(code))
                except (RuntimeError, ClientError) as exc:
                    return json_error(str(exc), 500)
                if meta is None:
                    return json_error("lesson not found", 404)
                if events:
                        events.publish(
                            email,
                            {
                                "type": "exercise.generator.updated",
                                "lessonId": lesson_id,
                                "updatedAt": meta.get("updatedAt"),
                            },
                        )
                return JSONResponse({"generator": meta}, status_code=201)
            content_json = payload.get("content")
            if content_json is None:
                content_json = payload.get("contentJson")
            if content_json is not None:
                if not isinstance(content_json, list):
                    return json_error("content must be a JSON array", 400)
                content_html = json.dumps(content_json, indent=2)
            else:
                content_html = payload.get("contentHtml") or "[]"
        else:
            content_html = payload.get("contentHtml")
            if content_html is None:
                content_html = ""
        create_new = bool(payload.get("createNew"))
        try:
            if create_new:
                base_key = store._section_base_key(section_key)
                section = store.create_section_instance(
                    email, lesson_id, base_key, str(content_html)
                )
            else:
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
                    "sectionKey": section.get("key", section_key),
                },
            )
        return JSONResponse(section, status_code=201)

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/{section_key}", methods=["DELETE"])
    async def delete_section(request: Request) -> JSONResponse:
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
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
        try:
            removed = store.delete_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if not removed:
            return json_error("section not found", 404)
        if events:
            events.publish(
                email,
                {
                    "type": "section.deleted",
                    "lessonId": lesson_id,
                    "sectionKey": section_key,
                },
            )
        return JSONResponse({"deleted": True, "sectionKey": section_key})

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/exercises/append", methods=["POST"])
    async def append_exercises(request: Request) -> JSONResponse:
        """Append batch items to the exercises JSON section.

        Body: {"items": [ ... ]}
        """
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        items = payload.get("items")
        if not isinstance(items, list):
            return json_error("items must be a JSON array", 400)
        section_key = payload.get("sectionKey") or "exercises"
        try:
            result = store.append_exercises(email, lesson_id, items, section_key=section_key)
        except (RuntimeError, ClientError, json.JSONDecodeError, ValueError) as exc:
            return json_error(str(exc), 500)
        if result is None:
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
        return JSONResponse(result)
