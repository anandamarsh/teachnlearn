import { Dispatch, SetStateAction, useEffect, useMemo, useRef } from "react";
import { Box, Button, IconButton, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import {
  ExerciseGuideState,
  ExerciseItem,
  ExerciseStatus,
  ExerciseStepProgress,
} from "../../state/types";
import {
  buildSnsExerciseData,
  createSnsSession,
  emitSnsEvent,
  SnsSession,
} from "../../utils/snsTracking";
import ExerciseDots from "./ExerciseDots";
import ExerciseSlide from "./ExerciseSlide";

type SetState<T> = Dispatch<SetStateAction<T>>;

type ExercisesSectionProps = {
  exercises: ExerciseItem[];
  lessonId: string;
  lessonTitle: string;
  lessonSubject?: string | null;
  lessonLevel?: string | null;
  exerciseIndex: number;
  setExerciseIndex: SetState<number>;
  exerciseStatuses: ExerciseStatus[];
  setExerciseStatuses: SetState<ExerciseStatus[]>;
  exerciseGuides: ExerciseGuideState[];
  setExerciseGuides: SetState<ExerciseGuideState[]>;
  maxExerciseIndex: number;
  setMaxExerciseIndex: SetState<number>;
  fibAnswers: string[];
  setFibAnswers: SetState<string[]>;
  mcqSelections: string[];
  setMcqSelections: SetState<string[]>;
  onComplete: () => void;
  showCompleteButton: boolean;
};

const ExercisesSection = ({
  exercises,
  lessonId,
  lessonTitle,
  lessonSubject,
  lessonLevel,
  exerciseIndex,
  setExerciseIndex,
  exerciseStatuses,
  setExerciseStatuses,
  exerciseGuides,
  setExerciseGuides,
  maxExerciseIndex,
  setMaxExerciseIndex,
  fibAnswers,
  setFibAnswers,
  mcqSelections,
  setMcqSelections,
  onComplete,
  showCompleteButton,
}: ExercisesSectionProps) => {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number>(0);
  const touchStartXRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef<{ active: boolean; target: number }>({
    active: false,
    target: 0,
  });
  const snsSessionRef = useRef<SnsSession | null>(null);
  const snsStatsRef = useRef({ answered: 0, correct: 0 });
  const snsStartedRef = useRef(false);
  const snsEndedRef = useRef(false);

  const scrollToIndex = (
    index: number,
    behavior: ScrollBehavior = "smooth",
    allowBeyond = false
  ) => {
    if (!carouselRef.current) {
      return;
    }
    const clampedIndex = allowBeyond
      ? index
      : Math.min(index, Math.max(maxExerciseIndex, 0));
    const width = carouselRef.current.clientWidth;
    carouselRef.current.scrollTo({ left: width * clampedIndex, behavior });
  };

  const handleCarouselScroll = () => {
    if (!carouselRef.current) {
      return;
    }
    const width = carouselRef.current.clientWidth;
    if (!width) {
      return;
    }
    const scrollLeft = carouselRef.current.scrollLeft;
    const nextIndex = Math.round(scrollLeft / width);
    if (nextIndex > maxExerciseIndex) {
      scrollToIndex(maxExerciseIndex, "auto", true);
      pendingIndexRef.current = maxExerciseIndex;
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        if (pendingIndexRef.current !== exerciseIndex) {
          setExerciseIndex(pendingIndexRef.current);
        }
      }, 80);
      return;
    }
    if (programmaticScrollRef.current.active) {
      const targetLeft = programmaticScrollRef.current.target * width;
      if (Math.abs(scrollLeft - targetLeft) < 2) {
        programmaticScrollRef.current.active = false;
        if (programmaticScrollRef.current.target !== exerciseIndex) {
          setExerciseIndex(programmaticScrollRef.current.target);
        }
      }
      return;
    }
    const clampedIndex = Math.min(nextIndex, Math.max(maxExerciseIndex, 0));
    if (nextIndex !== clampedIndex) {
      scrollToIndex(clampedIndex, "auto", true);
    }
    pendingIndexRef.current = clampedIndex;
    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      if (pendingIndexRef.current !== exerciseIndex) {
        setExerciseIndex(pendingIndexRef.current);
      }
    }, 120);
  };

  useEffect(() => {
    if (exercises.length) {
      scrollToIndex(exerciseIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises.length]);

  useEffect(() => {
    if (exerciseIndex > maxExerciseIndex) {
      setExerciseIndex(maxExerciseIndex);
      scrollToIndex(maxExerciseIndex, "auto");
    }
  }, [exerciseIndex, maxExerciseIndex, setExerciseIndex]);

  useEffect(
    () => () => {
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
      }
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      if (exerciseIndex < maxExerciseIndex) {
        return;
      }
      if (event.deltaX > 0 || event.deltaY > 0) {
        event.preventDefault();
        scrollToIndex(maxExerciseIndex, "auto", true);
      }
    };
    const handleTouchStart = (event: TouchEvent) => {
      touchStartXRef.current = event.touches[0]?.clientX ?? null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (exerciseIndex < maxExerciseIndex) {
        return;
      }
      const startX = touchStartXRef.current;
      const currentX = event.touches[0]?.clientX ?? null;
      if (startX === null || currentX === null) {
        return;
      }
      const delta = startX - currentX;
      if (delta > 0) {
        event.preventDefault();
        scrollToIndex(maxExerciseIndex, "auto", true);
      }
    };
    const handleTouchEnd = () => {
      touchStartXRef.current = null;
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [exerciseIndex, maxExerciseIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && exerciseIndex >= maxExerciseIndex) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [exerciseIndex, maxExerciseIndex]);

  const advanceToNext = (index: number, delayMs = 0) => {
    const nextIndex = index + 1;
    if (nextIndex >= exercises.length) {
      return;
    }
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
    }
    if (delayMs > 0) {
      advanceTimeoutRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = { active: true, target: nextIndex };
        setExerciseIndex(nextIndex);
        scrollToIndex(nextIndex, "smooth", true);
      }, delayMs);
    } else {
      programmaticScrollRef.current = { active: true, target: nextIndex };
      setExerciseIndex(nextIndex);
      scrollToIndex(nextIndex, "smooth", true);
    }
  };

  const normalize = (value: string | number | null | undefined) =>
    String(value ?? "").trim();

  const defaultStepProgress = useMemo<ExerciseStepProgress>(
    () => ({
      status: "unanswered",
      attempts: 0,
      fibAnswer: "",
      mcqSelection: "",
      lastIncorrect: false,
    }),
    []
  );

  const buildDefaultGuide = (completed = false): ExerciseGuideState => ({
    helpActive: false,
    stepIndex: 0,
    steps: [],
    mainAttempts: 0,
    mainLastIncorrect: false,
    mainPending: "none",
    completed,
  });

  const buildScoreSnapshot = () => {
    const total = exercises.length;
    const { answered, correct } = snsStatsRef.current;
    const skillScore = total
      ? Math.round((correct / total) * 100)
      : 0;
    return {
      questionsAnswered: { thisSession: answered, previousSessions: 0 },
      skillScore,
      correctSoFar: correct,
    };
  };

  const ensureSnsSession = () => {
    if (!snsSessionRef.current) {
      snsSessionRef.current = createSnsSession({
        skillTitle: lessonTitle || "Lesson practice",
        skillRef: lessonId || "unknown",
        subject: lessonSubject,
        level: lessonLevel,
      });
    }
    if (!snsStartedRef.current) {
      emitSnsEvent(
        "EXERCISE_STARTED",
        buildSnsExerciseData({
          session: snsSessionRef.current,
          now: new Date(),
          score: buildScoreSnapshot(),
        })
      );
      snsStartedRef.current = true;
    }
    return snsSessionRef.current;
  };

  useEffect(() => {
    if (!exercises.length || snsStartedRef.current) {
      return;
    }
    ensureSnsSession();
  }, [exercises.length, lessonId, lessonLevel, lessonSubject, lessonTitle]);

  useEffect(() => {
    if (!showCompleteButton || snsEndedRef.current) {
      return;
    }
    const session = ensureSnsSession();
    const now = new Date();
    emitSnsEvent(
      "EXERCISE_ENDED",
      buildSnsExerciseData({
        session,
        now,
        score: buildScoreSnapshot(),
        ended: true,
      })
    );
    snsEndedRef.current = true;
  }, [showCompleteButton]);

  useEffect(() => {
    if (!exercises.length) {
      return;
    }
    setExerciseGuides((prev) => {
      let changed = false;
      const base = prev.length === exercises.length
        ? prev
        : Array.from({ length: exercises.length }).map((_, idx) => prev[idx]);
      if (base.length !== prev.length) {
        changed = true;
      }
      const next = base.map((guide, idx) => {
        const exercise = exercises[idx];
        const stepCount = exercise?.steps?.length ?? 0;
        if (!exercise || stepCount === 0) {
          if (!guide) {
            changed = true;
            return buildDefaultGuide(false);
          }
          return guide;
        }
        const existing = guide || buildDefaultGuide(false);
        const steps = existing.steps || [];
        const nextSteps = Array.from({ length: stepCount }).map((_, stepIdx) => {
          const prevStep = steps[stepIdx];
          if (!prevStep) {
            changed = true;
            return { ...defaultStepProgress };
          }
          return prevStep;
        });
        const nextStepIndex = Math.min(existing.stepIndex, stepCount);
        if (
          nextSteps.length !== steps.length ||
          nextStepIndex !== existing.stepIndex
        ) {
          changed = true;
        }
        return { ...existing, steps: nextSteps, stepIndex: nextStepIndex };
      });
      return changed ? next : prev;
    });
  }, [defaultStepProgress, exercises, setExerciseGuides]);

  useEffect(() => {
    if (!exercises.length) {
      return;
    }
    setMaxExerciseIndex((prev) =>
      Math.min(prev, Math.max(exercises.length - 1, 0))
    );
  }, [exercises.length, setMaxExerciseIndex]);

  const ensureGuide = (
    guides: ExerciseGuideState[],
    index: number
  ): ExerciseGuideState => {
    return guides[index] || buildDefaultGuide(false);
  };

  const updateGuide = (
    index: number,
    updater: (guide: ExerciseGuideState) => ExerciseGuideState
  ) => {
    setExerciseGuides((prev) => {
      const guide = ensureGuide(prev, index);
      const nextGuide = updater(guide);
      if (nextGuide === guide) {
        return prev;
      }
      const next = [...prev];
      next[index] = nextGuide;
      return next;
    });
  };

  const stepsComplete = (guide: ExerciseGuideState, stepCount: number) =>
    Boolean(stepCount) && guide.helpActive && guide.stepIndex >= stepCount;

  const handleMainCorrect = (index: number) => {
    updateGuide(index, (guide) => ({
      ...guide,
      completed: true,
      mainLastIncorrect: false,
      mainPending: "none",
    }));
    setMaxExerciseIndex((prev) =>
      Math.min(exercises.length - 1, Math.max(prev, index + 1))
    );
    advanceToNext(index, 1000);
  };

  const resetStepsAfterMainMiss = (index: number, stepCount: number) => {
    window.setTimeout(() => {
      setExerciseGuides((prev) => {
        const next = [...prev];
        const guide = ensureGuide(prev, index);
        const steps = Array.from({ length: stepCount }).map(() => ({
          ...defaultStepProgress,
        }));
        next[index] = {
          ...guide,
          helpActive: true,
          stepIndex: 0,
          steps,
          mainPending: "none",
          mainLastIncorrect: false,
        };
        return next;
      });
      setMcqSelections((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      setFibAnswers((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
    }, 1000);
  };

  const handleMainIncorrect = (
    index: number,
    hasSteps: boolean,
    stepCount: number
  ) => {
    const clearMainAnswer = () => {
      setMcqSelections((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      setFibAnswers((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
    };
    updateGuide(index, (guide) => {
      if (!hasSteps) {
        return {
          ...guide,
          mainAttempts: guide.mainAttempts + 1,
          mainLastIncorrect: true,
          mainPending: "none",
        };
      }
      if (stepsComplete(guide, stepCount)) {
        resetStepsAfterMainMiss(index, stepCount);
        clearMainAnswer();
        return {
          ...guide,
          mainAttempts: guide.mainAttempts + 1,
          mainLastIncorrect: false,
          mainPending: "incorrectPending",
        };
      }
      clearMainAnswer();
      return {
        ...guide,
        helpActive: true,
        stepIndex: guide.stepIndex || 0,
        mainAttempts: guide.mainAttempts + 1,
        mainLastIncorrect: false,
        mainPending: "none",
      };
    });
  };

  const handleAnswer = (index: number, answer: string, option: string) => {
    const isCorrect = normalize(option) === normalize(answer);
    const nextSelections = [...mcqSelections];
    nextSelections[index] = option;
    setMcqSelections(nextSelections);
    const nextStatuses = [...exerciseStatuses];
    if (isCorrect) {
      if (nextStatuses[index] !== "incorrect") {
        nextStatuses[index] = "correct";
      }
      setExerciseStatuses(nextStatuses);
      handleMainCorrect(index);
    } else {
      if (nextStatuses[index] === "unattempted") {
        nextStatuses[index] = "incorrect";
        setExerciseStatuses(nextStatuses);
      }
      const stepCount = exercises[index]?.steps?.length ?? 0;
      handleMainIncorrect(index, stepCount > 0, stepCount);
    }
    const session = ensureSnsSession();
    if (session) {
      snsStatsRef.current.answered += 1;
      if (isCorrect) {
        snsStatsRef.current.correct += 1;
      }
      emitSnsEvent(
        "QUESTION_ANSWERED",
        buildSnsExerciseData({
          session,
          now: new Date(),
          score: buildScoreSnapshot(),
          correct: isCorrect,
        })
      );
    }
  };

  const handleFibSubmit = (index: number, answer: string) => {
    const submitted = normalize(fibAnswers[index]);
    const correct = normalize(answer);
    const isCorrect = submitted === correct;
    if (isCorrect) {
      const nextStatuses = [...exerciseStatuses];
      if (nextStatuses[index] !== "incorrect") {
        nextStatuses[index] = "correct";
      }
      setExerciseStatuses(nextStatuses);
      handleMainCorrect(index);
    } else {
      const nextStatuses = [...exerciseStatuses];
      if (nextStatuses[index] === "unattempted") {
        nextStatuses[index] = "incorrect";
        setExerciseStatuses(nextStatuses);
      }
      const stepCount = exercises[index]?.steps?.length ?? 0;
      handleMainIncorrect(index, stepCount > 0, stepCount);
    }
    const session = ensureSnsSession();
    if (session) {
      snsStatsRef.current.answered += 1;
      if (isCorrect) {
        snsStatsRef.current.correct += 1;
      }
      emitSnsEvent(
        "QUESTION_ANSWERED",
        buildSnsExerciseData({
          session,
          now: new Date(),
          score: buildScoreSnapshot(),
          correct: isCorrect,
        })
      );
    }
  };

  const handleStepFibChange = (exerciseIdx: number, stepIdx: number, value: string) => {
    updateGuide(exerciseIdx, (guide) => {
      const steps = [...guide.steps];
      const current = steps[stepIdx] || { ...defaultStepProgress };
      steps[stepIdx] = { ...current, fibAnswer: value, lastIncorrect: false };
      return { ...guide, steps };
    });
  };

  const handleStepOptionSelect = (
    exerciseIdx: number,
    stepIdx: number,
    option: string
  ) => {
    const scheduleFinalize = (delayMs: number) => {
      window.setTimeout(() => {
        setExerciseGuides((prev) => {
          const next = [...prev];
          const guide = ensureGuide(prev, exerciseIdx);
          const exercise = exercises[exerciseIdx];
          if (!exercise) {
            return prev;
          }
          const steps = [...guide.steps];
          const current = steps[stepIdx] || { ...defaultStepProgress };
          if (current.status !== "correctPending") {
            return prev;
          }
          steps[stepIdx] = {
            ...current,
            status: "correct",
            lastIncorrect: false,
          };
          const nextStepIndex = Math.min(
            stepIdx + 1,
            exercise.steps?.length ?? 0
          );
          next[exerciseIdx] = {
            ...guide,
            helpActive: true,
            steps,
            stepIndex: Math.max(guide.stepIndex, nextStepIndex),
          };
          return next;
        });
      }, delayMs);
    };

    updateGuide(exerciseIdx, (guide) => {
      const exercise = exercises[exerciseIdx];
      const step = exercise?.steps?.[stepIdx];
      if (!step) {
        return guide;
      }
      const steps = [...guide.steps];
      const current = steps[stepIdx] || { ...defaultStepProgress };
      const nextAttempts = current.attempts + 1;
      const isCorrect = normalize(option) === normalize(step.answer);
      if (isCorrect) {
        steps[stepIdx] = {
          ...current,
          mcqSelection: option,
          attempts: nextAttempts,
          status: "correctPending",
          lastIncorrect: false,
        };
        scheduleFinalize(1000);
      } else if (nextAttempts >= 3) {
        steps[stepIdx] = {
          ...current,
          mcqSelection: step.answer,
          attempts: nextAttempts,
          status: "revealed",
          lastIncorrect: false,
        };
      } else {
        steps[stepIdx] = {
          ...current,
          mcqSelection: option,
          attempts: nextAttempts,
          status: "unanswered",
          lastIncorrect: true,
        };
      }
      const nextStepIndex =
        steps[stepIdx].status === "unanswered" ||
        steps[stepIdx].status === "correctPending" ||
        steps[stepIdx].status === "revealed"
          ? guide.stepIndex
          : Math.min(stepIdx + 1, exercise.steps?.length ?? 0);
      return {
        ...guide,
        helpActive: true,
        steps,
        stepIndex: Math.max(guide.stepIndex, nextStepIndex),
      };
    });
  };

  const handleStepFibSubmit = (exerciseIdx: number, stepIdx: number) => {
    updateGuide(exerciseIdx, (guide) => {
      const exercise = exercises[exerciseIdx];
      const step = exercise?.steps?.[stepIdx];
      if (!step) {
        return guide;
      }
      const steps = [...guide.steps];
      const current = steps[stepIdx] || { ...defaultStepProgress };
      const nextAttempts = current.attempts + 1;
      const submitted = normalize(current.fibAnswer);
      const correct = normalize(step.answer);
      if (submitted === correct) {
        steps[stepIdx] = {
          ...current,
          fibAnswer: submitted,
          attempts: nextAttempts,
          status: "correctPending",
          lastIncorrect: false,
        };
        window.setTimeout(() => {
          setExerciseGuides((prev) => {
            const next = [...prev];
            const guidePrev = ensureGuide(prev, exerciseIdx);
            const exercisePrev = exercises[exerciseIdx];
            if (!exercisePrev) {
              return prev;
            }
            const stepsPrev = [...guidePrev.steps];
            const currentPrev = stepsPrev[stepIdx] || { ...defaultStepProgress };
            if (currentPrev.status !== "correctPending") {
              return prev;
            }
            stepsPrev[stepIdx] = {
              ...currentPrev,
              status: "correct",
              lastIncorrect: false,
            };
            const nextStepIndex = Math.min(
              stepIdx + 1,
              exercisePrev.steps?.length ?? 0
            );
            next[exerciseIdx] = {
              ...guidePrev,
              helpActive: true,
              steps: stepsPrev,
              stepIndex: Math.max(guidePrev.stepIndex, nextStepIndex),
            };
            return next;
          });
        }, 1000);
      } else if (nextAttempts >= 3) {
        steps[stepIdx] = {
          ...current,
          fibAnswer: correct,
          attempts: nextAttempts,
          status: "revealed",
          lastIncorrect: false,
        };
      } else {
        steps[stepIdx] = {
          ...current,
          attempts: nextAttempts,
          status: "unanswered",
          lastIncorrect: true,
        };
      }
      const nextStepIndex =
        steps[stepIdx].status === "unanswered" ||
        steps[stepIdx].status === "revealed" ||
        steps[stepIdx].status === "correctPending"
          ? guide.stepIndex
          : Math.min(stepIdx + 1, exercise.steps?.length ?? 0);
      return {
        ...guide,
        helpActive: true,
        steps,
        stepIndex: Math.max(guide.stepIndex, nextStepIndex),
      };
    });
  };

  const handleStepWrongReset = (exerciseIdx: number, stepIdx: number) => {
    updateGuide(exerciseIdx, (guide) => {
      const steps = [...guide.steps];
      const current = steps[stepIdx];
      if (!current) {
        return guide;
      }
      steps[stepIdx] = {
        ...current,
        status: "unanswered",
        lastIncorrect: false,
        fibAnswer: "",
        mcqSelection: "",
      };
      return {
        ...guide,
        helpActive: true,
        steps,
      };
    });
  };

  const handleStepRevealComplete = (exerciseIdx: number, stepIdx: number) => {
    updateGuide(exerciseIdx, (guide) => {
      const exercise = exercises[exerciseIdx];
      if (!exercise) {
        return guide;
      }
      if (guide.stepIndex > stepIdx) {
        return guide;
      }
      const nextStepIndex = Math.min(stepIdx + 1, exercise.steps?.length ?? 0);
      return {
        ...guide,
        helpActive: true,
        stepIndex: Math.max(guide.stepIndex, nextStepIndex),
      };
    });
  };

  const goToIndex = (nextIndex: number) => {
    if (
      nextIndex >= 0 &&
      nextIndex < exercises.length &&
      nextIndex <= maxExerciseIndex
    ) {
      programmaticScrollRef.current = { active: true, target: nextIndex };
      setExerciseIndex(nextIndex);
      scrollToIndex(nextIndex);
    }
  };

  return (
    <Box className="exercise-panel">
      {exercises.length ? (
        <>
          <Box className="exercise-carousel-wrap">
            <IconButton
              className="exercise-carousel-nav"
              onClick={() => goToIndex(Math.max(exerciseIndex - 1, 0))}
              disabled={exerciseIndex === 0}
            >
              <ChevronLeftRoundedIcon />
            </IconButton>
            <Box className="exercise-carousel" ref={carouselRef} onScroll={handleCarouselScroll}>
              {exercises.map((exercise, idx) => {
                const fibValue = fibAnswers[idx] ?? "";
                const guide =
                  exerciseGuides[idx] || buildDefaultGuide(false);
                return (
                  <ExerciseSlide
                    key={idx}
                    exercise={exercise}
                    guide={guide}
                    fibValue={fibValue}
                    mcqSelection={mcqSelections[idx]}
                    onMainFibChange={(value) => {
                      setFibAnswers((prev) => {
                        const next = [...prev];
                        next[idx] = value;
                        return next;
                      });
                      updateGuide(idx, (guide) => ({
                        ...guide,
                        mainLastIncorrect: false,
                        mainPending: "none",
                      }));
                    }}
                    onMainFibSubmit={() => handleFibSubmit(idx, exercise.answer)}
                    onMainOptionSelect={(option) =>
                      handleAnswer(idx, exercise.answer, option)
                    }
                    onStepFibChange={(stepIdx, value) =>
                      handleStepFibChange(idx, stepIdx, value)
                    }
                    onStepFibSubmit={(stepIdx) =>
                      handleStepFibSubmit(idx, stepIdx)
                    }
                    onStepOptionSelect={(stepIdx, option) =>
                      handleStepOptionSelect(idx, stepIdx, option)
                    }
                    onStepRevealComplete={(stepIdx) =>
                      handleStepRevealComplete(idx, stepIdx)
                    }
                    onStepWrongReset={(stepIdx) =>
                      handleStepWrongReset(idx, stepIdx)
                    }
                  />
                );
              })}
            </Box>
            <IconButton
              className="exercise-carousel-nav"
              onClick={() =>
                goToIndex(
                  Math.min(exerciseIndex + 1, maxExerciseIndex, exercises.length - 1)
                )
              }
              disabled={exerciseIndex >= maxExerciseIndex}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
          </Box>
          <ExerciseDots
            count={exercises.length}
            currentIndex={exerciseIndex}
            statuses={exerciseStatuses}
            maxUnlockedIndex={maxExerciseIndex}
            onSelect={(idx) => {
              if (idx > maxExerciseIndex) {
                return;
              }
              setExerciseIndex(idx);
              scrollToIndex(idx, "auto");
            }}
          />
        </>
      ) : (
        <Typography>No exercises available.</Typography>
      )}
      {showCompleteButton ? (
        <Box display="flex" justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button variant="contained" onClick={onComplete}>
            Next
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

export default ExercisesSection;
