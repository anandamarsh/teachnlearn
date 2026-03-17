import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import {
  ExerciseResponseRecord,
  ExerciseResponseSaveState,
  ExerciseStatus,
} from "../../state/types";

type ExerciseDotsProps = {
  count: number;
  currentIndex: number;
  statuses: ExerciseStatus[];
  responseSaveStates?: ExerciseResponseSaveState[];
  responseRecords?: ExerciseResponseRecord[];
  maxUnlockedIndex: number;
  onSelect: (index: number) => void;
};

const ExerciseDots = ({
  count,
  currentIndex,
  statuses,
  responseSaveStates,
  responseRecords,
  maxUnlockedIndex,
  onSelect,
}: ExerciseDotsProps) => {
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const [centered, setCentered] = useState(true);

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

  useEffect(() => {
    const container = dotsRef.current;
    if (!container) {
      return;
    }
    const updateCentered = () => {
      const isScrollable = container.scrollWidth > container.clientWidth + 1;
      setCentered(!isScrollable);
    };
    const frame = window.requestAnimationFrame(updateCentered);
    window.addEventListener("resize", updateCentered);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateCentered);
    };
  }, [count]);

  if (!count) {
    return null;
  }

  return (
    <Box className="exercise-dot-dock">
      <Box
        className={`exercise-dot-strip${centered ? " centered" : ""}`}
        ref={dotsRef}
      >
        {Array.from({ length: count }).map((_, idx) => {
          const status = statuses[idx] ?? "unattempted";
          const isDisplayed = idx === currentIndex;
          const responseState = responseSaveStates?.[idx];
          const responseRecord = responseRecords?.[idx];
          const reviewStatus = responseRecord?.reviewStatus || null;
          const hasAttemptedResponse = Boolean(
            responseRecord?.answerMarkdown?.trim() ||
              responseRecord?.attachments?.length,
          );
          const dotState = reviewStatus
            ? reviewStatus
            : responseState && hasAttemptedResponse
              ? "response-attempted"
              : status;
          const latestClass =
            !responseState && status === "unattempted" && isDisplayed ? "latest" : "";
          const isLocked = idx > maxUnlockedIndex;
          return (
            <button
              key={`${idx}-${dotState}`}
              type="button"
              data-dot-index={idx}
              className={`exercise-dot ${dotState} ${
                isDisplayed ? "displayed" : ""
              } ${
                isLocked ? "locked" : ""
              } ${latestClass}`}
              aria-label={`Question ${idx + 1}`}
              title={isLocked ? undefined : `Question ${idx + 1}`}
              onClick={() => onSelect(idx)}
              disabled={isLocked}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default ExerciseDots;
