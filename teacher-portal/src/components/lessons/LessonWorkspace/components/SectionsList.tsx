import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  IconButton,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SectionEditor from "../../SectionEditor";

type SectionSummary = {
  key: string;
};

type SectionsListProps = {
  sections: SectionSummary[];
  expandedKeys: Record<string, boolean>;
  loadingIndex: boolean;
  loadingSection: Record<string, boolean>;
  savingSection: Record<string, boolean>;
  printSelections: Record<string, boolean>;
  setPrintSelections: (value: Record<string, boolean>) => void;
  isPublished: boolean;
  canEdit: boolean;
  contents: Record<string, string>;
  drafts: Record<string, string>;
  sectionsMeta?: Record<
    string,
    {
      contentLength?: number;
    }
  >;
  setDrafts: (value: Record<string, string>) => void;
  editingKey: string | null;
  setEditingKey: (value: string | null) => void;
  handleAccordionChange: (
    key: string
  ) => (_: unknown, expanded: boolean) => void;
  handleSaveSection: (
    key: string,
    contentOverride?: string,
    language?: "html" | "json" | "javascript"
  ) => Promise<boolean>;
  exerciseGeneratorSource?: string;
  exerciseMode?: string | null;
  questionsPerExercise?: number;
  exercisesCount?: number;
  onExerciseConfigChange?: (questionsPerExercise: number, exercisesCount: number) => void;
  onDirtyClose: (key: string) => void;
  deleteMode: boolean;
  onRequestDelete: (key: string) => void;
};

