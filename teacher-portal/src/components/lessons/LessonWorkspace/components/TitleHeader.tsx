import {
  Box,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

type TitleHeaderProps = {
  titleDraft: string;
  editingTitle: boolean;
  savingTitle: boolean;
  isAuthenticated: boolean;
  canEdit: boolean;
  statusLabel: string;
  isPublished: boolean;
  lessonId: string;
  onEditTitle: () => void;
  onTitleChange: (value: string) => void;
  onFinishTitle: () => void;
  onPublishClick: () => void;
  onOpenReport: () => void;
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
  onEditTitle,
  onTitleChange,
  onFinishTitle,
  onPublishClick,
  onOpenReport,
}: TitleHeaderProps) => (
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
              onPublishClick();
            }
          }}
        >
          {statusLabel}
        </Box>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", mt: 1, textAlign: "center" }}
        >
          {lessonId}
        </Typography>
      </Box>
      <IconButton
        onClick={() => {
          if (!isPublished) {
            return;
          }
          onOpenReport();
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
);

export default TitleHeader;
