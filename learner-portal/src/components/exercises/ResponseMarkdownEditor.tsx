import { useEffect, useRef } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import { ClassicEditor } from "@ckeditor/ckeditor5-editor-classic";
import { Essentials } from "@ckeditor/ckeditor5-essentials";
import { Paragraph } from "@ckeditor/ckeditor5-paragraph";
import {
  Bold,
  Italic,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from "@ckeditor/ckeditor5-basic-styles";
import { Heading } from "@ckeditor/ckeditor5-heading";
import { Link } from "@ckeditor/ckeditor5-link";
import { List } from "@ckeditor/ckeditor5-list";
import { BlockQuote } from "@ckeditor/ckeditor5-block-quote";
import { CodeBlock } from "@ckeditor/ckeditor5-code-block";
import {
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
} from "@ckeditor/ckeditor5-font";
import { Highlight } from "@ckeditor/ckeditor5-highlight";
import { Table, TableToolbar } from "@ckeditor/ckeditor5-table";
import { RemoveFormat } from "@ckeditor/ckeditor5-remove-format";
import {
  SpecialCharacters,
  SpecialCharactersArrows,
  SpecialCharactersCurrency,
  SpecialCharactersEssentials,
  SpecialCharactersLatin,
  SpecialCharactersMathematical,
  SpecialCharactersText,
} from "@ckeditor/ckeditor5-special-characters";
import { GeneralHtmlSupport } from "@ckeditor/ckeditor5-html-support";
import { Markdown } from "@ckeditor/ckeditor5-markdown-gfm";
import "@ckeditor/ckeditor5-theme-lark/theme/theme.css";
import type { ResponseAttachment } from "../../state/types";

type ResponseMarkdownEditorProps = {
  value: string;
  teacherComment?: string;
  reviewStatus?: "approved" | "rejected" | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onAttachFiles: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  attachments: ResponseAttachment[];
  dirty: boolean;
  saving: boolean;
  error?: string | null;
};

class LessonResponseEditor extends ClassicEditor {}

const chemistrySpecialCharacterItems = [
  { title: "Reaction arrow", character: "→" },
  { title: "Equilibrium arrow", character: "⇌" },
  { title: "Reversible arrow", character: "↔" },
  { title: "Delta", character: "Δ" },
  { title: "Degree", character: "°" },
  { title: "Plus-minus", character: "±" },
  { title: "Middle dot", character: "·" },
  { title: "Micro", character: "µ" },
  { title: "Alpha", character: "α" },
  { title: "Beta", character: "β" },
  { title: "Gamma", character: "γ" },
  { title: "Lambda", character: "λ" },
  { title: "Omega", character: "Ω" },
  { title: "Left arrow", character: "←" },
  { title: "Up arrow", character: "↑" },
  { title: "Down arrow", character: "↓" },
  { title: "Approximately equal", character: "≈" },
  { title: "Not equal", character: "≠" },
  { title: "Less than or equal", character: "≤" },
  { title: "Greater than or equal", character: "≥" },
];

const registerChemistrySpecialCharacters = (editor: ClassicEditor) => {
  const specialCharacters = editor.plugins.get("SpecialCharacters") as {
    addItems: (
      category: string,
      items: Array<{ title: string; character: string }>,
    ) => void;
  };
  specialCharacters.addItems("Chemistry", chemistrySpecialCharacterItems);
};

LessonResponseEditor.builtinPlugins = [
  Essentials,
  Paragraph,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Subscript,
  Superscript,
  Heading,
  Link,
  List,
  BlockQuote,
  CodeBlock,
  FontColor,
  FontBackgroundColor,
  FontFamily,
  FontSize,
  Highlight,
  Table,
  TableToolbar,
  RemoveFormat,
  SpecialCharacters,
  SpecialCharactersArrows,
  SpecialCharactersCurrency,
  SpecialCharactersEssentials,
  SpecialCharactersLatin,
  SpecialCharactersMathematical,
  SpecialCharactersText,
  GeneralHtmlSupport,
  Markdown,
];

LessonResponseEditor.defaultConfig = {
  licenseKey: "GPL",
  toolbar: {
    shouldNotGroupWhenFull: true,
    items: [
      "heading",
      "|",
      "bold",
      "italic",
      "strikethrough",
      "underline",
      "subscript",
      "superscript",
      "|",
      "fontSize",
      "fontFamily",
      "fontColor",
      "fontBackgroundColor",
      "highlight",
      "|",
      "link",
      "bulletedList",
      "numberedList",
      "todoList",
      "insertTable",
      "blockQuote",
      "codeBlock",
      "specialCharacters",
      "removeFormat",
      "|",
      "undo",
      "redo",
    ],
  },
  table: {
    contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
  },
  htmlSupport: {
    allow: [
      {
        name: /.*/,
        attributes: true,
        classes: true,
        styles: true,
      },
    ],
  },
  codeBlock: {
    languages: [
      { language: "plaintext", label: "Plain text" },
      { language: "markdown", label: "Markdown" },
      { language: "html", label: "HTML" },
      { language: "javascript", label: "JavaScript" },
      { language: "json", label: "JSON" },
    ],
  },
};

const ResponseMarkdownEditor = ({
  value,
  teacherComment,
  reviewStatus,
  onChange,
  onSave,
  onAttachFiles,
  onRemoveAttachment,
  attachments,
  dirty,
  saving,
  error,
}: ResponseMarkdownEditorProps) => {
  const editorRef = useRef<LessonResponseEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.getData() === value) {
      return;
    }
    editor.setData(value || "");
  }, [value]);

  return (
    <Box className="response-editor-shell">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          onAttachFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <Box
        className="response-editor-dropzone"
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          onAttachFiles(event.dataTransfer.files);
        }}
      >
        <Box className="response-editor-box">
          <Box className="response-editor-header">
            <Box className="response-editor-header-note">
              Rich text, headings, tables, subscript, superscript, and symbols are supported.
            </Box>
            <Box className="response-editor-toolbar-actions">
              <button
                type="button"
                className="response-editor-toolbar-action"
                aria-label="Attach files"
                title="Attach files"
                onClick={() => fileInputRef.current?.click()}
              >
                <AttachFileRoundedIcon fontSize="small" />
              </button>
              <button
                type="button"
                className="response-editor-toolbar-action"
                aria-label="Save response"
                title="Save response"
                disabled={!dirty || saving}
                onClick={() => {
                  if (!dirty || saving) {
                    return;
                  }
                  onSave();
                }}
              >
                <SaveRoundedIcon fontSize="small" />
              </button>
            </Box>
          </Box>
          <CKEditor
            editor={LessonResponseEditor}
            data={value || ""}
            disabled={saving}
            onReady={(editor) => {
              registerChemistrySpecialCharacters(editor);
              editorRef.current = editor as LessonResponseEditor;
            }}
            onChange={(_, editor) => {
              const nextValue = editor.getData();
              if (nextValue !== value) {
                onChange(nextValue);
              }
            }}
          />
        </Box>
      </Box>
      {attachments.length ? (
        <Box className="response-attachment-list">
          {attachments.map((attachment) => (
            <Box key={attachment.id} className="response-attachment-chip">
              <a
                href={attachment.url || "#"}
                target={attachment.url ? "_blank" : undefined}
                rel={attachment.url ? "noreferrer" : undefined}
                className="response-attachment-link"
                onClick={(event) => {
                  if (!attachment.url) {
                    event.preventDefault();
                  }
                }}
              >
                <DescriptionRoundedIcon fontSize="small" />
                <span>{attachment.name}</span>
              </a>
              <IconButton
                size="small"
                aria-label="Remove attachment"
                onClick={() => onRemoveAttachment(attachment.id)}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      ) : null}
      {reviewStatus ? (
        <Box
          sx={{
            mt: 1.5,
            display: "inline-flex",
            alignItems: "center",
            px: 1.25,
            py: 0.5,
            borderRadius: "999px",
            fontSize: "0.78rem",
            fontWeight: 800,
            color: reviewStatus === "approved" ? "#1b5e20" : "#b71c1c",
            backgroundColor:
              reviewStatus === "approved" ? "#e8f5e9" : "#ffebee",
            border:
              reviewStatus === "approved"
                ? "1px solid rgba(46,125,50,0.24)"
                : "1px solid rgba(198,40,40,0.24)",
          }}
        >
          {reviewStatus === "approved" ? "Approved" : "Rejected"}
        </Box>
      ) : null}
      {teacherComment?.trim() ? (
        <Box
          sx={{
            mt: 1.5,
            px: 1.5,
            py: 1.25,
            borderRadius: "0.9rem",
            border: "1px solid rgba(180,134,0,0.28)",
            backgroundColor: "#fff7d6",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontWeight: 800,
              color: "#8a5a00",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              mb: 0.5,
            }}
          >
            Teacher Comment
          </Typography>
          <Typography sx={{ color: "#5c4200", whiteSpace: "pre-wrap" }}>
            {teacherComment}
          </Typography>
        </Box>
      ) : null}
      {error ? <Typography className="response-editor-error">{error}</Typography> : null}
    </Box>
  );
};

export default ResponseMarkdownEditor;
