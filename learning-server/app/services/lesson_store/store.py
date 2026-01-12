from .base import LessonStoreBase
from .exercise_generator import LessonStoreExerciseGenerator
from .lessons import LessonStoreLessons
from .reports import LessonStoreReports
from .sections import LessonStoreSections


class LessonStore(
    LessonStoreBase,
    LessonStoreExerciseGenerator,
    LessonStoreLessons,
    LessonStoreSections,
    LessonStoreReports,
):
    pass
