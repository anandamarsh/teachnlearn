import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Popper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { CatalogLesson } from "../../state/types";
import { withCacheBuster } from "../../util/format";

type HomeViewProps = {
  lessons: CatalogLesson[];
  isAuthenticated: boolean;
  studentName?: string | null;
  loginLoading: boolean;
  loginError: string | null;
  onLogin: (name: string, passcode: string) => Promise<void>;
  onSelectLesson: (lesson: CatalogLesson) => void;
};

const PASSCODE_LENGTH = 6;

const HomeView = ({
  lessons,
  isAuthenticated,
  studentName,
  loginLoading,
  loginError,
  onLogin,
  onSelectLesson,
}: HomeViewProps) => {
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const [hoverLesson, setHoverLesson] = useState<CatalogLesson | null>(null);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState<string[]>(() =>
    Array(PASSCODE_LENGTH).fill("")
  );
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const normalizedPasscode = useMemo(() => passcode.join(""), [passcode]);

  useEffect(() => {
    return () => {
      setHoverAnchor(null);
      setHoverLesson(null);
    };
  }, []);

  const updatePasscodeDigit = (index: number, value: string) => {
    const nextChar = value.replace(/[^a-z0-9]/gi, "").slice(-1).toUpperCase();
    setPasscode((prev) => {
      const next = [...prev];
      next[index] = nextChar;
      return next;
    });
    if (nextChar && index < PASSCODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  if (!isAuthenticated) {
    return (
      <Stack spacing={3} className="home-screen student-login-screen">
        <Paper className="student-login-card" elevation={0}>
          <Stack spacing={3} className="student-login-stack">
            <Box className="student-login-copy">
              <img
                src="/logo.png"
                alt="Teach N Learn"
                className="student-login-logo"
              />
            </Box>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              fullWidth
              className="student-login-input"
            />
            <Box className="student-login-passcode">
              <Box className="passcode-row">
                {passcode.map((digit, index) => (
                  <Box key={index} display="contents">
                    {index === 3 ? <span className="passcode-dash">-</span> : null}
                    <input
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      className="passcode-box"
                      inputMode="text"
                      maxLength={1}
                      value={digit}
                      onChange={(event) =>
                        updatePasscodeDigit(index, event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Backspace" &&
                          !passcode[index] &&
                          index > 0
                        ) {
                          inputRefs.current[index - 1]?.focus();
                        }
                      }}
                      aria-label={`Passcode digit ${index + 1}`}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
            {loginError ? <Alert severity="error">{loginError}</Alert> : null}
            <Button
              variant="contained"
              size="large"
              className="student-login-button"
              disabled={
                loginLoading ||
                !name.trim() ||
                normalizedPasscode.length !== PASSCODE_LENGTH
              }
              onClick={() => onLogin(name.trim(), normalizedPasscode)}
            >
              {loginLoading ? <CircularProgress size={20} color="inherit" /> : "Login"}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} className="home-screen">
      <Box className="home-header">
        <Box className="student-name-tag">{studentName || "Student"}</Box>
      </Box>
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
