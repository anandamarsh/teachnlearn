import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Fab, IconButton, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import {
  ExerciseScoreSnapshot,
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
  exerciseSectionKey: string;
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
  scoreSnapshot: ExerciseScoreSnapshot;
  setScoreSnapshot: SetState<ExerciseScoreSnapshot>;
  onComplete: () => void;
  showCompleteButton: boolean;
};

const ExercisesSection = ({
  exercises: rawExercises,
  exerciseSectionKey,
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
  scoreSnapshot,
  setScoreSnapshot,
  onComplete,
  showCompleteButton,
}: ExercisesSectionProps) => {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number>(0);
  const magicKeyBufferRef = useRef<string>("");
  const autoPilotTimeoutRef = useRef<number | null>(null);
  const autoPilotHoldRef = useRef<number | null>(null);
  const autoPilotHoldTriggeredRef = useRef(false);
  const autoPilotActiveRef = useRef(false);
  const exerciseIndexRef = useRef(exerciseIndex);
  const exercisesRef = useRef(exercises);
  const touchStartXRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef<{ active: boolean; target: number }>({
    active: false,
    target: 0,
  });
  const snsSessionRef = useRef<SnsSession | null>(null);
  const snsStartedRef = useRef(false);
  const snsEndedRef = useRef(false);
  const snsBlockedRef = useRef(false);
  const [retryPromptOpen, setRetryPromptOpen] = useState(false);
  const retryPromptShownRef = useRef(false);
  const [showMagicFab, setShowMagicFab] = useState(false);
  const [autoPilotActive, setAutoPilotActive] = useState(false);
  const magicPin = useMemo(() => String(lessonId || "").trim().toLowerCase(), [lessonId]);
  const snsCompletedStorageKey = useMemo(
    () => `sns-exercise-completed-${lessonId}-${exerciseSectionKey}`,
    [exerciseSectionKey, lessonId]
  );
  const shuffleStorageKey = useMemo(
    () => `lp-exercise-order-${lessonId}-${exerciseSectionKey}`,
    [exerciseSectionKey, lessonId]
  );
  const shuffleInitializedRef = useRef(false);

  const buildShuffleOrder = (count: number) => {
    const order = Array.from({ length: count }, (_, idx) => idx);
    for (let idx = order.length - 1; idx > 0; idx -= 1) {
      const swapIndex = Math.floor(Math.random() * (idx + 1));
      [order[idx], order[swapIndex]] = [order[swapIndex], order[idx]];
    }
    return order;
  };
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
    const targetSlide = carouselRef.current.querySelector<HTMLElement>(
      `[data-slide-index="${clampedIndex}"]`
    );
    if (targetSlide) {
      targetSlide.scrollIntoView({
        behavior,
        block: "nearest",
        inline: "center",
      });
      return;
    }
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
    const scrollCenter = scrollLeft + width / 2;
    const slides = Array.from(
      carouselRef.current.querySelectorAll<HTMLElement>("[data-slide-index]")
    );
    const nextIndex = slides.length
      ? slides.reduce(
          (closest, slide) => {
            const slideIndex = Number(slide.dataset.slideIndex ?? 0);
            const slideCenter = slide.offsetLeft + slide.clientWidth / 2;
            const distance = Math.abs(scrollCenter - slideCenter);
            if (distance < closest.distance) {
              return { index: slideIndex, distance };
            }
            return closest;
          },
          { index: 0, distance: Number.POSITIVE_INFINITY }
        ).index
      : Math.round(scrollLeft / width);
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
      const targetSlide = carouselRef.current.querySelector<HTMLElement>(
        `[data-slide-index="${programmaticScrollRef.current.target}"]`
      );
      const targetCenter = targetSlide
        ? targetSlide.offsetLeft + targetSlide.clientWidth / 2
        : programmaticScrollRef.current.target * width + width / 2;
      if (Math.abs(scrollCenter - targetCenter) < 2) {
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
    if (!rawExercises.length) {
      setExercises([]);
      return;
    }
    let order: number[] | null = null;
    try {
      const stored = window.localStorage.getItem(shuffleStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === rawExercises.length) {
          order = parsed.filter((value) => Number.isInteger(value));
          if (order.length !== rawExercises.length) {
            order = null;
          }
        }
      }
    } catch (_err) {
      order = null;
    }
    if (!order) {
      order = buildShuffleOrder(rawExercises.length);
      window.localStorage.setItem(shuffleStorageKey, JSON.stringify(order));
    }
    setExercises(order.map((idx) => rawExercises[idx]).filter(Boolean));
    shuffleInitializedRef.current = true;
  }, [rawExercises, shuffleStorageKey]);

  useEffect(() => {
    const hasAttempts = exerciseStatuses.some(
      (status) => status !== "unattempted"
    );
    if (hasAttempts) {
      shuffleInitializedRef.current = false;
    }
  }, [exerciseStatuses]);

  useEffect(() => {
    if (!rawExercises.length) {
      return;
    }
    const isFreshRun =
      exerciseIndex === 0 &&
      maxExerciseIndex === 0 &&
      exerciseStatuses.length === rawExercises.length &&
      exerciseStatuses.every((status) => status === "unattempted") &&
      fibAnswers.every((value) => !value) &&
      mcqSelections.every((value) => !value) &&
      exerciseGuides.every((guide) => !guide?.completed);
    if (!isFreshRun || shuffleInitializedRef.current) {
      return;
    }
    const order = buildShuffleOrder(rawExercises.length);
    window.localStorage.setItem(shuffleStorageKey, JSON.stringify(order));
    setExercises(order.map((idx) => rawExercises[idx]).filter(Boolean));
    shuffleInitializedRef.current = true;
  }, [
    exerciseGuides,
    exerciseIndex,
    exerciseStatuses,
    fibAnswers,
    maxExerciseIndex,
    mcqSelections,
    rawExercises,
    shuffleStorageKey,
  ]);

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

  useEffect(() => {
    exerciseIndexRef.current = exerciseIndex;
  }, [exerciseIndex]);

  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

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
    magicKeyBufferRef.current = "";
    setShowMagicFab(false);
  }, [magicPin]);

  useEffect(() => {
    if (!showMagicFab && autoPilotActiveRef.current) {
      setAutoPilotActive(false);
    }
  }, [showMagicFab]);

  useEffect(() => {
    autoPilotActiveRef.current = autoPilotActive;
    if (!autoPilotActive && autoPilotTimeoutRef.current !== null) {
      window.clearTimeout(autoPilotTimeoutRef.current);
      autoPilotTimeoutRef.current = null;
    }
  }, [autoPilotActive]);

  useEffect(() => {
    const handleMagicPinEntry = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }
      if (event.key.length !== 1) {
        return;
      }
      const key = event.key.toLowerCase();
      if (!/[a-z0-9]/.test(key)) {
        return;
      }
      const nextBuffer = `${magicKeyBufferRef.current}${key}`.slice(-magicPin.length);
      magicKeyBufferRef.current = nextBuffer;
      if (nextBuffer === magicPin) {
        setShowMagicFab((prev) => !prev);
      }
    };
    window.addEventListener("keyup", handleMagicPinEntry);
    return () => window.removeEventListener("keyup", handleMagicPinEntry);
  }, [magicPin]);

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

  const normalizeValue = (value: string | number | null | undefined) =>
    String(value ?? "").replace(/\s+/g, "");

  const stripNumberFormatting = (value: string) => value.replace(/[\s,]+/g, "");

  const normalizeOperators = (value: string) =>
    value
      .toLowerCase()
      .replace(/[×*]/g, "x")
      .replace(/[÷]/g, "/")
      .replace(/[−–—]/g, "-")
      .replace(/[＋]/g, "+")
      .replace(/\s+/g, "");

  const parseFraction = (value: string) => {
    const cleaned = stripNumberFormatting(value);
    const match = cleaned.match(/^([-+]?\d+)\/([-+]?\d+)$/);
    if (!match) {
      return null;
    }
    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
      return null;
    }
    if (denominator === 0) {
      return null;
    }
    return { numerator, denominator };
  };

  const isNumericString = (value: string) => {
    const cleaned = stripNumberFormatting(value);
    return /^[-+]?\d+(\.\d+)?$/.test(cleaned);
  };

  const areFractionsEqual = (left: string, right: string) => {
    const leftFrac = parseFraction(left);
    const rightFrac = parseFraction(right);
    if (!leftFrac || !rightFrac) {
      return false;
    }
    return (
      leftFrac.numerator * rightFrac.denominator ===
      rightFrac.numerator * leftFrac.denominator
    );
  };

  const areNumbersEqual = (left: string, right: string) => {
    if (!isNumericString(left) || !isNumericString(right)) {
      return false;
    }
    return Number(stripNumberFormatting(left)) === Number(stripNumberFormatting(right));
  };

  const isCorrectAnswer = (submitted: string, answer: string) => {
    const normalizedSubmitted = normalizeOperators(normalizeValue(submitted));
    const normalizedAnswer = normalizeOperators(normalizeValue(answer));
    if (areFractionsEqual(normalizedSubmitted, normalizedAnswer)) {
      return true;
    }
    if (areNumbersEqual(normalizedSubmitted, normalizedAnswer)) {
      return true;
    }
    return normalizedSubmitted === normalizedAnswer;
  };

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

  const buildScoreSnapshot = (
    statuses: ExerciseStatus[] = exerciseStatuses
  ) => {
    const total = exercises.length;
    const answered = statuses.filter((status) => status !== "unattempted").length;
    const correct = statuses.filter((status) => status === "correct").length;
    const skillScore = total
      ? Math.round((correct / total) * 100)
      : 0;
    return {
      questionsAnswered: { thisSession: answered, previousSessions: 0 },
      skillScore,
      correctSoFar: correct,
    };
  };
  const updateScoreSnapshot = (statuses?: ExerciseStatus[]) => {
    const next = buildScoreSnapshot(statuses);
    setScoreSnapshot((prev) => {
      if (
        prev.skillScore === next.skillScore &&
        prev.correctSoFar === next.correctSoFar &&
        prev.questionsAnswered.thisSession === next.questionsAnswered.thisSession &&
        prev.questionsAnswered.previousSessions ===
          next.questionsAnswered.previousSessions
      ) {
        return prev;
      }
      return next;
    });
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
    return snsSessionRef.current;
  };

  const startExerciseIfNeeded = () => {
    if (snsBlockedRef.current) {
      return;
    }
    if (snsStartedRef.current) {
      return;
    }
    const session = ensureSnsSession();
    emitSnsEvent(
      "EXERCISE_STARTED",
      buildSnsExerciseData({
        session,
        now: new Date(),
        score: scoreSnapshot,
      })
    );
    snsStartedRef.current = true;
    updateScoreSnapshot();
  };

  useEffect(() => {
    const completed = window.localStorage.getItem(snsCompletedStorageKey) === "true";
    if (completed) {
      snsBlockedRef.current = true;
      emitSnsEvent("ERROR_WARNING", {
        message:
          "You have already completed this skill and will not be awarded again.",
      });
    } else {
      snsBlockedRef.current = false;
    }
  }, [snsCompletedStorageKey]);

  useEffect(() => {
    if (snsEndedRef.current) {
      return;
    }
    if (!snsStartedRef.current) {
      return;
    }
    if (snsBlockedRef.current) {
      return;
    }
    const score = buildScoreSnapshot(exerciseStatuses);
    if (score.skillScore !== 100) {
      return;
    }
    const session = ensureSnsSession();
    const now = new Date();
    emitSnsEvent(
      "EXERCISE_ENDED",
      buildSnsExerciseData({
        session,
        now,
        score,
        ended: true,
      })
    );
    snsEndedRef.current = true;
    snsBlockedRef.current = true;
    window.localStorage.setItem(snsCompletedStorageKey, "true");
  }, [exerciseStatuses]);

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
    updateScoreSnapshot();
  }, [defaultStepProgress, exercises, setExerciseGuides]);

  useEffect(() => {
    updateScoreSnapshot();
  }, [exerciseStatuses, exercises.length]);

  useEffect(() => {
    snsStartedRef.current = false;
    snsEndedRef.current = false;
  }, [exerciseSectionKey]);

  useEffect(() => {
    if (!exercises.length) {
      return;
    }
    if (retryPromptShownRef.current || retryPromptOpen) {
      return;
    }
    const hasUnattempted = exerciseStatuses.some(
      (status) => status === "unattempted"
    );
    const hasIncorrect = exerciseStatuses.some(
      (status) => status === "incorrect"
    );
    if (!hasUnattempted && hasIncorrect) {
      window.setTimeout(() => {
        setRetryPromptOpen(true);
        retryPromptShownRef.current = true;
      }, 1000);
    }
  }, [exerciseStatuses, exercises.length, retryPromptOpen]);

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
    const isCorrect = isCorrectAnswer(option, answer);
    const nextSelections = [...mcqSelections];
    nextSelections[index] = option;
    setMcqSelections(nextSelections);
    let nextStatuses: ExerciseStatus[] = [];
    let statusChanged = false;
    setExerciseStatuses((prev) => {
      const next = [...prev];
      const prevStatus = next[index];
      if (isCorrect) {
        if (next[index] !== "incorrect") {
          next[index] = "correct";
        }
      } else if (next[index] === "unattempted") {
        next[index] = "incorrect";
      }
      statusChanged = next[index] !== prevStatus;
      nextStatuses = next;
      return next;
    });
    if (isCorrect) {
      handleMainCorrect(index);
    } else {
      const stepCount = exercises[index]?.steps?.length ?? 0;
      handleMainIncorrect(index, stepCount > 0, stepCount);
    }
    if (
      index === exercises.length - 1 &&
      !retryPromptShownRef.current &&
      nextStatuses.includes("incorrect")
    ) {
      setRetryPromptOpen(true);
      retryPromptShownRef.current = true;
    }
    if (snsBlockedRef.current) {
      return;
    }
    const session = ensureSnsSession();
    startExerciseIfNeeded();
    if (session && statusChanged) {
      const score = buildScoreSnapshot(nextStatuses);
      updateScoreSnapshot(nextStatuses);
      emitSnsEvent(
        "QUESTION_ANSWERED",
        buildSnsExerciseData({
          session,
          now: new Date(),
          score,
          correct: isCorrect,
        })
      );
    }
  };

  const handleFibSubmit = (
    index: number,
    answer: string,
    submittedOverride?: string
  ) => {
    const submitted = normalizeValue(submittedOverride ?? fibAnswers[index]);
    const correct = normalizeValue(answer);
    const isCorrect = isCorrectAnswer(submitted, correct);
    let nextStatuses: ExerciseStatus[] = [];
    let statusChanged = false;
    setExerciseStatuses((prev) => {
      const next = [...prev];
      const prevStatus = next[index];
      if (isCorrect) {
        if (next[index] !== "incorrect") {
          next[index] = "correct";
        }
      } else if (next[index] === "unattempted") {
        next[index] = "incorrect";
      }
      statusChanged = next[index] !== prevStatus;
      nextStatuses = next;
      return next;
    });
    if (isCorrect) {
      handleMainCorrect(index);
    } else {
      const stepCount = exercises[index]?.steps?.length ?? 0;
      handleMainIncorrect(index, stepCount > 0, stepCount);
    }
    if (
      index === exercises.length - 1 &&
      !retryPromptShownRef.current &&
      nextStatuses.includes("incorrect")
    ) {
      setRetryPromptOpen(true);
      retryPromptShownRef.current = true;
    }
    if (snsBlockedRef.current) {
      return;
    }
    const session = ensureSnsSession();
    startExerciseIfNeeded();
    if (session && statusChanged) {
      const score = buildScoreSnapshot(nextStatuses);
      updateScoreSnapshot(nextStatuses);
      emitSnsEvent(
        "QUESTION_ANSWERED",
        buildSnsExerciseData({
          session,
          now: new Date(),
          score,
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
      const isCorrect = isCorrectAnswer(option, step.answer);
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
      const submitted = normalizeValue(current.fibAnswer);
      const correct = normalizeValue(step.answer);
      if (isCorrectAnswer(submitted, correct)) {
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
    const unlockLimit = Math.max(maxExerciseIndex, exerciseIndex);
    if (
      nextIndex >= 0 &&
      nextIndex < exercises.length &&
      nextIndex <= unlockLimit
    ) {
      programmaticScrollRef.current = { active: true, target: nextIndex };
      setExerciseIndex(nextIndex);
      scrollToIndex(nextIndex);
    }
  };

  const handleMainRecheck = (index: number) => {
    const exercise = exercises[index];
    if (!exercise) {
      return;
    }
    if (exercise.type === "fib") {
      handleFibSubmit(index, exercise.answer, String(exercise.answer ?? ""));
      return;
    }
    const answer = String(exercise.answer ?? "");
    if (answer) {
      handleAnswer(index, answer, answer);
    }
  };

  const handleMagicSolve = (indexOverride?: number) => {
    const index = indexOverride ?? exerciseIndex;
    const exercise = exercises[index];
    if (!exercise) {
      return;
    }
    const answer = String(exercise.answer ?? "");
    if (exercise.type === "fib") {
      setFibAnswers((prev) => {
        const next = [...prev];
        next[index] = answer;
        return next;
      });
      handleFibSubmit(index, answer, answer);
      return;
    }
    if (answer) {
      handleAnswer(index, answer, answer);
    }
  };

  const autoPilotStep = () => {
    if (!autoPilotActiveRef.current) {
      return;
    }
    const index = exerciseIndexRef.current;
    const list = exercisesRef.current;
    if (!list.length) {
      setAutoPilotActive(false);
      return;
    }
    if (index >= list.length) {
      setAutoPilotActive(false);
      return;
    }
    handleMagicSolve(index);
    if (index >= list.length - 1) {
      setAutoPilotActive(false);
    }
  };

  useEffect(() => {
    if (!autoPilotActive || !showMagicFab) {
      return;
    }
    if (autoPilotTimeoutRef.current !== null) {
      window.clearTimeout(autoPilotTimeoutRef.current);
    }
    autoPilotTimeoutRef.current = window.setTimeout(() => {
      autoPilotStep();
    }, 500);
    return () => {
      if (autoPilotTimeoutRef.current !== null) {
        window.clearTimeout(autoPilotTimeoutRef.current);
        autoPilotTimeoutRef.current = null;
      }
    };
  }, [autoPilotActive, exerciseIndex, showMagicFab]);

  return (
    <Box className="exercise-panel">
      <div className="exercise-score-box">
        <div className="exercise-score-label">Score</div>
        <div className="exercise-score-value">{scoreSnapshot.skillScore}</div>
      </div>
      {showMagicFab ? (
        <Fab
          color="primary"
          aria-label="Magic answer"
          className={`exercise-magic-fab${autoPilotActive ? " autopilot" : ""}`}
          onClick={() => {
            if (autoPilotHoldTriggeredRef.current) {
              autoPilotHoldTriggeredRef.current = false;
              return;
            }
            handleMagicSolve();
          }}
          onPointerDown={() => {
            if (autoPilotHoldRef.current !== null) {
              window.clearTimeout(autoPilotHoldRef.current);
            }
            autoPilotHoldTriggeredRef.current = false;
            autoPilotHoldRef.current = window.setTimeout(() => {
              autoPilotHoldTriggeredRef.current = true;
              setAutoPilotActive((prev) => !prev);
            }, 350);
          }}
          onPointerUp={() => {
            if (autoPilotHoldRef.current !== null) {
              window.clearTimeout(autoPilotHoldRef.current);
              autoPilotHoldRef.current = null;
            }
          }}
          onPointerLeave={() => {
            if (autoPilotHoldRef.current !== null) {
              window.clearTimeout(autoPilotHoldRef.current);
              autoPilotHoldRef.current = null;
            }
          }}
          onPointerCancel={() => {
            if (autoPilotHoldRef.current !== null) {
              window.clearTimeout(autoPilotHoldRef.current);
              autoPilotHoldRef.current = null;
            }
          }}
          sx={{
            position: "fixed",
            right: "1rem",
            top: "50%",
            transform: autoPilotActive
              ? "translateY(-50%) scale(0.96)"
              : "translateY(-50%)",
            zIndex: 1400,
            boxShadow: autoPilotActive
              ? "inset 0 0 0 2px rgba(255,255,255,0.4)"
              : undefined,
          }}
        >
          <KeyRoundedIcon />
        </Fab>
      ) : null}
      <Dialog
        open={retryPromptOpen}
        onClose={() => setRetryPromptOpen(false)}
      >
        <DialogTitle>Retry wrong questions?</DialogTitle>
        <DialogContent>
          <Typography>
            Would you like to retry the wrong questions?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRetryPromptOpen(false)}>
            No
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const wrongIndices = exerciseStatuses
                .map((status, idx) => (status === "incorrect" ? idx : -1))
                .filter((idx) => idx >= 0);
              if (!wrongIndices.length) {
                setRetryPromptOpen(false);
                return;
              }
              snsEndedRef.current = false;
              const candidates = exerciseStatuses
                .map((status, idx) => (status === "correct" ? idx : -1))
                .filter((idx) => idx >= 0);
              const extraCount = wrongIndices.length;
              const extraIndices: number[] = [];
              const pool = [...candidates];
              while (extraIndices.length < extraCount && pool.length) {
                const pickIndex = Math.floor(Math.random() * pool.length);
                extraIndices.push(pool.splice(pickIndex, 1)[0]);
              }
              const retryIndices = Array.from(
                new Set([...wrongIndices, ...extraIndices])
              );
              setExerciseStatuses((prev) => {
                const next = [...prev];
                retryIndices.forEach((idx) => {
                  next[idx] = "unattempted";
                });
                return next;
              });
              setExerciseGuides((prev) => {
                const next = [...prev];
                retryIndices.forEach((idx) => {
                  next[idx] = buildDefaultGuide(false);
                });
                return next;
              });
              setFibAnswers((prev) => {
                const next = [...prev];
                retryIndices.forEach((idx) => {
                  next[idx] = "";
                });
                return next;
              });
              setMcqSelections((prev) => {
                const next = [...prev];
                retryIndices.forEach((idx) => {
                  next[idx] = "";
                });
                return next;
              });
              const firstRetry = Math.min(...retryIndices);
              programmaticScrollRef.current = {
                active: true,
                target: firstRetry,
              };
              setExerciseIndex(firstRetry);
              scrollToIndex(firstRetry, "smooth", true);
              if (snsBlockedRef.current) {
                setRetryPromptOpen(false);
                return;
              }
              const session = ensureSnsSession();
              const nextStatuses = exerciseStatuses.map((status, idx) =>
                retryIndices.includes(idx) ? "unattempted" : status
              );
              const score = buildScoreSnapshot(nextStatuses);
              updateScoreSnapshot(nextStatuses);
              if (session) {
                emitSnsEvent(
                  "QUESTION_ANSWERED",
                  buildSnsExerciseData({
                    session,
                    now: new Date(),
                    score,
                    correct: false,
                  })
                );
              }
              setRetryPromptOpen(false);
            }}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>
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
                    slideIndex={idx}
                    isActive={idx === exerciseIndex}
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
                    onMainRecheck={() => handleMainRecheck(idx)}
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
    </Box>
  );
};

export default ExercisesSection;
