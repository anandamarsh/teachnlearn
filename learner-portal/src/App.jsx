import { useEffect, useState } from "react";
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
  const [status, setStatus] = useState("idle");
  const [timestamp, setTimestamp] = useState(null);
  const [error, setError] = useState("");
  const [configError] = useState(!apiBaseUrl || !auth0Audience);

  if (configError) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <Typography color="error">Missing VITE_TEACHNLEARN_API or VITE_AUTH0_AUDIENCE.</Typography>
      </Box>
    );
  }

  const fetchTimestamp = async () => {
    setStatus("loading");
    setError("");
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: auth0Audience },
      });
      const response = await fetch(`${apiBaseUrl}/api/timestamp`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Fetch failed");
      }
      setTimestamp(data.data?.timestamp || "No timestamp found");
    } catch (err) {
      setError(err.message || "Fetch failed");
      setTimestamp(null);
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTimestamp();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" bgcolor="#eef2f6">
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="overline" color="text.secondary">
            Learner Portal
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Your workspace timestamp
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Sign in to read the timestamp file created by the Teacher Portal.
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
                variant="outlined"
                size="large"
                onClick={fetchTimestamp}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Refreshing..." : "Refresh"}
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
          {timestamp ? (
            <Typography sx={{ mt: 2 }} color="primary">
              Timestamp: {timestamp}
            </Typography>
          ) : null}
          {error ? (
            <Typography sx={{ mt: 1 }} color="error">
              {error}
            </Typography>
          ) : null}
        </Paper>
      </Container>
    </Box>
  );
}

export default App;
