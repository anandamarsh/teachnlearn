import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  Alert,
  Box,
  ButtonBase,
  Snackbar,
  Dialog,
  IconButton,
  LinearProgress,
  Button,
  Slide,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type { SlideProps } from "@mui/material/Slide";
import ToastViewer from "@toast-ui/editor/viewer";
import type { ViewerOptions } from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import { renderAsync } from "docx-preview";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import {
  buildAuthHeaders,
  type GetAccessTokenSilently,
} from "../../../../auth/buildAuthHeaders";
import {
  fetchTeacherLessonProgress,
  saveTeacherLessonComment,
  type TeacherLessonProgressAttachment,
  type TeacherLessonProgressPayload,
  type TeacherLessonProgressStudent,
} from "../../../../api/lessonProgress";

type ViewProgressStepProps = {
  apiBaseUrl: string;
  auth0Audience: string;
  lessonId: string;
  getAccessTokenSilently?: GetAccessTokenSilently;
  expanded: boolean;
  enabled: boolean;
  onNotify: (message: string, severity: "success" | "error") => void;
  onSummaryChange?: (summary: string) => void;
  onSummaryStatsChange?: (stats: {
    studentCount: number;
    answeredCount: number;
    partAnsweredCount: number;
    unansweredCount: number;
  }) => void;
};

const dotSx = {
  width: 12,
  height: 12,
  borderRadius: "999px",
  flexShrink: 0,
};

const BottomUpTransition = forwardRef(function BottomUpTransition(
  props: SlideProps,
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const isPdfAttachment = (name: string, contentType?: string) => {
  const normalizedName = String(name || "").toLowerCase();
  const normalizedType = String(contentType || "").toLowerCase();
  return normalizedName.endsWith(".pdf") || normalizedType.includes("pdf");
};

const isImageAttachment = (name: string, contentType?: string) => {
  const normalizedName = String(name || "").toLowerCase();
  const normalizedType = String(contentType || "").toLowerCase();
  return (
    normalizedType.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].some((ext) =>
      normalizedName.endsWith(ext),
    )
  );
};

const isWordAttachment = (name: string, contentType?: string) => {
  const normalizedName = String(name || "").toLowerCase();
  const normalizedType = String(contentType || "").toLowerCase();
  return (
    normalizedName.endsWith(".doc") ||
    normalizedName.endsWith(".docx") ||
    normalizedType.includes("msword") ||
    normalizedType.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
  );
};

const MarkdownResponseViewer = ({
  value,
}: {
  value: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<InstanceType<typeof ToastViewer> | null>(null);
  const lastValueRef = useRef(value || "");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const options: ViewerOptions = {
      el: container,
      initialValue: value || "",
    };
    const viewer = new ToastViewer(options);
    viewerRef.current = viewer;
    lastValueRef.current = value || "";
    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }
    const nextValue = value || "";
    if (lastValueRef.current === nextValue) {
      return;
    }
    viewer.setMarkdown(nextValue);
    lastValueRef.current = nextValue;
  }, [value]);

  return (
    <Box
      sx={{
        "& .toastui-editor-contents, & .toastui-editor-contents *": {
          fontFamily: "Roboto, Helvetica, Arial, sans-serif",
        },
        "& .toastui-editor-contents": {
          color: "#111827",
          lineHeight: 1.55,
        },
        "& .toastui-editor-contents table": {
          width: "100%",
          borderCollapse: "collapse",
          my: 2,
        },
        "& .toastui-editor-contents th, & .toastui-editor-contents td": {
          border: "1px solid rgba(0,0,0,0.14)",
          p: 1,
          textAlign: "left",
        },
        "& .toastui-editor-contents th": {
          backgroundColor: "#f2f2f2",
          color: "#111827",
        },
      }}
    >
      <Box ref={containerRef} />
    </Box>
  );
};

