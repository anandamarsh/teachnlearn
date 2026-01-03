import { useCallback, useState } from "react";
import { CatalogLesson, ExerciseItem, LessonSectionKey } from "../state/types";

type SectionState = {
  lessonHtml: string;
  referencesHtml: string;
  exercises: ExerciseItem[];
  loading: Record<LessonSectionKey, boolean>;
};

type UseLessonSectionsOptions = {
  lesson: CatalogLesson | null;
  fetchWithAuth: (path: string) => Promise<{ contentHtml?: string }>;
};

export const useLessonSections = ({ lesson, fetchWithAuth }: UseLessonSectionsOptions) => {
  const [lessonHtml, setLessonHtml] = useState("");
  const [referencesHtml, setReferencesHtml] = useState("");
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState<Record<LessonSectionKey, boolean>>({
    lesson: false,
    references: false,
    exercises: false,
  });

  const reset = useCallback(() => {
    setLessonHtml("");
    setReferencesHtml("");
    setExercises([]);
  }, []);

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
        const payload = await fetchWithAuth(
          `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/${sectionKey}`
        );
        if (sectionKey === "lesson") {
          setLessonHtml(payload.contentHtml || "");
        } else if (sectionKey === "references") {
          setReferencesHtml(payload.contentHtml || "");
        } else {
          const rawExercises = payload.contentHtml || "[]";
          const parsed = JSON.parse(rawExercises);
          setExercises(Array.isArray(parsed) ? parsed : []);
        }
      } finally {
        setLoading((prev) => ({ ...prev, [sectionKey]: false }));
      }
    },
    [exercises.length, fetchWithAuth, lesson, lessonHtml, loading, referencesHtml]
  );

  return {
    lessonHtml,
    referencesHtml,
    exercises,
    loading,
    loadSection,
    reset,
  };
};
