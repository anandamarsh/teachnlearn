import { Box, type BoxProps } from "@mui/material";

type HtmlPreviewProps = BoxProps & {
  value: string;
};

const stripBoxShadow = (html: string) =>
  html.replace(/box-shadow\s*:[^;"']*;?/gi, "");

const HtmlPreview = ({ value, ...boxProps }: HtmlPreviewProps) => (
  <Box
    {...boxProps}
    dangerouslySetInnerHTML={{ __html: stripBoxShadow(value || "") }}
  />
);

export default HtmlPreview;
