import { Box, Button, Container } from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";

type HomeProps = {
  onLessonsClick: () => void;
};

const Home = ({ onLessonsClick }: HomeProps) => {
  return (
    <Container
      maxWidth="sm"
      sx={{ minHeight: "100vh", display: "flex", justifyContent: "flex-start" }}
    >
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
