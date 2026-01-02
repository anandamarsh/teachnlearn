from .base import LessonStoreBase
from .lessons import LessonStoreLessons
from .reports import LessonStoreReports
from .sections import LessonStoreSections


class LessonStore(
    LessonStoreBase,
    LessonStoreLessons,
    LessonStoreSections,
    LessonStoreReports,
):
    pass
