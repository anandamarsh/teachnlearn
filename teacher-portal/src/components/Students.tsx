import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
  Button,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import {
  buildAuthHeaders,
  type GetAccessTokenSilently,
} from "../auth/buildAuthHeaders";
import {
  fetchTeacherStudents,
  updateTeacherStudents,
  type TeacherStudent,
} from "../api/teacherStudents";

type StudentsProps = {
  apiBaseUrl: string;
  auth0Audience: string;
  getAccessTokenSilently: GetAccessTokenSilently;
  onNotify: (message: string, severity: "success" | "error") => void;
};

const NAME_FIRST_PARTS = [
  "Amber",
  "Blue",
  "Brave",
  "Bright",
  "Calm",
  "Clever",
  "Coral",
  "Daring",
  "Golden",
  "Happy",
  "Kind",
  "Lucky",
  "Merry",
  "Nova",
  "Quiet",
  "River",
  "Silver",
  "Sunny",
  "Swift",
  "Tiny",
];

const NAME_SECOND_PARTS = [
  "Badger",
  "Comet",
  "Dolphin",
  "Falcon",
  "Forest",
  "Fox",
  "Harbor",
  "Lion",
  "Maple",
  "Meadow",
  "Otter",
  "Panda",
  "Pebble",
  "Robin",
  "Rocket",
  "Star",
  "Tiger",
  "Willow",
  "Wolf",
  "Wren",
];

const randomItem = (items: string[]) =>
  items[Math.floor(Math.random() * items.length)] || items[0];

const createStudentName = (existingNames: Set<string>) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const name = `${randomItem(NAME_FIRST_PARTS)} ${randomItem(NAME_SECOND_PARTS)}`;
    if (!existingNames.has(name.toLowerCase())) {
      return name;
    }
  }
  return `Student ${existingNames.size + 1}`;
};

const createStudentPasscode = () =>
  String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const formatStudentPasscode = (passcode: string) => {
  const digits = String(passcode || "").replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) {
    return passcode;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

const createStudentId = () =>
  `student_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeStudents = (students: TeacherStudent[] | null | undefined) =>
  Array.isArray(students)
    ? students
        .map((student) => ({
          id: String(student.id || "").trim(),
          name: String(student.name || "").trim(),
          passcode: String(student.passcode || "").trim(),
        }))
        .filter(
          (student) => Boolean(student.id && student.name && student.passcode),
        )
    : [];

const Students = ({
  apiBaseUrl,
  auth0Audience,
  getAccessTokenSilently,
  onNotify,
}: StudentsProps) => {
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [savedStudents, setSavedStudents] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TeacherStudent | null>(null);

  const endpoint = useMemo(
    () => (apiBaseUrl ? `${apiBaseUrl}/teacher/students` : ""),
    [apiBaseUrl]
  );

  useEffect(() => {
    if (!endpoint) {
      return;
    }
    let active = true;
    const loadStudents = async () => {
      setLoading(true);
      setError("");
      try {
        const headers = await buildAuthHeaders(
          getAccessTokenSilently,
          auth0Audience
        );
        const data = await fetchTeacherStudents(endpoint, headers);
        const normalized = normalizeStudents(data.students);
        if (!active) {
          return;
        }
        setStudents(normalized);
        setSavedStudents(normalized);
      } catch (err) {
        if (!active) {
          return;
        }
        const detail =
          err instanceof Error ? err.message : "Failed to load students";
        setError(detail);
        onNotify(detail, "error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadStudents();
    return () => {
      active = false;
    };
  }, [auth0Audience, endpoint, getAccessTokenSilently, onNotify]);

  const isDirty = JSON.stringify(students) !== JSON.stringify(savedStudents);

  const handleAddStudent = useCallback(() => {
    const existingNames = new Set(
      students.map((student) => student.name.toLowerCase())
    );
    setStudents((current) => [
      ...current,
      {
        id: createStudentId(),
        name: createStudentName(existingNames),
        passcode: createStudentPasscode(),
      },
    ]);
  }, [students]);

  const handleSave = useCallback(async () => {
    if (!endpoint) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const headers = await buildAuthHeaders(
        getAccessTokenSilently,
        auth0Audience
      );
      const data = await updateTeacherStudents(endpoint, headers, { students });
      const normalized = normalizeStudents(data.students);
      setStudents(normalized);
      setSavedStudents(normalized);
      onNotify("Students saved", "success");
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Failed to save students";
      setError(detail);
      onNotify(detail, "error");
    } finally {
      setSaving(false);
    }
  }, [auth0Audience, endpoint, getAccessTokenSilently, onNotify, students]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return;
    }
    setStudents((current) =>
      current.filter((student) => student.id !== deleteTarget.id)
    );
    setDeleteTarget(null);
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: "100vh", pt: "6.5rem", pb: 14 }}>
      <Stack spacing={3} alignItems="center">
        <Typography variant="h4" fontWeight={700} textAlign="center">
          Students
        </Typography>

        {loading ? <LinearProgress sx={{ width: "100%", maxWidth: 560 }} /> : null}

        {error ? (
          <Alert severity="error" sx={{ width: "100%", maxWidth: 560 }}>
            {error}
          </Alert>
        ) : null}

        {students.length === 0 ? (
          <Typography color="text.secondary" textAlign="center">
            No students yet.
          </Typography>
        ) : (
          <Stack spacing={0} sx={{ width: "100%", maxWidth: 560 }}>
            {students.map((student) => (
              <Box
                key={student.id}
                sx={{
                  py: 1.5,
                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography
                    sx={{
                      minWidth: 84,
                      fontFamily:
                        'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      letterSpacing: "0.08em",
                      color: "text.secondary",
                    }}
                  >
                    {formatStudentPasscode(student.passcode)}
                  </Typography>
                  <Typography
                    fontWeight={700}
                    sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {student.name}
                  </Typography>
                  <Box sx={{ flexShrink: 0 }}>
                    <IconButton
                      color="error"
                      aria-label={`Delete ${student.name}`}
                      onClick={() => setDeleteTarget(student)}
                    >
                      <DeleteRoundedIcon />
                    </IconButton>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        <Fab
          color="secondary"
          aria-label="Add student"
          onClick={handleAddStudent}
          disabled={saving || loading}
          sx={{
            position: "fixed",
            right: 20,
            bottom: "calc(96px + 56px)",
            width: "4rem",
            height: "4rem",
            boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
          }}
        >
          <AddRoundedIcon />
        </Fab>
        <Fab
          color="primary"
          aria-label="Save students"
          onClick={handleSave}
          disabled={!isDirty || saving || loading}
          sx={{
            position: "fixed",
            right: 20,
            bottom: "calc(20px + 56px)",
            width: "4rem",
            height: "4rem",
            boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
          }}
        >
          <SaveRoundedIcon />
        </Fab>
      </Stack>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete student</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            {deleteTarget
              ? `${deleteTarget.name} will be removed from this roster.`
              : "This student will be removed from this roster."}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Students;
