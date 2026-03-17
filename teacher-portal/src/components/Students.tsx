import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
  Button,
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
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
  addStudentSignal: number;
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

const formatStudentPasscode = (passcode: string) =>
  String(passcode || "").replace(/\D/g, "").slice(0, 6);

const formatStudentPasscodeDisplay = (passcode: string) => {
  const digits = formatStudentPasscode(passcode);
  if (digits.length <= 3) {
    return digits;
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
  addStudentSignal,
}: StudentsProps) => {
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editTarget, setEditTarget] = useState<TeacherStudent | null>(null);
  const [editName, setEditName] = useState("");
  const [editPasscode, setEditPasscode] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TeacherStudent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const persistedStudentsRef = useRef<TeacherStudent[]>([]);
  const lastAddSignalRef = useRef(addStudentSignal);

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
        persistedStudentsRef.current = normalized;
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

  const persistStudents = useCallback(async (
    nextStudents: TeacherStudent[],
    successMessage: string
  ) => {
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
      const data = await updateTeacherStudents(endpoint, headers, {
        students: nextStudents,
      });
      const normalized = normalizeStudents(data.students);
      setStudents(normalized);
      persistedStudentsRef.current = normalized;
      onNotify(successMessage, "success");
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Failed to save students";
      setError(detail);
      setStudents(persistedStudentsRef.current);
      onNotify(detail, "error");
    } finally {
      setSaving(false);
    }
  }, [auth0Audience, endpoint, getAccessTokenSilently, onNotify]);

  const handleAddStudent = useCallback(() => {
    const existingNames = new Set(
      persistedStudentsRef.current.map((student: TeacherStudent) =>
        student.name.toLowerCase()
      )
    );
    const nextStudents = [
      ...persistedStudentsRef.current,
      {
        id: createStudentId(),
        name: createStudentName(existingNames),
        passcode: createStudentPasscode(),
      },
    ];
    setStudents(nextStudents);
    void persistStudents(nextStudents, "Student added");
  }, [persistStudents]);

  useEffect(() => {
    if (addStudentSignal === lastAddSignalRef.current) {
      return;
    }
    lastAddSignalRef.current = addStudentSignal;
    handleAddStudent();
  }, [addStudentSignal, handleAddStudent]);

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteConfirmText.trim().toLowerCase() !== "delete") {
      return;
    }
    const nextStudents = persistedStudentsRef.current.filter(
      (student: TeacherStudent) => student.id !== deleteTarget.id
    );
    setStudents(nextStudents);
    setDeleteTarget(null);
    setDeleteConfirmText("");
    void persistStudents(nextStudents, "Student deleted");
  };

  const handleConfirmEdit = () => {
    if (!editTarget) {
      return;
    }
    const trimmedName = editName.trim();
    const trimmedPasscode = editPasscode.replace(/\D/g, "").slice(0, 6);
    if (!trimmedName) {
      setError("Student name is required");
      return;
    }
    if (trimmedPasscode.length !== 6) {
      setError("Student number must be 6 digits");
      return;
    }
    const nextStudents = persistedStudentsRef.current.map(
      (student: TeacherStudent) =>
        student.id === editTarget.id
          ? {
              ...student,
              name: trimmedName,
              passcode: trimmedPasscode,
            }
          : student
    );
    setStudents(nextStudents);
    setEditTarget(null);
    setEditName("");
    setEditPasscode("");
    void persistStudents(nextStudents, "Student updated");
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
                    {formatStudentPasscodeDisplay(student.passcode)}
                  </Typography>
                  <Typography
                    fontWeight={700}
                    sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {student.name}
                  </Typography>
                  <Box sx={{ flexShrink: 0 }}>
                    <IconButton
                      aria-label={`Edit ${student.name}`}
                      onClick={() => {
                        setEditTarget(student);
                        setEditName(student.name);
                        setEditPasscode(student.passcode);
                        setError("");
                      }}
                    >
                      <EditRoundedIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      aria-label={`Delete ${student.name}`}
                      onClick={() => {
                        setDeleteTarget(student);
                        setDeleteConfirmText("");
                      }}
                    >
                      <DeleteRoundedIcon />
                    </IconButton>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

      </Stack>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete student</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            {deleteTarget
              ? `${deleteTarget.name} will be removed from your list of students. Type Delete to confirm.`
              : "This student will be removed from your list of students. Type Delete to confirm."}
          </Alert>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Type Delete"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteTarget(null);
              setDeleteConfirmText("");
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteConfirmText.trim().toLowerCase() !== "delete"}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)}>
        <DialogTitle>Edit student</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Student nickname"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleConfirmEdit();
              }
            }}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            label="PIN"
            value={formatStudentPasscode(editPasscode)}
            onChange={(event) =>
              setEditPasscode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleConfirmEdit();
              }
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditTarget(null);
              setEditName("");
              setEditPasscode("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmEdit}
            disabled={!editName.trim() || editPasscode.replace(/\D/g, "").length !== 6 || saving}
            sx={{
              color:
                !editName.trim() ||
                editPasscode.replace(/\D/g, "").length !== 6 ||
                saving
                  ? undefined
                  : "#9a3412",
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Students;
