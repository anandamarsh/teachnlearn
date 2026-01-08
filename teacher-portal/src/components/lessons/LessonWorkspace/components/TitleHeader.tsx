import {
  Box,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { useState } from "react";

type TitleHeaderProps = {
  titleDraft: string;
  editingTitle: boolean;
  savingTitle: boolean;
  isAuthenticated: boolean;
  canEdit: boolean;
  statusLabel: string;
  isPublished: boolean;
  lessonId: string;
  subjectValue: string;
  levelValue: string;
  savingMeta: boolean;
  deleteMode?: boolean;
  onSubjectChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onEditTitle: () => void;
  onTitleChange: (value: string) => void;
  onFinishTitle: () => void;
  onPublishClick: () => void;
  onUnpublishClick: () => void;
  onOpenReport: () => void;
  openingReport: boolean;
};

const TitleHeader = ({
  titleDraft,
  editingTitle,
  savingTitle,
  isAuthenticated,
  canEdit,
  statusLabel,
  isPublished,
  lessonId,
  subjectValue,
  levelValue,
  savingMeta,
  deleteMode,
  onSubjectChange,
  onLevelChange,
  onEditTitle,
  onTitleChange,
  onFinishTitle,
  onPublishClick,
  onUnpublishClick,
  onOpenReport,
  openingReport,
}: TitleHeaderProps) => {
  const subjectOptions = ["Maths", "English", "Science", "Other"];
  const levelOptions = [
    "Foundation",
    "Pre School",
    ...Array.from({ length: 12 }).map((_, idx) => `Year ${idx + 1}`),
  ];
  const [editingSubject, setEditingSubject] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);

  const normalizeOption = (value: string, options: string[]) => {
    const lowered = value.toLowerCase().trim();
    return options.find((option) => option.toLowerCase() === lowered) || value;
  };
  const subjectDisplay = subjectValue
    ? normalizeOption(subjectValue, subjectOptions)
    : "";
  const levelDisplay = levelValue
    ? normalizeOption(levelValue, levelOptions)
    : "";

  return (
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
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={onFinishTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onFinishTitle();
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
                onEditTitle();
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
            onClick={onEditTitle}
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
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0,
          flexWrap: "nowrap",
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", mr: "2rem", textAlign: "center" }}
        >
          {lessonId}
        </Typography>
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            mr: "1rem",
            "&:hover .lesson-meta-edit": { opacity: canEdit ? 1 : 0 },
          }}
        >
          {editingSubject && canEdit ? (
            <TextField
              select
              label="Subject"
              size="small"
              value={subjectDisplay || ""}
              onChange={(event) => {
                onSubjectChange(event.target.value);
                setEditingSubject(false);
              }}
              onBlur={() => setEditingSubject(false)}
              disabled={savingMeta}
              autoFocus
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">None</MenuItem>
              {subjectOptions.map((subject) => (
                <MenuItem key={subject} value={subject}>
                  {subject}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Typography
              variant="body2"
              onClick={() => {
                if (canEdit) {
                  setEditingSubject(true);
                }
              }}
              sx={{
                color: subjectDisplay ? "primary.main" : "text.disabled",
                fontWeight: 700,
                cursor: canEdit ? "text" : "default",
              }}
            >
              {subjectDisplay || "Not set"}
            </Typography>
          )}
          {canEdit && !editingSubject ? (
            <IconButton
              className="lesson-meta-edit"
              onClick={() => setEditingSubject(true)}
              sx={{
                position: "absolute",
                right: -28,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0,
                transition: "opacity 0.2s ease",
                color: "primary.main",
              }}
            >
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Box>
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            mr: "1rem",
            "&:hover .lesson-meta-edit": { opacity: canEdit ? 1 : 0 },
          }}
        >
          {editingLevel && canEdit ? (
            <TextField
              select
              label="Level"
              size="small"
              value={levelDisplay || ""}
              onChange={(event) => {
                onLevelChange(event.target.value);
                setEditingLevel(false);
              }}
              onBlur={() => setEditingLevel(false)}
              disabled={savingMeta}
              autoFocus
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">None</MenuItem>
              {levelOptions.map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Typography
              variant="body2"
              onClick={() => {
                if (canEdit) {
                  setEditingLevel(true);
                }
              }}
              sx={{
                color: levelDisplay ? "primary.main" : "text.disabled",
                fontWeight: 700,
                cursor: canEdit ? "text" : "default",
              }}
            >
              {levelDisplay || "Not set"}
            </Typography>
          )}
          {canEdit && !editingLevel ? (
            <IconButton
              className="lesson-meta-edit"
              onClick={() => setEditingLevel(true)}
              sx={{
                position: "absolute",
                right: -28,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0,
                transition: "opacity 0.2s ease",
                color: "primary.main",
              }}
            >
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            ml: "1rem",
            mr: "2rem",
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
              cursor:
                statusLabel === "Ready" || statusLabel === "Published"
                  ? "pointer"
                  : "default",
              animation:
                statusLabel === "Ready"
                  ? "statusPulse 1.8s ease-in-out infinite"
                  : "none",
            }}
            onClick={() => {
              if (deleteMode) {
                return;
              }
              if (statusLabel === "Ready") {
                onPublishClick();
                return;
              }
              if (statusLabel === "Published") {
                onUnpublishClick();
              }
            }}
          >
            {statusLabel}
          </Box>
        </Box>
        <IconButton
          onClick={() => {
            onOpenReport();
          }}
          sx={{
            height: 56,
            width: 44,
            borderRadius: "0.75rem",
            color: "primary.main",
            backgroundColor: "transparent",
            "&:hover": {
              backgroundColor: "action.hover",
            },
          }}
        >
          <OpenInNewRoundedIcon
            sx={{
              animation: openingReport
                ? "reportSpin 1.8s linear infinite"
                : "none",
            }}
          />
        </IconButton>
      </Box>
    </Box>
  );
};

export default TitleHeader;
