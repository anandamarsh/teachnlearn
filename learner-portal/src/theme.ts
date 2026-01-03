import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#e65100",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#0288d1",
    },
    success: {
      main: "#2e7d32",
    },
    error: {
      main: "#c62828",
    },
    background: {
      default: "#fafafa",
      paper: "#ffffff",
    },
    text: {
      primary: "#212121",
      secondary: "#555555",
    },
  },
  shape: {
    borderRadius: 0,
  },
  typography: {
    fontFamily: "'Roboto', sans-serif",
    h1: {
      fontSize: "2.2rem",
      fontWeight: 700,
      color: "#e65100",
    },
    h2: {
      fontSize: "1.8rem",
      fontWeight: 700,
      color: "#0288d1",
    },
    h3: {
      fontSize: "1.4rem",
      fontWeight: 600,
      color: "#2e7d32",
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.5,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "1rem",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: "1rem",
          padding: "1rem 1.5rem",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "1rem",
          padding: "0.5rem",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
  },
});

export default theme;
