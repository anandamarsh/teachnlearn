import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

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
        onHomeClick={() => setPage("home")}
        onLessonsClick={() => setPage("lesson")}
        onAuthClick={() => loginWithRedirect()}
        onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
      />
    </Box>
  );
}

export default App;
