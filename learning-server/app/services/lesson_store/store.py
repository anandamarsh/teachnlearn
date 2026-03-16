from .base import LessonStoreBase
from .exercise_generator import LessonStoreExerciseGenerator
from .lessons import LessonStoreLessons
from .profile import LessonStoreProfile
from .reports import LessonStoreReports
from .responses import LessonStoreResponses
from .sections import LessonStoreSections


class LessonStore(
    LessonStoreBase,
    LessonStoreExerciseGenerator,
    LessonStoreLessons,
    LessonStoreSections,
    LessonStoreProfile,
    LessonStoreResponses,
    LessonStoreReports,
):
    pass
