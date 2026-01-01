import { useEffect, useRef, useState } from "react";
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
  IconButton,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { Lesson } from "../../state/lessonTypes";
import { useLessonSections } from "../../hooks/useLessonSections";
import SectionEditor from "./SectionEditor";
import type { GetAccessTokenSilently } from "../../auth/buildAuthHeaders";

type LessonWorkspaceProps = {
  lesson: Lesson | null;
  hasLessons: boolean;
  isAuthenticated: boolean;
  onUpdateTitle: (lessonId: string, title: string) => Promise<Lesson | null>;
  onUpdateContent: (
    lessonId: string,
    content: string
  ) => Promise<Lesson | null>;
  onUpdateStatus: (lessonId: string, status: string) => Promise<Lesson | null>;
  onNotify: (message: string, severity: "success" | "error") => void;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
};

const LessonWorkspace = ({
  lesson,
  hasLessons,
  isAuthenticated,
  onUpdateTitle,
  onUpdateContent,
  onUpdateStatus,
  onNotify,
  getAccessTokenSilently,
  onPulse,
}: LessonWorkspaceProps) => {
  const [titleDraft, setTitleDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const prevContentsRef = useRef<Record<string, string>>({});

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
    onPulse,
  });

  useEffect(() => {
    setTitleDraft(lesson?.title || "");
    setContentDraft(lesson?.content || "");
  }, [lesson]);

  useEffect(() => {
    setExpandedKeys({});
    setDrafts({});
    setEditingKey(null);
    setConfirmClose(null);
  }, [lesson?.id]);

  useEffect(() => {
    if (!lesson) {
      return;
    }
    sections.forEach((section) => {
      loadSection(section.key);
    });
  }, [lesson, loadSection, sections]);

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
      const previous = prevContentsRef.current;
      Object.entries(contents).forEach(([key, value]) => {
        const priorContent = previous[key];
        const currentDraft = prev[key];
        if (currentDraft === undefined || currentDraft === priorContent) {
          next[key] = value ?? "";
        }
      });
      prevContentsRef.current = { ...contents };
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

  const handleSaveContent = async () => {
    if (!lesson) {
      return;
    }
    const trimmed = contentDraft.trim();
    const current = (lesson.content || "").trim();
    if (trimmed === current) {
      setContentDraft(lesson.content || "");
      return;
    }
    setSavingContent(true);
    await onUpdateContent(lesson.id, trimmed);
    setSavingContent(false);
  };

  const handlePublish = async () => {
    if (!lesson) {
      return;
    }
    await onUpdateStatus(lesson.id, "published");
    setPublishOpen(false);
  };

  const handleAccordionChange =
    (key: string) => (_: unknown, expanded: boolean) => {
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
            <Typography color="text.secondary">
              Press the + icon below
            </Typography>
          </>
        )}
      </Box>
    );
  }

  const statusValue = lesson.status?.toLowerCase() || "draft";
  const isPublished =
    statusValue.includes("publish") || statusValue.includes("active");
  const canEdit = !isPublished;
  const allSectionsFilled =
    sections.length > 0 &&
    sections.every((section) => (contents[section.key] || "").trim().length > 0);
  const statusLabel = isPublished ? "Published" : allSectionsFilled ? "Ready" : "Draft";

  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 0,
          width: "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0,
            flexWrap: "nowrap",
            width: "100%",
          }}
        >
          <Box
            sx={{
              position: "relative",
              flex: 1,
              minWidth: 260,
              maxWidth: "100%",
              "&:hover .lesson-edit-button": { opacity: 1 },
            }}
          >
            {editingTitle ? (
              <TextField
                label="Title"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  handleSaveTitle();
                  setEditingTitle(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSaveTitle();
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                fullWidth
                disabled={!isAuthenticated || savingTitle}
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: "1rem" },
                }}
              />
            ) : (
              <Box
                onClick={() => {
                  if (canEdit) {
                    setEditingTitle(true);
                  }
                }}
                sx={{
                  border: "1px solid transparent",
                  borderRadius: "1rem",
                  px: 0,
                  py: 0,
                  minHeight: 64,
                  display: "flex",
                  alignItems: "center",
                  cursor: canEdit ? "text" : "default",
                  backgroundColor: "transparent",
                }}
              >
                <Typography variant="h2">
                  {titleDraft || "Untitled lesson"}
                </Typography>
              </Box>
            )}
            {!editingTitle && canEdit ? (
              <IconButton
                className="lesson-edit-button"
                onClick={() => setEditingTitle(true)}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: "2rem",
                  opacity: 0,
                  transition: "opacity 0.2s ease",
                  color: "primary.main",
                  backgroundColor: "transparent",
                  border: "none",
                  "&:hover": { backgroundColor: "action.hover" },
                }}
              >
                <EditRoundedIcon />
              </IconButton>
            ) : null}
          </Box>
          <Box
            sx={{
              minWidth: 180,
              marginLeft: "auto",
              textAlign: "right",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-end",
              gap: 2,
            }}
          >
            <IconButton
              onClick={() => onNotify("Report generation coming soon.", "success")}
              disabled={!isPublished}
              sx={{
                height: 56,
                width: 44,
                borderRadius: "0.75rem",
                color: isPublished ? "primary.main" : "text.disabled",
                backgroundColor: "transparent",
                "&:hover": { backgroundColor: isPublished ? "action.hover" : "transparent" },
              }}
            >
              <PrintRoundedIcon />
            </IconButton>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: "5rem",
                  backgroundColor: isPublished
                    ? "success.main"
                    : statusLabel === "Ready"
                      ? "warning.main"
                      : "error.main",
                  color: "common.white",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  cursor: statusLabel === "Ready" ? "pointer" : "default",
                  animation:
                    statusLabel === "Ready"
                      ? "statusPulse 1.8s ease-in-out infinite"
                      : "none",
                }}
                onClick={() => {
                  if (statusLabel === "Ready") {
                    setPublishOpen(true);
                  }
                }}
              >
                {statusLabel}
              </Box>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                {lesson.id}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            mt: 1,
            "&:hover .lesson-edit-button": { opacity: 1 },
          }}
        >
          {editingSummary ? (
            <TextField
              label="Summary"
              value={contentDraft}
              onChange={(event) => setContentDraft(event.target.value)}
              onBlur={() => {
                handleSaveContent();
                setEditingSummary(false);
              }}
              fullWidth
              disabled={!isAuthenticated || savingContent}
              minRows={2}
              maxRows={2}
              multiline
              autoFocus
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: "1rem" },
              }}
            />
          ) : (
            <Box
              onClick={() => {
                if (canEdit) {
                  setEditingSummary(true);
                }
              }}
              sx={{
                border: "1px solid transparent",
                borderRadius: "1rem",
                px: 0,
                py: 0,
                minHeight: 96,
                cursor: canEdit ? "text" : "default",
                backgroundColor: "transparent",
              }}
            >
              <Typography variant="h6" color="text.secondary">
                {contentDraft || "Add a short report summary."}
              </Typography>
            </Box>
          )}
          {!editingSummary && canEdit ? (
            <IconButton
              className="lesson-edit-button"
              onClick={() => setEditingSummary(true)}
              sx={{
                position: "absolute",
                top: 8,
                right: 0,
                opacity: 0,
                transition: "opacity 0.2s ease",
                color: "primary.main",
                backgroundColor: "transparent",
                border: "none",
                "&:hover": { backgroundColor: "action.hover" },
              }}
            >
              <EditRoundedIcon />
            </IconButton>
          ) : null}
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0, mt: -1 }}>
        {loadingIndex ? (
          <Box display="flex" justifyContent="center">
            <Box width="10rem">
              <LinearProgress />
            </Box>
          </Box>
        ) : (
          sections.map((section) => {
            const isExpanded = Boolean(expandedKeys[section.key]);
            const isEditingSection = editingKey === section.key;
            const content = isEditingSection
              ? drafts[section.key] ?? ""
              : contents[section.key] ?? drafts[section.key] ?? "";
            return (
              <Accordion
                key={section.key}
                expanded={isExpanded}
                onChange={handleAccordionChange(section.key)}
                sx={{
                  "&:first-of-type": {
                    borderTop: "1px solid",
                    borderColor: "divider",
                  },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography
                    variant="h3"
                    sx={{ fontSize: "1.05rem", color: "#1565c0" }}
                  >
                    {section.key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (char) => char.toUpperCase())}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    p: 0,
                    mt: -4,
                  }}
                >
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
                      disabled={loadingSection[section.key] || !canEdit}
                      dirty={
                        (drafts[section.key] ?? "") !==
                        (contents[section.key] ?? "")
                      }
                      editorKey={section.key}
                      isEditing={isEditingSection}
                      onToggleEdit={() => {
                        if (canEdit) {
                          setEditingKey(section.key);
                        }
                      }}
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
      <Dialog
        open={Boolean(confirmClose)}
        onClose={() => setConfirmClose(null)}
      >
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            You have unsaved changes. Closing will discard them.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClose(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmClose}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={publishOpen} onClose={() => setPublishOpen(false)}>
        <DialogTitle>Publish lesson?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This will publish the lesson. Once published, it can’t be unpublished.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePublish}>
            Publish
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LessonWorkspace;
