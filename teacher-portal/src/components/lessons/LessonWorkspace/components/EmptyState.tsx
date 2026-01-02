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
          Select a lesson
        </Typography>
        <Typography color="text.secondary">
          Pick a lesson from the left panel to begin.
        </Typography>
      </>
    ) : (
      <>
        <Typography variant="h3" sx={{ mb: 1, color: "#1565c0" }}>
          Create your first lesson
        </Typography>
        <Typography color="text.secondary">Press the + icon below</Typography>
      </>
    )}
  </Box>
);

export default EmptyState;
