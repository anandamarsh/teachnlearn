import json
import re

from botocore.exceptions import ClientError
from starlette.datastructures import UploadFile
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.student_auth import get_student_session
from app.core.settings import Settings
from app.services.lesson_store import LessonStore

from .common import json_error, presigned_object_url


def register_catalog_routes(mcp, store: LessonStore, settings: Settings) -> None:
    def is_pdf_attachment(name: str, content_type: str) -> bool:
        lowered_name = str(name or "").strip().lower()
        lowered_type = str(content_type or "").strip().lower()
        return lowered_name.endswith(".pdf") or "pdf" in lowered_type

    def ensure_student_authenticated(request: Request) -> tuple[dict | None, JSONResponse | None]:
        session = get_student_session(request, settings)
        if session:
            return session, None
        return None, json_error("student authentication required", 401)

    def decorate_response_payload(payload: dict) -> dict:
        responses = payload.get("responses")
        if not isinstance(responses, list):
            responses = []
        decorated: list[dict] = []
        for item in responses:
            if not isinstance(item, dict):
                continue
            attachments = item.get("attachments")
            normalized_attachments: list[dict] = []
            if isinstance(attachments, list):
                for attachment in attachments:
                    if not isinstance(attachment, dict):
                        continue
                    storage_key = str(attachment.get("storageKey") or "").strip()
                    normalized = dict(attachment)
                    if storage_key:
                        normalized["url"] = presigned_object_url(
                            settings,
                            store._s3_client,
                            storage_key,
                            filename=str(attachment.get("name") or "file"),
                            content_type=str(attachment.get("contentType") or ""),
                            inline=is_pdf_attachment(
                                str(attachment.get("name") or ""),
                                str(attachment.get("contentType") or ""),
                            ),
                        )
                    normalized_attachments.append(normalized)
            normalized_item = dict(item)
            normalized_item["attachments"] = normalized_attachments
            decorated.append(normalized_item)
        return {
            "responses": decorated,
            "updatedAt": payload.get("updatedAt"),
        }

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
        _, auth_error = ensure_student_authenticated(request)
        if auth_error is not None:
            return auth_error
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
        session, auth_error = ensure_student_authenticated(request)
        if auth_error is not None:
            return auth_error
        if session and session.get("teacher") != teacher_id:
            return json_error("student authentication required", 401)
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
        session, auth_error = ensure_student_authenticated(request)
        if auth_error is not None:
            return auth_error
        if session and session.get("teacher") != teacher_id:
            return json_error("student authentication required", 401)
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
        session, auth_error = ensure_student_authenticated(request)
        if auth_error is not None:
            return auth_error
        if session and session.get("teacher") != teacher_id:
            return json_error("student authentication required", 401)
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
        session, auth_error = ensure_student_authenticated(request)
        if auth_error is not None:
            return auth_error
        if session and session.get("teacher") != teacher_id:
            return json_error("student authentication required", 401)
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

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/responses/{section_key}",
        methods=["GET"],
    )
    async def get_catalog_responses(request: Request) -> JSONResponse:
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not teacher_id or not lesson_id or not section_key:
            return json_error("teacher_id, lesson_id and section_key are required", 400)
        session, auth_error = ensure_student_authenticated(request)
        if auth_error is not None:
            return auth_error
        if session and session.get("teacher") != teacher_id:
            return json_error("student authentication required", 401)
        try:
            payload = store.get_student_responses_sanitized(
                teacher_id,
                lesson_id,
                str(session.get("studentName") or ""),
                section_key,
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(decorate_response_payload(payload))

    @mcp.custom_route(
        "/catalog/teacher/{teacher_id}/lesson/{lesson_id}/responses/{section_key}",
        methods=["PUT"],
    )
    async def put_catalog_responses(request: Request) -> JSONResponse:
        teacher_id = request.path_params.get("teacher_id", "").strip()
        lesson_id = request.path_params.get("lesson_id", "").strip()
        section_key = request.path_params.get("section_key", "").strip()
        if not teacher_id or not lesson_id or not section_key:
            return json_error("teacher_id, lesson_id and section_key are required", 400)
        session, auth_error = ensure_student_authenticated(request)
        if auth_error is not None:
            return auth_error
        if session and session.get("teacher") != teacher_id:
            return json_error("student authentication required", 401)

        form = await request.form()
        payload_raw = form.get("payload")
        if not isinstance(payload_raw, str):
            return json_error("payload is required", 400)
        try:
            payload = json.loads(payload_raw)
        except json.JSONDecodeError:
            return json_error("invalid payload JSON", 400)
        if not isinstance(payload, dict):
            return json_error("invalid payload JSON", 400)

        raw_responses = payload.get("responses")
        if not isinstance(raw_responses, list):
            return json_error("responses must be a list", 400)

        uploaded_files: dict[str, UploadFile] = {}
        for key, value in form.multi_items():
            if key == "payload":
                continue
            if isinstance(value, UploadFile):
                uploaded_files[key] = value

        safe_responses: list[dict] = []
        removed_storage_keys: list[str] = []
        new_files: list[dict] = []
        total_attachment_bytes = 0
        existing_payload = store.get_student_responses_sanitized(
            teacher_id,
            lesson_id,
            str(session.get("studentName") or ""),
            section_key,
        )
        existing_storage_keys = {
            str(attachment.get("storageKey") or "").strip()
            for response in existing_payload.get("responses", [])
            if isinstance(response, dict)
            for attachment in response.get("attachments", [])
            if isinstance(attachment, dict)
        }
        retained_storage_keys: set[str] = set()

        for response_item in raw_responses:
            if not isinstance(response_item, dict):
                continue
            exercise_index = response_item.get("exerciseIndex")
            if not isinstance(exercise_index, int):
                continue
            answer_markdown = str(response_item.get("answerMarkdown") or "")
            prompt_title = str(response_item.get("promptTitle") or "")
            question_html = str(response_item.get("questionHtml") or "")
            attachments = response_item.get("attachments")
            normalized_attachments: list[dict] = []
            if isinstance(attachments, list):
                for attachment in attachments:
                    if not isinstance(attachment, dict):
                        continue
                    attachment_id = str(attachment.get("id") or "").strip()
                    name = str(attachment.get("name") or "").strip()
                    content_type = str(attachment.get("contentType") or "").strip()
                    size = attachment.get("size")
                    if not attachment_id or not name or not isinstance(size, int) or size < 0:
                        continue
                    total_attachment_bytes += size
                    storage_key = str(attachment.get("storageKey") or "").strip()
                    upload_ref = str(attachment.get("uploadRef") or "").strip()
                    if storage_key:
                        retained_storage_keys.add(storage_key)
                        normalized_attachments.append(
                            {
                                "id": attachment_id,
                                "name": name,
                                "size": size,
                                "contentType": content_type,
                                "storageKey": storage_key,
                            }
                        )
                        continue
                    upload = uploaded_files.get(upload_ref)
                    if not upload:
                        continue
                    content = await upload.read()
                    safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("._-") or "file"
                    new_storage_key = (
                        f"{settings.s3_prefix}/{teacher_id}/lessons/{lesson_id}/responses/"
                        f"{re.sub(r'[^a-zA-Z0-9._-]+', '_', str(session.get('studentName') or '').strip().lower()).strip('._-') or 'student'}/"
                        f"{re.sub(r'[^a-zA-Z0-9._-]+', '_', section_key).strip('._-') or 'section'}/"
                        f"files/{attachment_id}-{safe_name}"
                    )
                    new_files.append(
                        {
                            "storageKey": new_storage_key,
                            "content": content,
                            "contentType": upload.content_type or content_type or "application/octet-stream",
                        }
                    )
                    normalized_attachments.append(
                        {
                            "id": attachment_id,
                            "name": name,
                            "size": size,
                            "contentType": upload.content_type or content_type,
                            "storageKey": new_storage_key,
                        }
                    )
                safe_responses.append(
                {
                    "exerciseIndex": exercise_index,
                    "promptTitle": prompt_title,
                    "questionHtml": question_html,
                    "answerMarkdown": answer_markdown,
                    "teacherComment": str(response_item.get("teacherComment") or ""),
                    "attachments": normalized_attachments,
                }
            )

        if total_attachment_bytes > settings.student_response_upload_limit_bytes:
            return json_error("total uploaded files exceed 2 MB", 400)

        removed_storage_keys = [
            key for key in existing_storage_keys if key and key not in retained_storage_keys
        ]

        try:
            saved = store.put_student_responses_sanitized(
                teacher_id,
                lesson_id,
                str(session.get("studentName") or ""),
                section_key,
                safe_responses,
                removed_storage_keys,
                new_files,
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(decorate_response_payload(saved))
