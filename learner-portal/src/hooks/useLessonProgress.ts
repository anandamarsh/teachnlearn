import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LessonProgress,
  LessonSectionKey,
  ExerciseScoreSnapshot,
  ExerciseGuideState,
  ExerciseStatus,
  ExerciseStepProgress,
} from "../state/types";
import { readStorage, removeStorage, writeStorage } from "../util/storage";

type ProgressState = {
  openSection: LessonSectionKey;
  completedSections: Record<LessonSectionKey, boolean>;
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

const defaultCompleted = {
  lesson: false,
  references: false,
  exercises: false,
};

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
  return {
    exerciseIndex:
      typeof progress.exerciseIndex === "number"
        ? Math.min(progress.exerciseIndex, Math.max(count - 1, 0))
        : base.exerciseIndex,
    maxExerciseIndex:
      typeof progress.maxExerciseIndex === "number"
        ? Math.min(progress.maxExerciseIndex, Math.max(count - 1, 0))
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
  exerciseSections: ExerciseSectionConfig[]
) => {
  const exerciseCountRef = useRef(exerciseSections);
  const [openSection, setOpenSection] = useState<LessonSectionKey>("references");
  const [completedSections, setCompletedSections] =
    useState<Record<LessonSectionKey, boolean>>(defaultCompleted);
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

  useEffect(() => {
    exerciseCountRef.current = exerciseSections;
  }, [exerciseSections]);

  useEffect(() => {
    if (!progressKey) {
      setHydratedKey(null);
      return;
    }
    const parsed = readStorage<LessonProgress>(progressKey);
    if (parsed?.open) {
      setOpenSection(parsed.open);
    } else {
      setOpenSection("references");
    }
    if (parsed?.completed) {
      setCompletedSections({
        lesson: Boolean(parsed.completed.lesson),
        references: Boolean(parsed.completed.references),
        exercises: Boolean(parsed.completed.exercises),
      });
    } else {
      setCompletedSections(defaultCompleted);
    }
    const sectionMap = new Map(exerciseSections.map((section) => [section.key, section]));
    const defaultActiveKey = exerciseSections[0]?.key || null;
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
    exerciseSections.forEach((section) => {
      normalizedSections[section.key] = normalizeSectionProgress(
        nextSections[section.key],
        section.count
      );
    });
    setExerciseSectionsState(normalizedSections);
    const nextActiveKey =
      (parsed?.activeExerciseSectionKey &&
        normalizedSections[parsed.activeExerciseSectionKey]
          ? parsed.activeExerciseSectionKey
          : defaultActiveKey) || null;
    setActiveExerciseSectionKey(nextActiveKey);
    if (nextActiveKey && normalizedSections[nextActiveKey]) {
      const active = normalizedSections[nextActiveKey];
      setExerciseIndex(active.exerciseIndex);
      setMaxExerciseIndex(active.maxExerciseIndex);
      setExerciseStatuses(active.exerciseStatuses);
      setExerciseGuides(active.exerciseGuides);
      setFibAnswers(active.fibAnswers);
      setMcqSelections(active.mcqSelections);
      setScoreSnapshot(active.scoreSnapshot);
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
  }, [exerciseSections, progressKey]);

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
    if (!exerciseSections.length) {
      setExerciseSectionsState({});
      setActiveExerciseSectionKey(null);
      return;
    }
    setExerciseSectionsState((prev) => {
      const next: Record<string, ExerciseSectionProgress> = {};
      exerciseSections.forEach((section) => {
        next[section.key] = normalizeSectionProgress(prev[section.key], section.count);
      });
      return next;
    });
    if (
      !activeExerciseSectionKey ||
      !exerciseSections.some((section) => section.key === activeExerciseSectionKey)
    ) {
      setActiveExerciseSectionKey(exerciseSections[0].key);
    }
  }, [exerciseSections, activeExerciseSectionKey]);

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
    setOpenSection("references");
    setCompletedSections(defaultCompleted);
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
  }, [progressKey]);

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
