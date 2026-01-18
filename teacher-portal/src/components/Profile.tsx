import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Fab,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import {
  buildAuthHeaders,
  type GetAccessTokenSilently,
} from "../auth/buildAuthHeaders";
import {
  fetchTeacherProfile,
  updateTeacherProfile,
  type TeacherProfile,
} from "../api/teacherProfile";

type ProfileProps = {
  apiBaseUrl: string;
  auth0Audience: string;
  getAccessTokenSilently: GetAccessTokenSilently;
  onNotify: (message: string, severity: "success" | "error") => void;
};

const normalizeProfile = (profile: TeacherProfile | null | undefined) => ({
  name: profile?.name ? String(profile.name) : "",
  school: profile?.school ? String(profile.school) : "",
});

const Profile = ({
  apiBaseUrl,
  auth0Audience,
  getAccessTokenSilently,
  onNotify,
}: ProfileProps) => {
  const [profile, setProfile] = useState<TeacherProfile>({
    name: "",
    school: "",
  });
  const [savedProfile, setSavedProfile] = useState<TeacherProfile>({
    name: "",
    school: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const endpoint = useMemo(
    () => (apiBaseUrl ? `${apiBaseUrl}/teacher/profile` : ""),
    [apiBaseUrl]
  );

  useEffect(() => {
    if (!endpoint) {
      return;
    }
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const headers = await buildAuthHeaders(
          getAccessTokenSilently,
          auth0Audience
        );
        const data = await fetchTeacherProfile(endpoint, headers);
        const normalized = normalizeProfile(data);
        if (!active) {
          return;
        }
        setProfile(normalized);
        setSavedProfile(normalized);
      } catch (err) {
        if (!active) {
          return;
        }
        const detail =
          err instanceof Error ? err.message : "Failed to load profile";
        setError(detail);
        onNotify(detail, "error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [auth0Audience, endpoint, getAccessTokenSilently, onNotify]);

  const isDirty =
    profile.name.trim() !== savedProfile.name.trim() ||
    profile.school.trim() !== savedProfile.school.trim();

  const handleSave = useCallback(async () => {
    if (!endpoint) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const headers = await buildAuthHeaders(
        getAccessTokenSilently,
        auth0Audience
      );
      const data = await updateTeacherProfile(endpoint, headers, profile);
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      setSavedProfile(normalized);
      onNotify("Profile saved", "success");
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Failed to save profile";
      setError(detail);
      onNotify(detail, "error");
    } finally {
      setSaving(false);
    }
  }, [auth0Audience, endpoint, getAccessTokenSilently, onNotify, profile]);

  return (
    <Container maxWidth="sm" sx={{ minHeight: "100vh", pt: "6.5rem", pb: 10 }}>
      <Stack spacing={3}>
        <Box textAlign="center">
          <Typography variant="h4" fontWeight={700}>
            Your Profile
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            mt={1}
          ></Typography>
        </Box>
        <Stack spacing={2}>
          <TextField
            label="Your Name"
            value={profile.name}
            onChange={(event) =>
              setProfile((prev) => ({ ...prev, name: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Your School"
            value={profile.school}
            onChange={(event) =>
              setProfile((prev) => ({ ...prev, school: event.target.value }))
            }
            fullWidth
          />
        </Stack>
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : null}
        <Fab
          color="primary"
          aria-label="Save profile"
          onClick={handleSave}
          disabled={!isDirty || saving || loading}
          sx={{
            position: "fixed",
            right: 20,
            bottom: "calc(20px + 56px)",
            width: "4rem",
            height: "4rem",
            boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
          }}
        >
          <SaveRoundedIcon />
        </Fab>
      </Stack>
    </Container>
  );
};

export default Profile;
