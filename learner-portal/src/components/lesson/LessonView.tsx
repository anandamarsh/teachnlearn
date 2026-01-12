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
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CenteredLoader from "../common/CenteredLoader";
import { AuthedFetch } from "../../api/client";

type LessonViewProps = {
  lesson: CatalogLesson;
  fetchWithAuth: AuthedFetch;
};

const LessonView = ({ lesson, fetchWithAuth }: LessonViewProps) => {
  const progressKey = `learner-lesson-progress-${lesson.teacher}-${lesson.id}`;
  const lastSectionKey = `learner-lesson-last-section-${lesson.teacher}-${lesson.id}`;
  const appliedLastSectionRef = useRef(false);
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const initialTabScrollRef = useRef(false);
  const userTabSelectRef = useRef(false);
  const [restartPromptOpen, setRestartPromptOpen] = useState(false);
  const [pendingRestartSection, setPendingRestartSection] =
    useState<LessonSectionKey | null>(null);
  const [showCompleteNotice, setShowCompleteNotice] = useState(false);
  const completeNoticeTimeoutRef = useRef<number | null>(null);
  const [regenerateSignal, setRegenerateSignal] = useState(0);
  const [regenerateSectionKey, setRegenerateSectionKey] =
    useState<LessonSectionKey | null>(null);

  const {
    sectionHtml,
    exercisesBySection,
    sectionKeys,
    loading,
    indexLoading,
    loadSection,
    setExercisesForSection,
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
    hydratedExerciseSectionKey,
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

  useEffect(() => {
    if (!tabsContainerRef.current) {
      return;
    }
    if (initialTabScrollRef.current) {
      return;
    }
    const container = tabsContainerRef.current;
    const forceLeft = () => {
      container.scrollLeft = 0;
    };
    const timeoutA = window.setTimeout(forceLeft, 0);
    const timeoutB = window.setTimeout(forceLeft, 50);
    const timeoutC = window.setTimeout(forceLeft, 200);
    const rafA = window.requestAnimationFrame(forceLeft);
    const rafB = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(forceLeft);
    });
    initialTabScrollRef.current = true;
    return () => {
      window.clearTimeout(timeoutA);
      window.clearTimeout(timeoutB);
      window.clearTimeout(timeoutC);
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
    };
  }, [sectionKeys]);

  useEffect(() => {
    if (!tabsContainerRef.current) {
      return;
    }
    if (!userTabSelectRef.current) {
      return;
    }
    const container = tabsContainerRef.current;
    const selected = container.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]'
    );
    if (!selected) {
      return;
    }
    const target =
      selected.offsetLeft + selected.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    userTabSelectRef.current = false;
  }, [openSection]);

  useEffect(() => {
    if (completeNoticeTimeoutRef.current !== null) {
      window.clearTimeout(completeNoticeTimeoutRef.current);
      completeNoticeTimeoutRef.current = null;
    }
    if (!isExercisesSection(openSection)) {
      setShowCompleteNotice(false);
      return;
    }
    if (!completedSections[openSection]) {
      setShowCompleteNotice(false);
      return;
    }
    setShowCompleteNotice(true);
    completeNoticeTimeoutRef.current = window.setTimeout(() => {
      setShowCompleteNotice(false);
      completeNoticeTimeoutRef.current = null;
    }, 3000);
    return () => {
      if (completeNoticeTimeoutRef.current !== null) {
        window.clearTimeout(completeNoticeTimeoutRef.current);
        completeNoticeTimeoutRef.current = null;
      }
    };
  }, [completedSections, openSection]);

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
    if (!hydratedExerciseSectionKey) {
      return;
    }
    if (hydratedExerciseSectionKey !== openSection) {
      return;
    }
    if (scoreSnapshot.skillScore !== 100) {
      return;
    }
    setCompletedSections((prev) => {
      if (prev[hydratedExerciseSectionKey]) {
        return prev;
      }
      return { ...prev, [hydratedExerciseSectionKey]: true };
    });
  }, [hydratedExerciseSectionKey, scoreSnapshot.skillScore, setCompletedSections]);

  const activeHtml = sectionHtml[openSection] || "";
  const activeHtmlLoading = Boolean(loading[openSection]);

  return (
    <Stack spacing={0}>
      <Stack spacing={3}>
        <Box
          className="lesson-tabs-bar"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          <IconButton
            aria-label="Refresh page"
            onClick={() => {
              window.sessionStorage.setItem(lastSectionKey, openSection);
              window.location.reload();
            }}
          >
            <RefreshRoundedIcon />
          </IconButton>
          <Box
            flex={1}
            display="flex"
            justifyContent="flex-start"
            sx={{ overflowX: "auto", maxWidth: "100%", width: "100%" }}
            ref={tabsContainerRef}
          >
            <Tabs
              value={openSection}
              onChange={(_, value) => {
                userTabSelectRef.current = true;
                setOpenSection(value);
              }}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minWidth: "max-content",
                "& .MuiTab-root": {
                  mx: 3.5,
                },
                "& .MuiTabs-scroller": {
                  overflowX: "visible !important",
                },
              }}
            >
              {sectionKeys.map((sectionKey) => (
                <Tab
                  key={sectionKey}
                  value={sectionKey}
                  label={
                    <Box display="flex" alignItems="center">
                      {completedSections[sectionKey] ? (
                        <CheckCircleRoundedIcon
                          sx={{ color: "success.main", mr: "1rem" }}
                          fontSize="small"
                        />
                      ) : null}
                      {getSectionLabel(sectionKey)}
                    </Box>
                  }
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
                  lessonTeacher={lesson.teacher}
                  generatorAvailable={Boolean(lesson.exerciseGenerator?.version)}
                  generatorVersion={lesson.exerciseGenerator?.version}
                  questionsPerExercise={lesson.exerciseConfig?.questionsPerExercise}
                  autoStart={isExercisesSection(openSection)}
                  regenerateSignal={regenerateSignal}
                  regenerateSectionKey={regenerateSectionKey}
                  fetchWithAuth={fetchWithAuth}
                  setExercisesForSection={setExercisesForSection}
                  resetExerciseSection={resetExerciseSection}
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
                if (
                  isExercisesSection(pendingRestartSection) &&
                  lesson.exerciseGenerator?.version
                ) {
                  setExercisesForSection(pendingRestartSection, []);
                  setRegenerateSectionKey(pendingRestartSection);
                  setRegenerateSignal((prev) => prev + 1);
                }
              }
              setRestartPromptOpen(false);
              setPendingRestartSection(null);
            }}
          >
            Restart
          </Button>
        </DialogActions>
      </Dialog>
      {showCompleteNotice ? (
        <Box className="lesson-complete-notice">
          You have already finished this exercise, so try another one.
        </Box>
      ) : null}
    </Stack>
  );
};

export default LessonView;
