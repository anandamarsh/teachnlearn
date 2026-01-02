from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import Settings
from app.services.lesson_store import LessonStore


def register_resources(mcp: Any, store: LessonStore, settings: Settings) -> None:
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
