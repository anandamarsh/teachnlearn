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
  FormControl,
  InputLabel,
  LinearProgress,
  ListSubheader,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import "./App.css";
import BottomNav from "./components/BottomNav";
import LessonsPage from "./components/lessons/LessonsPage";
import Students from "./components/Students";
import { useLessons } from "./hooks/useLessons";
import { buildAuthHeaders } from "./auth/buildAuthHeaders";
import {
  clearStoredEffectiveAccount,
  getStoredEffectiveAccount,
  setStoredEffectiveAccount,
} from "./auth/effectiveAccount";

const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API || "";
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";

type PageKey = "lessons" | "students";

const getPageFromPath = (pathname: string): PageKey => {
  if (pathname === "/lessons" || /^\/lesson\/[^/]+$/.test(pathname)) {
    return "lessons";
  }
  if (pathname === "/students" || pathname === "/profile") {
    return "students";
  }
  return "lessons";
};

const getLessonIdFromPath = (pathname: string) => {
  const match = pathname.match(/^\/lesson\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

const getPathFromPage = (page: PageKey, lessonId?: string | null) => {
  if (page === "lessons") {
    if (lessonId) {
      return `/lesson/${encodeURIComponent(lessonId)}`;
    }
    return "/lessons";
  }
  if (page === "students") {
    return "/students";
  }
  return "/lessons";
};

const isAuthCallbackUrl = (search: string) => {
  const params = new URLSearchParams(search);
  return (
    (params.has("code") && params.has("state")) ||
    params.has("error") ||
    params.has("error_description")
  );
};

function App() {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    user,
  } = useAuth0();
  const authEmail = String(user?.email || "").trim().toLowerCase();
  const [effectiveAccount, setEffectiveAccount] = useState(() => getStoredEffectiveAccount());
  const [availableAccounts, setAvailableAccounts] = useState<
    { email: string; name: string; school: string }[]
  >([]);
  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const scopeKey = effectiveAccount || authEmail || "self";

  const [page, setPage] = useState<PageKey>(() => getPageFromPath(window.location.pathname));
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
    updateApprovedQuestions,
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
    scopeKey,
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
  const [addStudentSignal, setAddStudentSignal] = useState(0);
  const initialLessonIdFromPathRef = useRef<string | null>(
    getLessonIdFromPath(window.location.pathname)
  );

  const notify = useCallback((message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleLogout = useCallback(() => {
    setOtpCode("");
    setOtpStatus("idle");
    setEffectiveAccount("");
    clearStoredEffectiveAccount();
    window.sessionStorage.removeItem(otpStorageKey);
    logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  const canSwitchAccounts = availableAccounts.length > 0;

  const fetchAvailableAccounts = useCallback(async () => {
    if (!apiBaseUrl || !auth0Audience || !isAuthenticated) {
      return;
    }
    setAccountsLoading(true);
    setAccountsError("");
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const response = await fetch(`${apiBaseUrl}/teacher/accounts`, {
        method: "GET",
        headers,
      });
      if (response.status === 403) {
        setAvailableAccounts([]);
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to load accounts");
      }
      const data = (await response.json()) as {
        accounts?: { email?: string; name?: string; school?: string }[];
      };
      const accounts = Array.isArray(data.accounts)
        ? data.accounts
            .map((account) => ({
              email: String(account.email || "").trim().toLowerCase(),
              name: String(account.name || ""),
              school: String(account.school || ""),
            }))
            .filter((account) => Boolean(account.email))
        : [];
      setAvailableAccounts(accounts);
    } catch (error) {
      setAvailableAccounts([]);
      setAccountsError(error instanceof Error ? error.message : "Failed to load accounts");
    } finally {
      setAccountsLoading(false);
    }
  }, [apiBaseUrl, auth0Audience, getAccessTokenSilently, isAuthenticated]);

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
    if (isAuthCallbackUrl(window.location.search)) {
      return;
    }
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

  useEffect(() => {
    if (!authEmail) {
      setEffectiveAccount("");
      clearStoredEffectiveAccount();
      return;
    }
    const stored = getStoredEffectiveAccount();
    if (stored && stored !== authEmail) {
      setEffectiveAccount(stored);
      return;
    }
    setEffectiveAccount("");
    clearStoredEffectiveAccount();
  }, [authEmail]);

  useEffect(() => {
    if (!isAuthenticated || !authEmail) {
      setAvailableAccounts([]);
      return;
    }
    void fetchAvailableAccounts();
  }, [authEmail, fetchAvailableAccounts, isAuthenticated]);

  useEffect(() => {
    const onPopState = () => {
      const pathname = window.location.pathname;
      setPage(getPageFromPath(pathname));
      const lessonId = getLessonIdFromPath(pathname);
      if (lessonId) {
        setSelectedLessonId(lessonId);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setSelectedLessonId]);

  useEffect(() => {
    const lessonIdFromPath = initialLessonIdFromPathRef.current;
    if (
      page === "lessons" &&
      lessonIdFromPath &&
      lessons.some((lesson) => lesson.id === lessonIdFromPath) &&
      selectedLessonId !== lessonIdFromPath
    ) {
      setSelectedLessonId(lessonIdFromPath);
      initialLessonIdFromPathRef.current = null;
    }
  }, [lessons, page, selectedLessonId, setSelectedLessonId]);

  useEffect(() => {
    if (isLoading || isAuthCallbackUrl(window.location.search)) {
      return;
    }
    const nextPath = getPathFromPage(page, page === "lessons" ? selectedLesson?.id : null);
    const current = `${window.location.pathname}${window.location.search}`;
    const next = nextPath;
    if (current !== next) {
      window.history.replaceState({}, "", next);
    }
  }, [isLoading, page, selectedLesson?.id]);

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
      pb={10}
    >
      {page === "lessons" ? (
        <LessonsPage
          key={scopeKey}
          lessons={lessons}
          selectedLesson={selectedLesson}
          selectedLessonId={selectedLessonId}
          loading={loading}
          isAuthenticated={isAuthenticated}
          onCreateLesson={handleCreateLesson}
          onDuplicateLesson={() => setDuplicateOpen(true)}
          onDeleteLesson={() => setDeleteOpen(true)}
          onDeleteLessonById={deleteLesson}
          showDelete={Boolean(selectedLesson)}
          onSelectLesson={(lessonId) => setSelectedLessonId(lessonId)}
          onUpdateTitle={handleUpdateTitle}
          onUpdateContent={handleUpdateContent}
          onUpdateStatus={handleUpdateStatus}
          onUpdateMeta={handleUpdateMeta}
          onUpdateApprovedQuestions={updateApprovedQuestions}
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
      ) : null}
      {page === "students" ? (
        <Students
          key={scopeKey}
          apiBaseUrl={apiBaseUrl}
          auth0Audience={auth0Audience}
          getAccessTokenSilently={getAccessTokenSilently}
          onNotify={notify}
          addStudentSignal={addStudentSignal}
        />
      ) : null}

      <BottomNav
        isAuthenticated={isAuthenticated}
        userAvatar={user?.picture}
        authEmail={authEmail}
        effectiveAccountEmail={effectiveAccount || authEmail}
        canSwitchAccounts={canSwitchAccounts}
        currentPage={page}
        onLessonsClick={() => setPage("lessons")}
        onStudentsClick={() => setPage("students")}
        onPrimaryAction={() => {
          if (page === "students") {
            setAddStudentSignal((current) => current + 1);
            return;
          }
          void handleCreateLesson();
        }}
        showPrimaryAction={page === "lessons" || page === "students"}
        onDeleteLesson={() => setDeleteOpen(true)}
        showDelete={page === "lessons" && Boolean(selectedLesson)}
        onAuthClick={() => loginWithRedirect()}
        onLogout={handleLogout}
        onManageAccounts={() => setAccountsDialogOpen(true)}
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
      <Dialog
        open={accountsDialogOpen}
        onClose={() => setAccountsDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Switch account</DialogTitle>
        <DialogContent>
          {accountsError ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {accountsError}
            </Alert>
          ) : null}
          {accountsLoading ? <LinearProgress sx={{ mt: 1 }} /> : null}
          <FormControl fullWidth margin="normal">
            <InputLabel id="account-switch-label">Teacher account</InputLabel>
            <Select
              labelId="account-switch-label"
              label="Teacher account"
              value={effectiveAccount || authEmail}
              onChange={(event) => {
                const nextValue = String(event.target.value || "").trim().toLowerCase();
                if (!nextValue || nextValue === authEmail) {
                  clearStoredEffectiveAccount();
                  setEffectiveAccount("");
                  return;
                }
                setStoredEffectiveAccount(nextValue);
                setEffectiveAccount(nextValue);
              }}
            >
              <ListSubheader>Your account</ListSubheader>
              <MenuItem value={authEmail}>{authEmail || "Current login"}</MenuItem>
              <ListSubheader>All accounts</ListSubheader>
              {availableAccounts.map((account) => (
                <MenuItem key={account.email} value={account.email}>
                  {account.name ? `${account.name} (${account.email})` : account.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            The selected account becomes your effective teacher account for lessons, students,
            and lesson editing until you switch back.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void fetchAvailableAccounts()} disabled={accountsLoading}>
            Refresh
          </Button>
          <Button onClick={() => setAccountsDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{
          zIndex: 2147483647,
          top: { xs: 16, md: 24 },
        }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
          sx={{
            py: 0.5,
            ...(snackbar.severity === "success"
              ? {
                  bgcolor: "success.main",
                  color: "#fff",
                }
              : {}),
          }}
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
