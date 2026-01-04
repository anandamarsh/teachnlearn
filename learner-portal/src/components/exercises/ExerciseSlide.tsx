import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExerciseGuideState,
  ExerciseItem,
  ExerciseStep,
} from "../../state/types";

type ExerciseSlideProps = {
  exercise: ExerciseItem;
  guide: ExerciseGuideState;
  fibValue: string;
  mcqSelection: string;
  isActive: boolean;
  onMainFibChange: (value: string) => void;
  onMainFibSubmit: () => void;
  onMainOptionSelect: (option: string) => void;
  onStepFibChange: (stepIndex: number, value: string) => void;
  onStepFibSubmit: (stepIndex: number) => void;
  onStepOptionSelect: (stepIndex: number, option: string) => void;
  onStepRevealComplete: (stepIndex: number) => void;
  onStepWrongReset: (stepIndex: number) => void;
};

const ExerciseSlide = ({
  exercise,
  guide,
  fibValue,
  mcqSelection,
  isActive,
  onMainFibChange,
  onMainFibSubmit,
  onMainOptionSelect,
  onStepFibChange,
  onStepFibSubmit,
  onStepOptionSelect,
  onStepRevealComplete,
  onStepWrongReset,
}: ExerciseSlideProps) => {
  const steps = exercise.steps ?? [];
  const stepCount = steps.length;
  const stepsComplete =
    stepCount > 0 && guide.helpActive && guide.stepIndex >= stepCount;
  const showSteps = guide.helpActive && stepCount > 0;
  const showMainInput = !showSteps || stepsComplete;
  const isMainLocked = guide.completed;
  const fibDisabled =
    !fibValue.trim() ||
    isMainLocked ||
    guide.mainPending === "incorrectPending";
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const revealTimersRef = useRef<Record<number, number[]>>({});
  const [revealStates, setRevealStates] = useState<
    Array<"idle" | "pending" | "fading" | "shown">
  >([]);
  const wrongTimersRef = useRef<Record<number, number[]>>({});
  const [wrongStates, setWrongStates] = useState<
    Array<"idle" | "show" | "fading">
  >([]);
  const activeStepIndex = useMemo(() => {
    if (!stepCount) {
      return -1;
    }
    return stepsComplete ? stepCount - 1 : guide.stepIndex;
  }, [guide.stepIndex, stepCount, stepsComplete]);

  useEffect(() => {
    if (!showSteps || activeStepIndex < 0) {
      return;
    }
    const target = stepRefs.current[activeStepIndex];
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeStepIndex, showSteps]);

  useEffect(() => {
    setRevealStates((prev) => {
      if (prev.length === stepCount) {
        return prev;
      }
      return Array.from({ length: stepCount }).map(
        (_, idx) => prev[idx] || "idle"
      );
    });
    setWrongStates((prev) => {
      if (prev.length === stepCount) {
        return prev;
      }
      return Array.from({ length: stepCount }).map(
        (_, idx) => prev[idx] || "idle"
      );
    });
  }, [stepCount]);

  useEffect(() => {
    const scheduleReveal = (idx: number) => {
      const timers = revealTimersRef.current[idx] || [];
      const pendingTimer = window.setTimeout(() => {
        setRevealStates((prev) => {
          if (prev[idx] !== "pending") {
            return prev;
          }
          const next = [...prev];
          next[idx] = "fading";
          return next;
        });
        const fadeTimer = window.setTimeout(() => {
          setRevealStates((prev) => {
            if (prev[idx] !== "fading") {
              return prev;
            }
            const next = [...prev];
            next[idx] = "shown";
            return next;
          });
        }, 1000);
        revealTimersRef.current[idx] = [
          ...(revealTimersRef.current[idx] || []),
          fadeTimer,
        ];
      }, 2000);
      revealTimersRef.current[idx] = [...timers, pendingTimer];
    };

    guide.steps.forEach((step, idx) => {
      const state = revealStates[idx] || "idle";
      if (step?.status === "revealed") {
        if (state === "idle") {
          setRevealStates((prev) => {
            const next = [...prev];
            next[idx] = "pending";
            return next;
          });
          scheduleReveal(idx);
        }
      } else if (state !== "idle") {
        const timers = revealTimersRef.current[idx] || [];
        timers.forEach((timerId) => window.clearTimeout(timerId));
        revealTimersRef.current[idx] = [];
        setRevealStates((prev) => {
          const next = [...prev];
          next[idx] = "idle";
          return next;
        });
      }
    });
  }, [guide.steps, revealStates]);

  useEffect(() => {
    const scheduleWrongClear = (idx: number) => {
      const timers = wrongTimersRef.current[idx] || [];
      const showTimer = window.setTimeout(() => {
        setWrongStates((prev) => {
          if (prev[idx] !== "show") {
            return prev;
          }
          const next = [...prev];
          next[idx] = "fading";
          return next;
        });
        const fadeTimer = window.setTimeout(() => {
          onStepWrongReset(idx);
          setWrongStates((prev) => {
            const next = [...prev];
            next[idx] = "idle";
            return next;
          });
        }, 1000);
        wrongTimersRef.current[idx] = [
          ...(wrongTimersRef.current[idx] || []),
          fadeTimer,
        ];
      }, 1000);
      wrongTimersRef.current[idx] = [...timers, showTimer];
    };

    guide.steps.forEach((step, idx) => {
      const state = wrongStates[idx] || "idle";
      const stepDef = steps[idx];
      if (stepDef?.type === "fib") {
        if (state !== "idle") {
          const timers = wrongTimersRef.current[idx] || [];
          timers.forEach((timerId) => window.clearTimeout(timerId));
          wrongTimersRef.current[idx] = [];
          setWrongStates((prev) => {
            const next = [...prev];
            next[idx] = "idle";
            return next;
          });
        }
        return;
      }
      if (step?.lastIncorrect) {
        if (state === "idle") {
          setWrongStates((prev) => {
            const next = [...prev];
            next[idx] = "show";
            return next;
          });
          scheduleWrongClear(idx);
        }
      } else if (state !== "idle") {
        const timers = wrongTimersRef.current[idx] || [];
        timers.forEach((timerId) => window.clearTimeout(timerId));
        wrongTimersRef.current[idx] = [];
        setWrongStates((prev) => {
          const next = [...prev];
          next[idx] = "idle";
          return next;
        });
      }
    });
  }, [guide.steps, onStepWrongReset, steps, wrongStates]);

  useEffect(() => {
    revealStates.forEach((state, idx) => {
      if (state === "shown" && guide.steps[idx]?.status === "revealed") {
        onStepRevealComplete(idx);
      }
    });
  }, [guide.steps, onStepRevealComplete, revealStates]);

  useEffect(
    () => () => {
      Object.values(revealTimersRef.current).forEach((timers) => {
        timers.forEach((timerId) => window.clearTimeout(timerId));
      });
      revealTimersRef.current = {};
      Object.values(wrongTimersRef.current).forEach((timers) => {
        timers.forEach((timerId) => window.clearTimeout(timerId));
      });
      wrongTimersRef.current = {};
    },
    []
  );

  const renderStepContent = (
    step: ExerciseStep,
    stepIndex: number,
    isActive: boolean,
    isLast: boolean
  ) => {
    const progress = guide.steps[stepIndex];
    const revealState = revealStates[stepIndex] || "idle";
    const wrongState = wrongStates[stepIndex] || "idle";
    const isPending = progress?.status === "correctPending";
    const isDone =
      progress?.status === "correct" || progress?.status === "revealed";
    const stepFibDisabled = !progress?.fibAnswer?.trim() || isDone || isPending;
    const tickState = isDone
      ? progress?.status === "correct"
        ? "correct"
        : "incorrect"
      : isPending
      ? "correct"
      : progress?.lastIncorrect
      ? "incorrect"
      : "pending";
    const answerValue =
      progress?.mcqSelection || progress?.fibAnswer || step.answer;
    const showRevealNote =
      progress?.status === "revealed" && revealState !== "shown";
    const showAnswer =
      progress?.status === "revealed" ? revealState === "shown" : isDone;
    const finalDoneClass =
      stepIndex === steps.length - 1 && isDone
        ? " exercise-step-final-done"
        : "";
    return (
      <Box
        key={stepIndex}
        className={`exercise-step step-reveal${finalDoneClass}`}
        ref={(node: HTMLDivElement | null) => {
          stepRefs.current[stepIndex] = node;
        }}
      >
        <Box className="exercise-step-line">
          <span className={`step-tick ${tickState}`} aria-hidden="true" />
          <span
            className="exercise-step-question"
            dangerouslySetInnerHTML={{ __html: step.step || "" }}
          />
          {showAnswer ? (
            <span className="exercise-step-answer-inline">{answerValue}</span>
          ) : null}
        </Box>
        {showRevealNote ? (
          <Typography
            className={`exercise-step-reveal-note${
              revealState === "fading" ? " fade-out" : ""
            }`}
            sx={{ mt: "1rem" }}
          >
            Never mind, I will tell you the correct answer.
          </Typography>
        ) : null}
        {!isDone && isActive ? (
          step.type === "fib" ? (
            <Box className="exercise-options step-options">
              <Box
                className={`fib-row step-fib-row${
                  isPending ? " step-correct-pending" : ""
                }`}
              >
                <TextField
                  className="fib-textfield step-fib-textfield"
                  variant="outlined"
                  size="small"
                  value={progress?.fibAnswer || ""}
                  onChange={(event) =>
                    onStepFibChange(stepIndex, event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    if (!stepFibDisabled) {
                      onStepFibSubmit(stepIndex);
                    }
                  }}
                  placeholder="Type your answer"
                  error={Boolean(progress?.lastIncorrect)}
                  helperText={
                    progress?.lastIncorrect
                      ? "Sorry, that's not correct. Lets try again."
                      : " "
                  }
                  FormHelperTextProps={{
                    className: "fib-helper-text",
                  }}
                  inputProps={{ readOnly: isDone || isPending }}
                  disabled={isDone || isPending}
                  InputProps={{
                    endAdornment: progress?.fibAnswer ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="Clear answer"
                          onClick={() => onStepFibChange(stepIndex, "")}
                          edge="end"
                          disabled={isDone || isPending}
                        >
                          <ClearRoundedIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                <IconButton
                  className="fib-check"
                  color="primary"
                  onClick={() => onStepFibSubmit(stepIndex)}
                  disabled={stepFibDisabled}
                  aria-label="Check answer"
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    padding: 0,
                    transformOrigin: "center",
                    bgcolor: "primary.main",
                    color: "#fff",
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                    "&.Mui-disabled": {
                      bgcolor: "rgba(0, 0, 0, 0.2)",
                      color: "#fff",
                    },
                  }}
                >
                  <CheckRoundedIcon />
                </IconButton>
              </Box>
            </Box>
          ) : (
            <>
              <Box
                className={`exercise-options-grid step-options-grid${
                  isPending ? " step-options-pending" : ""
                }`}
              >
                {step.options?.map((option) => {
                  const isSelected = progress?.mcqSelection === option;
                  const isIncorrect =
                    progress?.lastIncorrect &&
                    isSelected &&
                    progress?.status === "unanswered";
                  const isCorrectPending = isPending && isSelected;
                  return (
                    <Button
                      key={option}
                      variant="outlined"
                      size="small"
                      onClick={() =>
                        isPending
                          ? undefined
                          : onStepOptionSelect(stepIndex, option)
                      }
                      sx={{
                        borderColor: isCorrectPending
                          ? "success.main"
                          : isIncorrect
                          ? "error.main"
                          : isSelected
                          ? "primary.main"
                          : undefined,
                        color: isCorrectPending
                          ? "success.main"
                          : isIncorrect
                          ? "error.main"
                          : isSelected
                          ? "primary.main"
                          : undefined,
                        backgroundColor: isCorrectPending
                          ? "rgba(46,125,50,0.15)"
                          : isIncorrect
                          ? "rgba(198,40,40,0.12)"
                          : isSelected
                          ? "rgba(230,81,0,0.08)"
                          : undefined,
                      }}
                    >
                      {option}
                    </Button>
                  );
                })}
              </Box>
              {progress?.lastIncorrect ? (
                <Typography
                  className={`exercise-step-error${
                    wrongState === "fading" ? " fade-out" : ""
                  }`}
                >
                  Sorry, that&apos;s not correct. Lets try again.
                </Typography>
              ) : null}
            </>
          )
        ) : null}
        {!isLast ? <div className="exercise-step-divider" /> : null}
      </Box>
    );
  };

  return (
    <Box className="exercise-slide">
      <Box className="exercise-slide-content">
        <Box
          className={`exercise-question${isActive ? " on-screen" : ""}`}
          dangerouslySetInnerHTML={{ __html: exercise.question_html || "" }}
        />
        {showSteps ? (
          <Box className="exercise-steps">
            {!stepsComplete ? (
              <Typography className="exercise-step-intro">
                Sorry, that&apos;s not correct. Lets try again.
              </Typography>
            ) : null}
            {steps
              .slice(0, stepsComplete ? steps.length : guide.stepIndex + 1)
              .map((step, idx, list) =>
                renderStepContent(
                  step,
                  idx,
                  idx === guide.stepIndex && !stepsComplete,
                  idx === list.length - 1
                )
              )}
          </Box>
        ) : null}
        {showMainInput ? (
          <>
            {stepsComplete && !guide.completed ? (
              <>
                <div className="exercise-step-divider post-steps" />
                <Typography
                  className="exercise-step-next"
                  sx={{ mt: "0.5rem", mb: "1rem" }}
                >
                  Now let's answer the original question again
                </Typography>
              </>
            ) : null}
            {exercise.type === "fib" ? (
              <Box className="exercise-options">
                <Box className="fib-row">
                  <TextField
                    className="fib-textfield"
                    variant="outlined"
                    size="medium"
                    value={fibValue}
                    onChange={(event) => onMainFibChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }
                      if (!fibDisabled) {
                        onMainFibSubmit();
                      }
                    }}
                    placeholder="Type your answer"
                    error={
                      guide.mainPending === "incorrectPending" ||
                      guide.mainLastIncorrect
                    }
                    helperText={
                      guide.mainPending === "incorrectPending" ||
                      guide.mainLastIncorrect
                        ? "Sorry, that's not correct. Lets work it out together"
                        : " "
                    }
                    FormHelperTextProps={{ className: "fib-helper-text" }}
                    inputProps={{
                      readOnly:
                        isMainLocked ||
                        guide.mainPending === "incorrectPending",
                    }}
                    disabled={
                      isMainLocked || guide.mainPending === "incorrectPending"
                    }
                    InputProps={{
                      endAdornment: fibValue ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="Clear answer"
                            onClick={() => onMainFibChange("")}
                            edge="end"
                            disabled={
                              isMainLocked ||
                              guide.mainPending === "incorrectPending"
                            }
                          >
                            <ClearRoundedIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                  <IconButton
                    className="fib-check"
                    color="primary"
                    onClick={onMainFibSubmit}
                    disabled={fibDisabled}
                    aria-label="Check answer"
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      padding: 0,
                      transformOrigin: "center",
                      bgcolor: guide.completed
                        ? "success.main"
                        : "primary.main",
                      color: "#fff",
                      "&:hover": {
                        bgcolor: guide.completed
                          ? "success.dark"
                          : "primary.dark",
                      },
                      "&.Mui-disabled": {
                        bgcolor: guide.completed
                          ? "success.main"
                          : "rgba(0, 0, 0, 0.2)",
                        color: "#fff",
                      },
                    }}
                  >
                    <CheckRoundedIcon />
                  </IconButton>
                </Box>
              </Box>
            ) : (
              <>
                <Box className="exercise-options-grid">
                  {exercise.options?.map((option) => {
                    const isSelected = mcqSelection === option;
                    const isIncorrectPending =
                      guide.mainPending === "incorrectPending" && isSelected;
                    const isCorrectFinal =
                      guide.completed && option === exercise.answer;
                    const highlightColor = isIncorrectPending
                      ? "error.dark"
                      : isCorrectFinal
                      ? "success.main"
                      : isSelected && guide.completed
                      ? "error.main"
                      : isSelected
                      ? "primary.main"
                      : undefined;
                    const highlightBg = isIncorrectPending
                      ? "rgba(198,40,40,0.2)"
                      : isCorrectFinal
                      ? "rgba(46,125,50,0.12)"
                      : isSelected && guide.completed
                      ? "rgba(198,40,40,0.12)"
                      : isSelected
                      ? "rgba(230,81,0,0.08)"
                      : undefined;
                    return (
                      <Button
                        key={option}
                        variant="outlined"
                        size="large"
                        onClick={() =>
                          isMainLocked || isIncorrectPending
                            ? undefined
                            : onMainOptionSelect(option)
                        }
                        disabled={guide.completed}
                        sx={{
                          borderColor: highlightColor,
                          color: highlightColor,
                          backgroundColor: isSelected ? highlightBg : undefined,
                          "&.Mui-disabled": {
                            borderColor: isCorrectFinal
                              ? "success.main"
                              : "rgba(0, 0, 0, 0.12)",
                            color: isCorrectFinal
                              ? "success.main"
                              : "rgba(0, 0, 0, 0.3)",
                            backgroundColor: isCorrectFinal
                              ? "rgba(46,125,50,0.12)"
                              : "transparent",
                          },
                        }}
                      >
                        {option}
                      </Button>
                    );
                  })}
                  {!exercise.options?.length ? (
                    <Typography color="text.secondary">
                      No options provided for this exercise.
                    </Typography>
                  ) : null}
                </Box>
                {guide.mainLastIncorrect ? (
                  <Typography className="exercise-step-error">
                    Sorry, that&apos;s not correct. Lets try again.
                  </Typography>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </Box>
    </Box>
  );
};

export default ExerciseSlide;
