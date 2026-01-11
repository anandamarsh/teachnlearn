import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Box, Container, Paper, Typography } from "@mui/material";
import "./App.css";
import BottomNav from "./components/BottomNav";
import CenteredLoader from "./components/common/CenteredLoader";
import HomeView from "./components/home/HomeView";
import LessonView from "./components/lesson/LessonView";
import { useApiClient } from "./hooks/useApiClient";
import { useCatalog } from "./hooks/useCatalog";
import { CatalogLesson } from "./state/types";
import { apiBaseUrl, auth0Audience } from "./auth/config";

type PageKey = "home" | "lesson";

function App() {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();
  const configError = !apiBaseUrl || !auth0Audience;

  const [page, setPage] = useState<PageKey>("home");
  const [selectedLesson, setSelectedLesson] = useState<CatalogLesson | null>(
    null
  );

  const fetchWithAuth = useApiClient(apiBaseUrl, auth0Audience);
  const { lessons, loading, error } = useCatalog({ fetchWithAuth });

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

  const pendingLessonKey = "lp-pending-lesson-path";

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
    if (!isAuthenticated || !lessons.length) {
      return;
    }
    const pendingPath = localStorage.getItem(pendingLessonKey);
    if (!pendingPath) {
      return;
    }
    localStorage.removeItem(pendingLessonKey);
    const pendingLesson = findLessonByPath(pendingPath);
    if (pendingLesson) {
      setSelectedLesson(pendingLesson);
      setPage("lesson");
      if (window.location.pathname !== pendingPath) {
        window.history.pushState({}, "", pendingPath);
      }
    }
  }, [findLessonByPath, isAuthenticated, lessons.length]);

  useEffect(() => {
    if (!lessons.length) {
      return;
    }
    if (lessonFromPath) {
      if (lessonFromPath.requiresLogin && !isAuthenticated) {
        const nextPath = buildLessonPath(lessonFromPath);
        localStorage.setItem(pendingLessonKey, nextPath);
        loginWithRedirect();
        return;
      }
      setSelectedLesson(lessonFromPath);
      setPage("lesson");
    }
  }, [isAuthenticated, lessonFromPath, lessons.length, loginWithRedirect]);

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
        if (nextLesson.requiresLogin && !isAuthenticated) {
          const nextPath = buildLessonPath(nextLesson);
          localStorage.setItem(pendingLessonKey, nextPath);
          loginWithRedirect();
          return;
        }
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
  }, [isAuthenticated, lessons, loginWithRedirect]);

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

  if (isLoading) {
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
            onSelectLesson={(lesson) => {
              if (lesson.requiresLogin && !isAuthenticated) {
                const nextPath = buildLessonPath(lesson);
                localStorage.setItem(pendingLessonKey, nextPath);
                loginWithRedirect();
                return;
              }
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
                Select a lesson from Home to begin.
              </Typography>
            </Paper>
          )
        ) : null}
      </Container>
        <BottomNav
          isAuthenticated={isAuthenticated}
          userAvatar={user?.picture}
          currentPage={page}
          onHomeClick={() => {
            setPage("home");
            if (window.location.pathname !== "/") {
              window.history.pushState({}, "", "/");
            }
          }}
          onLessonsClick={() => setPage("lesson")}
          onAuthClick={() => loginWithRedirect()}
          onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        />
    </Box>
  );
}

export default App;
