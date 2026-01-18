import json
from io import BytesIO

from botocore.exceptions import ClientError
from PIL import Image
from starlette.datastructures import UploadFile
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore, sanitize_email

from .common import json_error, public_object_url


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

    @mcp.custom_route("/lesson/id/{lesson_id}/exercise/generator", methods=["GET"])
    async def get_exercise_generator(request: Request) -> Response:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        try:
            payload = store.get_exercise_generator_sanitized(
                sanitize_email(email), lesson_id
            )
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

    @mcp.custom_route("/lesson/id/{lesson_id}/exercise/generator", methods=["POST"])
    async def put_exercise_generator(request: Request) -> JSONResponse:
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
        code = payload.get("code")
        if code is None:
            code = payload.get("content")
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
        return JSONResponse(meta, status_code=201)

    @mcp.custom_route("/lesson", methods=["POST"])
    async def create_lesson(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        title = str(payload.get("title", "")).strip()
        if not title:
            return json_error("title is required", 400)
        status = str(payload.get("status", "draft")).strip() or "draft"
        summary = payload.get("summary")
        if summary is None:
            summary = payload.get("content")
        subject = payload.get("subject")
        level = payload.get("level")
        requires_login = payload.get("requires_login")
        if requires_login is None:
            requires_login = payload.get("requiresLogin")
        exercise_config = payload.get("exerciseConfig")
        if exercise_config is None:
            questions_per = payload.get("questionsPerExercise")
            exercises_count = payload.get("exercisesCount")
            if questions_per is not None or exercises_count is not None:
                exercise_config = {
                    "questionsPerExercise": questions_per,
                    "exercisesCount": exercises_count,
                }
        try:
            lesson = store.create(
                email,
                title=title,
                status=status,
                summary=summary,
                subject=subject,
                level=level,
                requires_login=requires_login,
                exercise_config=exercise_config,
            )
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
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        title = payload.get("title")
        status = payload.get("status")
        summary = payload.get("summary")
        if summary is None:
            summary = payload.get("content")
        subject = payload.get("subject")
        level = payload.get("level")
        requires_login = payload.get("requires_login")
        if requires_login is None:
            requires_login = payload.get("requiresLogin")
        exercise_config = payload.get("exerciseConfig")
        if exercise_config is None:
            questions_per = payload.get("questionsPerExercise")
            exercises_count = payload.get("exercisesCount")
            if questions_per is not None or exercises_count is not None:
                exercise_config = {
                    "questionsPerExercise": questions_per,
                    "exercisesCount": exercises_count,
                }
        try:
            lesson = store.update(
                email,
                lesson_id,
                title=title,
                status=status,
                summary=summary,
                subject=subject,
                level=level,
                requires_login=requires_login,
                exercise_config=exercise_config,
            )
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

    @mcp.custom_route("/lesson/id/{lesson_id}/icon", methods=["POST"])
    async def upload_lesson_icon(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        form = await request.form()
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            return json_error("file is required", 400)
        payload = await upload.read()
        if not payload:
            return json_error("file is empty", 400)
        try:
            image = Image.open(BytesIO(payload))
            image.load()
        except OSError:
            return json_error("icon must be a png, jpeg, or webp image", 400)
        if image.width != image.height:
            return json_error("icon must be square", 400)
        if image.width < 64 or image.height < 64:
            return json_error("icon must be at least 64x64", 400)
        format_name = (image.format or "").lower()
        if format_name not in {"png", "jpeg", "webp"}:
            return json_error("icon must be a png, jpeg, or webp image", 400)
        extension = "jpg" if format_name == "jpeg" else format_name
        content_type = upload.content_type or f"image/{format_name}"
        try:
            key = store.put_icon(email, lesson_id, payload, content_type, extension)
            url = public_object_url(settings, key)
            updated = store.update_icon_url(email, lesson_id, url)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        if not updated:
            return json_error("lesson not found", 404)
        if events:
            events.publish(
                email,
                {"type": "lesson.updated", "lessonId": lesson_id},
            )
        return JSONResponse({"url": url})

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
