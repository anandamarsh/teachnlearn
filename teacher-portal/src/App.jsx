import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from "@mui/material";
import "./App.css";

const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

function App() {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    user,
  } = useAuth0();
  const [status, setStatus] = useState("ready");
  const [message, setMessage] = useState("");
  const [configError] = useState(!apiBaseUrl || !auth0Audience);

  if (configError) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <Typography color="error">Missing VITE_TEACHNLEARN_API or VITE_AUTH0_AUDIENCE.</Typography>
      </Box>
    );
  }

  const handleCreate = async () => {
    setStatus("creating");
    setMessage("");
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: auth0Audience },
      });
      const response = await fetch(`${apiBaseUrl}/api/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Create failed");
      }
      setMessage(`Created folder for ${data.folder}`);
    } catch (error) {
      setMessage(error.message || "Create failed");
    } finally {
      setStatus("ready");
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" bgcolor="#f6f3ef">
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="overline" color="text.secondary">
            Teacher Portal
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Create learner workspace
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Sign in to create a sanitized folder in S3 and drop a timestamp file.
          </Typography>
          {!isAuthenticated ? (
            <Button variant="contained" size="large" onClick={() => loginWithRedirect()}>
              Log in
            </Button>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              <Typography variant="body2" color="text.secondary">
                Signed in as {user?.email || user?.name}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleCreate}
                disabled={status === "creating"}
              >
                {status === "creating" ? "Creating..." : "Create"}
              </Button>
              <Button
                variant="text"
                color="secondary"
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              >
                Log out
              </Button>
            </Box>
          )}
          {message ? (
            <Typography sx={{ mt: 2 }} color="primary">
              {message}
            </Typography>
          ) : null}
        </Paper>
      </Container>
    </Box>
  );
}

export default App;
