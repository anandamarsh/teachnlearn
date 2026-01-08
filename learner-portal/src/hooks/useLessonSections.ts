import { useCallback, useEffect, useState } from "react";
import { CatalogLesson, ExerciseItem, ExerciseSection } from "../state/types";

type SectionState = {
  contentHtml: Record<string, string>;
  exercises: ExerciseSection[];
  loading: Record<string, boolean>;
};

type UseLessonSectionsOptions = {
  lesson: CatalogLesson | null;
  fetchWithAuth: (path: string) => Promise<{
    contentHtml?: string;
    content?: unknown;
  }>;
};

export const useLessonSections = ({ lesson, fetchWithAuth }: UseLessonSectionsOptions) => {
  const [contentHtml, setContentHtml] = useState<Record<string, string>>({});
  const [exercises, setExercises] = useState<ExerciseSection[]>([]);
  const [exerciseKeys, setExerciseKeys] = useState<string[]>([]);
  const [sectionKeys, setSectionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const reset = useCallback(() => {
    setContentHtml({});
    setExercises([]);
    setExerciseKeys([]);
    setSectionKeys([]);
    setLoading({});
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

  const orderStudentSections = (keys: string[]) => {
    const baseOrder = ["references", "lesson", "exercises"];
    const byBase: Record<string, string[]> = {};
    keys.forEach((key) => {
      const base = getBaseKey(key);
      byBase[base] = byBase[base] || [];
      byBase[base].push(key);
    });
    baseOrder.forEach((base) => {
      if (byBase[base]) {
        byBase[base].sort((left, right) => getKeyIndex(left) - getKeyIndex(right));
      }
    });
    return baseOrder.flatMap((base) => byBase[base] || []);
  };

  const loadIndex = useCallback(async () => {
    if (!lesson) {
      return;
    }
    try {
      const payload = await fetchWithAuth(
        `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/index`
      );
      const sections = (payload as { sections?: Record<string, string> }).sections || {};
      const filteredKeys = Object.keys(sections).filter(
        (key) =>
          !["assessment", "samples", "concepts", "background"].includes(
            getBaseKey(key)
          )
      );
      setSectionKeys(orderStudentSections(filteredKeys));
      const exerciseSectionKeys = Object.keys(sections).filter(
        (key) => getBaseKey(key) === "exercises"
      );
      setExerciseKeys(sortExerciseKeys(exerciseSectionKeys));
    } catch {
      const fallback = ["references", "lesson", "exercises"];
      setSectionKeys(fallback);
      setExerciseKeys(["exercises"]);
    }
  }, [fetchWithAuth, lesson]);

  useEffect(() => {
    if (lesson) {
      loadIndex();
    }
  }, [lesson, loadIndex]);

  const loadSection = useCallback(
    async (sectionKey: string) => {
      if (!lesson) {
        return;
      }
      if (loading[sectionKey]) {
        return;
      }
      if (getBaseKey(sectionKey) === "exercises") {
        if (exercises.some((section) => section.key === sectionKey)) {
          return;
        }
      } else if (contentHtml[sectionKey]) {
        return;
      }
      setLoading((prev) => ({ ...prev, [sectionKey]: true }));
      try {
        const payload = await fetchWithAuth(
          `/catalog/teacher/${lesson.teacher}/lesson/${lesson.id}/sections/${sectionKey}`
        );
        if (getBaseKey(sectionKey) !== "exercises") {
          setContentHtml((prev) => ({
            ...prev,
            [sectionKey]: payload.contentHtml || "",
          }));
          return;
        }
        const items = Array.isArray(payload.content)
          ? (payload.content as ExerciseItem[])
          : (() => {
              const rawExercises = payload.contentHtml || "[]";
              const parsed = JSON.parse(rawExercises);
              return Array.isArray(parsed) ? parsed : [];
            })();
        setExercises((prev) => {
          const next = prev.filter((section) => section.key !== sectionKey);
          next.push({ key: sectionKey, exercises: items });
          return sortExerciseKeys(next.map((section) => section.key)).map(
            (key) => next.find((section) => section.key === key)!
          );
        });
      } finally {
        setLoading((prev) => ({ ...prev, [sectionKey]: false }));
      }
    },
    [contentHtml, exercises, fetchWithAuth, lesson, loading]
  );

  return {
    contentHtml,
    exercises,
    loading,
    loadSection,
    reset,
    exerciseKeys,
    sectionKeys,
  };
};
