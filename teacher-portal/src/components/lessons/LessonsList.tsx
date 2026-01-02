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
  onNotify,
}: LessonsListProps) => {
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [iconLesson, setIconLesson] = useState<Lesson | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconError, setIconError] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);

  useEffect(() => {
    return () => {
      if (iconPreview) {
        URL.revokeObjectURL(iconPreview);
      }
    };
  }, [iconPreview]);

  const resetIconDialog = () => {
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
    }
    setIconDialogOpen(false);
    setIconLesson(null);
    setIconFile(null);
    setIconPreview(null);
    setIconError("");
    setUploadingIcon(false);
  };

  const handleOpenIconDialog = (lesson: Lesson) => {
    setIconLesson(lesson);
    setIconDialogOpen(true);
    setIconError("");
  };

  const handleIconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
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

  const handleUploadIcon = async () => {
    if (!iconLesson || !iconFile) {
      setIconError("Choose a square image at least 64x64.");
      return;
    }
    setUploadingIcon(true);
    const url = await onUploadIcon(iconLesson.id, iconFile);
    if (!url) {
      onNotify("Failed to upload lesson icon", "error");
      setUploadingIcon(false);
      return;
    }
    resetIconDialog();
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
      <Box sx={{ flex: 1, overflowY: "auto", px: 0, pb: 0 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <Box width="10rem">
              <LinearProgress />
            </Box>
          </Box>
        ) : lessons.length ? (
          <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {lessons.map((lesson) => {
              const highlight = getStatusHighlight(lesson.status);
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
                      backgroundColor: "#fff",
                      backgroundImage:
                        "linear-gradient(135deg, #ff6f00 0%, #00b0ff 100%)",
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
                        top: 6,
                        left: 6,
                        width: 10,
                        height: 10,
                        borderRadius: "999px",
                        bgcolor: getStatusBadgeColor(lesson.status),
                        border: "1px solid #fff",
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
                        "&:hover": {
                          backgroundColor: "rgba(255,255,255,1)",
                        },
                      }}
                    >
                      <EditRoundedIcon fontSize="inherit" />
                    </IconButton>
                    {lesson.iconUrl ? (
                      <img
                        src={lesson.iconUrl}
                        alt="Lesson"
                        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }}
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
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {lesson.status}
                      </Typography>
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
        <DialogTitle>Update lesson icon</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Upload a square image at least 64x64.
          </Typography>
          <Box
            sx={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 2,
              border: "1px dashed rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fafafa",
              overflow: "hidden",
            }}
          >
            {iconPreview ? (
              <img
                src={iconPreview}
                alt="Icon preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
          <Button variant="outlined" component="label">
            Choose image
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleIconFileChange}
            />
          </Button>
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LessonsList;
