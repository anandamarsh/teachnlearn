from typing import Any

from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .health import register_health
from .lessons import register_lesson_routes
from .reports import register_report_routes
from .sections import register_section_routes


def register_routes(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    register_health(mcp)
    register_lesson_routes(mcp, store, settings, events)
    register_section_routes(mcp, store, settings, events)
    register_report_routes(mcp, store, settings)
