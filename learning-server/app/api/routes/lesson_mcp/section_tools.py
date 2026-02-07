import json
from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .common import DEBOUNCE, RESULT_CACHE, cache_key, log_params


def _blocked_if_protected(
    store: LessonStore, email: str | None, lesson_id: str
) -> dict[str, Any] | None:
    if not email or not lesson_id:
        return None
    if store.is_protected_lesson(email, lesson_id):
        return {"error": "lesson is protected"}
    return None


def register_section_tools(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
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
    @mcp.tool()
    def lesson_section_get(
        lesson_id: str,
        section_key: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Get a lesson section's HTML content (JSON for exercises).

        Use when the user wants to read a specific section of a lesson.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - section_key: one of the configured section keys (required; ask if missing)

        The returned section content is HTML (JSON for exercises).
        Never call this tool without all three inputs.
        """
        if not email:
            return {"error": "email is required"}
        if not section_key:
            return {"error": "section_key is required"}
        if is_exercise_key(section_key):
            return {"error": "exercise sections use /sections/exercises endpoints"}
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        try:
            section = store.get_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        return section

    @mcp.tool()
    def lesson_sections_list() -> dict[str, Any]:
        """List configured lesson section keys in order.

        Use when the user asks what section types exist or needs the UI order.
        This tool takes no inputs.
        """
        return {
            "sections": settings.lesson_sections,
            "descriptions": settings.lesson_section_descriptions,
        }

    @mcp.tool()
    def lesson_section_create(
        lesson_id: str,
        section_key: str,
        content_html: str = "",
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a lesson section if it is missing, otherwise overwrite content.

        Use when the user wants to create a missing section or ensure it exists.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - section_key: one of the configured section keys (required; ask if missing)
        Optional:
        - content_html: initial HTML content (defaults to empty string)
        Never call this tool without email, lesson_id, and section_key.
        """
        if not email:
            return {"error": "email is required"}
        if not section_key:
            return {"error": "section_key is required"}
        if is_exercise_key(section_key):
            return {"error": "exercise sections use /sections/exercises endpoints"}
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        log_params(
            "lesson_section_create",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_html": content_html,
            },
        )
        cache_key_value = cache_key(
            "lesson_section_create",
            email,
            {
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_html": content_html,
            },
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_section_create", cache_key_value)
            return {"status": "debounced"}
        try:
            section = store.put_section(
                email, lesson_id, section_key, content_html, allow_create=True
            )
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        actual_key = section.get("key", section_key)
        question_count = get_exercise_question_count(email, lesson_id, actual_key)
        if question_count is None:
            return {"error": "section not found", "key": actual_key}
        response = {"sectionKey": actual_key, "noOfQuestions": question_count}
        RESULT_CACHE.set(cache_key_value, response)
        if events:
            events.publish(
                email,
                {
                    "type": "section.created",
                    "lessonId": lesson_id,
                    "sectionKey": actual_key,
                },
                delay_seconds=1.0,
            )
        return response

    @mcp.tool()
    def lesson_exercise_create(
        lesson_id: str,
        items: list[dict[str, Any]],
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a new exercises section and store items."""
        if not email:
            return {"error": "email is required"}
        if items is None:
            return {"error": "items is required"}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        log_params(
            "lesson_exercise_create",
            {"email": email, "lesson_id": lesson_id, "items": items},
        )
        cache_key_value = cache_key(
            "lesson_exercise_create",
            email,
            {"lesson_id": lesson_id, "items": items},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_exercise_create", cache_key_value)
            return {"status": "debounced"}
        try:
            content_html = json.dumps(items, indent=2)
            section = store.create_section_instance(
                email, lesson_id, "exercises", content_html
            )
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        if section is None:
            return {"error": "section not found", "key": "exercises"}
        section_key = section.get("key", "exercises")
        question_count = get_exercise_question_count(email, lesson_id, section_key)
        if question_count is None:
            return {"error": "section not found", "key": section_key}
        response = {"sectionKey": section_key, "noOfQuestions": question_count}
        RESULT_CACHE.set(cache_key_value, response)
        if events:
            events.publish(
                email,
                {
                    "type": "section.updated",
                    "lessonId": lesson_id,
                    "sectionKey": section_key,
                },
                delay_seconds=1.0,
            )
        return response

    @mcp.tool()
    def lesson_exercise_get(
        lesson_id: str,
        exercise_id: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Get a specific exercises section."""
        if not email:
            return {"error": "email is required"}
        if not exercise_id:
            return {"error": "exercise_id is required"}
        section_key = normalize_exercise_key(exercise_id)
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid exercise_id", "key": exercise_id}
        try:
            section = store.get_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        return section

    @mcp.tool()
    def lesson_exercise_append(
        lesson_id: str,
        exercise_id: str,
        items: list[dict[str, Any]],
        email: str | None = None,
    ) -> dict[str, Any]:
        """Append items to an exercises section."""
        if not email:
            return {"error": "email is required"}
        if not exercise_id:
            return {"error": "exercise_id is required"}
        if items is None:
            return {"error": "items is required"}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        section_key = normalize_exercise_key(exercise_id)
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid exercise_id", "key": exercise_id}
        log_params(
            "lesson_exercise_append",
            {
                "email": email,
                "lesson_id": lesson_id,
                "items": items,
                "section_key": section_key,
            },
        )
        cache_key_value = cache_key(
            "lesson_exercise_append",
            email,
            {"lesson_id": lesson_id, "items": items, "section_key": section_key},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_exercise_append", cache_key_value)
            return {"status": "debounced"}
        try:
            result = store.append_exercises(email, lesson_id, items, section_key=section_key)
        except (RuntimeError, ClientError, json.JSONDecodeError, ValueError) as exc:
            return {"error": str(exc)}
        if result is None:
            return {"error": "section not found", "key": section_key}
        question_count = get_exercise_question_count(email, lesson_id, section_key)
        if question_count is None:
            return {"error": "section not found", "key": section_key}
        response = {"sectionKey": section_key, "noOfQuestions": question_count}
        RESULT_CACHE.set(cache_key_value, response)
        if events:
            events.publish(
                email,
                {
                    "type": "section.updated",
                    "lessonId": lesson_id,
                    "sectionKey": section_key,
                },
                delay_seconds=1.0,
            )
        return response

    @mcp.tool()
    def lesson_exercise_delete(
        lesson_id: str,
        exercise_id: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Delete a specific exercises section."""
        if not email:
            return {"error": "email is required"}
        if not exercise_id:
            return {"error": "exercise_id is required"}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        section_key = normalize_exercise_key(exercise_id)
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid exercise_id", "key": exercise_id}
        log_params(
            "lesson_exercise_delete",
            {"email": email, "lesson_id": lesson_id, "section_key": section_key},
        )
        cache_key_value = cache_key(
            "lesson_exercise_delete",
            email,
            {"lesson_id": lesson_id, "section_key": section_key},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_exercise_delete", cache_key_value)
            return {"status": "debounced"}
        try:
            removed = store.delete_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if not removed:
            return {"error": "section not found", "key": section_key}
        result = {"deleted": True, "sectionKey": section_key}
        RESULT_CACHE.set(cache_key_value, result)
        if events:
            events.publish(
                email,
                {
                    "type": "section.deleted",
                    "lessonId": lesson_id,
                    "sectionKey": section_key,
                },
                delay_seconds=1.0,
            )
        return result

    @mcp.tool()
    def lesson_section_delete(
        lesson_id: str,
        section_key: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Delete a lesson section and its stored content.

        Use when the user needs to remove a section entirely.
        You must supply:
        - email: user email (required; ask if missing)
        - lesson_id: target lesson id (required; ask if missing)
        - section_key: section key to delete (required; ask if missing)
        """
        if not email:
            return {"error": "email is required"}
        if not section_key:
            return {"error": "section_key is required"}
        if is_exercise_key(section_key):
            return {"error": "exercise sections use /sections/exercises endpoints"}
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        log_params(
            "lesson_section_delete",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
            },
        )
        cache_key_value = cache_key(
            "lesson_section_delete",
            email,
            {"lesson_id": lesson_id, "section_key": section_key},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_section_delete", cache_key_value)
            return {"status": "debounced"}
        try:
            removed = store.delete_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if not removed:
            return {"error": "section not found", "key": section_key}
        result = {"deleted": True, "sectionKey": section_key}
        RESULT_CACHE.set(cache_key_value, result)
        if events:
            events.publish(
                email,
                {
                    "type": "section.deleted",
                    "lessonId": lesson_id,
                    "sectionKey": section_key,
                },
                delay_seconds=1.0,
            )
        return result
