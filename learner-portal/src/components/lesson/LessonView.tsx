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
  "references",
  "lesson",
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
    exerciseSections,
    activeExerciseSectionKey,
    setActiveExerciseSectionKey,
  } = useLessonProgress(
    progressKey,
    exercises.map((section) => ({
      key: section.key,
      count: section.exercises.length,
    }))
  );

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

  const showCompleteButton = useMemo(() => {
    if (!exercises.length) {
      return false;
    }
    return exercises.every((section) => {
      const progress = exerciseSections[section.key];
      if (!progress) {
        return false;
      }
      if (progress.exerciseGuides.length) {
        return progress.exerciseGuides.every((guide) => guide.completed);
      }
      return (
        progress.exerciseStatuses.length > 0 &&
        progress.exerciseStatuses.every((status) => status !== "unattempted")
      );
    });
  }, [exerciseSections, exercises]);

  const activeExerciseSection = useMemo(() => {
    if (!exercises.length) {
      return null;
    }
    if (activeExerciseSectionKey) {
      return (
        exercises.find((section) => section.key === activeExerciseSectionKey) ||
        exercises[0]
      );
    }
    return exercises[0];
  }, [activeExerciseSectionKey, exercises]);

  useEffect(() => {
    if (!activeExerciseSectionKey) {
      return;
    }
    if (scoreSnapshot.skillScore !== 100) {
      return;
    }
    const currentIndex = exercises.findIndex(
      (section) => section.key === activeExerciseSectionKey
    );
    if (currentIndex >= 0 && currentIndex < exercises.length - 1) {
      setActiveExerciseSectionKey(exercises[currentIndex + 1].key);
    } else {
      setCompletedSections((prev) => {
        if (prev.exercises) {
          return prev;
        }
        return { ...prev, exercises: true };
      });
    }
  }, [
    activeExerciseSectionKey,
    exercises,
    scoreSnapshot.skillScore,
    setActiveExerciseSectionKey,
    setCompletedSections,
  ]);

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
              ) : activeExerciseSection ? (
                <>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: "0.75rem",
                    }}
                  >
                    <Typography variant="h6">
                      Exercise Set{" "}
                      {exercises.findIndex(
                        (section) => section.key === activeExerciseSection.key
                      ) + 1}{" "}
                      of {exercises.length}
                    </Typography>
                    {exercises.length > 1 ? (
                      <Typography variant="body2" color="text.secondary">
                        {activeExerciseSection.key}
                      </Typography>
                    ) : null}
                  </Box>
                  <ExercisesSection
                    key={activeExerciseSection.key}
                    exercises={activeExerciseSection.exercises}
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
                    exerciseSectionKey={activeExerciseSection.key}
                  />
                </>
              ) : null}
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
