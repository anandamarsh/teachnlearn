import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Lesson } from "../../state/lessonTypes";
import { useLessonSections } from "../../hooks/useLessonSections";
import SectionEditor from "./SectionEditor";
import type { GetAccessTokenSilently } from "../../auth/buildAuthHeaders";

type LessonWorkspaceProps = {
  lesson: Lesson | null;
  hasLessons: boolean;
  isAuthenticated: boolean;
  onUpdateTitle: (lessonId: string, title: string) => Promise<Lesson | null>;
  onNotify: (message: string, severity: "success" | "error") => void;
  getAccessTokenSilently: GetAccessTokenSilently;
};

const LessonWorkspace = ({
  lesson,
  hasLessons,
  isAuthenticated,
  onUpdateTitle,
  onNotify,
  getAccessTokenSilently,
}: LessonWorkspaceProps) => {
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const {
    sections,
    contents,
    loadingIndex,
    loadingSection,
    savingSection,
    error,
    setError,
    loadSection,
    saveSection,
  } = useLessonSections({
    apiBaseUrl: import.meta.env.VITE_TEACHNLEARN_API || "",
    auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE || "",
    lessonId: lesson?.id || null,
    isAuthenticated,
    getAccessTokenSilently,
  });

  useEffect(() => {
    setTitleDraft(lesson?.title || "");
  }, [lesson]);

  useEffect(() => {
    if (!error) {
      return;
    }
    onNotify(error, "error");
    setError("");
  }, [error, onNotify, setError]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      Object.entries(contents).forEach(([key, value]) => {
        if (next[key] === undefined) {
          next[key] = value;
        }
      });
      return next;
    });
  }, [contents]);

  const handleSaveTitle = async () => {
    if (!lesson) {
      return;
    }
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === lesson.title) {
      setTitleDraft(lesson.title);
      return;
    }
    setSavingTitle(true);
    await onUpdateTitle(lesson.id, trimmed);
    setSavingTitle(false);
  };

  const handleAccordionChange = (key: string) => (_: unknown, expanded: boolean) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: expanded }));
    if (expanded) {
      loadSection(key);
    }
  };

  const handleSaveSection = async (key: string) => {
    const contentMd = drafts[key] ?? "";
    const saved = await saveSection(key, contentMd);
    if (saved) {
      onNotify("Section saved", "success");
      setEditingKey(null);
    }
  };

  const handleConfirmClose = () => {
    if (!confirmClose) {
      return;
    }
    setEditingKey(null);
    setDrafts((prev) => ({
      ...prev,
      [confirmClose]: contents[confirmClose] ?? "",
    }));
    setConfirmClose(null);
  };

  if (!lesson) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {hasLessons ? (
          <>
            <Typography variant="h3" sx={{ mb: 1 }}>
              Select a lesson
            </Typography>
            <Typography color="text.secondary">
              Pick a lesson from the left panel to begin.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h3" sx={{ mb: 1, color: "#1565c0" }}>
              Create your first lesson
            </Typography>
            <Typography color="text.secondary">Press the + icon below</Typography>
          </>
        )}
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          flexWrap: "wrap",
          maxWidth: 720,
        }}
      >
        <TextField
          label="Title"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSaveTitle();
            }
          }}
          fullWidth
          disabled={!isAuthenticated || savingTitle}
          sx={{
            flex: 1,
            minWidth: 260,
            "& .MuiOutlinedInput-root": { borderRadius: "1rem" },
          }}
        />
        <Box sx={{ minWidth: 140 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
            {lesson.id}
          </Typography>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              px: 1.5,
              py: 0.5,
              borderRadius: "5rem",
              backgroundColor:
                lesson.status.toLowerCase().includes("publish") ||
                lesson.status.toLowerCase().includes("active")
                  ? "success.main"
                  : "grey.300",
              color:
                lesson.status.toLowerCase().includes("publish") ||
                lesson.status.toLowerCase().includes("active")
                  ? "common.white"
                  : "text.primary",
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {lesson.status}
          </Box>
        </Box>
      </Box>
      <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 0 }}>
        {loadingIndex ? (
          <Box display="flex" justifyContent="center">
            <Box width="10rem">
              <LinearProgress />
            </Box>
          </Box>
        ) : (
          sections.map((section) => {
            const isExpanded = Boolean(expandedKeys[section.key]);
            const content = drafts[section.key] ?? "";
            return (
              <Accordion
                key={section.key}
                expanded={isExpanded}
                onChange={handleAccordionChange(section.key)}
              >
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography variant="h3" sx={{ fontSize: "1.05rem", color: "#1565c0" }}>
                    {section.key.charAt(0).toUpperCase() + section.key.slice(1)}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {loadingSection[section.key] ? (
                    <Box display="flex" justifyContent="center">
                      <Box width="10rem">
                        <LinearProgress />
                      </Box>
                    </Box>
                  ) : (
                    <SectionEditor
                      content={content}
                      onChange={(value) =>
                        setDrafts((prev) => ({ ...prev, [section.key]: value }))
                      }
                      onSave={() => handleSaveSection(section.key)}
                      saving={savingSection[section.key]}
                      disabled={loadingSection[section.key]}
                      dirty={(drafts[section.key] ?? "") !== (contents[section.key] ?? "")}
                      editorKey={section.key}
                      isEditing={editingKey === section.key}
                      onToggleEdit={() => setEditingKey(section.key)}
                      onCancelEdit={() => {
                        setEditingKey(null);
                        setDrafts((prev) => ({
                          ...prev,
                          [section.key]: contents[section.key] ?? "",
                        }));
                      }}
                      onDirtyClose={() => setConfirmClose(section.key)}
                    />
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Box>
      <Dialog open={Boolean(confirmClose)} onClose={() => setConfirmClose(null)}>
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            You have unsaved changes. Closing will discard them.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClose(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmClose}>
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LessonWorkspace;
