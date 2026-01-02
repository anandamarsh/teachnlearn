import { Box, Typography } from "@mui/material";
import { Lesson } from "../../../../state/lessonTypes";
import HtmlPreview from "../../HtmlPreview";

type SectionSummary = {
  key: string;
};

type PrintOnlyProps = {
  lesson: Lesson;
  titleDraft: string;
  contentDraft: string;
  sections: SectionSummary[];
  printSelections: Record<string, boolean>;
  contents: Record<string, string>;
};

const PrintOnly = ({
  lesson,
  titleDraft,
  contentDraft,
  sections,
  printSelections,
  contents,
}: PrintOnlyProps) => (
  <Box className="print-only">
    <Typography variant="h2" sx={{ mb: 1 }}>
      {titleDraft || lesson.title}
    </Typography>
    {contentDraft ? (
      <Typography variant="subtitle1" sx={{ mb: 3 }}>
        {contentDraft}
      </Typography>
    ) : null}
    {sections
      .filter((section) => printSelections[section.key] ?? true)
      .map((section) => (
        <Box key={`print-${section.key}`} sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ mb: 1 }}>
            {section.key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (char) => char.toUpperCase())}
          </Typography>
          <HtmlPreview value={contents[section.key] || ""} />
        </Box>
      ))}
  </Box>
);

export default PrintOnly;
