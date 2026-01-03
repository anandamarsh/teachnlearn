import { Box, Button, IconButton, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { ExerciseItem, ExerciseStatus } from "../../state/types";

type FibFeedback = { correct: boolean; correctAnswer: string } | null;

type ExerciseSlideProps = {
  exercise: ExerciseItem;
  status: ExerciseStatus;
  fibValue: string;
  fibFeedback: FibFeedback;
  mcqSelection: string;
  onFibChange: (value: string) => void;
  onFibSubmit: () => void;
  onOptionSelect: (option: string) => void;
};

const ExerciseSlide = ({
  exercise,
  status,
  fibValue,
  fibFeedback,
  mcqSelection,
  onFibChange,
  onFibSubmit,
  onOptionSelect,
}: ExerciseSlideProps) => {
  const isAnswered = status === "correct" || status === "incorrect";
  const fibDisabled = !fibValue.trim() || Boolean(fibFeedback);

  return (
    <Box className="exercise-slide">
      <Box className="exercise-slide-content">
        <Box
          className="exercise-question"
          dangerouslySetInnerHTML={{ __html: exercise.question_html || "" }}
        />
        {exercise.type === "fib" ? (
          <Box className="exercise-options">
            <Box className="fib-row">
              <input
                className="fib-input"
                type="text"
                value={fibValue}
                onChange={(event) =>
                  fibFeedback ? undefined : onFibChange(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }
                if (!fibDisabled) {
                  onFibSubmit();
                }
              }}
                placeholder="Type your answer"
                readOnly={Boolean(fibFeedback)}
              />
              <IconButton
                className="fib-check"
                color="primary"
                onClick={onFibSubmit}
                disabled={fibDisabled}
                aria-label="Check answer"
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  padding: 0,
                  transformOrigin: "center",
                  bgcolor: fibFeedback?.correct ? "success.main" : "primary.main",
                  color: "#fff",
                  "&:hover": {
                    bgcolor: fibFeedback?.correct
                      ? "success.dark"
                      : "primary.dark",
                  },
                  "&.Mui-disabled": {
                    bgcolor: fibFeedback?.correct
                      ? "success.main"
                      : "rgba(0, 0, 0, 0.2)",
                    color: "#fff",
                  },
                }}
              >
                <CheckRoundedIcon />
              </IconButton>
            </Box>
            {fibFeedback && !fibFeedback.correct ? (
              <Typography color="error.main">
                Incorrect. Correct answer: {fibFeedback.correctAnswer}
              </Typography>
            ) : null}
          </Box>
        ) : (
          <Box className="exercise-options-grid">
            {exercise.options?.map((option) => {
              const selected = mcqSelection;
              const isSelected = selected === option;
              const highlightColor = isSelected
                ? status === "correct"
                  ? "success.main"
                  : status === "incorrect"
                    ? "error.main"
                    : "primary.main"
                : undefined;
              const highlightBg = isSelected
                ? status === "correct"
                  ? "rgba(46,125,50,0.12)"
                  : status === "incorrect"
                    ? "rgba(198,40,40,0.12)"
                    : "rgba(230,81,0,0.08)"
                : undefined;
              return (
                <Button
                  key={option}
                  variant="outlined"
                  size="large"
                  onClick={() => (isAnswered ? undefined : onOptionSelect(option))}
                  sx={{
                    borderColor: highlightColor,
                    color: highlightColor,
                    backgroundColor: isSelected ? highlightBg : undefined,
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
        )}
      </Box>
    </Box>
  );
};

export default ExerciseSlide;
