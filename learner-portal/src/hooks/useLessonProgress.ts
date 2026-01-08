import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LessonProgress,
  ExerciseScoreSnapshot,
  ExerciseGuideState,
  ExerciseStatus,
  ExerciseStepProgress,
} from "../state/types";
import { readStorage, removeStorage, writeStorage } from "../util/storage";

type ProgressState = {
  openSection: string;
  completedSections: Record<string, boolean>;
  exerciseIndex: number;
  maxExerciseIndex: number;
  exerciseStatuses: ExerciseStatus[];
  exerciseGuides: ExerciseGuideState[];
  fibAnswers: string[];
  mcqSelections: string[];
  scoreSnapshot: ExerciseScoreSnapshot;
  exerciseSections: Record<string, ExerciseSectionProgress>;
  activeExerciseSectionKey: string | null;
};

type ExerciseSectionProgress = {
  exerciseIndex: number;
  maxExerciseIndex: number;
  exerciseStatuses: ExerciseStatus[];
  exerciseGuides: ExerciseGuideState[];
  fibAnswers: string[];
  mcqSelections: string[];
  scoreSnapshot: ExerciseScoreSnapshot;
};

type ExerciseSectionConfig = {
  key: string;
  count: number;
};

const buildCompleted = (sectionKeys: string[]) =>
  sectionKeys.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

const buildEmptyScore = (): ExerciseScoreSnapshot => ({
  questionsAnswered: { thisSession: 0, previousSessions: 0 },
  skillScore: 0,
  correctSoFar: 0,
});

const buildDefaultExerciseGuides = (count: number) =>
  Array.from({ length: count }).map(() => ({
    helpActive: false,
    stepIndex: 0,
    steps: [] as ExerciseStepProgress[],
    mainAttempts: 0,
    mainLastIncorrect: false,
    mainPending: "none",
    completed: false,
  }));

const buildSectionProgress = (count: number): ExerciseSectionProgress => ({
  exerciseIndex: 0,
  maxExerciseIndex: 0,
  exerciseStatuses: Array(count).fill("unattempted"),
  exerciseGuides: buildDefaultExerciseGuides(count),
  fibAnswers: Array(count).fill(""),
  mcqSelections: Array(count).fill(""),
  scoreSnapshot: buildEmptyScore(),
});

const normalizeArray = <T,>(
  values: T[] | undefined,
  count: number,
  fillValue: T
) => Array.from({ length: count }).map((_, idx) => values?.[idx] ?? fillValue);

const normalizeSectionProgress = (
  progress: ExerciseSectionProgress | undefined,
  count: number
): ExerciseSectionProgress => {
  const base = buildSectionProgress(count);
  if (!progress) {
    return base;
  }
  const maxIndex = Math.max(count - 1, 0);
  const isValid =
    typeof progress.exerciseIndex === "number" &&
    typeof progress.maxExerciseIndex === "number" &&
    progress.exerciseIndex >= 0 &&
    progress.exerciseIndex <= maxIndex &&
    progress.maxExerciseIndex >= 0 &&
    progress.maxExerciseIndex <= maxIndex &&
    Array.isArray(progress.exerciseStatuses) &&
    progress.exerciseStatuses.length === count &&
    Array.isArray(progress.exerciseGuides) &&
    progress.exerciseGuides.length === count &&
    Array.isArray(progress.fibAnswers) &&
    progress.fibAnswers.length === count &&
    Array.isArray(progress.mcqSelections) &&
    progress.mcqSelections.length === count &&
    Boolean(progress.scoreSnapshot);
  if (isValid) {
    return progress;
  }
  return {
    exerciseIndex:
      typeof progress.exerciseIndex === "number"
        ? Math.min(progress.exerciseIndex, maxIndex)
        : base.exerciseIndex,
    maxExerciseIndex:
      typeof progress.maxExerciseIndex === "number"
        ? Math.min(progress.maxExerciseIndex, maxIndex)
        : base.maxExerciseIndex,
    exerciseStatuses: normalizeArray(
      progress.exerciseStatuses,
      count,
      "unattempted"
    ),
    exerciseGuides:
      progress.exerciseGuides?.length === count
        ? progress.exerciseGuides
        : buildDefaultExerciseGuides(count),
    fibAnswers: normalizeArray(progress.fibAnswers, count, ""),
    mcqSelections: normalizeArray(progress.mcqSelections, count, ""),
    scoreSnapshot: progress.scoreSnapshot || buildEmptyScore(),
  };
};

