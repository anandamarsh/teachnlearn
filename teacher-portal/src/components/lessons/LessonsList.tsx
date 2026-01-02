import {
  Box,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { Lesson } from "../../state/lessonTypes";

type LessonsListProps = {
  lessons: Lesson[];
  selectedLessonId: string | null;
  leftOpen: boolean;
  loading: boolean;
  onSelectLesson: (lessonId: string) => void;
  onToggleLeft: () => void;
};

const LessonsList = ({
  lessons,
  selectedLessonId,
  leftOpen,
  loading,
  onSelectLesson,
  onToggleLeft,
}: LessonsListProps) => {
  const getStatusBadgeColor = (status?: string | null) => {
    const normalized = (status || "").toLowerCase();
    if (normalized.includes("publish") || normalized.includes("active")) {
      return "success.main";
    }
    if (normalized.includes("ready")) {
      return "warning.main";
    }
    return "error.main";
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
            {lessons.map((lesson) => (
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
                    backgroundColor: "rgba(230,81,0,0.16)",
                  },
                  "&.Mui-selected:hover": {
                    backgroundColor: "rgba(230,81,0,0.22)",
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
                      backgroundImage:
                        "linear-gradient(135deg, rgba(230,81,0,0.35) 0%, rgba(2,136,209,0.35) 100%)",
                      my: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "1.4rem",
                      color: "#7a7a7a",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 10,
                        height: 10,
                        borderRadius: "999px",
                        bgcolor: getStatusBadgeColor(lesson.status),
                      }}
                    />
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
            ))}
          </List>
        ) : null}
      </Box>
    </Box>
  );
};

export default LessonsList;
