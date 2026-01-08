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
};

const defaultCompleted = {
  lesson: false,
  references: false,
  exercises: false,
};

export const useLessonProgress = (
  progressKey: string | null,
  exerciseCount: number
) => {
  const exerciseCountRef = useRef(exerciseCount);
  const [openSection, setOpenSection] = useState<LessonSectionKey>("lesson");
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
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    exerciseCountRef.current = exerciseCount;
  }, [exerciseCount]);

  useEffect(() => {
    if (!progressKey) {
      setHydratedKey(null);
      return;
    }
    const parsed = readStorage<LessonProgress>(progressKey);
    if (parsed?.open) {
      setOpenSection(parsed.open);
    } else {
      setOpenSection("lesson");
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
    const parsedExerciseIndex =
      typeof parsed?.exerciseIndex === "number" ? parsed.exerciseIndex : 0;
    setExerciseIndex(parsedExerciseIndex);
    const parsedStatuses = parsed?.exerciseStatuses || [];
    setExerciseStatuses(parsedStatuses);
    const inferredMaxIndex = (() => {
      if (typeof parsed?.maxExerciseIndex === "number") {
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
    setMaxExerciseIndex(inferredMaxIndex);
    setExerciseGuides(parsed?.exerciseGuides || []);
    setFibAnswers(parsed?.fibAnswers || []);
    setMcqSelections(parsed?.mcqSelections || []);
    if (parsed?.score) {
      setScoreSnapshot(parsed.score);
    } else {
      setScoreSnapshot({
        questionsAnswered: { thisSession: 0, previousSessions: 0 },
        skillScore: 0,
        correctSoFar: 0,
      });
    }
    setHydratedKey(progressKey);
  }, [progressKey]);

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
    if (!exerciseCount) {
      return;
    }
    setExerciseIndex((prev) => (prev < exerciseCount ? prev : 0));
    if (exerciseStatuses.length !== exerciseCount) {
      setExerciseStatuses(Array(exerciseCount).fill("unattempted"));
    }
    if (exerciseGuides.length !== exerciseCount) {
      setExerciseGuides((prev) => {
        const next: ExerciseGuideState[] = Array.from({
          length: exerciseCount,
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
    if (fibAnswers.length !== exerciseCount) {
      setFibAnswers(Array(exerciseCount).fill(""));
    }
    if (mcqSelections.length !== exerciseCount) {
      setMcqSelections(Array(exerciseCount).fill(""));
    }
  }, [exerciseCount, exerciseStatuses, exerciseGuides.length, fibAnswers.length, mcqSelections.length]);

  const reset = useCallback(() => {
    if (progressKey) {
      removeStorage(progressKey);
    }
    const count = exerciseCountRef.current;
    setOpenSection("lesson");
    setCompletedSections(defaultCompleted);
    setExerciseIndex(0);
    setMaxExerciseIndex(0);
    setExerciseStatuses(Array(count).fill("unattempted"));
    setExerciseGuides(
      Array(count)
        .fill(null)
        .map(() => ({
          helpActive: false,
          stepIndex: 0,
          steps: [] as ExerciseStepProgress[],
          mainAttempts: 0,
          mainLastIncorrect: false,
          mainPending: "none",
          completed: false,
        }))
    );
    setFibAnswers(Array(count).fill(""));
    setMcqSelections(Array(count).fill(""));
    setScoreSnapshot({
      questionsAnswered: { thisSession: 0, previousSessions: 0 },
      skillScore: 0,
      correctSoFar: 0,
    });
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
    reset,
  };
};
