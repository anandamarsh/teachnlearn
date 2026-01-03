import { MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Popper,
  Step,
  StepButton,
  Stepper,
  Stack,
  Typography,
} from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import "./App.css";
import BottomNav from "./components/BottomNav";

const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API || "";
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";

type CatalogLesson = {
  id: string;
  title: string;
  status: string;
  updated_at?: string;
  iconUrl?: string;
  teacher: string;
  content?: string | null;
};

type LessonSectionKey = "lesson" | "references" | "exercises";

type LessonProgress = {
  completed: Record<LessonSectionKey, boolean>;
  open: LessonSectionKey;
};

type ExerciseItem = {
  type: string;
  question_html: string;
  options: string[];
  answer: string;
};

type ExerciseStatus = "unattempted" | "correct" | "incorrect";

function App() {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    user,
  } = useAuth0();
  const configError = !apiBaseUrl || !auth0Audience;
  const [lessons, setLessons] = useState<CatalogLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<CatalogLesson | null>(
    null
  );
  const [page, setPage] = useState<"home" | "lesson">("home");
  const [lessonHtml, setLessonHtml] = useState("");
  const [referencesHtml, setReferencesHtml] = useState("");
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [exerciseStatuses, setExerciseStatuses] = useState<ExerciseStatus[]>([]);
  const [fibAnswers, setFibAnswers] = useState<string[]>([]);
  const [fibFeedbacks, setFibFeedbacks] = useState<
    ({ correct: boolean; correctAnswer: string } | null)[]
  >([]);
  const [mcqSelections, setMcqSelections] = useState<string[]>([]);
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const [hoverLesson, setHoverLesson] = useState<CatalogLesson | null>(null);
  const [openSection, setOpenSection] = useState<LessonSectionKey>("lesson");
  const [completedSections, setCompletedSections] = useState<
    Record<LessonSectionKey, boolean>
  >({
    lesson: false,
    references: false,
    exercises: false,
  });
  const [sectionLoading, setSectionLoading] = useState<
    Record<LessonSectionKey, boolean>
  >({
    lesson: false,
    references: false,
    exercises: false,
  });
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number>(0);
  const [dotsCentered, setDotsCentered] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  const fetchWithAuth = useCallback(
    async (path: string) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: auth0Audience },
      });
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload.detail || "Request failed";
        throw new Error(message);
      }
      return response.json();
    },
    [getAccessTokenSilently, apiBaseUrl]
  );

  const loadCatalog = useCallback(async () => {
    setLoadingLessons(true);
    setLessonError(null);
    try {
      const payload = await fetchWithAuth("/catalog/lessons");
      setLessons(payload.lessons || []);
    } catch (error) {
      setLessonError(
        error instanceof Error ? error.message : "Unable to load lessons"
      );
    } finally {
      setLoadingLessons(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCatalog();
    }
  }, [isAuthenticated, loadCatalog]);

  const loadLessonContent = useCallback(async (lesson: CatalogLesson) => {
    setSelectedLesson(lesson);
    setLessonHtml("");
    setReferencesHtml("");
    setExercises([]);
    setExerciseIndex(0);
    setExerciseStatuses([]);
    setFibAnswers([]);
    setFibFeedbacks([]);
    setMcqSelections([]);
    setSectionLoading({ lesson: false, references: false, exercises: false });
  }, []);

  const handleSelectLesson = async (lesson: CatalogLesson) => {
    setPage("lesson");
    await loadLessonContent(lesson);
  };

  const progressKey = selectedLesson
    ? `learner-lesson-progress-${selectedLesson.teacher}-${selectedLesson.id}`
    : null;

  useEffect(() => {
    if (!progressKey) {
      return;
    }
    const raw = window.localStorage.getItem(progressKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as LessonProgress & {
          exerciseIndex?: number;
          exerciseStatuses?: ExerciseStatus[];
          fibAnswers?: string[];
          fibFeedbacks?: ({ correct: boolean; correctAnswer: string } | null)[];
          mcqSelections?: string[];
        };
        if (parsed?.open) {
          setOpenSection(parsed.open);
        }
        if (parsed?.completed) {
          setCompletedSections({
            lesson: Boolean(parsed.completed.lesson),
            references: Boolean(parsed.completed.references),
            exercises: Boolean(parsed.completed.exercises),
          });
        }
        if (typeof parsed.exerciseIndex === "number") {
          setExerciseIndex(parsed.exerciseIndex);
        }
        if (Array.isArray(parsed.exerciseStatuses)) {
          setExerciseStatuses(parsed.exerciseStatuses);
        }
        if (Array.isArray(parsed.fibAnswers)) {
          setFibAnswers(parsed.fibAnswers);
        }
        if (Array.isArray(parsed.fibFeedbacks)) {
          setFibFeedbacks(parsed.fibFeedbacks);
        }
        if (Array.isArray(parsed.mcqSelections)) {
          setMcqSelections(parsed.mcqSelections);
        }
        return;
      } catch {
        // Ignore corrupted local storage.
      }
    }
    setOpenSection("lesson");
    setCompletedSections({
      lesson: false,
      references: false,
      exercises: false,
    });
  }, [progressKey]);

  useEffect(() => {
    if (!progressKey) {
      return;
    }
    const payload: LessonProgress = {
      open: openSection,
      completed: completedSections,
    };
    const extendedPayload = {
      ...payload,
      exerciseIndex,
      exerciseStatuses,
      fibAnswers,
      fibFeedbacks,
      mcqSelections,
    };
    window.localStorage.setItem(progressKey, JSON.stringify(extendedPayload));
  }, [
    completedSections,
    exerciseIndex,
    exerciseStatuses,
    fibAnswers,
    fibFeedbacks,
    mcqSelections,
    openSection,
    progressKey,
  ]);

  const formatTeacherEmail = (value: string | undefined) => {
    if (!value) {
      return "";
    }
    return value.replaceAll("_at_", "@").replaceAll("_dot_", ".");
  };

  const withCacheBuster = (url: string, token?: string | null) => {
    if (!token) {
      return url;
    }
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}v=${encodeURIComponent(token)}`;
  };

  const loadSection = useCallback(
    async (sectionKey: LessonSectionKey) => {
      if (!selectedLesson) {
        return;
      }
      if (sectionLoading[sectionKey]) {
        return;
      }
      if (sectionKey === "lesson" && lessonHtml) {
        return;
      }
      if (sectionKey === "references" && referencesHtml) {
        return;
      }
      if (sectionKey === "exercises" && exercises.length) {
        return;
      }
      setSectionLoading((prev) => ({ ...prev, [sectionKey]: true }));
      setLessonError(null);
      try {
        const payload = await fetchWithAuth(
          `/catalog/teacher/${selectedLesson.teacher}/lesson/${selectedLesson.id}/sections/${sectionKey}`
        );
        if (sectionKey === "lesson") {
          setLessonHtml(payload.contentHtml || "");
        } else if (sectionKey === "references") {
          setReferencesHtml(payload.contentHtml || "");
        } else {
          const rawExercises = payload.contentHtml || "[]";
          const parsed = JSON.parse(rawExercises);
          const items = Array.isArray(parsed) ? parsed : [];
          setExercises(items);
          setExerciseIndex((prev) => (prev < items.length ? prev : 0));
          const hasSaved = exerciseStatuses.length === items.length && items.length > 0;
          if (!hasSaved) {
            setExerciseStatuses(Array(items.length).fill("unattempted"));
            setFibAnswers(Array(items.length).fill(""));
            setFibFeedbacks(Array(items.length).fill(null));
            setMcqSelections(Array(items.length).fill(""));
          }
        }
      } catch (error) {
        setLessonError(
          error instanceof Error
            ? error.message
            : "Unable to load lesson content"
        );
      } finally {
        setSectionLoading((prev) => ({ ...prev, [sectionKey]: false }));
      }
    },
    [
      exercises.length,
      exerciseStatuses.length,
      fetchWithAuth,
      lessonHtml,
      referencesHtml,
      sectionLoading,
      selectedLesson,
    ]
  );

  useEffect(() => {
    if (page === "lesson") {
      loadSection(openSection);
    }
  }, [loadSection, openSection, page]);

  useEffect(() => {
    if (exercises.length && openSection === "exercises") {
      scrollToIndex(exerciseIndex);
    }
  }, [exercises.length, exerciseIndex, openSection]);

  const sectionOrder: LessonSectionKey[] = [
    "lesson",
    "references",
    "exercises",
  ];

  const handleAdvanceSection = (current: LessonSectionKey) => {
    setCompletedSections((prev) => ({ ...prev, [current]: true }));
    const currentIndex = sectionOrder.indexOf(current);
    const nextKey = sectionOrder[currentIndex + 1];
    if (nextKey) {
      setOpenSection(nextKey);
    }
  };

  const getStepLabel = (key: LessonSectionKey) => {
    if (key === "lesson") {
      return "Lesson";
    }
    if (key === "references") {
      return "References";
    }
    return "Exercises";
  };

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

  const scrollToIndex = (index: number) => {
    if (!carouselRef.current) {
      return;
    }
    const width = carouselRef.current.clientWidth;
    carouselRef.current.scrollTo({ left: width * index, behavior: "smooth" });
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

  const handleHoverLesson = (
    event: MouseEvent<HTMLElement>,
    lesson: CatalogLesson
  ) => {
    setHoverAnchor(event.currentTarget);
    setHoverLesson(lesson);
  };

  const clearHoverLesson = () => {
    setHoverAnchor(null);
    setHoverLesson(null);
  };

  useEffect(() => {
    clearHoverLesson();
  }, [page]);

  const totalExercises = exercises.length;
  const allExercisesAnswered =
    exerciseStatuses.length > 0 &&
    exerciseStatuses.every((status) => status !== "unattempted");

  useEffect(() => {
    if (!dotsRef.current) {
      return;
    }
    const container = dotsRef.current;
    const dot = container.querySelector<HTMLButtonElement>(
      `[data-dot-index="${exerciseIndex}"]`
    );
    if (!dot) {
      return;
    }
    const leftEdge = container.scrollLeft;
    const rightEdge = leftEdge + container.clientWidth;
    const dotLeft = dot.offsetLeft;
    const dotRight = dotLeft + dot.clientWidth;
    if (dotLeft < leftEdge) {
      container.scrollTo({ left: Math.max(dotLeft - 4, 0), behavior: "smooth" });
    } else if (dotRight > rightEdge) {
      container.scrollTo({
        left: dotRight - container.clientWidth + 4,
        behavior: "smooth",
      });
    }
  }, [exerciseIndex]);

  useEffect(() => {
    const updateDotsCentering = () => {
      if (!dotsRef.current) {
        return;
      }
      setDotsCentered(dotsRef.current.scrollWidth <= dotsRef.current.clientWidth);
    };
    updateDotsCentering();
    window.addEventListener("resize", updateDotsCentering);
    return () => window.removeEventListener("resize", updateDotsCentering);
  }, [exercises.length, openSection]);

  const handleAnswer = (index: number, answer: string, option: string) => {
    const isCorrect = option === answer;
    setExerciseStatuses((prev) => {
      const next = [...prev];
      next[index] = isCorrect ? "correct" : "incorrect";
      return next;
    });
    setMcqSelections((prev) => {
      const next = [...prev];
      next[index] = option;
      return next;
    });
    const nextIndex = index + 1;
    if (nextIndex < exercises.length) {
      setExerciseIndex(nextIndex);
      scrollToIndex(nextIndex);
    }
  };

  const handleFibSubmit = (index: number, answer: string) => {
    const submitted = (fibAnswers[index] ?? "").trim();
    const correct = String(answer ?? "").trim();
    const isCorrect = submitted === correct;
    setExerciseStatuses((prev) => {
      const next = [...prev];
      next[index] = isCorrect ? "correct" : "incorrect";
      return next;
    });
    setFibFeedbacks((prev) => {
      const next = [...prev];
      next[index] = { correct: isCorrect, correctAnswer: correct };
      return next;
    });
  };

  const goToIndex = (nextIndex: number) => {
    if (nextIndex >= 0 && nextIndex < exercises.length) {
      setExerciseIndex(nextIndex);
      scrollToIndex(nextIndex);
    }
  };

  if (configError) {
    return (
      <Box
        display="flex"
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
      >
        <Typography color="error">
          Missing VITE_TEACHNLEARN_API or VITE_AUTH0_AUDIENCE.
        </Typography>
      </Box>
    );
  }

  if (isLoading || !isAuthenticated) {
    return (
      <Box
        display="flex"
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
      >
        <Box width="12rem">
          <LinearProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box className="app-shell" bgcolor="background.default" minHeight="100vh">
      <Container
        maxWidth={false}
        disableGutters
        className={`app-content${page === "lesson" ? " lesson-page" : ""}`}
        sx={{ px: 0 }}
      >
        {lessonError ? (
          <Paper className="card" elevation={0}>
            <Typography color="error">{lessonError}</Typography>
          </Paper>
        ) : null}

        {loadingLessons ? (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            py={6}
          >
            <Box width="12rem">
              <LinearProgress />
            </Box>
          </Box>
        ) : null}

        {page === "home" ? (
          <Stack spacing={3} className="home-screen">
            <Box className="home-grid">
              {lessons.map((lesson) => (
                <Box
                  key={`${lesson.teacher}-${lesson.id}`}
                  className="home-item"
                >
                  <Button
                    className="home-tile"
                    onClick={() => handleSelectLesson(lesson)}
                    onMouseEnter={(event) => handleHoverLesson(event, lesson)}
                    onMouseLeave={clearHoverLesson}
                    sx={{ minWidth: 0, minHeight: 0, padding: 0 }}
                  >
                    {lesson.iconUrl ? (
                      <img
                        src={withCacheBuster(lesson.iconUrl, lesson.updated_at)}
                        alt=""
                        className="home-icon"
                        loading="lazy"
                      />
                    ) : (
                      <DescriptionRoundedIcon
                        className="home-icon"
                        color="primary"
                      />
                    )}
                  </Button>
                  <Typography className="home-title">{lesson.title}</Typography>
                </Box>
              ))}
            </Box>
            <Popper
              open={Boolean(
                page === "home" &&
                  hoverAnchor &&
                  hoverLesson &&
                  document.body.contains(hoverAnchor)
              )}
              anchorEl={hoverAnchor}
              placement="bottom"
              modifiers={[
                { name: "offset", options: { offset: [0, 8] } },
                { name: "preventOverflow", options: { padding: 12 } },
                { name: "flip", options: { padding: 12 } },
              ]}
              onMouseEnter={() => {
                if (hoverLesson && hoverAnchor) {
                  setHoverLesson(hoverLesson);
                  setHoverAnchor(hoverAnchor);
                }
              }}
              onMouseLeave={clearHoverLesson}
            >
              <Paper
                elevation={8}
                sx={{ p: 2, maxWidth: 320, borderRadius: 2 }}
                onMouseEnter={() => {
                  if (hoverLesson && hoverAnchor) {
                    setHoverLesson(hoverLesson);
                    setHoverAnchor(hoverAnchor);
                  }
                }}
                onMouseLeave={clearHoverLesson}
              >
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {hoverLesson?.title || ""}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    by{" "}
                    <span className="popup-teacher">
                      {formatTeacherEmail(hoverLesson?.teacher || "")}
                    </span>
                  </Typography>
                  <Typography variant="body2">
                    {hoverLesson?.content || "No description provided."}
                  </Typography>
                </Stack>
              </Paper>
            </Popper>
          </Stack>
        ) : null}

        {page === "lesson" ? (
          <Stack spacing={0}>
            {selectedLesson ? (
              <Stack spacing={3}>
                <Box className="lesson-stepper">
                  <Box className="lesson-stepper-inner">
                    <Stepper
                      nonLinear
                      activeStep={sectionOrder.indexOf(openSection)}
                    >
                      {sectionOrder.map((sectionKey) => (
                        <Step
                          key={sectionKey}
                          completed={completedSections[sectionKey]}
                        >
                          <StepButton
                            onClick={() => setOpenSection(sectionKey)}
                            disabled={!canNavigateTo(sectionKey)}
                            icon={
                              <CheckCircleRoundedIcon
                                sx={{
                                  color:
                                    sectionKey === openSection
                                      ? "primary.main"
                                      : completedSections[sectionKey]
                                      ? "success.main"
                                      : "text.disabled",
                                }}
                              />
                            }
                          >
                            {getStepLabel(sectionKey)}
                          </StepButton>
                        </Step>
                      ))}
                    </Stepper>
                  </Box>
                  <IconButton
                    className="lesson-stepper-reset"
                    onClick={() => setResetOpen(true)}
                  >
                    <RestartAltRoundedIcon />
                  </IconButton>
                </Box>

                <Box
                  className="lesson-content"
                  sx={{ margin: "1rem auto !important" }}
                >
                  {openSection === "lesson" ? (
                    <Box>
                      {sectionLoading.lesson ? (
                        <Box display="flex" justifyContent="center" py={3}>
                          <Box width="12rem">
                            <LinearProgress />
                          </Box>
                        </Box>
                      ) : (
                        <Box
                          dangerouslySetInnerHTML={{ __html: lessonHtml }}
                          sx={{ mb: 3 }}
                        />
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
                      {sectionLoading.references ? (
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
                      {sectionLoading.exercises ? (
                        <Box display="flex" justifyContent="center" py={3}>
                          <Box width="12rem">
                            <LinearProgress />
                          </Box>
                        </Box>
                      ) : (
                        <Box className="exercise-panel">
                          {exercises.length ? (
                            <>
                              <Box className="exercise-carousel-wrap">
                                <IconButton
                                  className="exercise-carousel-nav"
                                  onClick={() => {
                                    const nextIndex = Math.max(exerciseIndex - 1, 0);
                                    goToIndex(nextIndex);
                                  }}
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
                                    const fibDisabled =
                                      !fibValue.trim() || Boolean(feedback);
                                  return (
                                    <Box key={idx} className="exercise-slide">
                                      <Stack spacing={3} alignItems="flex-start">
                                          <Box
                                            className="exercise-question"
                                            dangerouslySetInnerHTML={{
                                              __html: exercise.question_html || "",
                                            }}
                                          />
                                        {exercise.type === "fib" ? (
                                            <Stack
                                              spacing={2}
                                              className="exercise-options"
                                              alignItems="center"
                                            >
                                              <Box className="fib-row">
                                                <input
                                                  className="fib-input"
                                                  type="text"
                                                  value={fibValue}
                                                  onChange={(event) =>
                                                    feedback
                                                      ? undefined
                                                      : setFibAnswers((prev) => {
                                                          const next = [...prev];
                                                          next[idx] = event.target.value;
                                                          return next;
                                                        })
                                                  }
                                                  onKeyDown={(event) => {
                                                    if (event.key !== "Enter") {
                                                      return;
                                                    }
                                                    if (feedback) {
                                                      goToIndex(idx + 1);
                                                      return;
                                                    }
                                                    if (!fibDisabled) {
                                                      handleFibSubmit(idx, exercise.answer);
                                                    }
                                                  }}
                                                  placeholder="Type your answer"
                                                  readOnly={Boolean(feedback)}
                                                />
                                                <IconButton
                                                  className="fib-check"
                                                  color="primary"
                                                  onClick={() =>
                                                    handleFibSubmit(idx, exercise.answer)
                                                  }
                                                  disabled={fibDisabled}
                                                  aria-label="Check answer"
                                                  centerRipple
                                                  sx={{
                                                    width: 30,
                                                    height: 30,
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
                                              {feedback && !feedback.correct ? (
                                                <Typography color="error.main">
                                                  Incorrect. Correct answer: {feedback.correctAnswer}
                                                </Typography>
                                              ) : null}
                                            </Stack>
                                        ) : (
                                          <Box className="exercise-options-grid">
                                            {exercise.options?.map((option) => {
                                              const isCorrect = exercise.answer === option;
                                              const status = exerciseStatuses[idx];
                                              const isAnswered =
                                                status === "correct" || status === "incorrect";
                                              const selected = mcqSelections[idx];
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
                                                  onClick={() =>
                                                    isAnswered
                                                      ? undefined
                                                      : handleAnswer(
                                                          idx,
                                                          exercise.answer,
                                                          option
                                                        )
                                                  }
                                                  sx={{
                                                    borderColor: highlightColor,
                                                    color: highlightColor,
                                                    backgroundColor: isSelected
                                                      ? highlightBg
                                                      : undefined,
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
                                        <Box display="flex" justifyContent="flex-end" width="100%">
                                          <Button
                                            variant="contained"
                                            disabled={
                                              exerciseStatuses[idx] === "unattempted" ||
                                              idx >= exercises.length - 1
                                            }
                                            onClick={() => goToIndex(idx + 1)}
                                          >
                                            Next
                                          </Button>
                                        </Box>
                                      </Stack>
                                    </Box>
                                  );
                                })}
                                </Box>
                                <IconButton
                                  className="exercise-carousel-nav"
                                  onClick={() => {
                                    const nextIndex = Math.min(
                                      exerciseIndex + 1,
                                      exercises.length - 1
                                    );
                                    goToIndex(nextIndex);
                                  }}
                                  disabled={exerciseIndex >= exercises.length - 1}
                                >
                                  <ChevronRightRoundedIcon />
                                </IconButton>
                              </Box>
                              <Box className="exercise-dot-dock">
                              <Box className="exercise-dot-strip centered" ref={dotsRef}>
                                  {exercises.map((_, idx) => {
                                    const status = exerciseStatuses[idx] ?? "unattempted";
                                    const isCurrent = idx === exerciseIndex;
                                    const dotState = isCurrent ? "current" : status;
                                    return (
                                      <button
                                        key={`${idx}-${dotState}`}
                                        type="button"
                                        data-dot-index={idx}
                                        className={`exercise-dot ${dotState}`}
                                        aria-label={`Question ${idx + 1}`}
                                        title={`Question ${idx + 1}`}
                                        onClick={() => {
                                          setExerciseIndex(idx);
                                          scrollToIndex(idx);
                                        }}
                                      />
                                    );
                                  })}
                                </Box>
                              </Box>
                            </>
                          ) : (
                            <Typography>No exercises available.</Typography>
                          )}
                        </Box>
                      )}
                      {allExercisesAnswered ? (
                        <Box display="flex" justifyContent="flex-end" sx={{ mt: 3 }}>
                          <Button
                            variant="contained"
                            onClick={() => handleAdvanceSection("exercises")}
                          >
                            Next
                          </Button>
                        </Box>
                      ) : null}
                    </Box>
                  ) : null}
                  <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
                    <DialogTitle>Restart lesson?</DialogTitle>
                    <DialogContent>
                      <Typography>
                        Do you want to start the lesson all over?
                      </Typography>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setResetOpen(false)}>Cancel</Button>
                      <Button
                        variant="contained"
                        color="error"
                        onClick={() => {
                          if (progressKey) {
                            window.localStorage.removeItem(progressKey);
                          }
                          setCompletedSections({
                            lesson: false,
                            references: false,
                            exercises: false,
                          });
                          setOpenSection("lesson");
                          setExerciseIndex(0);
                          setExerciseStatuses(
                            Array(exercises.length).fill("unattempted")
                          );
                          setFibAnswers(Array(exercises.length).fill(""));
                          setFibFeedbacks(Array(exercises.length).fill(null));
                          setMcqSelections(Array(exercises.length).fill(""));
                          scrollToIndex(0);
                          setResetOpen(false);
                        }}
                      >
                        Restart
                      </Button>
                    </DialogActions>
                  </Dialog>
                </Box>
              </Stack>
            ) : (
              <Paper className="card" elevation={0}>
                <Typography color="text.secondary">
                  Select a lesson from Home to begin.
                </Typography>
              </Paper>
            )}
          </Stack>
        ) : null}
      </Container>
      <BottomNav
        isAuthenticated={isAuthenticated}
        userAvatar={user?.picture}
        currentPage={page}
        onHomeClick={() => setPage("home")}
        onLessonsClick={() => setPage("lesson")}
        onAuthClick={() => loginWithRedirect()}
        onLogout={() =>
          logout({ logoutParams: { returnTo: window.location.origin } })
        }
      />
    </Box>
  );
}

export default App;
