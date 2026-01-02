from typing import Any

from app.core.settings import Settings
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

from .resources import register_resources
from .tools import register_tools


def register_routes(
    mcp: Any, store: LessonStore, settings: Settings, events: LessonEventHub | None = None
) -> None:
    register_resources(mcp, store, settings)
    register_tools(mcp, store, settings, events)
