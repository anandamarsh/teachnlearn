import { Box } from "@mui/material";
import HtmlPreview from "../../HtmlPreview";

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
      const isLoaded = Object.prototype.hasOwnProperty.call(contents, section.key);
      const hash = value
        .split("")
        .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
      return (
        <Box
          key={`render-${section.key}-${hash}`}
          data-section-preview={section.key}
          data-content-state={isLoaded ? "loaded" : "missing"}
        >
          <HtmlPreview value={value} />
        </Box>
      );
    })}
  </Box>
);

export default SectionPreviewCache;
