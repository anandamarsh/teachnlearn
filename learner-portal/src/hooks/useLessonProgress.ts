import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExerciseScoreSnapshot,
  ExerciseGuideState,
  ExerciseStatus,
  ExerciseStepProgress,
  ExerciseSectionState,
  LessonProgress,
  LessonSectionKey,
} from "../state/types";
import { isExercisesSection } from "../utils/lessonSections";
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
};

const defaultScoreSnapshot: ExerciseScoreSnapshot = {
  questionsAnswered: { thisSession: 0, previousSessions: 0 },
  skillScore: 0,
  correctSoFar: 0,
};

const buildDefaultExerciseState = (exerciseCount: number): ExerciseSectionState => {
  const statuses = Array(exerciseCount).fill("unattempted");
  const guides = Array(exerciseCount)
    .fill(null)
    .map(() => ({
      helpActive: false,
      stepIndex: 0,
      steps: [] as ExerciseStepProgress[],
      mainAttempts: 0,
      mainLastIncorrect: false,
      mainPending: "none",
      completed: false,
    }));
  return {
    exerciseIndex: 0,
    maxExerciseIndex: 0,
    exerciseStatuses: statuses,
    exerciseGuides: guides,
    fibAnswers: Array(exerciseCount).fill(""),
    mcqSelections: Array(exerciseCount).fill(""),
    scoreSnapshot: defaultScoreSnapshot,
  };
};

const serializeExerciseState = (state: ExerciseSectionState) =>
  JSON.stringify(state);

const buildExerciseStateSnapshot = (
  exerciseIndex: number,
  maxExerciseIndex: number,
  exerciseStatuses: ExerciseStatus[],
  exerciseGuides: ExerciseGuideState[],
  fibAnswers: string[],
  mcqSelections: string[],
  scoreSnapshot: ExerciseScoreSnapshot
): ExerciseSectionState => ({
  exerciseIndex,
  maxExerciseIndex,
  exerciseStatuses,
  exerciseGuides,
  fibAnswers,
  mcqSelections,
  scoreSnapshot,
});

