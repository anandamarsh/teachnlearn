import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Container,
  LinearProgress,
  Paper,
  Typography,
} from "@mui/material";
import "./App.css";
import BottomNav from "./components/BottomNav";
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
  const { lessons, loading, error } = useCatalog({
    isAuthenticated,
    fetchWithAuth,
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

  const lessonFromPath = useMemo(() => {
    const matchByPath = (path: string) => {
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
    };
    return matchByPath(window.location.pathname);
  }, [lessons]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  useEffect(() => {
    if (!lessons.length) {
      return;
    }
    if (lessonFromPath) {
      setSelectedLesson(lessonFromPath);
      setPage("lesson");
    }
  }, [lessonFromPath, lessons.length]);

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
  }, [lessons]);

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
        {error ? (
          <Paper className="card" elevation={0}>
            <Typography color="error">{error}</Typography>
          </Paper>
        ) : null}

        {loading ? (
          <Box display="flex" alignItems="center" justifyContent="center" py={6}>
            <Box width="12rem">
              <LinearProgress />
            </Box>
          </Box>
        ) : null}

        {page === "home" ? (
          <HomeView
            lessons={lessons}
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
