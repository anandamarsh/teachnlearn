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
      const orderedAfterBackground = getSectionsAfterBackground(filtered);
      const useGeneratorTabs =
        lesson.exerciseMode === "generator" || Boolean(lesson.exerciseGenerator);
      const baseKeys = useGeneratorTabs
        ? orderedAfterBackground.filter(
            (key) => getSectionBaseKey(key) !== "exercises"
          )
        : orderedAfterBackground;
      const exercisesCount = lesson.exerciseConfig?.exercisesCount ?? 0;
      const exerciseTabs =
        useGeneratorTabs && exercisesCount > 0
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
        if (isExercisesSection(sectionKey)) {
          const payload = await fetchWithAuth(
            `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/exercises/${sectionKey}`
          );
          const items = Array.isArray(payload.content)
            ? (payload.content as ExerciseItem[])
            : [];
          setExercisesBySection((prev) => ({ ...prev, [sectionKey]: items }));
          return;
        }
        const payload = await fetchWithAuth(
          `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/${sectionKey}`
        );
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
