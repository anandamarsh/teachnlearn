import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  LinearProgress,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
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
  setDrafts: (value: Record<string, string>) => void;
  editingKey: string | null;
  setEditingKey: (value: string | null) => void;
  handleAccordionChange: (
    key: string
  ) => (_: unknown, expanded: boolean) => void;
  handleSaveSection: (key: string) => void;
  onDirtyClose: (key: string) => void;
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
  setDrafts,
  editingKey,
  setEditingKey,
  handleAccordionChange,
  handleSaveSection,
  onDirtyClose,
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
        const isExpanded = Boolean(expandedKeys[section.key]);
        const isEditingSection = editingKey === section.key;
        const content = isEditingSection
          ? drafts[section.key] ?? ""
          : contents[section.key] ?? drafts[section.key] ?? "";
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
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                  {section.key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </Typography>
              </Box>
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
                  onSave={() => handleSaveSection(section.key)}
                  saving={savingSection[section.key]}
                  disabled={loadingSection[section.key] || !canEdit}
                  dirty={
                    (drafts[section.key] ?? "") !==
                    (contents[section.key] ?? "")
                  }
                  editorKey={section.key}
                  isEditing={isEditingSection}
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
