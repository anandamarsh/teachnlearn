import { Box } from "@mui/material";
import { Viewer } from "@toast-ui/react-editor";

type SectionSummary = {
  key: string;
};

type SectionPreviewCacheProps = {
  sections: SectionSummary[];
  contents: Record<string, string>;
};

const SectionPreviewCache = ({ sections, contents }: SectionPreviewCacheProps) => (
  <Box sx={{ display: "none" }}>
    {sections.map((section) => {
      const value = contents[section.key] || "";
      const hash = value
        .split("")
        .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
      return (
        <Box
          key={`render-${section.key}-${hash}`}
          data-section-preview={section.key}
        >
          <Viewer initialValue={value} />
        </Box>
      );
    })}
  </Box>
);

export default SectionPreviewCache;