const checkboxIconSx = {
  width: 16,
  height: 16,
  borderRadius: "4px",
  border: "2px solid",
  borderColor: "text.secondary",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

const checkboxCheckedIconSx = {
  ...checkboxIconSx,
  borderColor: "primary.main",
  bgcolor: "primary.main",
  color: "common.white",
};

const formatSectionLabel = (key: string) => {
  const match = key.match(/^([a-z_]+)-(\d+)$/);
  if (!match) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
  const base = match[1];
  const index = Number(match[2]);
  const baseLabel = base.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return `${baseLabel} ${index}`;
};

const SectionsList = ({
  sections,
  expandedKeys,
  loadingIndex,
  loadingSection,
  savingSection,
  printSelections,
  setPrintSelections,
  isPublished,
  canEdit,
  contents,
  drafts,
  sectionsMeta,
  setDrafts,
  editingKey,
  setEditingKey,
  handleAccordionChange,
  handleSaveSection,
  exerciseGeneratorSource,
  exerciseMode,
  questionsPerExercise = 0,
  exercisesCount = 0,
  onExerciseConfigChange,
  onDirtyClose,
  deleteMode,
  onRequestDelete,
}: SectionsListProps) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0, mt: -1 }}>
    {loadingIndex ? (
      <Box display="flex" justifyContent="center">
        <Box width="10rem">
          <LinearProgress />
        </Box>
      </Box>
    ) : (
      sections.map((section) => {
        const isExerciseSection =
          section.key === "exercises" || /^exercises-\d+$/.test(section.key);
        const generatorActive =
          isExerciseSection && exerciseMode === "generator";
        const isExpanded = Boolean(expandedKeys[section.key]);
        const isEditingSection = editingKey === section.key;
        const hasDraft = Object.prototype.hasOwnProperty.call(drafts, section.key);
        const hasContent = Object.prototype.hasOwnProperty.call(contents, section.key);
        const hasLocalValue = hasDraft || hasContent;
        const content = isEditingSection
          ? drafts[section.key] ?? ""
          : contents[section.key] ?? drafts[section.key] ?? "";
        const meta = sectionsMeta?.[section.key] as
          | { contentLength?: number; content_length?: number }
          | undefined;
        const metaLength = meta?.contentLength ?? meta?.content_length;
        const localValue = hasDraft
          ? drafts[section.key] ?? ""
          : hasContent
          ? contents[section.key] ?? ""
          : "";
        const contentLength = hasLocalValue
          ? localValue.trim().length
          : typeof metaLength === "number"
          ? metaLength
          : null;
        const dotColor =
          contentLength === null
            ? "grey.400"
            : contentLength > 0
            ? "success.main"
            : "error.main";
        return (
          <Accordion
            key={section.key}
            expanded={isExpanded}
            onChange={handleAccordionChange(section.key)}
            sx={{
              "&:first-of-type": {
                borderTop: "1px solid",
                borderColor: "divider",
              },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                {deleteMode && canEdit ? (
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestDelete(section.key);
                    }}
                    sx={{ color: "error.main" }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null}
                {!isPublished ? (
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "999px",
                      bgcolor: dotColor,
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.08) inset",
                      mr: "0.25rem",
                    }}
                  />
                ) : null}
                {isPublished ? (
                  <Checkbox
                    checked={printSelections[section.key] ?? true}
                    icon={<Box sx={checkboxIconSx} />}
                    checkedIcon={
                      <Box sx={checkboxCheckedIconSx}>
                        <CheckRoundedIcon sx={{ fontSize: 14 }} />
                      </Box>
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onChange={(event) => {
                      setPrintSelections({
                        ...printSelections,
                        [section.key]: event.target.checked,
                      });
                    }}
                    size="small"
                    sx={{ p: 0.5 }}
                  />
                ) : null}
                <Typography
                  variant="h3"
                  sx={{ fontSize: "1.05rem", color: "#1565c0" }}
                >
                  {formatSectionLabel(section.key)}
                </Typography>
              </Box>
              {isExerciseSection ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mr: "1rem",
                  }}
                >
                  <TextField
                    label="Questions"
                    size="small"
                    type="number"
                    value={questionsPerExercise}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = Number(event.target.value || 0);
                      onExerciseConfigChange?.(next, exercisesCount);
                    }}
                    inputProps={{ min: 0, max: 99 }}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Exercises"
                    size="small"
                    type="number"
                    value={exercisesCount}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = Number(event.target.value || 0);
                      onExerciseConfigChange?.(questionsPerExercise, next);
                    }}
                    inputProps={{ min: 0, max: 99 }}
                    sx={{ width: 120 }}
                  />
                </Box>
              ) : null}
            </AccordionSummary>
            <AccordionDetails
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                p: 0,
                mt: -4,
                minHeight: "4rem",
              }}
            >
              {loadingSection[section.key] ? (
                <Box display="flex" justifyContent="center">
                  <Box width="10rem">
                    <LinearProgress />
                  </Box>
                </Box>
              ) : (
                <SectionEditor
                  content={content}
                  onChange={(value) =>
                    setDrafts({
                      ...drafts,
                      [section.key]: value,
                    })
                  }
                  onSave={(contentOverride, language) =>
                    handleSaveSection(section.key, contentOverride, language)
                  }
                  saving={savingSection[section.key]}
                  disabled={loadingSection[section.key] || !canEdit || deleteMode}
                  dirty={
                    (drafts[section.key] ?? "") !==
                    (contents[section.key] ?? "")
                  }
                  editorKey={section.key}
                  isEditing={isEditingSection}
                  exerciseGeneratorActive={generatorActive}
                  exerciseGeneratorSource={exerciseGeneratorSource || ""}
                  sourceOverrides={
                    isExerciseSection
                      ? { javascript: exerciseGeneratorSource || "" }
                      : undefined
                  }
                  onToggleEdit={() => {
                    if (canEdit) {
                      setEditingKey(section.key);
                    }
                  }}
                  onCancelEdit={() => {
                    setEditingKey(null);
                    setDrafts({
                      ...drafts,
                      [section.key]: contents[section.key] ?? "",
                    });
                  }}
                  onDirtyClose={() => onDirtyClose(section.key)}
                />
              )}
            </AccordionDetails>
          </Accordion>
        );
      })
    )}
  </Box>
);

export default SectionsList;
