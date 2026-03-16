import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Container, Paper, Typography } from "@mui/material";
import "./App.css";
import BottomNav from "./components/BottomNav";
import CenteredLoader from "./components/common/CenteredLoader";
import HomeView from "./components/home/HomeView";
import LessonView from "./components/lesson/LessonView";
import { useApiClient } from "./hooks/useApiClient";
import { useCatalog } from "./hooks/useCatalog";
import { useStudentAuth } from "./hooks/useStudentAuth";
import { CatalogLesson } from "./state/types";
import { apiBaseUrl } from "./auth/config";

type PageKey = "home" | "lesson";

function App() {
  const configError = !apiBaseUrl;

  const [page, setPage] = useState<PageKey>("home");
  const [selectedLesson, setSelectedLesson] = useState<CatalogLesson | null>(
    null
  );
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const fetchWithAuth = useApiClient(apiBaseUrl);
  const { student, isAuthenticated, loading: authLoading, login, logout } =
    useStudentAuth(apiBaseUrl);
  const { lessons, loading, error } = useCatalog({
    fetchWithAuth,
    enabled: isAuthenticated,
  });

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const buildLessonPath = (lesson: CatalogLesson) => {
    const subject = lesson.subject ? slugify(lesson.subject) : "";
    const level = lesson.level ? slugify(lesson.level) : "";
    const title = lesson.title ? slugify(lesson.title) : "";
    if (subject && level && title) {
      return `/${subject}/${level}/${title}`;
    }
    return `/lesson/${lesson.id}`;
  };

  const findLessonByPath = useCallback(
    (path: string) => {
      const cleaned = path.replace(/^\/+|\/+$/g, "");
      if (!cleaned) {
        return null;
      }
      const parts = cleaned.split("/");
      if (parts[0] === "lesson" && parts[1]) {
        return lessons.find((lesson) => String(lesson.id) === parts[1]) || null;
      }
      if (parts.length >= 3) {
        const [subject, level, title] = parts;
        return (
          lessons.find((lesson) => {
            if (!lesson.subject || !lesson.level || !lesson.title) {
              return false;
            }
            return (
              slugify(lesson.subject) === subject &&
              slugify(lesson.level) === level &&
              slugify(lesson.title) === title
            );
          }) || null
        );
      }
      return null;
    },
    [lessons]
  );

  const lessonFromPath = useMemo(
    () => findLessonByPath(window.location.pathname),
    [findLessonByPath]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setSelectedLesson(null);
      setPage("home");
      return;
    }
    if (!lessons.length) {
      return;
    }
    if (lessonFromPath) {
      setSelectedLesson(lessonFromPath);
      setPage("lesson");
    }
  }, [isAuthenticated, lessonFromPath, lessons.length]);

  useEffect(() => {
    const handlePopState = () => {
      const cleaned = window.location.pathname.replace(/^\/+|\/+$/g, "");
      if (!cleaned) {
        setPage("home");
        return;
      }
      if (!lessons.length) {
        return;
      }
      const parts = cleaned.split("/");
      let nextLesson: CatalogLesson | null = null;
      if (parts[0] === "lesson" && parts[1]) {
        nextLesson =
          lessons.find((lesson) => String(lesson.id) === parts[1]) || null;
      } else if (parts.length >= 3) {
        const [subject, level, title] = parts;
        nextLesson =
          lessons.find((lesson) => {
            if (!lesson.subject || !lesson.level || !lesson.title) {
              return false;
            }
            return (
              slugify(lesson.subject) === subject &&
              slugify(lesson.level) === level &&
              slugify(lesson.title) === title
            );
          }) || null;
      }
      if (nextLesson) {
        setSelectedLesson(nextLesson);
        setPage("lesson");
      } else {
        setPage("home");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isAuthenticated, lessons]);

  if (configError) {
    return (
      <Box
        display="flex"
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
      >
        <Typography color="error">
          Missing VITE_TEACHNLEARN_API.
        </Typography>
      </Box>
    );
  }

  if (authLoading) {
    return <CenteredLoader />;
  }

  return (
    <Box className="app-shell" bgcolor="background.default" minHeight="100vh">
      <Container
        maxWidth={false}
        disableGutters
        className={`app-content${page === "lesson" ? " lesson-page" : ""}`}
        sx={{ px: 0 }}
      >
        {error ? (
          <Paper className="card" elevation={0}>
            <Typography color="error">{error}</Typography>
          </Paper>
        ) : null}

        {loading ? <CenteredLoader /> : null}

        {page === "home" ? (
          <HomeView
            lessons={lessons}
            isAuthenticated={isAuthenticated}
            studentName={student?.name}
            loginLoading={loginLoading}
            loginError={loginError}
            onLogin={async (name, passcode) => {
              setLoginError(null);
              setLoginLoading(true);
              try {
                await login(name, passcode);
              } catch (err) {
                setLoginError("Name or passcode is incorrect");
              } finally {
                setLoginLoading(false);
              }
            }}
            onSelectLesson={(lesson) => {
              setSelectedLesson(lesson);
              setPage("lesson");
              const nextPath = buildLessonPath(lesson);
              if (window.location.pathname !== nextPath) {
                window.history.pushState({}, "", nextPath);
              }
            }}
          />
        ) : null}

        {page === "lesson" ? (
          selectedLesson ? (
            <LessonView lesson={selectedLesson} fetchWithAuth={fetchWithAuth} />
          ) : (
            <Paper className="card" elevation={0}>
              <Typography color="text.secondary">
                Select an exercise set from Home to begin.
              </Typography>
            </Paper>
          )
        ) : null}
      </Container>
        <BottomNav
          isAuthenticated={isAuthenticated}
          studentName={student?.name}
          currentPage={page}
          onHomeClick={() => {
            setPage("home");
            if (window.location.pathname !== "/") {
              window.history.pushState({}, "", "/");
            }
          }}
          onLessonsClick={() => {
            if (selectedLesson) {
              setPage("lesson");
            }
          }}
          onLogout={() => {
            logout();
            setSelectedLesson(null);
            setPage("home");
            if (window.location.pathname !== "/") {
              window.history.pushState({}, "", "/");
            }
          }}
        />
    </Box>
  );
}

export default App;
