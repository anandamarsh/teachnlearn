import { Box, Typography } from "@mui/material";

type EmptyStateProps = {
  hasLessons: boolean;
};

const EmptyState = ({ hasLessons }: EmptyStateProps) => (
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
          Select a lesson template
        </Typography>
        <Typography color="text.secondary">
          Pick a teacher-owned template from the left panel to begin.
        </Typography>
      </>
    ) : (
      <>
        <Typography variant="h3" sx={{ mb: 1, color: "#1565c0" }}>
          Create your first lesson template
        </Typography>
        <Typography color="text.secondary">
          Start a generic class lesson, then specialize it later.
        </Typography>
      </>
    )}
  </Box>
);

export default EmptyState;
