import json
import re

from botocore.exceptions import ClientError
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.auth import get_request_email
from app.core.otp import verify_otp
from app.core.settings import Settings
from app.services.lesson_store import LessonStore
from app.services.lesson_store.s3 import sanitize_email

from .common import content_disposition, json_error, presigned_object_url


def register_profile_routes(mcp, store: LessonStore, settings: Settings) -> None:
    def is_pdf_attachment(name: str, content_type: str) -> bool:
        lowered_name = str(name or "").strip().lower()
        lowered_type = str(content_type or "").strip().lower()
        return lowered_name.endswith(".pdf") or "pdf" in lowered_type

    def normalize_review_status(value: object) -> str | None:
        normalized = str(value or "").strip().lower()
        if normalized in {"approved", "rejected"}:
            return normalized
        return None

    def build_teacher_lesson_progress(email: str, lesson_id: str) -> dict:
        sanitized_email = sanitize_email(email)
        lesson = store.get(email, lesson_id)
        if not lesson:
            raise RuntimeError("lesson not found")

        roster = store.get_students(email)
        raw_students = roster.get("students") if isinstance(roster, dict) else []
        students = raw_students if isinstance(raw_students, list) else []

        def sort_section_key(section_key: str) -> tuple[int, int]:
            text = str(section_key or "")
            if text == "exercises":
                return (0, 1)
            match = re.match(r"^exercises-(\d+)$", text)
            if match:
                return (0, int(match.group(1)))
            return (1, 9999)

        def normalize_section_key(section_key: str) -> str:
            text = str(section_key or "").strip()
            if text.startswith("exercise-"):
                return text.replace("exercise-", "exercises-", 1)
            if text == "exercise":
                return "exercises"
            return text

        def build_question_signature(prompt_title: str, question_html: str) -> str:
            normalized_title = re.sub(r"\s+", " ", str(prompt_title or "").strip())
            normalized_html = re.sub(r"\s+", " ", str(question_html or "").strip())
            return f"{normalized_title}::{normalized_html}"

        section_index = store.get_sections_index(email, lesson_id) or {"sections": {}}
        section_map = section_index.get("sections") if isinstance(section_index, dict) else {}
        exercise_keys = []
        if isinstance(section_map, dict):
            exercise_keys = [
                key
                for key in section_map
                if str(key) == "exercises" or str(key).startswith("exercises-")
            ]

        discovered_documents = store.list_lesson_response_documents_sanitized(
            sanitized_email, lesson_id
        )
        discovered_section_keys = {
            normalize_section_key(item.get("sectionKey") or "")
            for item in discovered_documents
        }
        exercise_keys = sorted(
            {str(key) for key in exercise_keys if key}
            | {key for key in discovered_section_keys if key},
            key=sort_section_key,
        )

        question_map: dict[str, dict] = {}
        question_key_by_signature: dict[str, str] = {}
        for section_key in exercise_keys:
            section = store.get_section(email, lesson_id, section_key) or {}
            content = section.get("content") if isinstance(section, dict) else []
            if not isinstance(content, list):
                continue
            for exercise_index, item in enumerate(content):
                if not isinstance(item, dict):
                    continue
                question_key = f"{section_key}:{exercise_index}"
                question_map[question_key] = {
                    "questionKey": question_key,
                    "sectionKey": section_key,
                    "exerciseIndex": exercise_index,
                    "promptTitle": str(item.get("promptTitle") or "").strip(),
                    "questionHtml": str(item.get("question_html") or "").strip(),
                }
                question_signature = build_question_signature(
                    str(item.get("promptTitle") or "").strip(),
                    str(item.get("question_html") or "").strip(),
                )
                if question_signature != "::":
                    question_key_by_signature[question_signature] = question_key

        student_name_by_key = {
            re.sub(r"[^a-zA-Z0-9._-]+", "_", str(student.get("name") or "").strip().lower()).strip(
                "._-"
            )
            or "student": str(student.get("name") or "").strip()
            for student in students
            if isinstance(student, dict) and str(student.get("name") or "").strip()
        }

        stored_responses_by_student: dict[str, dict[str, dict]] = {}
        for document in discovered_documents:
            section_key = normalize_section_key(document.get("sectionKey") or "")
            student_name = student_name_by_key.get(str(document.get("studentKey") or "").strip())
            if not student_name or not section_key:
                continue
            payload = store.get_student_responses_sanitized(
                sanitized_email,
                lesson_id,
                student_name,
                section_key,
            )
            responses = payload.get("responses") if isinstance(payload, dict) else []
            if not isinstance(responses, list):
                continue
            student_saved = stored_responses_by_student.setdefault(student_name, {})
            for item in responses:
                if not isinstance(item, dict):
                    continue
                exercise_index = int(item.get("exerciseIndex") or 0)
                saved_prompt_title = str(item.get("promptTitle") or "").strip()
                saved_question_html = str(item.get("questionHtml") or "").strip()
                question_signature = build_question_signature(
                    saved_prompt_title,
                    saved_question_html,
                )
                question_key = question_key_by_signature.get(question_signature) or (
                    f"{section_key}:{exercise_index}"
                )
                if question_key not in question_map:
                    question_map[question_key] = {
                        "questionKey": question_key,
                        "sectionKey": section_key,
                        "exerciseIndex": exercise_index,
                        "promptTitle": saved_prompt_title,
                        "questionHtml": saved_question_html,
                    }
                attachments = item.get("attachments") or []
                decorated_attachments = []
                if isinstance(attachments, list):
                    for attachment in attachments:
                        if not isinstance(attachment, dict):
                            continue
                        storage_key = str(attachment.get("storageKey") or "").strip()
                        decorated = dict(attachment)
                        if storage_key:
                            decorated["url"] = presigned_object_url(
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
                            decorated["previewPath"] = (
                                f"/teacher/lesson/{lesson_id}/response-attachment"
                                f"?key={storage_key}"
                            )
                        decorated_attachments.append(decorated)
                student_saved[question_key] = {
                    "questionKey": question_key,
                    "sectionKey": section_key,
                    "exerciseIndex": exercise_index,
                    "promptTitle": saved_prompt_title,
                    "questionHtml": saved_question_html,
                    "answerMarkdown": str(item.get("answerMarkdown") or ""),
                    "teacherComment": str(item.get("teacherComment") or ""),
                    "reviewStatus": normalize_review_status(item.get("reviewStatus")),
                    "attachments": decorated_attachments,
                }

        questions = sorted(
            question_map.values(),
            key=lambda item: (
                sort_section_key(str(item.get("sectionKey") or "")),
                int(item.get("exerciseIndex") or 0),
            ),
        )

        summary = {
            "studentCount": len(students),
            "answeredCount": 0,
            "partAnsweredCount": 0,
            "unansweredCount": 0,
        }

        progress_students: list[dict] = []
        for student in students:
            if not isinstance(student, dict):
                continue
            student_name = str(student.get("name") or "").strip()
            if not student_name:
                continue

            saved_responses = stored_responses_by_student.get(student_name, {})

            response_items: list[dict] = []
            answered_count = 0
            for question in questions:
                saved = saved_responses.get(question["questionKey"]) or {}
                answer_markdown = str(saved.get("answerMarkdown") or "")
                attachments = saved.get("attachments") if isinstance(saved.get("attachments"), list) else []
                answered = bool(answer_markdown.strip() or attachments)
                if answered:
                    answered_count += 1
                review_status = normalize_review_status(saved.get("reviewStatus"))
                response_items.append(
                    {
                        "questionKey": question["questionKey"],
                        "sectionKey": question["sectionKey"],
                        "exerciseIndex": question["exerciseIndex"],
                        "promptTitle": saved.get("promptTitle") or question["promptTitle"],
                        "questionHtml": saved.get("questionHtml") or question["questionHtml"],
                        "answerMarkdown": answer_markdown,
                        "teacherComment": str(saved.get("teacherComment") or ""),
                        "reviewStatus": review_status,
                        "attachments": attachments,
                        "answered": answered,
                    }
                )

            if not questions or answered_count == 0:
                status = "unanswered"
                summary["unansweredCount"] += 1
            elif answered_count == len(questions):
                status = "answered"
                summary["answeredCount"] += 1
            else:
                status = "part_answered"
                summary["partAnsweredCount"] += 1

            progress_students.append(
                {
                    "id": str(student.get("id") or "").strip(),
                    "name": student_name,
                    "status": status,
                    "answeredCount": answered_count,
                    "questionStates": [
                        item["reviewStatus"] or ("answered" if item["answered"] else "unanswered")
                        for item in response_items
                    ],
                    "responses": response_items,
                }
            )

        return {
            "summary": summary,
            "questions": questions,
            "students": progress_students,
        }

    @mcp.custom_route("/teacher/students", methods=["GET"])
    async def get_students(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            students = store.get_students(email)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(students)

    @mcp.custom_route("/teacher/students", methods=["PUT"])
    async def put_students(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        students = payload.get("students") if isinstance(payload, dict) else []
        if not isinstance(students, list):
            return json_error("students must be a list", 400)
        try:
            saved = store.put_students(email, students)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(saved)

    @mcp.custom_route("/teacher/profile", methods=["GET"])
    async def get_profile(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            profile = store.get_profile(email)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(profile)

    @mcp.custom_route("/teacher/lesson/{lesson_id}/progress", methods=["GET"])
    async def get_teacher_lesson_progress(request: Request) -> JSONResponse:
        lesson_id = str(request.path_params.get("lesson_id") or "").strip()
        if not lesson_id:
            return json_error("lesson_id is required", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            payload = build_teacher_lesson_progress(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            message = str(exc)
            status = 404 if "lesson not found" in message.lower() else 500
            return json_error(message, status)
        return JSONResponse(payload)

    @mcp.custom_route("/teacher/lesson/{lesson_id}/response-attachment", methods=["GET"])
    async def get_teacher_response_attachment(request: Request) -> Response:
        lesson_id = str(request.path_params.get("lesson_id") or "").strip()
        storage_key = str(request.query_params.get("key") or "").strip()
        if not lesson_id or not storage_key:
            return json_error("lesson_id and key are required", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        sanitized_email = sanitize_email(email)
        expected_prefix = (
            f"{settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/responses/"
        )
        if not storage_key.startswith(expected_prefix):
            return json_error("invalid attachment key", 403)
        try:
            obj = store._s3_client.get_object(
                Bucket=settings.s3_bucket,
                Key=storage_key,
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        filename = storage_key.rsplit("/", 1)[-1]
        if "-" in filename:
            filename = filename.split("-", 1)[1]
        content_type = str(obj.get("ContentType") or "application/octet-stream")
        headers = {
            "Cache-Control": "private, max-age=300",
            "Content-Disposition": content_disposition(
                filename,
                inline=content_type.lower().startswith("image/")
                or "pdf" in content_type.lower()
                or "wordprocessingml" in content_type.lower()
                or "msword" in content_type.lower(),
            ),
        }
        return Response(
            obj["Body"].read(),
            media_type=content_type,
            headers=headers,
        )

    @mcp.custom_route(
        "/teacher/lesson/{lesson_id}/student/{student_id}/response-comment",
        methods=["PUT"],
    )
    async def put_teacher_response_comment(request: Request) -> JSONResponse:
        lesson_id = str(request.path_params.get("lesson_id") or "").strip()
        student_id = str(request.path_params.get("student_id") or "").strip()
        if not lesson_id or not student_id:
            return json_error("lesson_id and student_id are required", 400)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        if not isinstance(payload, dict):
            return json_error("invalid JSON body", 400)
        section_key = str(payload.get("sectionKey") or "").strip()
        if section_key.startswith("exercise-"):
            section_key = section_key.replace("exercise-", "exercises-", 1)
        elif section_key == "exercise":
            section_key = "exercises"
        prompt_title = str(payload.get("promptTitle") or "").strip()
        question_html = str(payload.get("questionHtml") or "").strip()
        teacher_comment = str(payload.get("teacherComment") or "")
        review_status = normalize_review_status(payload.get("reviewStatus"))
        exercise_index = payload.get("exerciseIndex")
        if not section_key or not isinstance(exercise_index, int):
            return json_error("sectionKey and exerciseIndex are required", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        roster = store.get_students(email)
        students = roster.get("students") if isinstance(roster, dict) else []
        if not isinstance(students, list):
            students = []
        matched_student = next(
            (
                item
                for item in students
                if isinstance(item, dict)
                and str(item.get("id") or "").strip() == student_id
            ),
            None,
        )
        if not matched_student:
            return json_error("student not found", 404)
        student_name = str(matched_student.get("name") or "").strip()
        if not student_name:
            return json_error("student not found", 404)
        sanitized_email = sanitize_email(email)
        try:
            existing_payload = store.get_student_responses_sanitized(
                sanitized_email,
                lesson_id,
                student_name,
                section_key,
            )
            existing_responses = (
                existing_payload.get("responses") if isinstance(existing_payload, dict) else []
            )
            if not isinstance(existing_responses, list):
                existing_responses = []
            normalized_prompt_title = re.sub(r"\s+", " ", prompt_title)
            normalized_question_html = re.sub(r"\s+", " ", question_html)
            signature = f"{normalized_prompt_title}::{normalized_question_html}"
            target_index: int | None = next(
                (
                    idx
                    for idx, item in enumerate(existing_responses)
                    if isinstance(item, dict)
                    and int(item.get("exerciseIndex") or -1) == exercise_index
                ),
                None,
            )
            if target_index is None and signature != "::":
                target_index = next(
                    (
                        idx
                        for idx, item in enumerate(existing_responses)
                        if isinstance(item, dict)
                        and (
                            f"{re.sub(r'\\s+', ' ', str(item.get('promptTitle') or '').strip())}::"
                            f"{re.sub(r'\\s+', ' ', str(item.get('questionHtml') or '').strip())}"
                        )
                        == signature
                    ),
                    None,
                )
            updated_responses: list[dict] = []
            found = target_index is not None
            for idx, item in enumerate(existing_responses):
                if not isinstance(item, dict):
                    continue
                if idx != target_index:
                    updated_responses.append(item)
                    continue
                updated_item = dict(item)
                updated_item["teacherComment"] = teacher_comment
                updated_item["reviewStatus"] = review_status
                if prompt_title:
                    updated_item["promptTitle"] = prompt_title
                if question_html:
                    updated_item["questionHtml"] = question_html
                updated_responses.append(updated_item)
            if not found:
                updated_responses.append(
                    {
                        "exerciseIndex": exercise_index,
                        "promptTitle": prompt_title,
                        "questionHtml": question_html,
                        "answerMarkdown": "",
                        "teacherComment": teacher_comment,
                        "reviewStatus": review_status,
                        "attachments": [],
                    }
                )
            store.put_student_responses_sanitized(
                sanitized_email,
                lesson_id,
                student_name,
                section_key,
                updated_responses,
                [],
                [],
            )
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(
            {
                "teacherComment": teacher_comment,
                "reviewStatus": review_status,
            }
        )

    @mcp.custom_route("/teacher/profile", methods=["PUT"])
    async def put_profile(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        name = payload.get("name") if isinstance(payload, dict) else None
        school = payload.get("school") if isinstance(payload, dict) else None
        try:
            profile = store.put_profile(email, name, school)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(profile)

    @mcp.custom_route("/teacher/profile/lookup", methods=["POST"])
    async def lookup_profile(request: Request) -> JSONResponse:
        email = str(request.query_params.get("email") or "").strip()
        passcode = request.query_params.get("passcode")
        passcode = str(passcode or "").strip()
        if not email or not passcode:
            return json_error("email and passcode are required", 400)
        if not verify_otp(email, passcode, settings):
            return json_error("invalid or expired passcode", 403)
        try:
            profile = store.get_profile(email)
        except (RuntimeError, ClientError) as exc:
            return json_error(str(exc), 500)
        return JSONResponse(profile)
