from typing import Any

from botocore.exceptions import ClientError

from app.services.lesson_store import LessonStore


def register_routes(mcp: Any, store: LessonStore) -> None:
    @mcp.resource("lesson://user/{email}/list")
    def mcp_list_lessons(email: str) -> dict[str, Any]:
        try:
            return {"lessons": store.list_all(email)}
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}

    @mcp.resource("lesson://user/{email}/status/{status}")
    def mcp_list_lessons_by_status(email: str, status: str) -> dict[str, Any]:
        try:
            return {"lessons": store.list_by_status(email, status)}
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}

    @mcp.resource("lesson://user/{email}/id/{lesson_id}")
    def mcp_get_lesson(email: str, lesson_id: str) -> dict[str, Any]:
        try:
            lesson = store.get(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if lesson is None:
            return {"error": "lesson not found", "id": lesson_id}
        return lesson

    @mcp.resource("lesson://user/{email}/id/{lesson_id}/sections/index")
    def mcp_get_sections_index(email: str, lesson_id: str) -> dict[str, Any]:
        try:
            index = store.get_sections_index(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        if index is None:
            return {"error": "sections index not found", "id": lesson_id}
        return index

    @mcp.resource("lesson://user/{email}/id/{lesson_id}/sections/{section_key}")
    def mcp_get_section(email: str, lesson_id: str, section_key: str) -> dict[str, Any]:
        try:
            section = store.get_section(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        return section

    @mcp.resource("lesson://user/{email}/id/{lesson_id}/sections/{section_key}/meta")
    def mcp_get_section_meta(email: str, lesson_id: str, section_key: str) -> dict[str, Any]:
        try:
            meta = store.get_section_meta(email, lesson_id, section_key)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if meta is None:
            return {"error": "section meta not found", "key": section_key}
        return meta

    @mcp.tool()
    def lesson_create(
        title: str,
        status: str = "draft",
        content: str | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a lesson."""
        if not email:
            return {"error": "email is required"}
        try:
            lesson = store.create(email, title=title, status=status, content=content)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        return lesson

    @mcp.tool()
    def lesson_update(
        lesson_id: str,
        title: str | None = None,
        status: str | None = None,
        content: str | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Update a lesson."""
        if not email:
            return {"error": "email is required"}
        try:
            lesson = store.update(email, lesson_id, title=title, status=status, content=content)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if lesson is None:
            return {"error": "lesson not found", "id": lesson_id}
        return lesson

    @mcp.tool()
    def lesson_delete(lesson_id: str, email: str | None = None) -> dict[str, Any]:
        """Delete a lesson."""
        if not email:
            return {"error": "email is required"}
        try:
            deleted = store.delete(email, lesson_id)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "id": lesson_id}
        if not deleted:
            return {"error": "lesson not found", "id": lesson_id}
        return {"status": "deleted", "id": lesson_id}

    @mcp.tool()
    def lesson_list(email: str | None = None) -> dict[str, Any]:
        """List lessons for a user."""
        if not email:
            return {"error": "email is required"}
        try:
            lessons = store.list_all(email)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc)}
        return {"lessons": [{"id": item.get("id"), "title": item.get("title")} for item in lessons]}

    @mcp.tool()
    def lesson_list_by_status(status: str, email: str | None = None) -> dict[str, Any]:
        """List lessons for a user by status."""
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
    def lesson_section_assessment_get(lesson_id: str, email: str | None = None) -> dict[str, Any]:
        """Get the assessment section for a lesson."""
        if not email:
            return {"error": "email is required"}
        try:
            section = store.get_section(email, lesson_id, "assessment")
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": "assessment"}
        if section is None:
            return {"error": "section not found", "key": "assessment"}
        return section

    @mcp.tool()
    def lesson_section_analysis_get(lesson_id: str, email: str | None = None) -> dict[str, Any]:
        """Get the analysis section for a lesson."""
        if not email:
            return {"error": "email is required"}
        try:
            section = store.get_section(email, lesson_id, "analysis")
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": "analysis"}
        if section is None:
            return {"error": "section not found", "key": "analysis"}
        return section

    @mcp.tool()
    def lesson_section_profile_get(lesson_id: str, email: str | None = None) -> dict[str, Any]:
        """Get the profile section for a lesson."""
        if not email:
            return {"error": "email is required"}
        try:
            section = store.get_section(email, lesson_id, "profile")
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": "profile"}
        if section is None:
            return {"error": "section not found", "key": "profile"}
        return section

    @mcp.tool()
    def lesson_section_put(
        lesson_id: str,
        section_key: str,
        content_md: str,
        email: str | None = None,
    ) -> dict[str, Any]:
        """Update a lesson section."""
        if not email:
            return {"error": "email is required"}
        try:
            section = store.put_section(email, lesson_id, section_key, content_md, allow_create=False)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        return section

    @mcp.tool()
    def lesson_section_create(
        lesson_id: str,
        section_key: str,
        content_md: str = "",
        email: str | None = None,
    ) -> dict[str, Any]:
        """Create a lesson section if missing."""
        if not email:
            return {"error": "email is required"}
        try:
            section = store.put_section(email, lesson_id, section_key, content_md, allow_create=True)
        except (RuntimeError, ClientError) as exc:
            return {"error": str(exc), "key": section_key}
        if section is None:
            return {"error": "section not found", "key": section_key}
        return section