export const useLessonProgress = (
  progressKey: string | null,
  sectionKeys: string[],
  exerciseSections: ExerciseSectionConfig[]
) => {
  const exerciseCountRef = useRef(exerciseSections);
  const [openSection, setOpenSection] = useState<string>(sectionKeys[0] || "");
  const [completedSections, setCompletedSections] =
    useState<Record<string, boolean>>(buildCompleted(sectionKeys));
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [maxExerciseIndex, setMaxExerciseIndex] = useState(0);
  const [exerciseStatuses, setExerciseStatuses] = useState<ExerciseStatus[]>([]);
  const [exerciseGuides, setExerciseGuides] = useState<ExerciseGuideState[]>([]);
  const [fibAnswers, setFibAnswers] = useState<string[]>([]);
  const [mcqSelections, setMcqSelections] = useState<string[]>([]);
  const [scoreSnapshot, setScoreSnapshot] = useState<ExerciseScoreSnapshot>({
    questionsAnswered: { thisSession: 0, previousSessions: 0 },
    skillScore: 0,
    correctSoFar: 0,
  });
  const [exerciseSectionsState, setExerciseSectionsState] = useState<
    Record<string, ExerciseSectionProgress>
  >({});
  const [activeExerciseSectionKey, setActiveExerciseSectionKey] = useState<string | null>(
    null
  );
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const sectionKeysSignature = useMemo(() => sectionKeys.join("|"), [sectionKeys]);
  const exerciseSectionsSignature = useMemo(
    () =>
      exerciseSections.map((section) => `${section.key}:${section.count}`).join("|"),
    [exerciseSections]
  );

  const stableSectionKeys = useMemo(() => sectionKeys, [sectionKeysSignature]);
  const stableExerciseSections = useMemo(
    () => exerciseSections,
    [exerciseSectionsSignature]
  );

  useEffect(() => {
    exerciseCountRef.current = stableExerciseSections;
  }, [exerciseSectionsSignature, stableExerciseSections]);

  useEffect(() => {
    if (!stableSectionKeys.length) {
      setOpenSection("");
      setCompletedSections({});
      return;
    }
    setOpenSection((prev) =>
      stableSectionKeys.includes(prev) ? prev : stableSectionKeys[0]
    );
    setCompletedSections((prev) => {
      const next = buildCompleted(stableSectionKeys);
      Object.keys(next).forEach((key) => {
        if (typeof prev[key] === "boolean") {
          next[key] = prev[key];
        }
      });
      const keys = Object.keys(next);
      if (keys.length === Object.keys(prev).length) {
        const unchanged = keys.every((key) => prev[key] === next[key]);
        if (unchanged) {
          return prev;
        }
      }
      return next;
    });
  }, [sectionKeysSignature, stableSectionKeys]);

  useEffect(() => {
    if (!progressKey) {
      setHydratedKey(null);
      return;
    }
    const parsed = readStorage<LessonProgress>(progressKey);
    const initialOpen = stableSectionKeys[0] || "";
    const nextOpen =
      parsed?.open && stableSectionKeys.includes(parsed.open)
        ? parsed.open
        : initialOpen;
    setOpenSection((prev) => (prev === nextOpen ? prev : nextOpen));
    setCompletedSections((prev) => {
      const nextCompleted = buildCompleted(stableSectionKeys);
      if (parsed?.completed) {
        Object.keys(nextCompleted).forEach((key) => {
          if (typeof parsed.completed[key] === "boolean") {
            nextCompleted[key] = parsed.completed[key];
          }
        });
      }
      const keys = Object.keys(nextCompleted);
      if (keys.length === Object.keys(prev).length) {
        const unchanged = keys.every((key) => prev[key] === nextCompleted[key]);
        if (unchanged) {
          return prev;
        }
      }
      return nextCompleted;
    });
    const defaultActiveKey = stableExerciseSections[0]?.key || null;
    let nextSections = parsed?.exerciseSections || {};
    if (!parsed?.exerciseSections && parsed?.exerciseIndex !== undefined) {
      const legacyKey = defaultActiveKey || "exercises";
      nextSections = {
        [legacyKey]: {
          exerciseIndex: parsed.exerciseIndex ?? 0,
          maxExerciseIndex: parsed.maxExerciseIndex ?? 0,
          exerciseStatuses: parsed.exerciseStatuses ?? [],
          exerciseGuides: parsed.exerciseGuides ?? [],
          fibAnswers: parsed.fibAnswers ?? [],
          mcqSelections: parsed.mcqSelections ?? [],
          scoreSnapshot: parsed.score ?? buildEmptyScore(),
        },
      };
    }
    const normalizedSections: Record<string, ExerciseSectionProgress> = {};
    stableExerciseSections.forEach((section) => {
      normalizedSections[section.key] = normalizeSectionProgress(
        nextSections[section.key],
        section.count
      );
    });
    setExerciseSectionsState((prev) => {
      const nextKeys = Object.keys(normalizedSections);
      const prevKeys = Object.keys(prev);
      if (
        nextKeys.length === prevKeys.length &&
        nextKeys.every((key) => prev[key] === normalizedSections[key])
      ) {
        return prev;
      }
      return normalizedSections;
    });
    const nextActiveKey =
      (parsed?.activeExerciseSectionKey &&
        normalizedSections[parsed.activeExerciseSectionKey]
          ? parsed.activeExerciseSectionKey
          : defaultActiveKey) || null;
    setActiveExerciseSectionKey((prev) =>
      prev === nextActiveKey ? prev : nextActiveKey
    );
    if (nextActiveKey && normalizedSections[nextActiveKey]) {
      const active = normalizedSections[nextActiveKey];
      setExerciseIndex((prev) =>
        prev === active.exerciseIndex ? prev : active.exerciseIndex
      );
      setMaxExerciseIndex((prev) =>
        prev === active.maxExerciseIndex ? prev : active.maxExerciseIndex
      );
      setExerciseStatuses((prev) =>
        prev === active.exerciseStatuses ? prev : active.exerciseStatuses
      );
      setExerciseGuides((prev) =>
        prev === active.exerciseGuides ? prev : active.exerciseGuides
      );
      setFibAnswers((prev) => (prev === active.fibAnswers ? prev : active.fibAnswers));
      setMcqSelections((prev) =>
        prev === active.mcqSelections ? prev : active.mcqSelections
      );
      setScoreSnapshot((prev) =>
        prev === active.scoreSnapshot ? prev : active.scoreSnapshot
      );
    } else {
      setExerciseIndex(0);
      setMaxExerciseIndex(0);
      setExerciseStatuses([]);
      setExerciseGuides([]);
      setFibAnswers([]);
      setMcqSelections([]);
      setScoreSnapshot(buildEmptyScore());
    }
    setHydratedKey(progressKey);
  }, [exerciseSectionsSignature, progressKey, sectionKeysSignature, stableExerciseSections, stableSectionKeys]);

  useEffect(() => {
    if (!progressKey) {
      return;
    }
    if (hydratedKey !== progressKey) {
      return;
    }
    const payload: LessonProgress = {
      open: openSection,
      completed: completedSections,
      activeExerciseSectionKey,
      exerciseSections: exerciseSectionsState,
      exerciseIndex,
      maxExerciseIndex,
      exerciseStatuses,
      exerciseGuides,
      fibAnswers,
      mcqSelections,
      score: scoreSnapshot,
    };
    writeStorage(progressKey, payload);
  }, [
    completedSections,
    activeExerciseSectionKey,
    exerciseSectionsState,
    exerciseIndex,
    maxExerciseIndex,
    exerciseStatuses,
    exerciseGuides,
    fibAnswers,
    mcqSelections,
    openSection,
    scoreSnapshot,
    progressKey,
    hydratedKey,
  ]);

  useEffect(() => {
    if (!stableExerciseSections.length) {
      setExerciseSectionsState({});
      setActiveExerciseSectionKey(null);
      return;
    }
    setExerciseSectionsState((prev) => {
      const next: Record<string, ExerciseSectionProgress> = {};
      let changed = false;
      stableExerciseSections.forEach((section) => {
        const normalized = normalizeSectionProgress(prev[section.key], section.count);
        next[section.key] = normalized;
        if (prev[section.key] !== normalized) {
          changed = true;
        }
      });
      if (
        !changed &&
        Object.keys(prev).length === Object.keys(next).length
      ) {
        return prev;
      }
      return next;
    });
    if (
      !activeExerciseSectionKey ||
      !stableExerciseSections.some(
        (section) => section.key === activeExerciseSectionKey
      )
    ) {
      setActiveExerciseSectionKey(stableExerciseSections[0].key);
    }
  }, [exerciseSectionsSignature, activeExerciseSectionKey, stableExerciseSections]);

  useEffect(() => {
    if (!activeExerciseSectionKey) {
      return;
    }
    const current = exerciseSectionsState[activeExerciseSectionKey];
    if (!current) {
      return;
    }
    setExerciseIndex(current.exerciseIndex);
    setMaxExerciseIndex(current.maxExerciseIndex);
    setExerciseStatuses(current.exerciseStatuses);
    setExerciseGuides(current.exerciseGuides);
    setFibAnswers(current.fibAnswers);
    setMcqSelections(current.mcqSelections);
    setScoreSnapshot(current.scoreSnapshot);
  }, [activeExerciseSectionKey, exerciseSectionsState]);

  useEffect(() => {
    if (!activeExerciseSectionKey) {
      return;
    }
    setExerciseSectionsState((prev) => {
      const current = prev[activeExerciseSectionKey];
      if (!current) {
        return prev;
      }
      const next = {
        ...current,
        exerciseIndex,
        maxExerciseIndex,
        exerciseStatuses,
        exerciseGuides,
        fibAnswers,
        mcqSelections,
        scoreSnapshot,
      };
      if (next === current) {
        return prev;
      }
      return { ...prev, [activeExerciseSectionKey]: next };
    });
  }, [
    activeExerciseSectionKey,
    exerciseIndex,
    maxExerciseIndex,
    exerciseStatuses,
    exerciseGuides,
    fibAnswers,
    mcqSelections,
    scoreSnapshot,
  ]);

  const reset = useCallback(() => {
    if (progressKey) {
      removeStorage(progressKey);
    }
    const sectionConfigs = exerciseCountRef.current;
    setOpenSection(stableSectionKeys[0] || "");
    setCompletedSections(buildCompleted(stableSectionKeys));
    setExerciseIndex(0);
    setMaxExerciseIndex(0);
    setExerciseStatuses([]);
    setExerciseGuides([]);
    setFibAnswers([]);
    setMcqSelections([]);
    setScoreSnapshot(buildEmptyScore());
    const nextSections: Record<string, ExerciseSectionProgress> = {};
    sectionConfigs.forEach((section) => {
      nextSections[section.key] = buildSectionProgress(section.count);
    });
    setExerciseSectionsState(nextSections);
    setActiveExerciseSectionKey(sectionConfigs[0]?.key ?? null);
  }, [progressKey, stableSectionKeys]);

  const state: ProgressState = useMemo(
    () => ({
      openSection,
      completedSections,
      exerciseIndex,
      maxExerciseIndex,
      exerciseStatuses,
      exerciseGuides,
      fibAnswers,
      mcqSelections,
      scoreSnapshot,
      exerciseSections: exerciseSectionsState,
      activeExerciseSectionKey,
    }),
    [
      completedSections,
      exerciseIndex,
      maxExerciseIndex,
      exerciseStatuses,
      exerciseGuides,
      fibAnswers,
      mcqSelections,
      scoreSnapshot,
      openSection,
      exerciseSectionsState,
      activeExerciseSectionKey,
    ]
  );

  return {
    ...state,
    setOpenSection,
    setCompletedSections,
    setExerciseIndex,
    setMaxExerciseIndex,
    setExerciseStatuses,
    setExerciseGuides,
    setFibAnswers,
    setMcqSelections,
    setScoreSnapshot,
    setActiveExerciseSectionKey,
    reset,
  };
};
