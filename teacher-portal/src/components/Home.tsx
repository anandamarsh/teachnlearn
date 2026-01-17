import { useEffect, useState } from "react";
import { Box, Button, Container, IconButton, Stack, Typography } from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

type HomeProps = {
  onLessonsClick: () => void;
  otpCode: string;
  otpStatus: "idle" | "loading" | "error";
  onReloadOtp: () => void;
};

const Home = ({
  onLessonsClick,
  otpCode,
  otpStatus,
  onReloadOtp,
}: HomeProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    if (!otpCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(otpCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{ minHeight: "100vh", display: "flex", justifyContent: "flex-start" }}
    >
      <Box
        sx={{
          position: "fixed",
          bottom: "calc(16px + 3rem)",
          right: 16,
          zIndex: 1200,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily:
                  'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                letterSpacing: "0.08em",
                color: "#b27d7d",
              }}
            >
              {otpStatus === "loading" ? "•••-•••" : otpCode || "—"}
            </Typography>
            {otpStatus === "error" ? (
              <Typography variant="caption" color="error.main">
                Failed to load
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              aria-label="Copy login code"
              onClick={handleCopy}
              disabled={!otpCode || otpStatus === "loading"}
              sx={{
                color: copied ? "success.main" : "inherit",
                transition: "color 150ms ease",
              }}
            >
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Reload login code"
              onClick={onReloadOtp}
              disabled={otpStatus === "loading"}
            >
              <RefreshRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>
      <Box
        width="100%"
        textAlign="center"
        display="flex"
        flexDirection="column"
        alignItems="center"
        pt="7.5rem"
        gap="2.5rem"
      >
        <Box
          component="img"
          src="/logo.png"
          alt="Teacher Portal"
          sx={{
            width: 144,
            height: 144,
            display: "block",
            borderRadius: 0,
          }}
        />
        <Button
          variant="contained"
          size="large"
          startIcon={<DescriptionRoundedIcon />}
          sx={{
            height: 64,
            fontSize: "1.1rem",
            justifyContent: "flex-start",
            px: 4,
            borderRadius: "5rem",
            width: "70%",
            minWidth: 260,
            boxShadow: "0 12px 18px rgba(0,0,0,0.18)",
          }}
          onClick={onLessonsClick}
        >
          Lessons
        </Button>
      </Box>
    </Container>
  );
};

export default Home;
