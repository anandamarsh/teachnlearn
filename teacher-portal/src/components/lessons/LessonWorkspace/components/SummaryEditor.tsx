import { Box, IconButton, TextField, Typography } from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";

type SummaryEditorProps = {
  contentDraft: string;
  editingSummary: boolean;
  savingContent: boolean;
  isAuthenticated: boolean;
  canEdit: boolean;
  onEditSummary: () => void;
  onSummaryChange: (value: string) => void;
  onFinishSummary: (value: string) => void;
};

const SummaryEditor = ({
  contentDraft,
  editingSummary,
  savingContent,
  isAuthenticated,
  canEdit,
  onEditSummary,
  onSummaryChange,
  onFinishSummary,
}: SummaryEditorProps) => (
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
        onChange={(event) => onSummaryChange(event.target.value)}
        onBlur={(event) => onFinishSummary(event.target.value)}
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
            onEditSummary();
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
        onClick={onEditSummary}
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
);

export default SummaryEditor;
