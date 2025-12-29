import { useAuth0 } from "@auth0/auth0-react";
import { Box, Button, CircularProgress, Container, Paper, Typography } from "@mui/material";
import "./App.css";

const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

function App() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } = useAuth0();
  const configError = !apiBaseUrl || !auth0Audience;

  if (configError) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <Typography color="error">Missing VITE_TEACHNLEARN_API or VITE_AUTH0_AUDIENCE.</Typography>
      </Box>
    );
  }

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
            Welcome
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Sign in to access your learner workspace.
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
                variant="text"
                color="secondary"
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              >
                Log out
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

export default App;