const AttachmentPreview = ({
  url,
  previewUrl,
  name,
  contentType,
  compact = false,
  fillHeight = false,
  getAccessTokenSilently,
  auth0Audience,
}: {
  url: string;
  previewUrl?: string;
  name: string;
  contentType?: string;
  compact?: boolean;
  fillHeight?: boolean;
  getAccessTokenSilently?: GetAccessTokenSilently;
  auth0Audience: string;
}) => {
  const [docxError, setDocxError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isWordAttachment(name, contentType) || !url) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let cancelled = false;
    container.innerHTML = "";
    setDocxError(null);

    const load = async () => {
      try {
        const headers =
          getAccessTokenSilently && previewUrl
            ? await buildAuthHeaders(getAccessTokenSilently, auth0Audience)
            : undefined;
        const response = await fetch(
          previewUrl || url,
          headers ? { headers } : undefined,
        );
        if (!response.ok) {
          throw new Error("Failed to load Word document preview");
        }
        const blob = await response.blob();
        if (cancelled || !containerRef.current) {
          return;
        }
        await renderAsync(blob, containerRef.current, undefined, {
          className: "docx-preview",
          ignoreWidth: false,
          ignoreHeight: true,
          breakPages: true,
        });
      } catch (error) {
        if (!cancelled) {
          setDocxError(
            error instanceof Error
              ? error.message
              : "Unable to preview this Word document",
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [
    auth0Audience,
    contentType,
    getAccessTokenSilently,
    name,
    previewUrl,
    url,
  ]);

  if (isImageAttachment(name, contentType)) {
    return (
      <Box
        component="img"
        src={url}
        alt={name}
        sx={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "0.6rem",
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      />
    );
  }

  if (isPdfAttachment(name, contentType)) {
    return (
      <Box
        component="iframe"
        src={url}
        title={name}
        sx={{
          width: "100%",
          height: fillHeight
            ? "100%"
            : compact
              ? "24rem"
              : "calc(100vh - 15rem)",
          minHeight: fillHeight ? 0 : compact ? "24rem" : "32rem",
          maxHeight: fillHeight
            ? "none"
            : compact
              ? "24rem"
              : "calc(100vh - 15rem)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "0.6rem",
          backgroundColor: "#fff",
        }}
      />
    );
  }

  if (isWordAttachment(name, contentType)) {
    return (
      <Box
        sx={{
          height: fillHeight ? "100%" : "auto",
          minHeight: 0,
        }}
      >
        <Box
          ref={(node: HTMLDivElement | null) => {
            containerRef.current = node;
          }}
          sx={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "0.6rem",
            backgroundColor: "#fff",
            height: fillHeight
              ? "100%"
              : compact
                ? "24rem"
                : "calc(100vh - 15rem)",
            minHeight: fillHeight ? 0 : compact ? "18rem" : "20rem",
            maxHeight: fillHeight
              ? "none"
              : compact
                ? "24rem"
                : "calc(100vh - 15rem)",
            overflow: "auto",
            p: 2,
            overscrollBehavior: "contain",
            "& .docx-preview": {
              color: "#111827",
              backgroundColor: "#fff",
              minHeight: "100%",
            },
            "& .docx-wrapper": {
              background: "#f3f4f6",
              padding: "1rem",
              minHeight: "100%",
              boxSizing: "border-box",
            },
            "& .docx-preview > section": {
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              marginLeft: "auto",
              marginRight: "auto",
              minHeight: "100%",
            },
          }}
        />
        {docxError ? (
          <Alert severity="warning" sx={{ mt: 1.25 }}>
            {docxError}
          </Alert>
        ) : null}
      </Box>
    );
  }

  return null;
};

const StudentResponsesDialog = ({
  student,
  open,
  onClose,
  lessonId,
  apiBaseUrl,
  auth0Audience,
  getAccessTokenSilently,
  onNotify,
}: {
  student: TeacherLessonProgressStudent | null;
  open: boolean;
  onClose: () => void;
  lessonId: string;
  apiBaseUrl: string;
  auth0Audience: string;
  getAccessTokenSilently?: GetAccessTokenSilently;
  onNotify: (message: string, severity: "success" | "error") => void;
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [savedComments, setSavedComments] = useState<Record<string, string>>(
    {},
  );
  const [savingCommentKey, setSavingCommentKey] = useState<string | null>(null);
  const [saveNoticeOpen, setSaveNoticeOpen] = useState(false);
  const [fullscreenAttachment, setFullscreenAttachment] =
    useState<TeacherLessonProgressAttachment | null>(null);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<
    string | null
  >(null);

  useEffect(() => {
    setSlideIndex(0);
  }, [student?.id]);

  useEffect(() => {
    if (!student) {
      setCommentDrafts({});
      setSavedComments({});
      return;
    }
    const nextComments = Object.fromEntries(
      student.responses.map((response) => [
        response.questionKey,
        response.teacherComment || "",
      ]),
    );
    setCommentDrafts(nextComments);
    setSavedComments(nextComments);
  }, [student]);

  useEffect(() => {
    setFullscreenAttachment(null);
  }, [slideIndex, student?.id]);

  const responses = student?.responses || [];
  const activeResponse = responses[slideIndex] || null;
  const previewableAttachments = (activeResponse?.attachments || []).filter(
    (attachment) =>
      attachment.url &&
      (isPdfAttachment(attachment.name, attachment.contentType) ||
        isImageAttachment(attachment.name, attachment.contentType) ||
        isWordAttachment(attachment.name, attachment.contentType)),
  );
  const commentsKey = activeResponse?.questionKey || "question";
  const commentDirty =
    (commentDrafts[commentsKey] || "") !== (savedComments[commentsKey] || "");

  useEffect(() => {
    if (!previewableAttachments.length) {
      setSelectedAttachmentId(null);
      return;
    }
    setSelectedAttachmentId((current) =>
      current &&
      previewableAttachments.some((attachment) => attachment.id === current)
        ? current
        : previewableAttachments[0]?.id || null,
    );
  }, [previewableAttachments]);

  const selectedPreviewAttachment =
    previewableAttachments.find(
      (attachment) => attachment.id === selectedAttachmentId,
    ) || previewableAttachments[0] || null;

  const resolvePreviewUrl = (attachment: TeacherLessonProgressAttachment) =>
    attachment.previewPath
      ? `${apiBaseUrl}${attachment.previewPath}`
      : undefined;

  const saveComment = async () => {
    if (!student || !activeResponse || !getAccessTokenSilently) {
      return;
    }
    const nextComment = commentDrafts[commentsKey] || "";
    if (nextComment === (savedComments[commentsKey] || "")) {
      return;
    }
    setSavingCommentKey(commentsKey);
    try {
      const headers = await buildAuthHeaders(
        getAccessTokenSilently,
        auth0Audience,
      );
      await saveTeacherLessonComment(
        `${apiBaseUrl}/teacher/lesson/${lessonId}/student/${student.id}/response-comment`,
        headers,
        {
          sectionKey: activeResponse.sectionKey,
          exerciseIndex: activeResponse.exerciseIndex,
          promptTitle: activeResponse.promptTitle || "",
          questionHtml: activeResponse.questionHtml || "",
          teacherComment: nextComment,
        },
      );
      setSavedComments((current) => ({
        ...current,
        [commentsKey]: nextComment,
      }));
      setSaveNoticeOpen(true);
    } catch (error) {
      onNotify(
        error instanceof Error
          ? error.message
          : "Failed to save teacher comment",
        "error",
      );
    } finally {
      setSavingCommentKey(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      TransitionComponent={BottomUpTransition}
      PaperProps={{
        sx: {
          bgcolor: "#f3f4f6",
          borderRadius: 0,
        },
      }}
    >
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            px: { xs: 2, md: 3 },
            pt: { xs: 2, md: 3 },
            pb: 2,
            bgcolor: "#f3f4f6",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Typography sx={{ fontSize: "1.4rem", fontWeight: 800 }}>
              {student?.name || "Student"}
            </Typography>
            <IconButton
              onClick={onClose}
              sx={{
                position: "fixed",
                top: { xs: 16, md: 24 },
                right: { xs: 16, md: 24 },
                zIndex: 4,
                width: 36,
                height: 36,
                borderRadius: "999px",
                bgcolor: "#c62828",
                color: "#fff",
                boxShadow: "none",
                "&:hover": {
                  bgcolor: "#b71c1c",
                },
              }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Box>

          {activeResponse ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 2,
                width: "100%",
              }}
            >
              <Typography sx={{ color: "text.secondary", fontWeight: 700 }}>
                Question {slideIndex + 1} of {responses.length}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <Box
                  component="button"
                  onClick={() =>
                    setSlideIndex((current) => Math.max(0, current - 1))
                  }
                  disabled={slideIndex === 0}
                  sx={{
                    border: "none",
                    background: "transparent",
                    color: "#616161",
                    p: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: slideIndex === 0 ? "default" : "pointer",
                    "&:hover": {
                      color: slideIndex === 0 ? "#bdbdbd" : "#2f2f2f",
                    },
                    "&:disabled": {
                      color: "#bdbdbd",
                    },
                  }}
                >
                  <ChevronLeftRoundedIcon />
                </Box>
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                  {responses.map((response, idx) => (
                    <Box
                      key={response.questionKey}
                      sx={{
                        ...dotSx,
                        bgcolor: response.answered ? "#2e7d32" : "#c7c7c7",
                        outline:
                          idx === slideIndex
                            ? "2px solid rgba(46,125,50,0.35)"
                            : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </Box>
                <Box
                  component="button"
                  onClick={() =>
                    setSlideIndex((current) =>
                      Math.min(responses.length - 1, current + 1),
                    )
                  }
                  disabled={slideIndex >= responses.length - 1}
                  sx={{
                    border: "none",
                    background: "transparent",
                    color: "#616161",
                    p: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor:
                      slideIndex >= responses.length - 1
                        ? "default"
                        : "pointer",
                    "&:hover": {
                      color:
                        slideIndex >= responses.length - 1
                          ? "#bdbdbd"
                          : "#2f2f2f",
                    },
                    "&:disabled": {
                      color: "#bdbdbd",
                    },
                  }}
                >
                  <ChevronRightRoundedIcon />
                </Box>
              </Box>
              <Box />
            </Box>
          ) : null}
        </Box>

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            px: { xs: 2, md: 3 },
            py: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {activeResponse ? (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    lg: previewableAttachments.length
                      ? "minmax(0, 1fr) minmax(0, 1fr)"
                      : "1fr",
                  },
                  gap: 2,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <Stack spacing={2} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      bgcolor: "#fff",
                      borderRadius: "0.9rem",
                      border: "1px solid rgba(0,0,0,0.08)",
                      p: 3,
                    }}
                  >
                    {activeResponse.promptTitle ? (
                      <Typography sx={{ fontWeight: 800, mb: 1.5 }}>
                        {activeResponse.promptTitle}
                      </Typography>
                    ) : null}
                    <Box
                      sx={{
                        "& table": {
                          width: "100%",
                          borderCollapse: "collapse",
                          my: 2,
                        },
                        "& th, & td": {
                          border: "1px solid rgba(0,0,0,0.14)",
                          p: 1,
                          textAlign: "left",
                        },
                      }}
                      dangerouslySetInnerHTML={{
                        __html:
                          activeResponse.questionHtml ||
                          "<p>No question content saved.</p>",
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      bgcolor: "#fff",
                      borderRadius: "0.9rem",
                      border: "1px solid rgba(0,0,0,0.08)",
                      p: 3,
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, mb: 1.5 }}>
                      Response
                    </Typography>
                    <MarkdownResponseViewer
                      key={commentsKey}
                      value={
                        activeResponse.answerMarkdown.trim() ||
                        "_No response saved._"
                      }
                    />
                  </Box>

                  <Box
                    sx={{
                      bgcolor: "#fff",
                      borderRadius: "0.9rem",
                      border: "1px solid rgba(0,0,0,0.08)",
                      p: 3,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        mb: 1.5,
                      }}
                    >
                      <Typography sx={{ fontWeight: 800 }}>Comments</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={
                          !commentDirty || savingCommentKey === commentsKey
                        }
                        onClick={() => {
                          void saveComment();
                        }}
                      >
                        Save
                      </Button>
                    </Box>
                    <TextField
                      key={commentsKey}
                      multiline
                      minRows={4}
                      fullWidth
                      placeholder="Leave comments here"
                      value={commentDrafts[commentsKey] || ""}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({
                          ...current,
                          [commentsKey]: event.target.value,
                        }))
                      }
                      helperText={
                        savingCommentKey === commentsKey ? "Saving..." : " "
                      }
                    />
                  </Box>
                </Stack>

                {previewableAttachments.length ? (
                  <Box
                    sx={{
                      minWidth: 0,
                      bgcolor: "#fff",
                      borderRadius: "0.9rem",
                      border: "1px solid rgba(0,0,0,0.08)",
                      p: 2,
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        mb: 1.25,
                      }}
                    >
                      <Tabs
                        value={selectedPreviewAttachment?.id || false}
                        onChange={(_, value: string) =>
                          setSelectedAttachmentId(value)
                        }
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                          minHeight: 0,
                          flex: 1,
                          "& .MuiTabs-flexContainer": {
                            gap: 0.75,
                          },
                          "& .MuiTabs-indicator": {
                            display: "none",
                          },
                        }}
                      >
                        {previewableAttachments.map((attachment) => (
                          <Tab
                            key={attachment.id}
                            value={attachment.id}
                            label={attachment.name}
                            sx={{
                              minHeight: 0,
                              minWidth: 0,
                              px: 1.5,
                              py: 0.75,
                              borderRadius: "999px",
                              border: "1px solid rgba(234,88,12,0.16)",
                              backgroundColor:
                                attachment.id === selectedPreviewAttachment?.id
                                  ? "#ffedd5"
                                  : "#fff8ef",
                              color: "#9a3412",
                              fontWeight: 700,
                              textTransform: "none",
                            }}
                          />
                        ))}
                      </Tabs>
                      {selectedPreviewAttachment ? (
                        <IconButton
                          onClick={() =>
                            setFullscreenAttachment(selectedPreviewAttachment)
                          }
                          size="small"
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: "0.7rem",
                            border: "1px solid rgba(0,0,0,0.12)",
                            color: "#374151",
                          }}
                        >
                          <OpenInFullRoundedIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Box>
                    <Box
                      sx={{
                        minWidth: 0,
                        minHeight: 0,
                        flex: 1,
                        overflow: "auto",
                      }}
                    >
                      {selectedPreviewAttachment?.url ? (
                        <AttachmentPreview
                          url={selectedPreviewAttachment.url}
                          previewUrl={resolvePreviewUrl(selectedPreviewAttachment)}
                          name={selectedPreviewAttachment.name}
                          contentType={selectedPreviewAttachment.contentType}
                          fillHeight
                          getAccessTokenSilently={getAccessTokenSilently}
                          auth0Audience={auth0Audience}
                        />
                      ) : (
                        <Alert severity="warning">
                          Attachment preview unavailable.
                        </Alert>
                      )}
                    </Box>
                  </Box>
                ) : null}
              </Box>
            </>
          ) : (
            <Alert severity="info">
              No saved responses for this student yet.
            </Alert>
          )}
        </Box>
      </Box>
      <Snackbar
        open={saveNoticeOpen}
        autoHideDuration={2500}
        onClose={() => setSaveNoticeOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSaveNoticeOpen(false)}
          severity="success"
          variant="filled"
          sx={{ bgcolor: "success.main", color: "#fff" }}
        >
          Data has been saved
        </Alert>
      </Snackbar>
      <Dialog
        open={Boolean(fullscreenAttachment)}
        onClose={() => setFullscreenAttachment(null)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: "#f3f4f6",
            borderRadius: 0,
          },
        }}
      >
        <Box
          sx={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <Typography
            sx={{
              position: "fixed",
              top: { xs: 16, md: 24 },
              left: { xs: 16, md: 24 },
              zIndex: 2,
              fontSize: "1.2rem",
              fontWeight: 800,
            }}
          >
            {fullscreenAttachment?.name || "Attachment preview"}
          </Typography>
          <IconButton
            onClick={() => setFullscreenAttachment(null)}
            sx={{
              position: "fixed",
              top: { xs: 16, md: 24 },
              right: { xs: 16, md: 24 },
              zIndex: 2,
              width: 36,
              height: 36,
              borderRadius: "999px",
              bgcolor: "#c62828",
              color: "#fff",
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#b71c1c",
              },
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
          {fullscreenAttachment?.url ? (
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                boxSizing: "border-box",
                pt: { xs: "4.5rem", md: "5rem" },
                overflow: "auto",
              }}
            >
              <AttachmentPreview
                url={fullscreenAttachment.url}
                previewUrl={resolvePreviewUrl(fullscreenAttachment)}
                name={fullscreenAttachment.name}
                contentType={fullscreenAttachment.contentType}
                fillHeight
                getAccessTokenSilently={getAccessTokenSilently}
                auth0Audience={auth0Audience}
              />
            </Box>
          ) : (
            <Alert severity="warning">Attachment preview unavailable.</Alert>
          )}
        </Box>
      </Dialog>
    </Dialog>
  );
};

