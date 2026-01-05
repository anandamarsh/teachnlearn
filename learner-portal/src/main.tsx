import { Fragment, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import "./index.css";
import App from "./App";
import theme from "./theme";

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

if (!auth0Domain || !auth0ClientId || !auth0Audience) {
  // eslint-disable-next-line no-console
  console.error("Missing Auth0 environment variables.");
}

const RootWrapper = import.meta.env.DEV ? Fragment : StrictMode;

createRoot(document.getElementById("root")!).render(
  <RootWrapper>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: auth0Audience,
          scope: "openid profile email",
        }}
      >
        <App />
      </Auth0Provider>
    </ThemeProvider>
  </RootWrapper>
);
