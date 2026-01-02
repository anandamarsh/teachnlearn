import { Box, type BoxProps } from "@mui/material";

type HtmlPreviewProps = BoxProps & {
  value: string;
};

const HtmlPreview = ({ value, ...boxProps }: HtmlPreviewProps) => (
  <Box {...boxProps} dangerouslySetInnerHTML={{ __html: value || "" }} />
);

export default HtmlPreview;
