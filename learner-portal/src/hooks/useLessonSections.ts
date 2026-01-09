import { useCallback, useEffect, useState } from "react";
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
  fetchWithAuth: (path: string) => Promise<{
    contentHtml?: string;
    content?: unknown;
    sections?: unknown;
  }>;
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
      const nextKeys = getSectionsAfterBackground(filtered);
      setSectionKeys(Array.from(new Set(nextKeys)));
    } finally {
      setIndexLoading(false);
    }
  }, [fetchWithAuth, lesson]);

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

  return { ...state, loadSection, reset, loadSectionIndex };
};
