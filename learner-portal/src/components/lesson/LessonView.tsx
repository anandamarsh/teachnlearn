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
import { CatalogLesson } from "../../state/types";
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

const LessonView = ({ lesson, fetchWithAuth }: LessonViewProps) => {
  const [resetOpen, setResetOpen] = useState(false);
  const progressKey = `learner-lesson-progress-${lesson.teacher}-${lesson.id}`;
  const prevLessonIdRef = useRef<string | null>(null);

  const {
    contentHtml,
    exercises,
    loading,
    loadSection,
    reset: resetSections,
    sectionKeys,
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
    sectionKeys,
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
    if (openSection) {
      loadSection(openSection);
    }
  }, [loadSection, openSection]);

  useEffect(() => {
    if (!openSection.startsWith("exercises")) {
      return;
    }
    if (openSection !== activeExerciseSectionKey) {
      setActiveExerciseSectionKey(openSection);
    }
  }, [activeExerciseSectionKey, openSection, setActiveExerciseSectionKey]);

  const canNavigateTo = (target: string) => {
    if (target === openSection) {
      return true;
    }
    if (completedSections[target]) {
      return true;
    }
    const currentIndex = sectionKeys.indexOf(openSection);
    const targetIndex = sectionKeys.indexOf(target);
    if (currentIndex < 0 || targetIndex < 0) {
      return false;
    }
    return targetIndex < currentIndex;
  };

  const handleAdvanceSection = (current: string) => {
    setCompletedSections((prev) => ({ ...prev, [current]: true }));
    const currentIndex = sectionKeys.indexOf(current);
    const nextKey = sectionKeys[currentIndex + 1];
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
    const preferredKey = openSection.startsWith("exercises")
      ? openSection
      : activeExerciseSectionKey;
    if (preferredKey) {
      return exercises.find((section) => section.key === preferredKey) || null;
    }
    return exercises[0];
  }, [activeExerciseSectionKey, exercises, openSection]);

  useEffect(() => {
    if (!activeExerciseSectionKey) {
      return;
    }
    if (scoreSnapshot.skillScore !== 100) {
      return;
    }
    setCompletedSections((prev) => ({
      ...prev,
      [activeExerciseSectionKey]: true,
    }));
    const currentIndex = sectionKeys.indexOf(activeExerciseSectionKey);
    const nextKey = sectionKeys[currentIndex + 1];
    if (nextKey) {
      setOpenSection(nextKey);
    }
  }, [
    activeExerciseSectionKey,
    exercises,
    scoreSnapshot.skillScore,
    setActiveExerciseSectionKey,
    setCompletedSections,
    sectionKeys,
    setOpenSection,
  ]);

  return (
    <Stack spacing={0}>
      <Stack spacing={3}>
        <LessonStepper
          openSection={openSection}
          completedSections={completedSections}
          onOpenSection={setOpenSection}
          canNavigateTo={canNavigateTo}
          sectionKeys={sectionKeys}
          onReset={() => setResetOpen(true)}
        />
        <Box className="lesson-content" sx={{ margin: "1rem auto !important" }}>
          {openSection && openSection.startsWith("lesson") ? (
            <Box>
              {loading[openSection] ? (
                <Box display="flex" justifyContent="center" py={3}>
                  <Box width="12rem">
                    <LinearProgress />
                  </Box>
                </Box>
              ) : (
                <Box
                  dangerouslySetInnerHTML={{ __html: contentHtml[openSection] || "" }}
                  sx={{ mb: 3 }}
                />
              )}
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => handleAdvanceSection(openSection)}
                >
                  Next
                </Button>
              </Box>
            </Box>
          ) : null}

          {openSection && openSection.startsWith("references") ? (
            <Box>
              {loading[openSection] ? (
                <Box display="flex" justifyContent="center" py={3}>
                  <Box width="12rem">
                    <LinearProgress />
                  </Box>
                </Box>
              ) : (
                <Box
                  dangerouslySetInnerHTML={{ __html: contentHtml[openSection] || "" }}
                  sx={{ mb: 3 }}
                />
              )}
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => handleAdvanceSection(openSection)}
                >
                  Next
                </Button>
              </Box>
            </Box>
          ) : null}

          {openSection && openSection.startsWith("exercises") ? (
            <Box>
              {loading[openSection] ? (
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
                    onComplete={() => handleAdvanceSection(openSection)}
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
