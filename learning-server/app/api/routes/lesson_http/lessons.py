import json
from io import BytesIO
import base64
import binascii

from botocore.exceptions import ClientError
from PIL import Image
from starlette.datastructures import UploadFile
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.auth import get_request_email, is_auth0_bearer_request
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
            print("ICON UPLOAD: missing email")
            return json_error("email is required", 400)
        lesson_id = request.path_params.get("lesson_id", "").strip()
        if not lesson_id:
            print("ICON UPLOAD: missing lesson_id")
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
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
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

    @mcp.custom_route("/lesson/with-sections", methods=["POST"])
    async def create_lesson_with_sections(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        if not isinstance(payload, dict):
            return json_error("invalid JSON body", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        lesson_payload = payload.get("lesson")
        if lesson_payload is None:
            lesson_payload = payload
        if not isinstance(lesson_payload, dict):
            return json_error("lesson payload must be an object", 400)
        title = str(lesson_payload.get("title", "")).strip()
        if not title:
            return json_error("title is required", 400)
        status = str(lesson_payload.get("status", "draft")).strip() or "draft"
        summary = lesson_payload.get("summary")
        if summary is None:
            summary = lesson_payload.get("content")
        subject = lesson_payload.get("subject")
        level = lesson_payload.get("level")
        requires_login = lesson_payload.get("requires_login")
        if requires_login is None:
            requires_login = lesson_payload.get("requiresLogin")
        exercise_config = lesson_payload.get("exerciseConfig")
        if exercise_config is None:
            questions_per = lesson_payload.get("questionsPerExercise")
            exercises_count = lesson_payload.get("exercisesCount")
            if questions_per is not None or exercises_count is not None:
                exercise_config = {
                    "questionsPerExercise": questions_per,
                    "exercisesCount": exercises_count,
                }
        sections_payload = payload.get("sections") or {}
        if not isinstance(sections_payload, dict):
            return json_error("sections must be an object", 400)
        required_section_keys = ("assessment", "concepts", "background", "lesson")
        missing_sections = [
            key for key in required_section_keys if key not in sections_payload
        ]
        if missing_sections:
            return json_error(
                f"missing required sections: {', '.join(missing_sections)}", 400
            )
        required_section_set = set(required_section_keys)
        prepared_sections: list[dict[str, str | bool]] = []
        for raw_key, raw_value in sections_payload.items():
            section_key = str(raw_key).strip()
            if not section_key:
                return json_error("section_key is required", 400)
            if not store.is_valid_section_key(section_key):
                return json_error("invalid section_key", 400)
            base_key = store._section_base_key(section_key)
            content_html: str | None = None
            generator_code: str | None = None
            create_new = False
            if isinstance(raw_value, dict):
                create_new = bool(raw_value.get("createNew"))
                content_type = str(
                    raw_value.get("contentType") or raw_value.get("type") or "html"
                )
                if base_key == "exercises" and content_type.lower() in (
                    "js",
                    "javascript",
                ):
                    generator_code = raw_value.get("code")
                    if generator_code is None:
                        generator_code = raw_value.get("content")
                    if generator_code is None:
                        generator_code = raw_value.get("contentHtml")
                    if not generator_code:
                        return json_error("code is required", 400)
                else:
                    content_json = raw_value.get("content")
                    if content_json is None:
                        content_json = raw_value.get("contentJson")
                    if content_json is not None:
                        if not isinstance(content_json, list):
                            return json_error("content must be a JSON array", 400)
                        content_html = json.dumps(content_json, indent=2)
                    else:
                        content_html = raw_value.get("contentHtml")
                        if content_html is None:
                            content_html = raw_value.get("content")
            elif isinstance(raw_value, list):
                if base_key != "exercises":
                    return json_error("contentHtml is required", 400)
                content_html = json.dumps(raw_value, indent=2)
            else:
                content_html = str(raw_value)
            if generator_code is not None:
                prepared_sections.append(
                    {"key": section_key, "generator_code": str(generator_code)}
                )
            else:
                if section_key in required_section_set:
                    if content_html is None or not str(content_html).strip():
                        return json_error(
                            f"content is required for section '{section_key}'", 400
                        )
                if content_html is None:
                    content_html = ""
                prepared_sections.append(
                    {
                        "key": section_key,
                        "content_html": str(content_html),
                        "create_new": bool(create_new),
                        "base_key": base_key,
                    }
                )
        generator_payload = payload.get("exerciseGenerator") or payload.get(
            "exercise_generator"
        )
        generator_code = None
        if isinstance(generator_payload, dict):
            generator_code = generator_payload.get("code")
            if generator_code is None:
                generator_code = generator_payload.get("content")
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
        lesson_id = lesson.get("id")
        results: dict[str, dict[str, object]] = {}
        for item in prepared_sections:
            if "generator_code" in item:
                try:
                    meta = store.put_exercise_generator(
                        email, lesson_id, str(item["generator_code"])
                    )
                except (RuntimeError, ClientError) as exc:
                    return json_error(str(exc), 500)
                if meta is None:
                    return json_error("lesson not found", 404)
                results[str(item["key"])] = {"generator": meta}
                if events:
                    events.publish(
                        email,
                        {
                            "type": "exercise.generator.updated",
                            "lessonId": lesson_id,
                            "updatedAt": meta.get("updatedAt"),
                        },
                    )
                continue
            try:
                if item.get("create_new"):
                    section = store.create_section_instance(
                        email,
                        lesson_id,
                        str(item["base_key"]),
                        str(item["content_html"]),
                    )
                else:
                    section = store.put_section(
                        email,
                        lesson_id,
                        str(item["key"]),
                        str(item["content_html"]),
                        allow_create=True,
                    )
            except (RuntimeError, ClientError) as exc:
                return json_error(str(exc), 500)
            if section is None:
                return json_error("section not found", 404)
            results[str(section.get("key", item["key"]))] = section
            if events:
                event_type = (
                    "section.created" if item.get("create_new") else "section.updated"
                )
                events.publish(
                    email,
                    {
                        "type": event_type,
                        "lessonId": lesson_id,
                        "sectionKey": section.get("key", item["key"]),
                    },
                )
        if generator_code:
            try:
                meta = store.put_exercise_generator(email, lesson_id, str(generator_code))
            except (RuntimeError, ClientError) as exc:
                return json_error(str(exc), 500)
            if meta is None:
                return json_error("lesson not found", 404)
            results["exerciseGenerator"] = {"generator": meta}
            if events:
                events.publish(
                    email,
                    {
                        "type": "exercise.generator.updated",
                        "lessonId": lesson_id,
                        "updatedAt": meta.get("updatedAt"),
                    },
                )
        return JSONResponse({"lesson": lesson, "sections": results}, status_code=201)

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
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
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
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
        payload: bytes | None = None
        content_type: str | None = None
        extension: str | None = None

        if request.headers.get("content-type", "").startswith("application/json"):
            try:
                body = await request.json()
            except json.JSONDecodeError:
                print("ICON UPLOAD: invalid JSON body")
                return json_error("invalid JSON body", 400)
            if not isinstance(body, dict):
                print("ICON UPLOAD: JSON body is not an object")
                return json_error("invalid JSON body", 400)
            file_base64 = str(body.get("fileBase64") or "").strip()
            if not file_base64:
                print("ICON UPLOAD: missing fileBase64")
                return json_error("fileBase64 is required", 400)
            if "," in file_base64 and file_base64.startswith("data:"):
                header, b64_data = file_base64.split(",", 1)
                if ";base64" in header:
                    content_type = header[5:].split(";", 1)[0].strip() or None
                file_base64 = b64_data
            try:
                payload = base64.b64decode(file_base64, validate=True)
            except (binascii.Error, ValueError):
                print("ICON UPLOAD: invalid base64 payload")
                return json_error("fileBase64 must be valid base64", 400)
        else:
            form = await request.form()
            upload = form.get("file")
            if not isinstance(upload, UploadFile):
                print("ICON UPLOAD: multipart missing file")
                return json_error("file is required", 400)
            payload = await upload.read()
            content_type = upload.content_type or None

        if not payload:
            print("ICON UPLOAD: empty file payload")
            return json_error("file is empty", 400)

        try:
            image = Image.open(BytesIO(payload))
            image.load()
        except OSError:
            print("ICON UPLOAD: invalid image format")
            return json_error("icon must be a png, jpeg, or webp image", 400)
        if image.width != image.height:
            print("ICON UPLOAD: image not square")
            return json_error("icon must be square", 400)
        if image.width < 64 or image.height < 64:
            print("ICON UPLOAD: image too small")
            return json_error("icon must be at least 64x64", 400)
        format_name = (image.format or "").lower()
        if format_name not in {"png", "jpeg", "webp"}:
            print("ICON UPLOAD: unsupported image format")
            return json_error("icon must be a png, jpeg, or webp image", 400)
        extension = "jpg" if format_name == "jpeg" else format_name
        if not content_type:
            content_type = f"image/{format_name}"
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
        if store.is_protected_lesson(email, lesson_id) and not is_auth0_bearer_request(
            request, settings
        ):
            return json_error("lesson is protected", 403)
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
