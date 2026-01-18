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
    def lesson_section_put(
        lesson_id: str,
        section_key: str,
        content_html: str,
        content_type: str = "json",
        code: str | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Update an existing lesson section's HTML content (JSON for exercises).

        Use when the user wants to save changes to a section that already exists.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - section_key: one of the configured section keys (required; ask if missing)
        - content_html: full HTML content to store (JSON for exercises; required; ask if missing)

        For exercises:
        - content_type: "json" (default) or "js"
        - when content_type is "js", send code (or content_html) as JS source
        The content must be HTML (JSON for exercises) unless using content_type="js".

        Never call this tool without all required inputs.
        """
        if not email:
            return {"error": "email is required"}
        if not section_key:
            return {"error": "section_key is required"}
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        if store._section_base_key(section_key) == "exercises" and content_type.lower() in (
            "js",
            "javascript",
        ):
            source = code if code is not None else content_html
            if not source:
                return {"error": "code is required"}
            log_params(
                "lesson_exercise_generator_put",
                {
                    "email": email,
                    "lesson_id": lesson_id,
                    "content_length": len(source),
                },
            )
            try:
                meta = store.put_exercise_generator(email, lesson_id, source)
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
                        "updatedAt": meta.get("updatedAt"),
                    },
                )
            return {"generator": meta}
        log_params(
            "lesson_section_put",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_html": content_html,
            },
        )
        cache_key_value = cache_key(
            "lesson_section_put",
            email,
            {"lesson_id": lesson_id, "section_key": section_key, "content_html": content_html},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_section_put", cache_key_value)
            return {"status": "debounced"}
        try:
            section = store.put_section(
                email, lesson_id, section_key, content_html, allow_create=False
            )
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        RESULT_CACHE.set(cache_key_value, section)
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
        return section

    @mcp.tool()
    def lesson_section_create(
        lesson_id: str,
        section_key: str,
        content_html: str = "",
        create_new: bool = False,
        content_type: str = "json",
        code: str | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a lesson section if it is missing, otherwise overwrite content.

        Use when the user wants to create a missing section or ensure it exists.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - section_key: one of the configured section keys (required; ask if missing)
        Optional:
        - content_html: initial HTML content (JSON for exercises; defaults to empty string)
        - create_new: when true, creates a new instance for multi sections (lesson/exercises)

        For exercises:
        - content_type: "json" (default) or "js"
        - when content_type is "js", send code (or content_html) as JS source
        The content must be HTML (JSON for exercises) unless using content_type="js".
        Never call this tool without email, lesson_id, and section_key.
        """
        if not email:
            return {"error": "email is required"}
        if not section_key:
            return {"error": "section_key is required"}
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        if store._section_base_key(section_key) == "exercises" and content_type.lower() in (
            "js",
            "javascript",
        ):
            source = code if code is not None else content_html
            if not source:
                return {"error": "code is required"}
            log_params(
                "lesson_exercise_generator_put",
                {
                    "email": email,
                    "lesson_id": lesson_id,
                    "content_length": len(source),
                },
            )
            try:
                meta = store.put_exercise_generator(email, lesson_id, source)
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
                        "updatedAt": meta.get("updatedAt"),
                    },
                )
            return {"generator": meta}
        log_params(
            "lesson_section_create",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_html": content_html,
                "create_new": create_new,
            },
        )
        cache_key_value = cache_key(
            "lesson_section_create",
            email,
            {
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_html": content_html,
                "create_new": create_new,
            },
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_section_create", cache_key_value)
            return {"status": "debounced"}
        try:
            if create_new:
                base_key = store._section_base_key(section_key)
                section = store.create_section_instance(
                    email, lesson_id, base_key, content_html
                )
            else:
                section = store.put_section(
                    email, lesson_id, section_key, content_html, allow_create=True
                )
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        RESULT_CACHE.set(cache_key_value, section)
        if events:
            events.publish(
                email,
                {
                    "type": "section.created",
                    "lessonId": lesson_id,
                    "sectionKey": section.get("key", section_key),
                },
                delay_seconds=1.0,
            )
        return section

    @mcp.tool()
    def lesson_exercises_append(
        lesson_id: str,
        items: list[dict[str, Any]],
        section_key: str = "exercises",
        email: str | None = None,
    ) -> dict[str, Any]:
        """Append batch items to the exercises JSON section.

        Use when the user needs to append exercises in batches (JSON array).
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - items: list of exercise objects to append (required; ask if missing)
        - section_key: exercises section key (optional; defaults to "exercises")

        This tool only appends to the exercises section. It does not overwrite.
        """
        if not email:
            return {"error": "email is required"}
        if not items:
            return {"error": "items is required"}
        blocked = _blocked_if_protected(store, email, lesson_id)
        if blocked:
            return blocked
        log_params(
            "lesson_exercises_append",
            {"email": email, "lesson_id": lesson_id, "items": items, "section_key": section_key},
        )
        cache_key_value = cache_key(
            "lesson_exercises_append",
            email,
            {"lesson_id": lesson_id, "items": items, "section_key": section_key},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_exercises_append", cache_key_value)
            return {"status": "debounced"}
        try:
            result = store.append_exercises(email, lesson_id, items, section_key=section_key)
        except (RuntimeError, ClientError, json.JSONDecodeError, ValueError) as exc:
            return {"error": str(exc)}
        if result is None:
            return {"error": "section not found", "key": "exercises"}
        RESULT_CACHE.set(cache_key_value, result)
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