export const useLessonProgress = (
  progressKey: string | null,
  sectionKeys: LessonSectionKey[],
  exerciseCountsBySection: Record<string, number>
) => {
  const [openSection, setOpenSection] = useState<LessonSectionKey>(
    sectionKeys[0] || "lesson"
  );
  const activeExerciseSectionKey = isExercisesSection(openSection)
    ? openSection
    : null;
  const activeExerciseCount =
    activeExerciseSectionKey != null
      ? exerciseCountsBySection[activeExerciseSectionKey] || 0
      : 0;
  const exerciseCountRef = useRef(activeExerciseCount);
  const [completedSections, setCompletedSections] =
    useState<Record<LessonSectionKey, boolean>>({});
  const [exerciseStateBySection, setExerciseStateBySection] = useState<
    Record<string, ExerciseSectionState>
  >({});
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [maxExerciseIndex, setMaxExerciseIndex] = useState(0);
  const [exerciseStatuses, setExerciseStatuses] = useState<ExerciseStatus[]>([]);
  const [exerciseGuides, setExerciseGuides] = useState<ExerciseGuideState[]>([]);
  const [fibAnswers, setFibAnswers] = useState<string[]>([]);
  const [mcqSelections, setMcqSelections] = useState<string[]>([]);
  const [scoreSnapshot, setScoreSnapshot] = useState<ExerciseScoreSnapshot>(
    defaultScoreSnapshot
  );
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const sectionKeySignature = sectionKeys.join("|");
  const exerciseStateBySectionRef = useRef<Record<string, ExerciseSectionState>>({});
  const lastHydratedRef = useRef<{ key: string | null; signature: string | null }>({
    key: null,
    signature: null,
  });

  useEffect(() => {
    exerciseCountRef.current = activeExerciseCount;
  }, [activeExerciseCount]);

  useEffect(() => {
    if (!progressKey) {
      setHydratedKey(null);
      return;
    }
    const parsed = readStorage<LessonProgress>(progressKey);
    const nextCompleted = sectionKeys.reduce<Record<LessonSectionKey, boolean>>(
      (acc, key) => {
        acc[key] = Boolean(parsed?.completed?.[key]);
        return acc;
      },
      {}
    );
    const fallbackOpen = sectionKeys[0] || "lesson";
    const firstIncomplete =
      sectionKeys.find((key) => !nextCompleted[key]) || fallbackOpen;
    const parsedOpen = parsed?.open;
    if (
      parsedOpen &&
      sectionKeys.includes(parsedOpen) &&
      nextCompleted[firstIncomplete]
    ) {
      setOpenSection(parsedOpen);
    } else {
      setOpenSection(firstIncomplete);
    }
    setCompletedSections(nextCompleted);
    let nextExerciseStateBySection = parsed?.exerciseStateBySection || {};
    if (!parsed?.exerciseStateBySection && parsed) {
      const legacyKey = sectionKeys.find((key) => isExercisesSection(key));
      if (legacyKey) {
        const parsedStatuses = parsed.exerciseStatuses || [];
        const parsedExerciseIndex =
          typeof parsed.exerciseIndex === "number" ? parsed.exerciseIndex : 0;
        const inferredMaxIndex = (() => {
          if (typeof parsed.maxExerciseIndex === "number") {
            return parsed.maxExerciseIndex;
          }
          const lastAttempted = parsedStatuses.reduce((acc, status, idx) => {
            if (status && status !== "unattempted") {
              return idx;
            }
            return acc;
          }, 0);
          return Math.max(lastAttempted, parsedExerciseIndex);
        })();
        nextExerciseStateBySection = {
          ...nextExerciseStateBySection,
          [legacyKey]: {
            exerciseIndex: parsedExerciseIndex,
            maxExerciseIndex: inferredMaxIndex,
            exerciseStatuses: parsedStatuses,
            exerciseGuides: parsed.exerciseGuides || [],
            fibAnswers: parsed.fibAnswers || [],
            mcqSelections: parsed.mcqSelections || [],
            scoreSnapshot: parsed.score || defaultScoreSnapshot,
          },
        };
      }
    }
    setExerciseStateBySection(nextExerciseStateBySection);
    setHydratedKey(progressKey);
  }, [progressKey, sectionKeySignature, sectionKeys]);

  useEffect(() => {
    if (!activeExerciseSectionKey) {
      return;
    }
    const savedState =
      exerciseStateBySectionRef.current[activeExerciseSectionKey];
    const nextState = savedState || buildDefaultExerciseState(activeExerciseCount);
    const nextSignature = serializeExerciseState(nextState);
    if (
      lastHydratedRef.current.key === activeExerciseSectionKey &&
      lastHydratedRef.current.signature === nextSignature
    ) {
      return;
    }
    lastHydratedRef.current = {
      key: activeExerciseSectionKey,
      signature: nextSignature,
    };
    setExerciseIndex(nextState.exerciseIndex);
    setMaxExerciseIndex(nextState.maxExerciseIndex);
    setExerciseStatuses(nextState.exerciseStatuses);
    setExerciseGuides(nextState.exerciseGuides);
    setFibAnswers(nextState.fibAnswers);
    setMcqSelections(nextState.mcqSelections);
    setScoreSnapshot(nextState.scoreSnapshot);
  }, [
    activeExerciseCount,
    activeExerciseSectionKey,
  ]);

  useEffect(() => {
    if (!progressKey || hydratedKey !== progressKey || !activeExerciseSectionKey) {
      return;
    }
    const nextState = buildExerciseStateSnapshot(
      exerciseIndex,
      maxExerciseIndex,
      exerciseStatuses,
      exerciseGuides,
      fibAnswers,
      mcqSelections,
      scoreSnapshot
    );
    setExerciseStateBySection((prev) => {
      const current = prev[activeExerciseSectionKey];
      if (current && serializeExerciseState(current) === serializeExerciseState(nextState)) {
        return prev;
      }
      return {
        ...prev,
        [activeExerciseSectionKey]: nextState,
      };
    });
  }, [
    activeExerciseSectionKey,
    exerciseGuides,
    exerciseIndex,
    exerciseStatuses,
    fibAnswers,
    hydratedKey,
    maxExerciseIndex,
    mcqSelections,
    progressKey,
    scoreSnapshot,
  ]);

  useEffect(() => {
    if (!activeExerciseSectionKey) {
      return;
    }
    if (!activeExerciseCount) {
      return;
    }
    setExerciseIndex((prev) => (prev < activeExerciseCount ? prev : 0));
    if (exerciseStatuses.length !== activeExerciseCount) {
      setExerciseStatuses(Array(activeExerciseCount).fill("unattempted"));
    }
    if (exerciseGuides.length !== activeExerciseCount) {
      setExerciseGuides((prev) => {
        const next: ExerciseGuideState[] = Array.from({
          length: activeExerciseCount,
        }).map((_, idx) => {
          const existing = prev[idx];
          const completed =
            existing?.completed ||
            exerciseStatuses[idx] === "correct" ||
            exerciseStatuses[idx] === "incorrect";
          return (
            existing || {
              helpActive: false,
              stepIndex: 0,
              steps: [],
              mainAttempts: 0,
              mainLastIncorrect: false,
              mainPending: "none",
              completed,
            }
          );
        });
        return next;
      });
    }
    if (fibAnswers.length !== activeExerciseCount) {
      setFibAnswers(Array(activeExerciseCount).fill(""));
    }
    if (mcqSelections.length !== activeExerciseCount) {
      setMcqSelections(Array(activeExerciseCount).fill(""));
    }
  }, [
    activeExerciseCount,
    activeExerciseSectionKey,
    exerciseGuides.length,
    exerciseStatuses,
    fibAnswers.length,
    mcqSelections.length,
  ]);

  const reset = useCallback(() => {
    if (progressKey) {
      removeStorage(progressKey);
    }
    const count = exerciseCountRef.current;
    const defaultState = buildDefaultExerciseState(count);
    setOpenSection(sectionKeys[0] || "lesson");
    setCompletedSections(
      sectionKeys.reduce<Record<LessonSectionKey, boolean>>((acc, key) => {
        acc[key] = false;
        return acc;
      }, {})
    );
    setExerciseStateBySection({});
    setExerciseIndex(defaultState.exerciseIndex);
    setMaxExerciseIndex(defaultState.maxExerciseIndex);
    setExerciseStatuses(defaultState.exerciseStatuses);
    setExerciseGuides(defaultState.exerciseGuides);
    setFibAnswers(defaultState.fibAnswers);
    setMcqSelections(defaultState.mcqSelections);
    setScoreSnapshot(defaultState.scoreSnapshot);
  }, [progressKey, sectionKeys]);

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
    ]
  );

  useEffect(() => {
    if (!progressKey || hydratedKey !== progressKey) {
      return;
    }
    const payload: LessonProgress = {
      open: openSection,
      completed: completedSections,
      exerciseStateBySection,
    };
    writeStorage(progressKey, payload);
  }, [
    completedSections,
    exerciseStateBySection,
    openSection,
    progressKey,
    hydratedKey,
  ]);

  useEffect(() => {
    exerciseStateBySectionRef.current = exerciseStateBySection;
  }, [exerciseStateBySection]);

  const resetExerciseSection = useCallback(
    (sectionKey: LessonSectionKey) => {
      const count = exerciseCountsBySection[sectionKey] || 0;
      const defaultState = buildDefaultExerciseState(count);
      setExerciseStateBySection((prev) => ({
        ...prev,
        [sectionKey]: defaultState,
      }));
      setCompletedSections((prev) => ({
        ...prev,
        [sectionKey]: false,
      }));
      if (activeExerciseSectionKey === sectionKey) {
        lastHydratedRef.current = { key: null, signature: null };
        setExerciseIndex(defaultState.exerciseIndex);
        setMaxExerciseIndex(defaultState.maxExerciseIndex);
        setExerciseStatuses(defaultState.exerciseStatuses);
        setExerciseGuides(defaultState.exerciseGuides);
        setFibAnswers(defaultState.fibAnswers);
        setMcqSelections(defaultState.mcqSelections);
        setScoreSnapshot(defaultState.scoreSnapshot);
      }
    },
    [activeExerciseSectionKey, exerciseCountsBySection]
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
    resetExerciseSection,
    reset,
  };
};
