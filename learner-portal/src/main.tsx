import { Fragment, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import "./index.css";
import App from "./App";
import theme from "./theme";

const RootWrapper = import.meta.env.DEV ? Fragment : StrictMode;

createRoot(document.getElementById("root")!).render(
  <RootWrapper>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </RootWrapper>
);
