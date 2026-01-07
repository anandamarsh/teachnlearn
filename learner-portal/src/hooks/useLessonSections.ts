import { useCallback, useEffect, useState } from "react";
import { CatalogLesson, ExerciseItem, ExerciseSection, LessonSectionKey } from "../state/types";

type SectionState = {
  lessonHtml: string;
  referencesHtml: string;
  exercises: ExerciseSection[];
  loading: Record<LessonSectionKey, boolean>;
};

type UseLessonSectionsOptions = {
  lesson: CatalogLesson | null;
  fetchWithAuth: (path: string) => Promise<{
    contentHtml?: string;
    content?: unknown;
  }>;
};

export const useLessonSections = ({ lesson, fetchWithAuth }: UseLessonSectionsOptions) => {
  const [lessonHtml, setLessonHtml] = useState("");
  const [referencesHtml, setReferencesHtml] = useState("");
  const [exercises, setExercises] = useState<ExerciseSection[]>([]);
  const [exerciseKeys, setExerciseKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState<Record<LessonSectionKey, boolean>>({
    lesson: false,
    references: false,
    exercises: false,
  });

  const reset = useCallback(() => {
    setLessonHtml("");
    setReferencesHtml("");
    setExercises([]);
    setExerciseKeys([]);
  }, []);

  const getBaseKey = (key: string) => {
    const match = key.match(/^([a-z_]+)-\d+$/);
    return match ? match[1] : key;
  };

  const getKeyIndex = (key: string) => {
    const match = key.match(/-(\d+)$/);
    if (!match) {
      return 1;
    }
    return Number(match[1]) || 1;
  };

  const sortExerciseKeys = (keys: string[]) =>
    [...keys].sort((left, right) => getKeyIndex(left) - getKeyIndex(right));

  const loadIndex = useCallback(async () => {
    if (!lesson) {
      return;
    }
    const payload = await fetchWithAuth(
      `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/index`
    );
    const sections = (payload as { sections?: Record<string, string> }).sections || {};
    const exerciseSectionKeys = Object.keys(sections).filter(
      (key) => getBaseKey(key) === "exercises"
    );
    setExerciseKeys(sortExerciseKeys(exerciseSectionKeys));
  }, [fetchWithAuth, lesson]);

  useEffect(() => {
    if (lesson) {
      loadIndex();
    }
  }, [lesson, loadIndex]);

  const loadSection = useCallback(
    async (sectionKey: LessonSectionKey) => {
      if (!lesson) {
        return;
      }
      if (loading[sectionKey]) {
        return;
      }
      if (sectionKey === "lesson" && lessonHtml) {
        return;
      }
      if (sectionKey === "references" && referencesHtml) {
        return;
      }
      if (sectionKey === "exercises" && exercises.length) {
        return;
      }
      setLoading((prev) => ({ ...prev, [sectionKey]: true }));
      try {
        if (sectionKey === "lesson") {
          const payload = await fetchWithAuth(
            `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/${sectionKey}`
          );
          setLessonHtml(payload.contentHtml || "");
          return;
        }
        if (sectionKey === "references") {
          const payload = await fetchWithAuth(
            `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/${sectionKey}`
          );
          setReferencesHtml(payload.contentHtml || "");
          return;
        }
        await loadIndex();
        const keys = exerciseKeys.length ? exerciseKeys : await (async () => {
          const payload = await fetchWithAuth(
            `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/index`
          );
          const sections = (payload as { sections?: Record<string, string> }).sections || {};
          return sortExerciseKeys(
            Object.keys(sections).filter((key) => getBaseKey(key) === "exercises")
          );
        })();
        const responses = await Promise.all(
          keys.map((key) =>
            fetchWithAuth(
              `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/${key}`
            ).then((payload) => ({ key, payload }))
          )
        );
        const nextExercises = responses.map(({ key, payload }) => {
          if (Array.isArray(payload.content)) {
            return { key, exercises: payload.content as ExerciseItem[] };
          }
          const rawExercises = payload.contentHtml || "[]";
          const parsed = JSON.parse(rawExercises);
          return {
            key,
            exercises: Array.isArray(parsed) ? parsed : [],
          };
        });
        setExercises(nextExercises);
      } finally {
        setLoading((prev) => ({ ...prev, [sectionKey]: false }));
      }
    },
    [
      exercises.length,
      exerciseKeys,
      fetchWithAuth,
      lesson,
      lessonHtml,
      loading,
      referencesHtml,
      loadIndex,
    ]
  );

  return {
    lessonHtml,
    referencesHtml,
    exercises,
    loading,
    loadSection,
    reset,
    exerciseKeys,
  };
};
