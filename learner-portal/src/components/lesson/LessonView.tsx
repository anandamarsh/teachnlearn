import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
} from "@mui/material";
import { CatalogLesson, LessonSectionKey } from "../../state/types";
import { useLessonProgress } from "../../hooks/useLessonProgress";
import { useLessonSections } from "../../hooks/useLessonSections";
import ExercisesSection from "../exercises/ExercisesSection";
import { getSectionLabel, isExercisesSection } from "../../utils/lessonSections";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import CenteredLoader from "../common/CenteredLoader";

type LessonViewProps = {
  lesson: CatalogLesson;
  fetchWithAuth: (path: string) => Promise<{
    contentHtml?: string;
    content?: unknown;
  }>;
};

const LessonView = ({ lesson, fetchWithAuth }: LessonViewProps) => {
  const progressKey = `learner-lesson-progress-${lesson.teacher}-${lesson.id}`;
  const lastSectionKey = `learner-lesson-last-section-${lesson.teacher}-${lesson.id}`;
  const appliedLastSectionRef = useRef(false);
  const [restartPromptOpen, setRestartPromptOpen] = useState(false);
  const [pendingRestartSection, setPendingRestartSection] =
    useState<LessonSectionKey | null>(null);

  const {
    sectionHtml,
    exercisesBySection,
    sectionKeys,
    loading,
    indexLoading,
    loadSection,
  } = useLessonSections({ lesson, fetchWithAuth });

  const exerciseCountsBySection = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(exercisesBySection).map(([key, items]) => [key, items.length])
      ),
    [exercisesBySection]
  );

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
    resetExerciseSection,
  } = useLessonProgress(progressKey, sectionKeys, exerciseCountsBySection);

  const activeExerciseSectionKey = isExercisesSection(openSection)
    ? openSection
    : null;
  const activeExercises = activeExerciseSectionKey
    ? exercisesBySection[activeExerciseSectionKey] || []
    : [];

  useEffect(() => {
    if (!openSection) {
      return;
    }
    if (sectionKeys.length && !sectionKeys.includes(openSection)) {
      return;
    }
    loadSection(openSection);
  }, [loadSection, openSection, sectionKeys]);

  useEffect(() => {
    if (!sectionKeys.length || appliedLastSectionRef.current) {
      return;
    }
    const saved = window.sessionStorage.getItem(lastSectionKey);
    if (saved && sectionKeys.includes(saved)) {
      setOpenSection(saved);
    }
    appliedLastSectionRef.current = true;
  }, [lastSectionKey, sectionKeys, setOpenSection]);

  const handleAdvanceSection = (current: LessonSectionKey) => {
    setCompletedSections((prev) => ({ ...prev, [current]: true }));
    const currentIndex = sectionKeys.indexOf(current);
    const nextKey = sectionKeys[currentIndex + 1];
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
    if (!activeExerciseSectionKey) {
      return;
    }
    if (scoreSnapshot.skillScore !== 100) {
      return;
    }
    setCompletedSections((prev) => {
      if (prev[activeExerciseSectionKey]) {
        return prev;
      }
      return { ...prev, [activeExerciseSectionKey]: true };
    });
  }, [activeExerciseSectionKey, scoreSnapshot.skillScore, setCompletedSections]);

  const activeHtml = sectionHtml[openSection] || "";
  const activeHtmlLoading = Boolean(loading[openSection]);

  return (
    <Stack spacing={0}>
      <Stack spacing={3}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <IconButton
            aria-label="Refresh page"
            onClick={() => {
              window.sessionStorage.setItem(lastSectionKey, openSection);
              window.location.reload();
            }}
          >
            <RefreshRoundedIcon />
          </IconButton>
          <Box flex={1} display="flex" justifyContent="center">
            <Tabs
              value={openSection}
              onChange={(_, value) => setOpenSection(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                "& .MuiTab-root": {
                  mx: 3.5,
                },
              }}
            >
              {sectionKeys.map((sectionKey) => (
                <Tab
                  key={sectionKey}
                  value={sectionKey}
                  label={getSectionLabel(sectionKey)}
                />
              ))}
            </Tabs>
          </Box>
          {isExercisesSection(openSection) ? (
            <IconButton
              aria-label="Restart exercises"
              onClick={() => {
                setPendingRestartSection(openSection);
                setRestartPromptOpen(true);
              }}
            >
              <RestartAltRoundedIcon />
            </IconButton>
          ) : (
            <Box width={40} />
          )}
        </Box>
        <Box className="lesson-content" sx={{ margin: "1rem auto !important" }}>
          {indexLoading && !sectionKeys.length ? (
            null
          ) : null}
          {!isExercisesSection(openSection) ? (
            <Box>
              {activeHtmlLoading ? (
                <CenteredLoader />
              ) : (
                <Box dangerouslySetInnerHTML={{ __html: activeHtml }} sx={{ mb: 3 }} />
              )}
            </Box>
          ) : (
            <Box>
              {activeExerciseSectionKey && loading[activeExerciseSectionKey] ? (
                <CenteredLoader />
              ) : (
                <ExercisesSection
                  exercises={activeExercises}
                  exerciseSectionKey={openSection}
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
                />
              )}
            </Box>
          )}
        </Box>
      </Stack>
      <Dialog
        open={restartPromptOpen}
        onClose={() => setRestartPromptOpen(false)}
      >
        <DialogTitle>Restart exercises?</DialogTitle>
        <DialogContent>
          This will clear your answers for this exercise section.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestartPromptOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (pendingRestartSection) {
                resetExerciseSection(pendingRestartSection);
              }
              setRestartPromptOpen(false);
              setPendingRestartSection(null);
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
