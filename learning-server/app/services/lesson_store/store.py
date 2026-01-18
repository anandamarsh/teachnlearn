from .base import LessonStoreBase
from .exercise_generator import LessonStoreExerciseGenerator
from .lessons import LessonStoreLessons
from .profile import LessonStoreProfile
from .reports import LessonStoreReports
from .sections import LessonStoreSections


class LessonStore(
    LessonStoreBase,
    LessonStoreExerciseGenerator,
    LessonStoreLessons,
    LessonStoreSections,
    LessonStoreProfile,
    LessonStoreReports,
):
    pass
