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
    def is_exercise_key(value: str) -> bool:
        return "exercise" in value.lower()

    def get_exercise_question_count(
        email: str, lesson_id: str, section_key: str
    ) -> int | None:
        section = store.get_section(email, lesson_id, section_key)
        if section is None:
            return None
        if store._section_base_key(section_key) != "exercises":
            return 0
        content = section.get("content")
        if isinstance(content, list):
            return len(content)
        return 0

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
        if is_exercise_key(section_key):
            return json_error("exercise sections use /sections/exercises endpoints", 400)
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
        if is_exercise_key(section_key):
            return json_error("exercise sections use /sections/exercises endpoints", 400)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid section_key", 400)
        try:
            meta = store.get_section_meta(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if meta is None:
            return json_error("section meta not found", 404)
        return JSONResponse(meta)

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
        content_html = payload.get("contentHtml")
        if content_html is None:
            content_html = ""
        try:
            section = store.put_section(
                email, lesson_id, section_key, str(content_html), allow_create=True
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
        actual_key = section.get("key", section_key)
        question_count = get_exercise_question_count(email, lesson_id, actual_key)
        if question_count is None:
            return json_error("section not found", 404)
        if events:
            events.publish(
                email,
                {
                    "type": "section.created",
                    "lessonId": lesson_id,
                    "sectionKey": actual_key,
                },
            )
        return JSONResponse(
            {"sectionKey": actual_key, "noOfQuestions": question_count}, status_code=200
        )

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

    @mcp.custom_route("/lesson/id/{lesson_id}/sections/exercises", methods=["POST"])
    async def create_exercise_section(request: Request) -> JSONResponse:
        """Create a new exercises section and store the provided items."""
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
        items = payload
        if isinstance(payload, dict):
            items = payload.get("items")
        if not isinstance(items, list):
            return json_error("items must be a JSON array", 400)
        try:
            content_html = json.dumps(items, indent=2)
            section = store.create_section_instance(
                email, lesson_id, "exercises", content_html
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
        section_key = section.get("key", "exercises")
        question_count = get_exercise_question_count(email, lesson_id, section_key)
        if question_count is None:
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
        return JSONResponse({"sectionKey": section_key, "noOfQuestions": question_count})

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

    @mcp.custom_route(
        "/lesson/id/{lesson_id}/sections/exercises/{exercise_id}", methods=["GET"]
    )
    async def get_exercise_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        exercise_id = request.path_params.get("exercise_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not exercise_id:
            return json_error("exercise_id is required", 400)
        section_key = normalize_exercise_key(exercise_id)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid exercise_id", 400)
        try:
            section = store.get_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if section is None:
            return json_error("section not found", 404)
        return JSONResponse(section)

    @mcp.custom_route(
        "/lesson/id/{lesson_id}/sections/exercises/{exercise_id}", methods=["POST"]
    )
    async def append_exercise_questions(request: Request) -> JSONResponse:
        """Append items to an exercises section."""
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        exercise_id = request.path_params.get("exercise_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not exercise_id:
            return json_error("exercise_id is required", 400)
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        items = payload
        if isinstance(payload, dict):
            items = payload.get("items")
        if not isinstance(items, list):
            return json_error("items must be a JSON array", 400)
        section_key = normalize_exercise_key(exercise_id)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid exercise_id", 400)
        try:
            result = store.append_exercises(
                email, lesson_id, items, section_key=section_key
            )
        except (RuntimeError, ClientError, json.JSONDecodeError, ValueError) as exc:
            return json_error(str(exc), 500)
        if result is None:
            return json_error("section not found", 404)
        question_count = get_exercise_question_count(email, lesson_id, section_key)
        if question_count is None:
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
        return JSONResponse({"sectionKey": section_key, "noOfQuestions": question_count})

    @mcp.custom_route(
        "/lesson/id/{lesson_id}/sections/exercises/{exercise_id}", methods=["DELETE"]
    )
    async def delete_exercise_section(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        exercise_id = request.path_params.get("exercise_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        if not exercise_id:
            return json_error("exercise_id is required", 400)
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
        section_key = normalize_exercise_key(exercise_id)
        if not store.is_valid_section_key(section_key):
            return json_error("invalid exercise_id", 400)
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
