import { useCallback, useEffect, useState } from "react";
import { AuthedFetch } from "../api/client";
import { CatalogLesson, ExerciseItem } from "../state/types";
import {
  getSectionBaseKey,
  getSectionsAfterBackground,
  isExercisesSection,
  normalizeSectionOrder,
} from "../utils/lessonSections";

type SectionState = {
  sectionHtml: Record<string, string>;
  exercisesBySection: Record<string, ExerciseItem[]>;
  sectionKeys: string[];
  loading: Record<string, boolean>;
  indexLoading: boolean;
};

type UseLessonSectionsOptions = {
  lesson: CatalogLesson | null;
  fetchWithAuth: AuthedFetch;
};

export const useLessonSections = ({ lesson, fetchWithAuth }: UseLessonSectionsOptions) => {
  const [sectionHtml, setSectionHtml] = useState<Record<string, string>>({});
  const [exercisesBySection, setExercisesBySection] = useState<
    Record<string, ExerciseItem[]>
  >({});
  const [sectionKeys, setSectionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [indexLoading, setIndexLoading] = useState(false);
  const [loadedSections, setLoadedSections] = useState<Record<string, boolean>>({});

  const reset = useCallback(() => {
    setSectionHtml({});
    setExercisesBySection({});
    setSectionKeys([]);
    setLoading({});
    setLoadedSections({});
  }, []);

  const loadSectionIndex = useCallback(async () => {
    if (!lesson) {
      setSectionKeys([]);
      return;
    }
    setIndexLoading(true);
    try {
      const payload = await fetchWithAuth(
        `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/index`
      );
      const ordered = normalizeSectionOrder(payload.sections);
      const filtered = ordered.filter((key) => {
        const baseKey = getSectionBaseKey(key);
        return baseKey !== "references" && baseKey !== "samples";
      });
      const baseKeys = getSectionsAfterBackground(filtered).filter(
        (key) => getSectionBaseKey(key) !== "exercises"
      );
      const exercisesCount = lesson.exerciseConfig?.exercisesCount ?? 0;
      const exerciseTabs =
        exercisesCount > 0
          ? Array.from({ length: exercisesCount }, (_, idx) => `exercise-${idx + 1}`)
          : [];
      const lessonIndex = baseKeys.findIndex(
        (key) => getSectionBaseKey(key) === "lesson"
      );
      const nextKeys =
        lessonIndex >= 0
          ? [
              ...baseKeys.slice(0, lessonIndex + 1),
              ...exerciseTabs,
              ...baseKeys.slice(lessonIndex + 1),
            ]
          : [...baseKeys, ...exerciseTabs];
      setSectionKeys(Array.from(new Set(nextKeys)));
    } finally {
      setIndexLoading(false);
    }
  }, [fetchWithAuth, lesson]);

  const setExercisesForSection = useCallback(
    (sectionKey: string, items: ExerciseItem[]) => {
      setExercisesBySection((prev) => ({ ...prev, [sectionKey]: items }));
      setLoadedSections((prev) => ({ ...prev, [sectionKey]: true }));
    },
    []
  );

  const loadSection = useCallback(
    async (sectionKey: string) => {
      if (!lesson) {
        return;
      }
      if (loading[sectionKey]) {
        return;
      }
      if (loadedSections[sectionKey]) {
        return;
      }
      const baseKey = getSectionBaseKey(sectionKey);
      if (baseKey === "exercise") {
        setExercisesBySection((prev) => ({ ...prev, [sectionKey]: [] }));
        setLoadedSections((prev) => ({ ...prev, [sectionKey]: true }));
        return;
      }
      setLoading((prev) => ({ ...prev, [sectionKey]: true }));
      try {
        const payload = await fetchWithAuth(
          `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/${sectionKey}`
        );
        if (isExercisesSection(sectionKey)) {
          if (Array.isArray(payload.content)) {
            const items = payload.content as ExerciseItem[];
            setExercisesBySection((prev) => ({ ...prev, [sectionKey]: items }));
            return;
          }
          if (
            payload.content &&
            typeof payload.content === "object" &&
            Array.isArray((payload.content as { content?: unknown }).content)
          ) {
            const items = (payload.content as { content: ExerciseItem[] }).content;
            setExercisesBySection((prev) => ({ ...prev, [sectionKey]: items }));
            return;
          }
          const rawExercises = payload.contentHtml || "[]";
          const parsed = JSON.parse(rawExercises);
          const items = Array.isArray(parsed) ? (parsed as ExerciseItem[]) : [];
          setExercisesBySection((prev) => ({
            ...prev,
            [sectionKey]: items,
          }));
          return;
        }
        setSectionHtml((prev) => ({ ...prev, [sectionKey]: payload.contentHtml || "" }));
      } finally {
        setLoading((prev) => ({ ...prev, [sectionKey]: false }));
        setLoadedSections((prev) => ({ ...prev, [sectionKey]: true }));
      }
    },
    [fetchWithAuth, lesson, loadedSections, loading]
  );

  useEffect(() => {
    loadSectionIndex();
  }, [loadSectionIndex]);

  const state: SectionState = {
    sectionHtml,
    exercisesBySection,
    sectionKeys,
    loading,
    indexLoading,
  };

  return {
    ...state,
    loadSection,
    reset,
    loadSectionIndex,
    setExercisesForSection,
  };
};
