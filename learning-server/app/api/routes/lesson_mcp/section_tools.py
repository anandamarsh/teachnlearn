from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .common import DEBOUNCE, RESULT_CACHE, cache_key, log_params


def register_section_tools(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    @mcp.tool()
    def lesson_section_get(
        lesson_id: str,
        section_key: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Get a lesson section's Markdown content.

        Use when the user wants to read a specific section of a lesson.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - section_key: one of the configured section keys (required; ask if missing)

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
        content_md: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Update an existing lesson section's Markdown content.

        Use when the user wants to save changes to a section that already exists.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - section_key: one of the configured section keys (required; ask if missing)
        - content_md: full Markdown content to store (required; ask if missing)

        Never call this tool without all required inputs.
        """
        if not email:
            return {"error": "email is required"}
        if not section_key:
            return {"error": "section_key is required"}
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        log_params(
            "lesson_section_put",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_md": content_md,
            },
        )
        cache_key_value = cache_key(
            "lesson_section_put",
            email,
            {"lesson_id": lesson_id, "section_key": section_key, "content_md": content_md},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_section_put", cache_key_value)
            return {"status": "debounced"}
        try:
            section = store.put_section(email, lesson_id, section_key, content_md, allow_create=False)
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
        content_md: str = "",
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a lesson section if it is missing, otherwise overwrite content.

        Use when the user wants to create a missing section or ensure it exists.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        - section_key: one of the configured section keys (required; ask if missing)
        Optional:
        - content_md: initial Markdown content (defaults to empty string)

        Never call this tool without email, lesson_id, and section_key.
        """
        if not email:
            return {"error": "email is required"}
        if not section_key:
            return {"error": "section_key is required"}
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        log_params(
            "lesson_section_create",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_md": content_md,
            },
        )
        cache_key_value = cache_key(
            "lesson_section_create",
            email,
            {"lesson_id": lesson_id, "section_key": section_key, "content_md": content_md},
        )
        cached = RESULT_CACHE.get(cache_key_value)
        if cached:
            return cached
        if not DEBOUNCE.should_run(cache_key_value):
            DEBOUNCE.mark_ignored("lesson_section_create", cache_key_value)
            return {"status": "debounced"}
        try:
            section = store.put_section(email, lesson_id, section_key, content_md, allow_create=True)
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
                    "sectionKey": section_key,
                },
                delay_seconds=1.0,
            )
        return section
