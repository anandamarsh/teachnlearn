import hashlib
import json
import logging
import threading
import time
from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

logger = logging.getLogger("uvicorn.error")


def _cache_key(tool: str, email: str, payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return f"{tool}:{email}:{digest}"


def _log_params(tool: str, params: dict[str, Any]) -> None:
    def scrub(value: Any) -> Any:
        if isinstance(value, str) and len(value) > 20:
            return f"{value[:20]}..."
        return value

    sanitized = {key: scrub(value) for key, value in params.items()}
    payload = json.dumps(sanitized, separators=(",", ":"))
    print(f"[DEBUG] [MCP] {tool} params={payload}")


class _DebounceGate:
    def __init__(self, delay_seconds: float = 1.0) -> None:
        self._delay = delay_seconds
        self._lock = threading.Lock()
        self._latest: dict[str, float] = {}

    def should_run(self, key: str) -> bool:
        token = time.monotonic()
        with self._lock:
            self._latest[key] = token
        time.sleep(self._delay)
        with self._lock:
            return self._latest.get(key) == token

    def mark_ignored(self, tool: str, key: str) -> None:
        print(f"[DEBUG] [MCP] debounced tool={tool} key={key}")


_DEBOUNCE = _DebounceGate(delay_seconds=1.0)


class _RecentResultCache:
    def __init__(self, ttl_seconds: float = 60.0) -> None:
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._entries: dict[str, tuple[float, dict[str, Any]]] = {}

    def _purge(self) -> None:
        now = time.monotonic()
        expired = [key for key, (ts, _) in self._entries.items() if now - ts > self._ttl]
        for key in expired:
            self._entries.pop(key, None)

    def get(self, key: str) -> dict[str, Any] | None:
        with self._lock:
            self._purge()
            entry = self._entries.get(key)
            return entry[1] if entry else None

    def set(self, key: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self._purge()
            self._entries[key] = (time.monotonic(), payload)


_RESULT_CACHE = _RecentResultCache(ttl_seconds=60.0)


def register_routes(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    @mcp.resource("lesson://user/{email}/list")
    def mcp_list_lessons(email: str) -> dict[str, Any]:
        print(f"[DEBUG] [MCP] resource=list_lessons email={email}")
        try:
            return {"lessons": store.list_all(email)}
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}

    @mcp.resource("lesson://user/{email}/status/{status}")
    def mcp_list_lessons_by_status(email: str, status: str) -> dict[str, Any]:
        print(f"[DEBUG] [MCP] resource=list_lessons_by_status email={email} status={status}")
        try:
            return {"lessons": store.list_by_status(email, status)}
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}

    @mcp.resource("lesson://user/{email}/id/{lesson_id}")
    def mcp_get_lesson(email: str, lesson_id: str) -> dict[str, Any]:
        print(f"[DEBUG] [MCP] resource=get_lesson email={email} lesson_id={lesson_id}")
        try:
            lesson = store.get(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if lesson is None:
            return {"error": "lesson not found", "id": lesson_id}
        return lesson

    @mcp.resource("lesson://user/{email}/id/{lesson_id}/sections/index")
    def mcp_get_sections_index(email: str, lesson_id: str) -> dict[str, Any]:
        print(f"[DEBUG] [MCP] resource=get_sections_index email={email} lesson_id={lesson_id}")
        try:
            index = store.get_sections_index(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        if index is None:
            return {"error": "sections index not found", "id": lesson_id}
        return index

    @mcp.resource("lesson://user/{email}/id/{lesson_id}/sections/{section_key}")
    def mcp_get_section(email: str, lesson_id: str, section_key: str) -> dict[str, Any]:
        print(
            f"[DEBUG] [MCP] resource=get_section email={email} lesson_id={lesson_id} "
            f"section_key={section_key}"
        )
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        try:
            section = store.get_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        return section

    @mcp.resource("lesson://user/{email}/id/{lesson_id}/sections/{section_key}/meta")
    def mcp_get_section_meta(email: str, lesson_id: str, section_key: str) -> dict[str, Any]:
        print(
            f"[DEBUG] [MCP] resource=get_section_meta email={email} lesson_id={lesson_id} "
            f"section_key={section_key}"
        )
        if not store.is_valid_section_key(section_key):
            return {"error": "invalid section_key", "key": section_key}
        try:
            meta = store.get_section_meta(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if meta is None:
            return {"error": "section meta not found", "key": section_key}
        return meta

    @mcp.resource("lesson://sections")
    def mcp_list_sections() -> dict[str, Any]:
        print("[DEBUG] [MCP] resource=list_sections")
        return {
            "sections": settings.lesson_sections,
            "descriptions": settings.lesson_section_descriptions,
        }

    @mcp.tool()
    def lesson_create(
        title: str,
        status: str = "draft",
        content: str | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a lesson for a user.

        Use when the user wants to create a new lesson. You must supply:
        - email: user email (required; ask the user if missing)
        - title: lesson title (required; ask the user if missing)
        Optional inputs:
        - status: defaults to "draft"
        - content: optional short summary of the uploaded report (2-3 lines). Dont include "using visual models, worked examples, guided practice, and common misconception checks."

        Never call this tool if you do not know the email or title.
        """
        if not email:
            return {"error": "email is required"}
        _log_params(
            "lesson_create",
            {"email": email, "title": title, "status": status, "content": content},
        )
        cache_key = _cache_key(
            "lesson_create",
            email,
            {"title": title, "status": status, "content": content},
        )
        cached = _RESULT_CACHE.get(cache_key)
        if cached:
            return cached
        if not _DEBOUNCE.should_run(cache_key):
            _DEBOUNCE.mark_ignored("lesson_create", cache_key)
            return {"status": "debounced"}
        try:
            lesson = store.create(email, title=title, status=status, content=content)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        _RESULT_CACHE.set(cache_key, lesson)
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
        email: str | None = None,
    ) -> dict[str, Any]:
        """Update a lesson's fields.

        Use when the user wants to update a lesson's title, status, or content.
        You must supply:
        - email: user email (required; ask the user if missing)
        - lesson_id: target lesson id (required; ask the user if missing)
        Provide at least one of:
        - title
        - status
        - content

        Never call this tool if you do not know email, lesson_id, or any field to update.
        """
        if not email:
            return {"error": "email is required"}
        _log_params(
            "lesson_update",
            {
                "email": email,
                "lesson_id": lesson_id,
                "title": title,
                "status": status,
                "content": content,
            },
        )
        cache_key = _cache_key(
            "lesson_update",
            email,
            {"lesson_id": lesson_id, "title": title, "status": status, "content": content},
        )
        cached = _RESULT_CACHE.get(cache_key)
        if cached:
            return cached
        if not _DEBOUNCE.should_run(cache_key):
            _DEBOUNCE.mark_ignored("lesson_update", cache_key)
            return {"status": "debounced"}
        try:
            lesson = store.update(email, lesson_id, title=title, status=status, content=content)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if lesson is None:
            return {"error": "lesson not found", "id": lesson_id}
        _RESULT_CACHE.set(cache_key, lesson)
        if events:
            events.publish(
                email,
                {"type": "lesson.updated", "lessonId": lesson_id},
            )
        return lesson

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
        _log_params("lesson_delete", {"email": email, "lesson_id": lesson_id})
        cache_key = _cache_key("lesson_delete", email, {"lesson_id": lesson_id})
        cached = _RESULT_CACHE.get(cache_key)
        if cached:
            return cached
        if not _DEBOUNCE.should_run(cache_key):
            _DEBOUNCE.mark_ignored("lesson_delete", cache_key)
            return {"status": "debounced"}
        try:
            deleted = store.delete(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if not deleted:
            cached = _RESULT_CACHE.get(cache_key)
            if cached:
                return cached
            return {"error": "lesson not found", "id": lesson_id}
        payload = {"status": "deleted", "id": lesson_id}
        _RESULT_CACHE.set(cache_key, payload)
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
        - status: status filter (required; ask the user if missing)

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
        _log_params(
            "lesson_section_put",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_md": content_md,
            },
        )
        cache_key = _cache_key(
            "lesson_section_put",
            email,
            {"lesson_id": lesson_id, "section_key": section_key, "content_md": content_md},
        )
        cached = _RESULT_CACHE.get(cache_key)
        if cached:
            return cached
        if not _DEBOUNCE.should_run(cache_key):
            _DEBOUNCE.mark_ignored("lesson_section_put", cache_key)
            return {"status": "debounced"}
        try:
            section = store.put_section(email, lesson_id, section_key, content_md, allow_create=False)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        _RESULT_CACHE.set(cache_key, section)
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
        _log_params(
            "lesson_section_create",
            {
                "email": email,
                "lesson_id": lesson_id,
                "section_key": section_key,
                "content_md": content_md,
            },
        )
        cache_key = _cache_key(
            "lesson_section_create",
            email,
            {"lesson_id": lesson_id, "section_key": section_key, "content_md": content_md},
        )
        cached = _RESULT_CACHE.get(cache_key)
        if cached:
            return cached
        if not _DEBOUNCE.should_run(cache_key):
            _DEBOUNCE.mark_ignored("lesson_section_create", cache_key)
            return {"status": "debounced"}
        try:
            section = store.put_section(email, lesson_id, section_key, content_md, allow_create=True)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        _RESULT_CACHE.set(cache_key, section)
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
