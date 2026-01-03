import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { ExerciseStatus } from "../../state/types";

type ExerciseDotsProps = {
  count: number;
  currentIndex: number;
  statuses: ExerciseStatus[];
  onSelect: (index: number) => void;
};

const ExerciseDots = ({
  count,
  currentIndex,
  statuses,
  onSelect,
}: ExerciseDotsProps) => {
  const dotsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dotsRef.current) {
      return;
    }
    const container = dotsRef.current;
    const dot = container.querySelector<HTMLButtonElement>(
      `[data-dot-index=\"${currentIndex}\"]`
    );
    if (!dot) {
      return;
    }
    const leftEdge = container.scrollLeft;
    const rightEdge = leftEdge + container.clientWidth;
    const dotLeft = dot.offsetLeft;
    const dotRight = dotLeft + dot.clientWidth;
    if (dotLeft < leftEdge) {
      container.scrollTo({
        left: Math.max(dotLeft - 4, 0),
        behavior: "smooth",
      });
    } else if (dotRight > rightEdge) {
      container.scrollTo({
        left: dotRight - container.clientWidth + 4,
        behavior: "smooth",
      });
    }
  }, [currentIndex]);

  if (!count) {
    return null;
  }

  return (
    <Box className="exercise-dot-dock">
      <Box className="exercise-dot-strip centered" ref={dotsRef}>
        {Array.from({ length: count }).map((_, idx) => {
          const status = statuses[idx] ?? "unattempted";
          const isCurrent = idx === currentIndex;
          const dotState = isCurrent ? "current" : status;
          return (
            <button
              key={`${idx}-${dotState}`}
              type="button"
              data-dot-index={idx}
              className={`exercise-dot ${dotState}`}
              aria-label={`Question ${idx + 1}`}
              title={`Question ${idx + 1}`}
              onClick={() => onSelect(idx)}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default ExerciseDots;
