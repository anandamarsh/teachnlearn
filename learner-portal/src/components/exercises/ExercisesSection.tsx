import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import { Box, Button, IconButton, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { ExerciseItem, ExerciseStatus } from "../../state/types";
import ExerciseDots from "./ExerciseDots";
import ExerciseSlide from "./ExerciseSlide";

type SetState<T> = Dispatch<SetStateAction<T>>;

type ExercisesSectionProps = {
  exercises: ExerciseItem[];
  exerciseIndex: number;
  setExerciseIndex: SetState<number>;
  exerciseStatuses: ExerciseStatus[];
  setExerciseStatuses: SetState<ExerciseStatus[]>;
  fibAnswers: string[];
  setFibAnswers: SetState<string[]>;
  fibFeedbacks: ({ correct: boolean; correctAnswer: string } | null)[];
  setFibFeedbacks: SetState<({ correct: boolean; correctAnswer: string } | null)[]>;
  mcqSelections: string[];
  setMcqSelections: SetState<string[]>;
  onComplete: () => void;
  showCompleteButton: boolean;
};

const ExercisesSection = ({
  exercises,
  exerciseIndex,
  setExerciseIndex,
  exerciseStatuses,
  setExerciseStatuses,
  fibAnswers,
  setFibAnswers,
  fibFeedbacks,
  setFibFeedbacks,
  mcqSelections,
  setMcqSelections,
  onComplete,
  showCompleteButton,
}: ExercisesSectionProps) => {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const advanceTimeoutRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number>(0);

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    if (!carouselRef.current) {
      return;
    }
    const width = carouselRef.current.clientWidth;
    carouselRef.current.scrollTo({ left: width * index, behavior });
  };

  const handleCarouselScroll = () => {
    if (!carouselRef.current) {
      return;
    }
    const width = carouselRef.current.clientWidth;
    if (!width) {
      return;
    }
    const nextIndex = Math.round(carouselRef.current.scrollLeft / width);
    pendingIndexRef.current = nextIndex;
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
        setExerciseIndex(nextIndex);
        scrollToIndex(nextIndex);
      }, delayMs);
    } else {
      setExerciseIndex(nextIndex);
      scrollToIndex(nextIndex);
    }
  };

  const handleAnswer = (index: number, answer: string, option: string) => {
    const isCorrect = option === answer;
    const nextStatuses = [...exerciseStatuses];
    nextStatuses[index] = isCorrect ? "correct" : "incorrect";
    setExerciseStatuses(nextStatuses);
    const nextSelections = [...mcqSelections];
    nextSelections[index] = option;
    setMcqSelections(nextSelections);
    advanceToNext(index, isCorrect ? 1000 : 0);
  };

  const handleFibSubmit = (index: number, answer: string) => {
    const submitted = (fibAnswers[index] ?? "").trim();
    const correct = String(answer ?? "").trim();
    const isCorrect = submitted === correct;
    const nextStatuses = [...exerciseStatuses];
    nextStatuses[index] = isCorrect ? "correct" : "incorrect";
    setExerciseStatuses(nextStatuses);
    const nextFeedbacks = [...fibFeedbacks];
    nextFeedbacks[index] = { correct: isCorrect, correctAnswer: correct };
    setFibFeedbacks(nextFeedbacks);
    advanceToNext(index, isCorrect ? 1000 : 0);
  };

  const goToIndex = (nextIndex: number) => {
    if (nextIndex >= 0 && nextIndex < exercises.length) {
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
            <Box
              className="exercise-carousel"
              ref={carouselRef}
              onScroll={handleCarouselScroll}
            >
              {exercises.map((exercise, idx) => {
                const fibValue = fibAnswers[idx] ?? "";
                const feedback = fibFeedbacks[idx] ?? null;
                const status = exerciseStatuses[idx];
                return (
                  <ExerciseSlide
                    key={idx}
                    exercise={exercise}
                    status={status}
                    fibValue={fibValue}
                    fibFeedback={feedback}
                    mcqSelection={mcqSelections[idx]}
                    onFibChange={(value) =>
                      setFibAnswers((prev) => {
                        const next = [...prev];
                        next[idx] = value;
                        return next;
                      })
                    }
                    onFibSubmit={() => handleFibSubmit(idx, exercise.answer)}
                    onOptionSelect={(option) =>
                      handleAnswer(idx, exercise.answer, option)
                    }
                  />
                );
              })}
            </Box>
            <IconButton
              className="exercise-carousel-nav"
              onClick={() =>
                goToIndex(Math.min(exerciseIndex + 1, exercises.length - 1))
              }
              disabled={exerciseIndex >= exercises.length - 1}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
          </Box>
          <ExerciseDots
            count={exercises.length}
            currentIndex={exerciseIndex}
            statuses={exerciseStatuses}
            onSelect={(idx) => {
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
