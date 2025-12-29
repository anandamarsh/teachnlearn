import { useState } from "react";
import { Box, Drawer } from "@mui/material";
import LessonsList from "./LessonsList";
import LessonWorkspace from "./LessonWorkspace";
import { Lesson } from "../../state/lessonTypes";
import type { GetAccessTokenSilently } from "../../auth/buildAuthHeaders";

type LessonsPageProps = {
  lessons: Lesson[];
  selectedLesson: Lesson | null;
  selectedLessonId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  onSelectLesson: (lessonId: string) => void;
  onUpdateTitle: (lessonId: string, title: string) => Promise<Lesson | null>;
  onNotify: (message: string, severity: "success" | "error") => void;
  getAccessTokenSilently: GetAccessTokenSilently;
};

const LessonsPage = ({
  lessons,
  selectedLesson,
  selectedLessonId,
  loading,
  isAuthenticated,
  onSelectLesson,
  onUpdateTitle,
  onNotify,
  getAccessTokenSilently,
}: LessonsPageProps) => {
  const [leftOpen, setLeftOpen] = useState(false);
  const drawerWidth = leftOpen ? "16rem" : "5rem";

  return (
    <Box display="flex" minHeight="100vh">
      <Drawer
        variant="permanent"
        open={leftOpen}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            transition: "width 0.25s ease",
            overflowX: "hidden",
            borderRight: "1px solid rgba(0,0,0,0.08)",
            p: 0,
            borderRadius: 0,
          },
        }}
      >
        <LessonsList
          lessons={lessons}
          selectedLessonId={selectedLessonId}
          leftOpen={leftOpen}
          loading={loading}
          onSelectLesson={onSelectLesson}
          onToggleLeft={() => setLeftOpen((prev) => !prev)}
        />
      </Drawer>
      <Box position="relative" display="flex" flex={1}>
        <Box flex={1} py={2} pr={3} pl={3}>
          <Box
            sx={{
              minHeight: "calc(100vh - 120px)",
              backgroundColor: "transparent",
              p: 3,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <LessonWorkspace
              lesson={selectedLesson}
              hasLessons={lessons.length > 0}
              isAuthenticated={isAuthenticated}
              onUpdateTitle={onUpdateTitle}
              onNotify={onNotify}
              getAccessTokenSilently={getAccessTokenSilently}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LessonsPage;
