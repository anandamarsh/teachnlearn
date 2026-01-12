from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .common import DEBOUNCE, RESULT_CACHE, cache_key, log_params


def register_lesson_tools(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    @mcp.tool()
    def lesson_create(
        title: str,
        status: str = "draft",
        content: str | None = None,
        subject: str | None = None,
        level: str | None = None,
        exercise_config: dict[str, int] | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a lesson for a user.

        Use when the user wants to create a new lesson. You must supply:
        - email: user email (required; ask the user if missing)
        - title: lesson title (required; ask the user if missing)
        Optional inputs:
        - status: defaults to "draft"
        - content: optional short summary of the uploaded report (2-3 lines). Dont include "using visual models, worked examples, guided practice, and common misconception checks."
        - subject: optional subject from the list ["Maths", "English", "Science", "Other"]
        - level: optional level from the list ["Foundation", "Pre School", "Year 1", "Year 2", ... "Year 12"]

        Never call this tool if you do not know the email or title.
        """
        if not email:
            return {"error": "email is required"}
        log_params(
            "lesson_create",
            {
                "email": email,
                "title": title,
                "status": status,
                "content": content,
                "subject": subject,
                "level": level,
                "exercise_config": exercise_config,
            },
        )
        cache_key_value = cache_key(
            "lesson_create",
            email,
            {
                "title": title,
                "status": status,
                "content": content,
                "subject": subject,
                "level": level,
                "exercise_config": exercise_config,
            },
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_create", cache_key_value)
            return {"status": "debounced"}
        try:
            lesson = store.create(
                email,
                title=title,
                status=status,
                content=content,
                subject=subject,
                level=level,
                exercise_config=exercise_config,
            )
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        RESULT_CACHE.set(cache_key_value, lesson)
        if events:
            events.publish(
                email,
                {"type": "lesson.created", "lessonId": lesson.get("id")},
            )
        return lesson

    @mcp.tool()
    def lesson_update(
        lesson_id: str,
        title: str | None = None,
        status: str | None = None,
        content: str | None = None,
        subject: str | None = None,
        level: str | None = None,
        exercise_config: dict[str, int] | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Update a lesson's fields.

        Use when the user wants to update a lesson's title, status, content, subject, or level.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        Provide at least one of:
        - title
        - status
        - content
        - subject
        - level

        Never call this tool if you do not know email, lesson_id, or any field to update.
        """
        if not email:
            return {"error": "email is required"}
        log_params(
            "lesson_update",
            {
                "email": email,
                "lesson_id": lesson_id,
                "title": title,
                "status": status,
                "content": content,
                "subject": subject,
                "level": level,
                "exercise_config": exercise_config,
            },
        )
        cache_key_value = cache_key(
            "lesson_update",
            email,
            {
                "lesson_id": lesson_id,
                "title": title,
                "status": status,
                "content": content,
                "subject": subject,
                "level": level,
                "exercise_config": exercise_config,
            },
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_update", cache_key_value)
            return {"status": "debounced"}
        try:
            lesson = store.update(
                email,
                lesson_id,
                title=title,
                status=status,
                content=content,
                subject=subject,
                level=level,
                exercise_config=exercise_config,
            )
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if lesson is None:
            return {"error": "lesson not found", "id": lesson_id}
        RESULT_CACHE.set(cache_key_value, lesson)
        if events:
            events.publish(
                email,
                {"type": "lesson.updated", "lessonId": lesson_id},
            )
        return lesson

    @mcp.tool()
    def lesson_exercise_generator_put(
        lesson_id: str,
        code: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Upload a lesson's exercise generator JS file.

        Use when the user provides exercise-generator.js to store for a lesson.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - code: full JS source (required; ask if missing)

        The JS must define a global `generateExercise(noOfQuestions = 5)` function
        that returns an array of exercise items with `question_html`, `type`, and `answer`.
        """
        if not email:
            return {"error": "email is required"}
        if not lesson_id:
            return {"error": "lesson_id is required"}
        if not code:
            return {"error": "code is required"}
        log_params(
            "lesson_exercise_generator_put",
            {
                "email": email,
                "lesson_id": lesson_id,
                "content_length": len(code),
            },
        )
        try:
            meta = store.put_exercise_generator(email, lesson_id, code)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        if meta is None:
            return {"error": "lesson not found", "id": lesson_id}
        if events:
            events.publish(
                email,
                {
                    "type": "exercise.generator.updated",
                    "lessonId": lesson_id,
                    "version": meta.get("version"),
                },
            )
        return meta

    @mcp.tool()
    def lesson_delete(lesson_id: str, email: str | None = None) -> dict[str, Any]:
        """Delete a lesson permanently.

        Use only when the user explicitly confirms deletion.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)

        WARNING: This action is destructive. Ask for confirmation if not already provided.
        Never call this tool without a clear confirmation and both required inputs.
        """
        if not email:
            return {"error": "email is required"}
        log_params("lesson_delete", {"email": email, "lesson_id": lesson_id})
        cache_key_value = cache_key("lesson_delete", email, {"lesson_id": lesson_id})
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_delete", cache_key_value)
            return {"status": "debounced"}
        try:
            deleted = store.delete(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if not deleted:
            cached = RESULT_CACHE.get(cache_key_value)
            if cached:
                return cached
            return {"error": "lesson not found", "id": lesson_id}
        payload = {"status": "deleted", "id": lesson_id}
        RESULT_CACHE.set(cache_key_value, payload)
        if events:
            events.publish(email, {"type": "lesson.deleted", "lessonId": lesson_id})
        return payload

    @mcp.tool()
    def lesson_list(email: str | None = None) -> dict[str, Any]:
        """List lessons for a user.

        Use when the user asks to list or browse their lessons.
        You must supply:
        - email: user email (required; ask the user if missing)

        Never call this tool without the user's email.
        """
        if not email:
            return {"error": "email is required"}
        try:
            lessons = store.list_all(email)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        return {"lessons": [{"id": item.get("id"), "title": item.get("title")} for item in lessons]}

    @mcp.tool()
    def lesson_list_by_status(status: str, email: str | None = None) -> dict[str, Any]:
        """List lessons for a user filtered by status.

        Use when the user asks for lessons in a specific status (e.g., draft, published).
        You must supply:
        - email: user email (required; ask the user if missing)
        - status: status filter (required; ask if missing)

        Never call this tool without email and status.
        """
        if not email:
            return {"error": "email is required"}
        if not status:
            return {"error": "status is required"}
        try:
            lessons = store.list_by_status(email, status)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        return {"lessons": [{"id": item.get("id"), "title": item.get("title")} for item in lessons]}