const ViewProgressStep = ({
  apiBaseUrl,
  auth0Audience,
  lessonId,
  getAccessTokenSilently,
  expanded,
  enabled,
  onNotify,
  onSummaryChange,
  onSummaryStatsChange,
}: ViewProgressStepProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<TeacherLessonProgressPayload | null>(
    null,
  );
  const [selectedStudent, setSelectedStudent] =
    useState<TeacherLessonProgressStudent | null>(null);

  useEffect(() => {
    if (!enabled || !apiBaseUrl || !lessonId || !getAccessTokenSilently) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const headers = await buildAuthHeaders(
          getAccessTokenSilently,
          auth0Audience,
        );
        const nextPayload = await fetchTeacherLessonProgress(
          `${apiBaseUrl}/teacher/lesson/${lessonId}/progress`,
          headers,
        );
        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load lesson progress";
        setError(message);
        onNotify(message, "error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    auth0Audience,
    enabled,
    getAccessTokenSilently,
    lessonId,
    onNotify,
  ]);

  const summaryText = useMemo(() => {
    const summary = payload?.summary;
    if (!summary) {
      return "0 students - 0 answered, 0 part-answered, 0 unanswered";
    }
    return `${summary.studentCount} students - ${summary.answeredCount} answered, ${summary.partAnsweredCount} part-answered, ${summary.unansweredCount} unanswered`;
  }, [payload?.summary]);

  useEffect(() => {
    onSummaryChange?.(summaryText);
  }, [onSummaryChange, summaryText]);

  useEffect(() => {
    onSummaryStatsChange?.({
      studentCount: payload?.summary.studentCount ?? 0,
      answeredCount: payload?.summary.answeredCount ?? 0,
      partAnsweredCount: payload?.summary.partAnsweredCount ?? 0,
      unansweredCount: payload?.summary.unansweredCount ?? 0,
    });
  }, [onSummaryStatsChange, payload?.summary]);

  return (
    <Stack spacing={2}>
      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <Box width="10rem">
            <LinearProgress />
          </Box>
        </Box>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error && payload && payload.students.length === 0 ? (
        <Alert severity="info">
          No students found for this teacher account.
        </Alert>
      ) : null}

      {!loading && !error && payload && payload.questions.length === 0 ? (
        <Alert severity="info">
          No exercise questions have been published yet.
        </Alert>
      ) : null}

      {!loading && !error && payload?.students.length ? (
        <Stack spacing={1.25} sx={{ width: "100%", alignItems: "flex-start" }}>
          {payload.students.map((student) => (
            <ButtonBase
              key={student.id || student.name}
              onClick={() => setSelectedStudent(student)}
              sx={{
                width: "20rem",
                maxWidth: "100%",
                justifyContent: "space-between",
                alignItems: "center",
                textAlign: "left",
                px: 2,
                py: 1.5,
                borderRadius: "0.95rem",
                border: "1px solid rgba(0,0,0,0.08)",
                bgcolor: "#fff",
              }}
            >
              <Typography sx={{ fontWeight: 800, mr: 2 }}>
                {student.name}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  gap: 0.75,
                }}
              >
                {student.questionStates.map((answered, idx) => (
                  <Box
                    key={`${student.name}_${idx}`}
                    sx={{
                      ...dotSx,
                      bgcolor: answered ? "#2e7d32" : "#bdbdbd",
                    }}
                  />
                ))}
              </Box>
            </ButtonBase>
          ))}
        </Stack>
      ) : null}

      <StudentResponsesDialog
        student={selectedStudent}
        open={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        lessonId={lessonId}
        apiBaseUrl={apiBaseUrl}
        auth0Audience={auth0Audience}
        getAccessTokenSilently={getAccessTokenSilently}
        onNotify={onNotify}
      />
    </Stack>
  );
};

export default ViewProgressStep;
