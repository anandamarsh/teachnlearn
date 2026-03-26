import { ChangeEvent, useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { Lesson } from "../../state/lessonTypes";

type LessonsListProps = {
  lessons: Lesson[];
  selectedLessonId: string | null;
  leftOpen: boolean;
  loading: boolean;
  onSelectLesson: (lessonId: string) => void;
  onToggleLeft: () => void;
  onUploadIcon: (lessonId: string, file: File) => Promise<string | null>;
  onDeleteLesson: (lessonId: string) => Promise<boolean>;
  onNotify: (message: string, severity: "success" | "error") => void;
};

const LessonsList = ({
  lessons,
  selectedLessonId,
  leftOpen,
  loading,
  onSelectLesson,
  onToggleLeft,
  onUploadIcon,
  onDeleteLesson,
  onNotify,
}: LessonsListProps) => {
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [iconLesson, setIconLesson] = useState<Lesson | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconError, setIconError] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deleteLesson, setDeleteLesson] = useState<Lesson | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingLesson, setDeletingLesson] = useState(false);

  useEffect(() => {
    return () => {
      if (iconPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(iconPreview);
      }
    };
  }, [iconPreview]);

  const resetIconDialog = () => {
    if (iconPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(iconPreview);
    }
    setIconDialogOpen(false);
    setIconLesson(null);
    setIconFile(null);
    setIconPreview(null);
    setIconError("");
    setUploadingIcon(false);
    setDragActive(false);
  };

  const handleOpenIconDialog = (lesson: Lesson) => {
    setIconLesson(lesson);
    if (lesson.iconUrl) {
      setIconPreview(lesson.iconUrl);
    } else {
      setIconPreview(null);
    }
    setIconDialogOpen(true);
    setIconError("");
  };

  const handleIconFile = (file: File | null) => {
    if (!file) {
      return;
    }
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
    }
    setIconError("");
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width !== img.height) {
        setIconError("Icon must be square.");
        setIconFile(null);
        URL.revokeObjectURL(objectUrl);
        return;
      }
      if (img.width < 64 || img.height < 64) {
        setIconError("Icon must be at least 64x64.");
        setIconFile(null);
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setIconFile(file);
      setIconPreview(objectUrl);
    };
    img.onerror = () => {
      setIconError("Could not read image file.");
      setIconFile(null);
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const handleIconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    handleIconFile(file);
  };

  const handleUploadIcon = async () => {
    if (!iconLesson || !iconFile) {
      setIconError("Choose a square image at least 64x64.");
      return;
    }
    setUploadingIcon(true);
    const url = await onUploadIcon(iconLesson.id, iconFile);
    if (!url) {
      onNotify("Failed to upload template cover", "error");
      setUploadingIcon(false);
      return;
    }
    resetIconDialog();
  };

  const resetDeleteDialog = () => {
    setDeleteLesson(null);
    setDeleteConfirmText("");
    setDeletingLesson(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteLesson) {
      return;
    }
    if (deleteConfirmText.trim().toLowerCase() !== "delete") {
      return;
    }
    setDeletingLesson(true);
    const deleted = await onDeleteLesson(deleteLesson.id);
    setDeletingLesson(false);
    if (deleted) {
      onNotify("Lesson deleted", "success");
      resetDeleteDialog();
    }
  };
  const getStatusBadgeColor = (status?: string | null) => {
    const normalized = (status || "").toLowerCase().trim();
    if (normalized.includes("publish") || normalized.includes("active")) {
      return "success.main";
    }
    if (normalized.includes("ready")) {
      return "warning.main";
    }
    return "error.main";
  };

  const getStatusHighlight = (status?: string | null) => {
    const normalized = (status || "").toLowerCase().trim();
    if (normalized.includes("publish") || normalized.includes("active")) {
      return {
        background: "rgba(46,125,50,0.18)",
        hover: "rgba(46,125,50,0.26)",
      };
    }
    if (normalized.includes("ready")) {
      return {
        background: "rgba(245,124,0,0.18)",
        hover: "rgba(245,124,0,0.26)",
      };
    }
    return {
      background: "rgba(211,47,47,0.18)",
      hover: "rgba(211,47,47,0.26)",
    };
  };

  const HIDDEN_BASE_KEYS = new Set(["samples", "references"]);
  const getBaseKey = (key: string) => {
    const match = key.match(/^([a-z_]+)-\d+$/);
    return match ? match[1] : key;
  };

  const getDerivedStatus = (lesson: Lesson) => {
    const normalized = (lesson.status || "").toLowerCase().trim();
    if (normalized.includes("publish") || normalized.includes("active")) {
      return lesson.status;
    }
    if (!lesson.sectionsMeta) {
      return lesson.status;
    }
    const keys = lesson.sections
      ? Object.keys(lesson.sections)
      : Object.keys(lesson.sectionsMeta);
    if (!keys.length) {
      return lesson.status;
    }
    const filled = keys
      .filter((key) => !HIDDEN_BASE_KEYS.has(getBaseKey(key)))
      .every((key) => {
        const meta = lesson.sectionsMeta?.[key] as
          | { contentLength?: number; content_length?: number }
          | undefined;
        const length = meta?.contentLength ?? meta?.content_length;
        return typeof length === "number" && length > 0;
      });
    return filled ? "Ready" : lesson.status;
  };

  const withCacheBuster = (url: string, token?: string | null) => {
    if (!token) {
      return url;
    }
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}v=${encodeURIComponent(token)}`;
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: leftOpen ? "flex-end" : "center",
          px: 0,
        }}
      >
        <IconButton color="primary" onClick={onToggleLeft}>
          {leftOpen ? <ChevronLeftRoundedIcon /> : <MenuRoundedIcon />}
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", px: 0, pb: 8 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <Box width="10rem">
              <LinearProgress />
            </Box>
          </Box>
        ) : lessons.length ? (
          <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {lessons.map((lesson) => {
              const derivedStatus = getDerivedStatus(lesson);
              const highlight = getStatusHighlight(derivedStatus);
              const iconSrc = lesson.iconUrl
                ? withCacheBuster(lesson.iconUrl, lesson.updated_at)
                : null;
              return (
                <ListItemButton
                  key={lesson.id}
                  selected={selectedLessonId === lesson.id}
                  onClick={() => onSelectLesson(lesson.id)}
                  sx={{
                    borderRadius: 4,
                    px: leftOpen ? 1 : 0.5,
                    py: 0.5,
                    justifyContent: leftOpen ? "flex-start" : "center",
                    "&.Mui-selected": {
                      backgroundColor: highlight.background,
                    },
                    "&.Mui-selected:hover": {
                      backgroundColor: highlight.hover,
                    },
                    "&:hover .lesson-icon-action": {
                      opacity: 1,
                    },
                  }}
                >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: leftOpen ? 1.5 : 0,
                    justifyContent: "center",
                  }}
                >
                    <Box
                      sx={{
                        position: "relative",
                        width: "4rem",
                        height: "4rem",
                        borderRadius: "8px",
                      backgroundColor: iconSrc ? "transparent" : "#fff",
                      backgroundImage: iconSrc
                        ? "none"
                        : "linear-gradient(135deg, #ff6f00 0%, #00b0ff 100%)",
                        my: "0.25rem",
                        display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "1.4rem",
                      color: "#ffffff",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 15,
                        height: 15,
                        borderRadius: "999px",
                        backgroundColor: getStatusBadgeColor(derivedStatus),
                        border: "1px solid #fff",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
                        zIndex: 2,
                      }}
                    />
                    <IconButton
                      className="lesson-icon-action"
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenIconDialog(lesson);
                      }}
                      sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        opacity: 0,
                        transition: "opacity 0.2s ease",
                        backgroundColor: "rgba(255,255,255,0.92)",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                        zIndex: 2,
                        "&:hover": {
                          backgroundColor: "rgba(255,255,255,1)",
                        },
                      }}
                    >
                      <EditRoundedIcon fontSize="inherit" />
                    </IconButton>
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt="Lesson template"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          opacity: 0.8,
                          zIndex: 1,
                        }}
                      />
                    ) : (
                      (lesson.title?.trim()?.charAt(0).toUpperCase() || "L")
                    )}
                  </Box>
                </ListItemIcon>
                {leftOpen ? (
                  <ListItemText
                    primary={
                      <Typography variant="body1" fontWeight={600} noWrap>
                        {lesson.title}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            px: 0.9,
                            py: 0.15,
                            borderRadius: "999px",
                            border: "1px solid rgba(0,0,0,0.12)",
                            color: "text.secondary",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            textTransform: "capitalize",
                            backgroundColor: "#fff",
                          }}
                        >
                          {derivedStatus}
                        </Box>
                        <IconButton
                          size="small"
                          aria-label={`Delete ${lesson.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteLesson(lesson);
                            setDeleteConfirmText("");
                          }}
                          sx={{ color: "error.main", p: 0.25 }}
                        >
                          <DeleteRoundedIcon fontSize="inherit" />
                        </IconButton>
                      </Box>
                    }
                  />
                ) : null}
              </ListItemButton>
              );
            })}
          </List>
        ) : null}
      </Box>
      <Dialog open={iconDialogOpen} onClose={resetIconDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Update template cover</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Upload a square image at least 64x64.
          </Typography>
          <Box
            sx={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 2,
              border: dragActive ? "2px solid #e65100" : "1px dashed rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: dragActive ? "rgba(230,81,0,0.08)" : "#fafafa",
              overflow: "hidden",
              transition: "border 160ms ease, background-color 160ms ease",
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0] || null;
              handleIconFile(file);
              setDragActive(false);
            }}
          >
            {iconPreview ? (
              <img
                src={iconPreview}
                alt="Icon preview"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No image selected
              </Typography>
            )}
          </Box>
          {iconError ? (
            <Typography variant="caption" color="error">
              {iconError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button variant="outlined" component="label">
            Choose image
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleIconFileChange}
            />
          </Button>
          <Box display="flex" gap={1}>
            <Button onClick={resetIconDialog} disabled={uploadingIcon}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleUploadIcon}
              disabled={uploadingIcon || !iconFile}
            >
              {uploadingIcon ? "Uploading..." : "Upload"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(deleteLesson)} onClose={resetDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Delete lesson</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete this lesson. Type <strong>Delete</strong> to confirm.
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {deleteLesson?.title}
          </Typography>
          <input
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder="Type Delete"
            style={{
              width: "100%",
              padding: "0.875rem 1rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(0,0,0,0.18)",
              font: "inherit",
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={resetDeleteDialog} disabled={deletingLesson}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              void handleConfirmDelete();
            }}
            disabled={deletingLesson || deleteConfirmText.trim().toLowerCase() !== "delete"}
          >
            {deletingLesson ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LessonsList;
