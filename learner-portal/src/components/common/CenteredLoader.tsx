import { Box, LinearProgress } from "@mui/material";

type CenteredLoaderProps = {
  width?: string | number;
};

const CenteredLoader = ({ width = "12rem" }: CenteredLoaderProps) => {
  return (
    <Box
      position="fixed"
      top="50%"
      left="50%"
      sx={{ transform: "translate(-50%, -50%)" }}
    >
      <Box width={width}>
        <LinearProgress />
      </Box>
    </Box>
  );
};

export default CenteredLoader;
