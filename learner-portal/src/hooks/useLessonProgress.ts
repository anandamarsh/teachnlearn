import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LessonProgress, LessonSectionKey, ExerciseStatus } from "../state/types";
import { readStorage, removeStorage, writeStorage } from "../util/storage";

type ProgressState = {
  openSection: LessonSectionKey;
  completedSections: Record<LessonSectionKey, boolean>;
  exerciseIndex: number;
  exerciseStatuses: ExerciseStatus[];
  fibAnswers: string[];
  fibFeedbacks: ({ correct: boolean; correctAnswer: string } | null)[];
  mcqSelections: string[];
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
  const [exerciseStatuses, setExerciseStatuses] = useState<ExerciseStatus[]>([]);
  const [fibAnswers, setFibAnswers] = useState<string[]>([]);
  const [fibFeedbacks, setFibFeedbacks] = useState<
    ({ correct: boolean; correctAnswer: string } | null)[]
  >([]);
  const [mcqSelections, setMcqSelections] = useState<string[]>([]);
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
    if (typeof parsed?.exerciseIndex === "number") {
      setExerciseIndex(parsed.exerciseIndex);
    } else {
      setExerciseIndex(0);
    }
    setExerciseStatuses(parsed?.exerciseStatuses || []);
    setFibAnswers(parsed?.fibAnswers || []);
    setFibFeedbacks(parsed?.fibFeedbacks || []);
    setMcqSelections(parsed?.mcqSelections || []);
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
      exerciseStatuses,
      fibAnswers,
      fibFeedbacks,
      mcqSelections,
    };
    writeStorage(progressKey, payload);
  }, [
    completedSections,
    exerciseIndex,
    exerciseStatuses,
    fibAnswers,
    fibFeedbacks,
    mcqSelections,
    openSection,
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
    if (fibAnswers.length !== exerciseCount) {
      setFibAnswers(Array(exerciseCount).fill(""));
    }
    if (fibFeedbacks.length !== exerciseCount) {
      setFibFeedbacks(Array(exerciseCount).fill(null));
    }
    if (mcqSelections.length !== exerciseCount) {
      setMcqSelections(Array(exerciseCount).fill(""));
    }
  }, [exerciseCount, exerciseStatuses.length, fibAnswers.length, fibFeedbacks.length, mcqSelections.length]);

  const reset = useCallback(() => {
    if (progressKey) {
      removeStorage(progressKey);
    }
    const count = exerciseCountRef.current;
    setOpenSection("lesson");
    setCompletedSections(defaultCompleted);
    setExerciseIndex(0);
    setExerciseStatuses(Array(count).fill("unattempted"));
    setFibAnswers(Array(count).fill(""));
    setFibFeedbacks(Array(count).fill(null));
    setMcqSelections(Array(count).fill(""));
  }, [progressKey]);

  const state: ProgressState = useMemo(
    () => ({
      openSection,
      completedSections,
      exerciseIndex,
      exerciseStatuses,
      fibAnswers,
      fibFeedbacks,
      mcqSelections,
    }),
    [
      completedSections,
      exerciseIndex,
      exerciseStatuses,
      fibAnswers,
      fibFeedbacks,
      mcqSelections,
      openSection,
    ]
  );

  return {
    ...state,
    setOpenSection,
    setCompletedSections,
    setExerciseIndex,
    setExerciseStatuses,
    setFibAnswers,
    setFibFeedbacks,
    setMcqSelections,
    reset,
  };
};
