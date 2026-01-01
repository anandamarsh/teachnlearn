import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Snackbar,
  Typography,
} from "@mui/material";
import "./App.css";
import Home from "./components/Home";
import BottomNav from "./components/BottomNav";
import LessonsPage from "./components/lessons/LessonsPage";
import { useLessons } from "./hooks/useLessons";

const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API || "";
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";

type PageKey = "home" | "lessons";

function App() {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    user,
  } = useAuth0();

  const [page, setPage] = useState<PageKey>("home");
  const configError = !apiBaseUrl || !auth0Audience;

  const [wsPulse, setWsPulse] = useState<{ id: number; color: "success" | "error" } | null>(
    null
  );

  const {
    lessons,
    selectedLesson,
    selectedLessonId,
    setSelectedLessonId,
    loading,
    error,
    setError,
    createLesson,
    updateLessonTitle,
    updateLessonContent,
    deleteLesson,
  } = useLessons({
    apiBaseUrl,
    auth0Audience,
    isAuthenticated,
    getAccessTokenSilently,
    onPulse: (color) => {
      setWsPulse((prev) => ({
        id: (prev?.id ?? 0) + 1,
        color,
      }));
    },
  });

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const notify = useCallback((message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCreateLesson = async () => {
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }
    const created = await createLesson();
    if (created) {
      notify("Lesson created", "success");
    }
    setPage("lessons");
  };

  const handleUpdateTitle = async (lessonId: string, title: string) => {
    const updated = await updateLessonTitle(lessonId, title);
    if (updated) {
      notify("Lesson updated", "success");
    }
    return updated;
  };

  const handleUpdateContent = async (lessonId: string, content: string) => {
    const updated = await updateLessonContent(lessonId, content);
    if (updated) {
      notify("Lesson summary updated", "success");
    }
    return updated;
  };

  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleConfirmDelete = async () => {
    if (!selectedLesson) {
      setDeleteOpen(false);
      return;
    }
    const deleted = await deleteLesson(selectedLesson.id);
    if (deleted) {
      setSnackbar({
        open: true,
        message: "Lesson deleted",
        severity: "success",
      });
    }
    setDeleteOpen(false);
  };

  useEffect(() => {
    if (error) {
      notify(error, "error");
      setError("");
    }
  }, [error, notify, setError]);

  if (configError) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <Typography color="error">Missing VITE_TEACHNLEARN_API or VITE_AUTH0_AUDIENCE.</Typography>
      </Box>
    );
  }

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  if (isLoading || !isAuthenticated) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <Box width="10rem">
          <LinearProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box minHeight="100vh" bgcolor="background.default" pb={page === "home" ? 0 : 10}>
      {page === "home" ? (
        <Home onLessonsClick={() => setPage("lessons")} />
      ) : (
        <LessonsPage
          lessons={lessons}
          selectedLesson={selectedLesson}
          selectedLessonId={selectedLessonId}
          loading={loading}
          isAuthenticated={isAuthenticated}
          onSelectLesson={(lessonId) => setSelectedLessonId(lessonId)}
          onUpdateTitle={handleUpdateTitle}
          onUpdateContent={handleUpdateContent}
          onNotify={notify}
          getAccessTokenSilently={getAccessTokenSilently}
          onPulse={(color) =>
            setWsPulse((prev) => ({
              id: (prev?.id ?? 0) + 1,
              color,
            }))
          }
        />
      )}

      <BottomNav
        isAuthenticated={isAuthenticated}
        userAvatar={user?.picture}
        currentPage={page}
        onHomeClick={() => setPage("home")}
        onLessonsClick={() => setPage("lessons")}
        onCreateLesson={handleCreateLesson}
        onDeleteLesson={() => setDeleteOpen(true)}
        showDelete={page === "lessons" && Boolean(selectedLesson)}
        onAuthClick={() => loginWithRedirect()}
        onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
      />
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete lesson</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will delete the lesson permanently.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
          sx={{ py: 0.5 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      {wsPulse ? (
        <Box
          key={wsPulse.id}
          className="ws-status-blip"
          sx={{
            position: "fixed",
            top: 12,
            right: 16,
            width: 12,
            height: 12,
            borderRadius: "999px",
            bgcolor: wsPulse.color === "success" ? "success.main" : "error.main",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
            zIndex: 1300,
          }}
          aria-label={wsPulse.color === "success" ? "WebSocket activity" : "WebSocket error"}
        />
      ) : null}
    </Box>
  );
}

export default App;
