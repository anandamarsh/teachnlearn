from typing import Any

from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .lesson_tools import register_lesson_tools
from .section_tools import register_section_tools


def register_tools(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    register_lesson_tools(mcp, store, settings, events)
    register_section_tools(mcp, store, settings, events)
