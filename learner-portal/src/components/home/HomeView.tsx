import { useEffect, useState } from "react";
import { Box, Button, Paper, Popper, Stack, Typography } from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { CatalogLesson } from "../../state/types";
import { formatTeacherEmail, withCacheBuster } from "../../util/format";

type HomeViewProps = {
  lessons: CatalogLesson[];
  onSelectLesson: (lesson: CatalogLesson) => void;
};

const HomeView = ({ lessons, onSelectLesson }: HomeViewProps) => {
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const [hoverLesson, setHoverLesson] = useState<CatalogLesson | null>(null);

  useEffect(() => {
    return () => {
      setHoverAnchor(null);
      setHoverLesson(null);
    };
  }, []);

  return (
    <Stack spacing={3} className="home-screen">
      <Box className="home-grid">
        {lessons.map((lesson) => (
          <Box key={`${lesson.teacher}-${lesson.id}`} className="home-item">
            <Button
              className="home-tile"
              onClick={() => onSelectLesson(lesson)}
              onMouseEnter={(event) => {
                setHoverAnchor(event.currentTarget);
                setHoverLesson(lesson);
              }}
              onMouseLeave={() => {
                setHoverAnchor(null);
                setHoverLesson(null);
              }}
              sx={{ minWidth: 0, minHeight: 0, padding: 0 }}
            >
              {lesson.requiresLogin ? (
                <span className="home-lock" aria-label="Login required">
                  <LockRoundedIcon fontSize="small" />
                </span>
              ) : null}
              <div className="home-icon-wrap">
                {lesson.iconUrl ? (
                  <img
                    src={withCacheBuster(lesson.iconUrl, lesson.updated_at)}
                    alt=""
                    className="home-icon"
                    loading="lazy"
                  />
                ) : (
                  <DescriptionRoundedIcon
                    className="home-icon"
                    color="primary"
                  />
                )}
              </div>
            </Button>
            <Typography className="home-title">{lesson.title}</Typography>
          </Box>
        ))}
      </Box>
      <Popper
        open={Boolean(
          hoverAnchor && hoverLesson && document.body.contains(hoverAnchor)
        )}
        anchorEl={hoverAnchor}
        placement="bottom"
        modifiers={[
          { name: "offset", options: { offset: [0, 8] } },
          { name: "preventOverflow", options: { padding: 12 } },
          { name: "flip", options: { padding: 12 } },
        ]}
        onMouseLeave={() => {
          setHoverAnchor(null);
          setHoverLesson(null);
        }}
      >
        <Paper
          elevation={8}
          sx={{ p: 2, maxWidth: 320, borderRadius: 2 }}
          onMouseEnter={() => {
            if (hoverLesson && hoverAnchor) {
              setHoverLesson(hoverLesson);
              setHoverAnchor(hoverAnchor);
            }
          }}
          onMouseLeave={() => {
            setHoverAnchor(null);
            setHoverLesson(null);
          }}
        >
          <Stack spacing={1}>
            <Box className="lesson-popover-title">
              <Typography variant="subtitle1" fontWeight={700}>
                {hoverLesson?.title || ""}
              </Typography>
              {hoverLesson?.id ? (
                <Typography variant="caption" className="lesson-popover-id">
                  {hoverLesson.id}
                </Typography>
              ) : null}
            </Box>
            <Typography variant="body2" color="text.secondary">
              by{" "}
              <span className="popup-teacher">
                {formatTeacherEmail(hoverLesson?.teacher || "")}
              </span>
            </Typography>
            <Typography variant="body2">
              {hoverLesson?.content || "No description provided."}
            </Typography>
          </Stack>
        </Paper>
      </Popper>
    </Stack>
  );
};

export default HomeView;
