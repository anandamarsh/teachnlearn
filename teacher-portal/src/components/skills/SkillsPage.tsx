import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SkillCodeEditor from "./SkillCodeEditor";
import type {
  SkillDefinition,
  SkillKind,
  SkillScope,
  SkillStatus,
} from "../../state/skillTypes";

type SkillsPageProps = {
  skills: SkillDefinition[];
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string) => void;
  onCreateSkill: () => void;
  onUpdateSkill: (skillId: string, updates: Partial<SkillDefinition>) => void;
  onDuplicateSkill: (skillId: string) => void;
  onDeleteSkill: (skillId: string) => void;
  onResetSkills: () => void;
  onNotify: (message: string, severity: "success" | "error") => void;
};

const scopeOptions: SkillScope[] = ["system", "teacher"];
const statusOptions: SkillStatus[] = ["active", "draft"];

const skillKindLabel: Record<SkillKind, string> = {
  compute: "Compute",
  ai_driven: "AI Driven",
};

const renderSkillKindIcon = (kind: SkillKind) => {
  if (kind === "compute") {
    return <MemoryRoundedIcon fontSize="small" />;
  }
  return <PsychologyRoundedIcon fontSize="small" />;
};

const SkillsPage = ({
  skills,
  selectedSkillId,
  onSelectSkill,
  onCreateSkill,
  onUpdateSkill,
  onDuplicateSkill,
  onDeleteSkill,
  onResetSkills,
  onNotify,
}: SkillsPageProps) => {
  const [schemaError, setSchemaError] = useState("");
  const [editingMeta, setEditingMeta] = useState(false);
  const [promptOpen, setPromptOpen] = useState(true);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) || null,
    [selectedSkillId, skills]
  );

  const validateSchema = (raw: string) => {
    try {
      JSON.parse(raw);
      setSchemaError("");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid JSON";
      setSchemaError(detail);
    }
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ p: 0, m: 0 }}>
      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", md: "320px 1fr" }}
        gap={3}
        sx={{ height: "calc(100vh - 56px)", m: 0 }}
      >
        <Box
          sx={{
            minWidth: 0,
            borderRight: { md: "1px solid rgba(0,0,0,0.08)" },
            overflowY: "auto",
          }}
        >
          <List disablePadding>
            {skills.map((skill) => (
              <Box key={skill.id}>
                <ListItemButton
                  key={skill.id}
                  selected={skill.id === selectedSkillId}
                  onClick={() => onSelectSkill(skill.id)}
                  sx={{
                    alignItems: "flex-start",
                    pt: 1.5,
                    pb: 1.5,
                    pl: "1.5rem",
                    pr: 0,
                    mx: 0,
                    borderRadius: 0,
                    display: "block",
                    opacity: skill.status === "active" ? 1 : 0.45,
                    "&.Mui-selected": {
                      backgroundColor: "rgba(230,81,0,0.12)",
                    },
                    "&.Mui-selected:hover": {
                      backgroundColor: "rgba(230,81,0,0.16)",
                    },
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Tooltip title={skillKindLabel[skill.kind]} placement="right">
                      <Box
                        sx={{ pt: 0.25, color: "primary.main", display: "flex" }}
                        aria-label={skillKindLabel[skill.kind]}
                      >
                        {renderSkillKindIcon(skill.kind)}
                      </Box>
                    </Tooltip>
                    <ListItemText
                      primary={
                        <Typography fontWeight={700}>{skill.displayName}</Typography>
                      }
                      sx={{ mx: 0, px: 0 }}
                    />
                  </Stack>
                </ListItemButton>
                <Divider />
              </Box>
              ))}
            </List>
        </Box>

        <Box sx={{ minWidth: 0, pt: 2, pl: { md: 2 }, pr: { md: 2 }, overflowY: "auto" }}>
            {selectedSkill ? (
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Box>
                    <Typography variant="h5" fontWeight={800}>
                      {selectedSkill.displayName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last updated {new Date(selectedSkill.updatedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Duplicate skill">
                      <IconButton
                        onClick={() => {
                          onDuplicateSkill(selectedSkill.id);
                          onNotify("Skill duplicated", "success");
                        }}
                        sx={{
                          width: 42,
                          height: 42,
                          border: "1px solid rgba(0,0,0,0.18)",
                          backgroundColor: "transparent",
                        }}
                      >
                        <ContentCopyRoundedIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete skill">
                      <IconButton
                        onClick={() => {
                          onDeleteSkill(selectedSkill.id);
                          onNotify("Skill deleted", "success");
                        }}
                        sx={{
                          width: 42,
                          height: 42,
                          border: "1px solid rgba(211,47,47,0.3)",
                          color: "error.main",
                          backgroundColor: "transparent",
                        }}
                      >
                        <DeleteRoundedIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={editingMeta ? "Finish editing" : "Edit details"}>
                      <IconButton
                        onClick={() => setEditingMeta((prev) => !prev)}
                        sx={{
                          width: 42,
                          height: 42,
                          border: "1px solid rgba(0,0,0,0.18)",
                          backgroundColor: "transparent",
                        }}
                      >
                        <EditRoundedIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
                <Divider />

                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "7fr 3fr" }} gap={1.5}>
                  <Box sx={{ p: 0.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SchoolRoundedIcon color="primary" />
                      <Box>
                        <Typography fontWeight={700}>What this does</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedSkill.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Box sx={{ p: 0.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AutoStoriesRoundedIcon color="primary" />
                      <Box>
                        <Typography fontWeight={700}>Where it is used</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedSkill.usedBy.join(", ") || "Not linked yet"}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Box>
                <Divider />

                {editingMeta ? (
                  <>
                    <Box
                      display="grid"
                      gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }}
                      gap={2}
                    >
                      <TextField
                        label="Teacher-facing Name"
                        value={selectedSkill.displayName}
                        onChange={(event) =>
                          onUpdateSkill(selectedSkill.id, { displayName: event.target.value })
                        }
                        fullWidth
                      />
                      <TextField label="Internal Id" value={selectedSkill.id} fullWidth disabled />
                      <TextField
                        select
                        label="Who owns it"
                        value={selectedSkill.scope}
                        onChange={(event) =>
                          onUpdateSkill(selectedSkill.id, {
                            scope: event.target.value as SkillScope,
                          })
                        }
                        fullWidth
                      >
                        {scopeOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Status"
                        value={selectedSkill.status}
                        onChange={(event) =>
                          onUpdateSkill(selectedSkill.id, {
                            status: event.target.value as SkillStatus,
                          })
                        }
                        fullWidth
                      >
                        {statusOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Used In"
                        value={selectedSkill.usedBy.join(", ")}
                        onChange={(event) =>
                          onUpdateSkill(selectedSkill.id, {
                            usedBy: event.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        helperText="Comma-separated workflow names"
                        fullWidth
                      />
                    </Box>

                    <TextField
                      label="Plain-language Description"
                      value={selectedSkill.description}
                      onChange={(event) =>
                        onUpdateSkill(selectedSkill.id, { description: event.target.value })
                      }
                      fullWidth
                      multiline
                      minRows={2}
                    />
                    <Divider />
                  </>
                ) : null}

                <Box>
                  <Button
                    fullWidth
                    onClick={() => setPromptOpen((prev) => !prev)}
                    disableRipple
                    disableElevation
                    sx={{
                      justifyContent: "space-between",
                      textAlign: "left",
                      px: 0,
                      py: 1,
                      color: "text.primary",
                      textTransform: "none",
                      backgroundColor: "transparent",
                      "&:hover": { backgroundColor: "transparent" },
                      "&:active": { backgroundColor: "transparent" },
                    }}
                  >
                    <Box>
                      <Typography fontWeight={700}>Prompt Instructions</Typography>
                      <Typography variant="body2" color="text.secondary">
                        This is the guidance the assistant reads.
                      </Typography>
                    </Box>
                    <ExpandMoreRoundedIcon
                      sx={{
                        transform: promptOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </Button>
                  <Collapse in={promptOpen} timeout="auto" unmountOnExit>
                    <Box pb={2.5}>
                    <SkillCodeEditor
                      language="markdown"
                      value={selectedSkill.prompt}
                      onChange={(value: string) =>
                        onUpdateSkill(selectedSkill.id, { prompt: value })
                      }
                    />
                    </Box>
                  </Collapse>
                </Box>
                <Divider />

                <Box>
                  <Button
                    fullWidth
                    onClick={() => setSchemaOpen((prev) => !prev)}
                    disableRipple
                    disableElevation
                    sx={{
                      justifyContent: "space-between",
                      textAlign: "left",
                      px: 0,
                      py: 1,
                      color: "text.primary",
                      textTransform: "none",
                      backgroundColor: "transparent",
                      "&:hover": { backgroundColor: "transparent" },
                      "&:active": { backgroundColor: "transparent" },
                    }}
                  >
                    <Box>
                      <Typography fontWeight={700}>Input / Output Schema</Typography>
                      <Typography variant="body2" color="text.secondary">
                        This tells the system what goes in and what should come out.
                      </Typography>
                    </Box>
                    <ExpandMoreRoundedIcon
                      sx={{
                        transform: schemaOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </Button>
                  <Collapse in={schemaOpen} timeout="auto" unmountOnExit>
                    <Box pb={2.5}>
                    <SkillCodeEditor
                      language="json"
                      value={selectedSkill.ioSchema}
                      onChange={(value: string) => {
                        onUpdateSkill(selectedSkill.id, { ioSchema: value });
                        validateSchema(value);
                      }}
                      error={schemaError}
                    />
                    </Box>
                  </Collapse>
                </Box>
                <Divider />

                <Alert severity="info" sx={{ borderRadius: 3 }}>
                  This first version saves in the browser so you can explore safely. Next step is
                  wiring the same screen to the real S3 skill registry.
                </Alert>
              </Stack>
            ) : (
              <Typography color="text.secondary">Create or select a skill to begin.</Typography>
            )}
        </Box>
      </Box>
      <Button
        onClick={() => {
          onCreateSkill();
          onNotify("Skill created", "success");
        }}
        sx={{
          position: "fixed",
          right: 24,
          bottom: 86,
          minWidth: 0,
          width: 56,
          height: 56,
          borderRadius: "999px",
          backgroundColor: "primary.main",
          color: "common.white",
          boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
          "&:hover": {
            backgroundColor: "primary.dark",
          },
        }}
      >
        <AddRoundedIcon />
      </Button>
    </Container>
  );
};

export default SkillsPage;
