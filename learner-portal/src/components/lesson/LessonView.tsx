import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { CatalogLesson, LessonSectionKey } from "../../state/types";
import { useLessonProgress } from "../../hooks/useLessonProgress";
import { useLessonSections } from "../../hooks/useLessonSections";
import LessonStepper from "./LessonStepper";
import ExercisesSection from "../exercises/ExercisesSection";

type LessonViewProps = {
  lesson: CatalogLesson;
  fetchWithAuth: (path: string) => Promise<{
    contentHtml?: string;
    content?: unknown;
  }>;
};

const sectionOrder: LessonSectionKey[] = [
  "lesson",
  "references",
  "exercises",
];

const LessonView = ({ lesson, fetchWithAuth }: LessonViewProps) => {
  const [resetOpen, setResetOpen] = useState(false);
  const progressKey = `learner-lesson-progress-${lesson.teacher}-${lesson.id}`;
  const prevLessonIdRef = useRef<string | null>(null);

  const {
    lessonHtml,
    referencesHtml,
    exercises,
    loading,
    loadSection,
    reset: resetSections,
  } = useLessonSections({ lesson, fetchWithAuth });

  const {
    openSection,
    completedSections,
    setOpenSection,
    setCompletedSections,
    exerciseIndex,
    setExerciseIndex,
    maxExerciseIndex,
    setMaxExerciseIndex,
    exerciseStatuses,
    setExerciseStatuses,
    exerciseGuides,
    setExerciseGuides,
    fibAnswers,
    setFibAnswers,
    mcqSelections,
    setMcqSelections,
    scoreSnapshot,
    setScoreSnapshot,
    reset: resetProgress,
  } = useLessonProgress(progressKey, exercises.length);

  useEffect(() => {
    if (prevLessonIdRef.current && prevLessonIdRef.current !== lesson.id) {
      resetSections();
      resetProgress();
    }
    prevLessonIdRef.current = lesson.id;
  }, [lesson.id, resetProgress, resetSections]);

  useEffect(() => {
    loadSection(openSection);
  }, [loadSection, openSection]);

  const canNavigateTo = (target: LessonSectionKey) => {
    if (target === openSection) {
      return true;
    }
    if (completedSections[target]) {
      return true;
    }
    const currentIndex = sectionOrder.indexOf(openSection);
    const targetIndex = sectionOrder.indexOf(target);
    return targetIndex < currentIndex;
  };

  const handleAdvanceSection = (current: LessonSectionKey) => {
    setCompletedSections((prev) => ({ ...prev, [current]: true }));
    const currentIndex = sectionOrder.indexOf(current);
    const nextKey = sectionOrder[currentIndex + 1];
    if (nextKey) {
      setOpenSection(nextKey);
    }
  };

  const showCompleteButton = useMemo(
    () => {
      if (exerciseGuides.length) {
        return exerciseGuides.every((guide) => guide.completed);
      }
      return (
        exerciseStatuses.length > 0 &&
        exerciseStatuses.every((status) => status !== "unattempted")
      );
    },
    [exerciseGuides, exerciseStatuses]
  );

  useEffect(() => {
    if (scoreSnapshot.skillScore !== 100) {
      return;
    }
    setCompletedSections((prev) => {
      if (prev.exercises) {
        return prev;
      }
      return { ...prev, exercises: true };
    });
  }, [scoreSnapshot.skillScore, setCompletedSections]);

  return (
    <Stack spacing={0}>
      <Stack spacing={3}>
        <LessonStepper
          openSection={openSection}
          completedSections={completedSections}
          onOpenSection={setOpenSection}
          canNavigateTo={canNavigateTo}
          onReset={() => setResetOpen(true)}
        />
        <Box className="lesson-content" sx={{ margin: "1rem auto !important" }}>
          {openSection === "lesson" ? (
            <Box>
              {loading.lesson ? (
                <Box display="flex" justifyContent="center" py={3}>
                  <Box width="12rem">
                    <LinearProgress />
                  </Box>
                </Box>
              ) : (
                <Box dangerouslySetInnerHTML={{ __html: lessonHtml }} sx={{ mb: 3 }} />
              )}
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => handleAdvanceSection("lesson")}
                >
                  Next
                </Button>
              </Box>
            </Box>
          ) : null}

          {openSection === "references" ? (
            <Box>
              {loading.references ? (
                <Box display="flex" justifyContent="center" py={3}>
                  <Box width="12rem">
                    <LinearProgress />
                  </Box>
                </Box>
              ) : (
                <Box
                  dangerouslySetInnerHTML={{ __html: referencesHtml }}
                  sx={{ mb: 3 }}
                />
              )}
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => handleAdvanceSection("references")}
                >
                  Next
                </Button>
              </Box>
            </Box>
          ) : null}

          {openSection === "exercises" ? (
            <Box>
              {loading.exercises ? (
                <Box display="flex" justifyContent="center" py={3}>
                  <Box width="12rem">
                    <LinearProgress />
                  </Box>
                </Box>
              ) : (
                <ExercisesSection
                  exercises={exercises}
                  lessonId={lesson.id}
                  lessonTitle={lesson.title}
                  lessonSubject={lesson.subject}
                  lessonLevel={lesson.level}
                  exerciseIndex={exerciseIndex}
                  setExerciseIndex={setExerciseIndex}
                  maxExerciseIndex={maxExerciseIndex}
                  setMaxExerciseIndex={setMaxExerciseIndex}
                  exerciseStatuses={exerciseStatuses}
                  setExerciseStatuses={setExerciseStatuses}
                  exerciseGuides={exerciseGuides}
                  setExerciseGuides={setExerciseGuides}
                  fibAnswers={fibAnswers}
                  setFibAnswers={setFibAnswers}
                  mcqSelections={mcqSelections}
                  setMcqSelections={setMcqSelections}
                  scoreSnapshot={scoreSnapshot}
                  setScoreSnapshot={setScoreSnapshot}
                  onComplete={() => handleAdvanceSection("exercises")}
                  showCompleteButton={showCompleteButton}
                />
              )}
            </Box>
          ) : null}
        </Box>
      </Stack>
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Restart lesson?</DialogTitle>
        <DialogContent>
          <Typography>Do you want to start the lesson all over?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              resetSections();
              resetProgress();
              setResetOpen(false);
            }}
          >
            Restart
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default LessonView;
