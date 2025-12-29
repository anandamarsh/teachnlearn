import { useEffect, useState } from "react";
import { Box, TextField, Typography } from "@mui/material";
import { Lesson } from "../../state/lessonTypes";

type LessonWorkspaceProps = {
  lesson: Lesson | null;
  hasLessons: boolean;
  isAuthenticated: boolean;
  onUpdateTitle: (lessonId: string, title: string) => Promise<Lesson | null>;
};

const statusChipColor = (status: string): "default" | "secondary" | "success" => {
  const lowered = status.toLowerCase();
  if (lowered.includes("publish") || lowered.includes("active")) {
    return "success";
  }
  if (lowered.includes("draft")) {
    return "default";
  }
  return "secondary";
};

const LessonWorkspace = ({
  lesson,
  hasLessons,
  isAuthenticated,
  onUpdateTitle,
}: LessonWorkspaceProps) => {
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    setTitleDraft(lesson?.title || "");
  }, [lesson]);

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
            <Typography variant="h3" sx={{ mb: 1, color: "success.main" }}>
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
    </>
  );
};

export default LessonWorkspace;
