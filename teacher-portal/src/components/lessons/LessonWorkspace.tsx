import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
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
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Viewer } from "@toast-ui/react-editor";
import { Lesson } from "../../state/lessonTypes";
import { useLessonSections } from "../../hooks/useLessonSections";
import SectionEditor from "./SectionEditor";
import { buildAuthHeaders } from "../../auth/buildAuthHeaders";
import { createLessonReport, fetchLessonReport } from "../../api/lessons";
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
  const [printSelections, setPrintSelections] = useState<
    Record<string, boolean>
  >({});
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
    refreshSection,
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
    if (!sections.length) {
      setPrintSelections({});
      return;
    }
    setPrintSelections((prev) => {
      const next: Record<string, boolean> = {};
      sections.forEach((section) => {
        next[section.key] = prev[section.key] ?? true;
      });
      return next;
    });
  }, [sections]);

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
    try {
      await ensureReportUrl();
    } catch {
      // Report generation is best-effort on publish.
    }
    setPublishOpen(false);
  };

  const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API || "";
  const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";

  const buildReportHtml = (includePrintScript: boolean) => {
    if (!lesson) {
      return "";
    }
    const selectedSections = sections.filter(
      (section) => printSelections[section.key] ?? true
    );
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const summaryHtml = contentDraft
      ? `<p class="summary">${escapeHtml(contentDraft)}</p>`
      : "";
    const hasSections = selectedSections.length > 0;
    const footerHtml =
      "(C) TeachNLearn - Individualised Lessons for each child";
    const tocHtml = selectedSections
      .map((section) => {
        const heading = section.key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        return `<li><a href="#section-${section.key}">${escapeHtml(
          heading
        )}</a></li>`;
      })
      .join("");
    const sectionHtml = selectedSections
      .map((section) => {
        const heading = section.key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        const bodyHtml = document.querySelector(
          `[data-section-preview="${section.key}"]`
        )?.innerHTML;
        return `
          <section class="section-block" id="section-${section.key}">
            <h2>${escapeHtml(heading)}</h2>
            <div class="section-body">${bodyHtml || ""}</div>
          </section>
        `;
      })
      .join("");
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(titleDraft || lesson.title || "Lesson")}</title>
          <link rel="stylesheet" href="https://uicdn.toast.com/editor/latest/toastui-editor.css">
          <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: "Helvetica Neue", Arial, sans-serif; padding: 32px; color: #1f2933; }
            h1 { font-size: 24px; margin: 0 0 8px; }
            h2 { font-size: 18px; margin: 24px 0 8px; color: #1f63b5; }
            .summary { margin: 0; color: #4b5563; text-align: left; max-width: 720px; }
            .section-body {
              line-height: 1.6;
              border: none;
              border-radius: 12px;
              padding: 16px;
              background: #fff;
            }
            .section-block {
              position: relative;
              padding-bottom: 48px;
            }
            .section-block + .section-block {
              break-before: page;
              page-break-before: always;
            }
            .section-body table,
            .section-body th,
            .section-body td {
              border: none !important;
            }
            .cover-page {
              break-after: page;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              gap: 10rem;
            }
            .cover-logo { margin-top: 4rem; }
            .cover-title { text-align: center; margin: 0; }
            .cover-title-wrap {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
            }
            .cover-summary {
              margin: 0;
              width: 100%;
              max-width: 720px;
              align-self: flex-start;
            }
            .cover-summary .summary { text-align: left; }
            .toc-block {
              margin-top: -6rem;
            }
            .toc { margin: 24px 0 0; padding-left: 18px; }
            .toc li { margin-bottom: 6px; }
            .toc a { color: #1f63b5; text-decoration: none; }
            .toc a:hover { text-decoration: underline; }
            .logo { max-width: 160px; margin: 0; }
            .page-footer {
              position: fixed;
              bottom: 16px;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <section class="cover-page">
            <img class="logo cover-logo" src="${
              window.location.origin
            }/logo.png" alt="Logo" />
            <div class="cover-title-wrap">
              <h1 class="cover-title">${escapeHtml(
                titleDraft || lesson.title || "Lesson"
              )}</h1>
            </div>
            <div class="cover-summary">
              ${summaryHtml}
            </div>
          ${
            hasSections
              ? `<div class="toc-block">
              <h2>Table of Contents</h2>
              <ol class="toc">${tocHtml}</ol>
            </div>`
              : ""
          }
          </section>
          ${sectionHtml}
          <footer class="page-footer">${escapeHtml(footerHtml)}</footer>
          ${
            includePrintScript
              ? `<script>
            window.onload = () => {
              window.print();
            };
          </script>`
              : `<script>
            window.onload = () => {
            };
          </script>`
          }
        </body>
      </html>
    `;
  };

  const ensureSectionPreviews = async (keys: string[]) => {
    if (!keys.length) {
      return;
    }
    await Promise.all(keys.map((key) => loadSection(key)));
    const waitForPreview = (key: string) =>
      new Promise<void>((resolve) => {
        let attempts = 0;
        const check = () => {
          const node = document.querySelector(`[data-section-preview="${key}"]`);
          if (node?.innerHTML) {
            resolve();
            return;
          }
          attempts += 1;
          if (attempts > 20) {
            resolve();
            return;
          }
          window.setTimeout(check, 50);
        };
        check();
      });
    await Promise.all(keys.map((key) => waitForPreview(key)));
  };

  const ensureReportUrl = async (options?: { forceCreate?: boolean }) => {
    if (!lesson || !apiBaseUrl || !auth0Audience) {
      return null;
    }
    const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
    const endpoint = `${apiBaseUrl}/lesson/id/${lesson.id}/report`;
    if (!options?.forceCreate) {
      try {
        const existing = await fetchLessonReport(endpoint, headers);
        if (existing.url) {
          return existing.url;
        }
      } catch {
        // continue
      }
    }
    const selectedKeys = sections
      .filter((section) => printSelections[section.key] ?? true)
      .map((section) => section.key);
    await ensureSectionPreviews(selectedKeys);
    const html = buildReportHtml(false);
    if (!html) {
      return null;
    }
    const created = await createLessonReport(endpoint, headers, { html });
    return created.url || null;
  };

  const handleOpenReport = async () => {
    if (!lesson) {
      return;
    }
    const url = await ensureReportUrl({ forceCreate: true });
    if (!url) {
      return;
    }
    await navigator.clipboard.writeText(url);
    window.open(url, "_blank", "noopener,noreferrer");
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
    sections.every(
      (section) => (contents[section.key] || "").trim().length > 0
    );
  const statusLabel = isPublished
    ? "Published"
    : allSectionsFilled
    ? "Ready"
    : "Draft";

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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
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
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 1, textAlign: "center" }}
              >
                {lesson.id}
              </Typography>
            </Box>
            <IconButton
              onClick={() => {
                if (!isPublished) {
                  return;
                }
                handleOpenReport();
              }}
              disabled={!isPublished}
              sx={{
                height: 56,
                width: 44,
                borderRadius: "0.75rem",
                color: isPublished ? "primary.main" : "text.disabled",
                backgroundColor: "transparent",
                "&:hover": {
                  backgroundColor: isPublished ? "action.hover" : "transparent",
                },
              }}
            >
              <OpenInNewRoundedIcon />
            </IconButton>
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
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {isPublished ? (
                      <Checkbox
                        checked={printSelections[section.key] ?? true}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onChange={(event) => {
                          setPrintSelections((prev) => ({
                            ...prev,
                            [section.key]: event.target.checked,
                          }));
                        }}
                        size="small"
                        sx={{ p: 0.5 }}
                      />
                    ) : null}
                    <Typography
                      variant="h3"
                      sx={{ fontSize: "1.05rem", color: "#1565c0" }}
                    >
                      {section.key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </Typography>
                  </Box>
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
            This will publish the lesson. Once published, it can’t be
            unpublished.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePublish}>
            Publish
          </Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ display: "none" }}>
        {sections.map((section) => {
          const value = contents[section.key] || "";
          const hash = value
            .split("")
            .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
          return (
            <Box
              key={`render-${section.key}-${hash}`}
              data-section-preview={section.key}
            >
              <Viewer initialValue={value} />
            </Box>
          );
        })}
      </Box>
      <Box className="print-only">
        <Typography variant="h2" sx={{ mb: 1 }}>
          {titleDraft || lesson.title}
        </Typography>
        {contentDraft ? (
          <Typography variant="subtitle1" sx={{ mb: 3 }}>
            {contentDraft}
          </Typography>
        ) : null}
        {sections
          .filter((section) => printSelections[section.key] ?? true)
          .map((section) => (
            <Box key={`print-${section.key}`} sx={{ mb: 3 }}>
              <Typography variant="h4" sx={{ mb: 1 }}>
                {section.key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (char) => char.toUpperCase())}
              </Typography>
              <Viewer initialValue={contents[section.key] || ""} />
            </Box>
          ))}
      </Box>
    </>
  );
};

export default LessonWorkspace;
