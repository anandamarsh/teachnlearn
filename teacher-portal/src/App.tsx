import { useCallback, useEffect, useRef, useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import "./App.css";
import Home from "./components/Home";
import BottomNav from "./components/BottomNav";
import LessonsPage from "./components/lessons/LessonsPage";
import { useLessons } from "./hooks/useLessons";
import { buildAuthHeaders } from "./auth/buildAuthHeaders";

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
    duplicateLesson,
    updateLessonTitle,
    updateLessonContent,
    updateLessonStatus,
    updateLessonMeta,
    deleteLesson,
    uploadLessonIcon,
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
  const [otpTrigger, setOtpTrigger] = useState(0);
  const prevAuthRef = useRef(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState<"idle" | "loading" | "error">("idle");
  const otpStorageKey = "tp_otp_cache_v1";

  const notify = useCallback((message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleLogout = useCallback(() => {
    setOtpCode("");
    setOtpStatus("idle");
    window.sessionStorage.removeItem(otpStorageKey);
    logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

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

  const handleUpdateStatus = async (lessonId: string, status: string) => {
    const updated = await updateLessonStatus(lessonId, status);
    if (updated) {
      notify("Lesson status updated", "success");
    }
    return updated;
  };

  const handleUpdateMeta = async (
    lessonId: string,
    updates: {
      subject?: string | null;
      level?: string | null;
      requiresLogin?: boolean | null;
    }
  ) => {
    const updated = await updateLessonMeta(lessonId, updates);
    if (updated) {
      notify("Lesson updated", "success");
    }
    return updated;
  };

  const handleUploadIcon = async (lessonId: string, file: File) => {
    const url = await uploadLessonIcon(lessonId, file);
    if (url) {
      notify("Lesson icon updated", "success");
    }
    return url;
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const handleConfirmDelete = async () => {
    if (!selectedLesson) {
      setDeleteOpen(false);
      setDeleteConfirmText("");
      return;
    }
    if (deleteConfirmText.trim().toLowerCase() !== "delete") {
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
    setDeleteConfirmText("");
  };

  const handleConfirmDuplicate = async () => {
    if (!selectedLesson) {
      setDuplicateOpen(false);
      return;
    }
    const created = await duplicateLesson(selectedLesson.id);
    if (created) {
      setSnackbar({
        open: true,
        message: "Lesson duplicated",
        severity: "success",
      });
    }
    setDuplicateOpen(false);
  };

  const normalizedStatus = (selectedLesson?.status || "").toLowerCase().trim();
  const isSelectedPublished =
    normalizedStatus.includes("publish") || normalizedStatus.includes("active");

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

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (isAuthenticated && !prevAuthRef.current) {
      setOtpTrigger((prev) => prev + 1);
    }
    if (!isAuthenticated && prevAuthRef.current) {
      setOtpCode("");
      setOtpStatus("idle");
      window.sessionStorage.removeItem(otpStorageKey);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, isLoading]);

  const fetchOtp = useCallback(async () => {
    if (!apiBaseUrl || !auth0Audience) {
      return;
    }
    setOtpStatus("loading");
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const response = await fetch(`${apiBaseUrl}/auth/otp`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch OTP");
      }
      const data = await response.json();
      const code = String(data.code || "");
      const expiresIn = Number(data.expiresIn || 0);
      setOtpCode(code);
      setOtpStatus("idle");
      if (code && expiresIn > 0) {
        const payload = {
          code,
          expiresAt: Date.now() + expiresIn * 1000,
          userSub: user?.sub || "",
        };
        window.sessionStorage.setItem(otpStorageKey, JSON.stringify(payload));
      }
    } catch {
      setOtpStatus("error");
    }
  }, [apiBaseUrl, auth0Audience, getAccessTokenSilently, user?.sub]);

  useEffect(() => {
    if (otpTrigger <= 0) {
      return;
    }
    try {
      const cached = window.sessionStorage.getItem(otpStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          code?: string;
          expiresAt?: number;
          userSub?: string;
        };
        const sameUser = Boolean(parsed.userSub && parsed.userSub === (user?.sub || ""));
        const valid = Boolean(parsed.expiresAt && parsed.expiresAt > Date.now());
        if (parsed.code && sameUser && valid) {
          setOtpCode(parsed.code);
          setOtpStatus("idle");
          return;
        }
      }
    } catch {
      window.sessionStorage.removeItem(otpStorageKey);
    }
    fetchOtp();
  }, [fetchOtp, otpTrigger, user?.sub]);

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
    <Box
      className="app-shell"
      minHeight="100vh"
      bgcolor="background.default"
      pb={page === "home" ? 0 : 10}
    >
      {page === "home" ? (
        <Home
          onLessonsClick={() => setPage("lessons")}
          otpCode={otpCode}
          otpStatus={otpStatus}
          onReloadOtp={fetchOtp}
        />
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
          onUpdateStatus={handleUpdateStatus}
          onUpdateMeta={handleUpdateMeta}
          onUploadIcon={handleUploadIcon}
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
        onDuplicateLesson={() => setDuplicateOpen(true)}
        onDeleteLesson={() => setDeleteOpen(true)}
        showDuplicate={page === "lessons" && Boolean(selectedLesson)}
        showDelete={page === "lessons" && Boolean(selectedLesson) && !isSelectedPublished}
        onAuthClick={() => loginWithRedirect()}
        onLogout={handleLogout}
      />
      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteConfirmText("");
        }}
      >
        <DialogTitle>Delete lesson</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will delete the lesson permanently.
          </Alert>
          <TextField
            fullWidth
            label='Type "Delete" to confirm'
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            autoFocus
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteOpen(false);
              setDeleteConfirmText("");
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
            disabled={deleteConfirmText.trim().toLowerCase() !== "delete"}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={duplicateOpen} onClose={() => setDuplicateOpen(false)}>
        <DialogTitle>Duplicate lesson</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1 }}>
            This will create a new lesson with duplicated contents.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmDuplicate}>
            Duplicate
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
