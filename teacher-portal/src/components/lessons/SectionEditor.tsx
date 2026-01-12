import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import Alert from "@mui/material/Alert";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { javascript as javascriptLanguage } from "@codemirror/lang-javascript";
import { json as jsonLanguage } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { nord } from "@uiw/codemirror-theme-nord";
import {
  solarizedDark,
  solarizedLight,
} from "@uiw/codemirror-theme-solarized";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import prettier from "prettier/standalone";
import parserHtml from "prettier/plugins/html";
import parserBabel from "prettier/plugins/babel";
import parserEstree from "prettier/plugins/estree";
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
import { Alignment } from "@ckeditor/ckeditor5-alignment";
import {
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
} from "@ckeditor/ckeditor5-font";
import { Highlight } from "@ckeditor/ckeditor5-highlight";
import { Image, ImageCaption, ImageResize, ImageStyle, ImageToolbar } from "@ckeditor/ckeditor5-image";
import { MediaEmbed } from "@ckeditor/ckeditor5-media-embed";
import { Table, TableToolbar } from "@ckeditor/ckeditor5-table";
import { RemoveFormat } from "@ckeditor/ckeditor5-remove-format";
import { SpecialCharacters } from "@ckeditor/ckeditor5-special-characters";
import { SpecialCharactersEssentials } from "@ckeditor/ckeditor5-special-characters";
import { Base64UploadAdapter } from "@ckeditor/ckeditor5-upload";
import { GeneralHtmlSupport } from "@ckeditor/ckeditor5-html-support";
import "@ckeditor/ckeditor5-theme-lark/theme/theme.css";
import HtmlPreview from "./HtmlPreview";

type SourceThemeKey =
  | "vscodeLight"
  | "vscodeDark"
  | "oneDark"
  | "dracula"
  | "nord"
  | "solarizedLight"
  | "solarizedDark"
  | "monokai";

type SourceLanguage = "html" | "json" | "javascript";

const themeExtensions: Record<SourceThemeKey, Extension> = {
  vscodeLight,
  vscodeDark,
  oneDark,
  dracula,
  nord,
  solarizedLight,
  solarizedDark,
  monokai,
};

const baseSourceTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "0.85rem",
  },
  ".cm-scroller": {
    fontFamily:
      "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    overflowX: "hidden",
  },
  ".cm-content": {
    padding: "12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
});

const stripeThemes: Record<SourceThemeKey, Extension> = {
  vscodeLight: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(25, 118, 210, 0.06)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(25, 118, 210, 0.28)",
    },
  }),
  solarizedLight: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(38, 139, 210, 0.08)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(38, 139, 210, 0.3)",
    },
  }),
  vscodeDark: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(144, 202, 249, 0.08)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(144, 202, 249, 0.32)",
    },
  }),
  oneDark: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(97, 175, 239, 0.08)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(97, 175, 239, 0.3)",
    },
  }),
  dracula: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(189, 147, 249, 0.08)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(189, 147, 249, 0.3)",
    },
  }),
  nord: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(136, 192, 208, 0.08)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(136, 192, 208, 0.3)",
    },
  }),
  solarizedDark: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(38, 139, 210, 0.1)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(38, 139, 210, 0.35)",
    },
  }),
  monokai: EditorView.theme({
    ".cm-line:nth-child(odd)": { backgroundColor: "rgba(166, 226, 46, 0.08)" },
    ".cm-line:nth-child(even)": { backgroundColor: "transparent" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(166, 226, 46, 0.28)",
    },
  }),
};

const buildSourceExtensions = (
  language: SourceLanguage,
  theme: SourceThemeKey,
  onChange: (value: string) => void,
  readOnly = false
) => {
  const extensions: Extension[] = [
    language === "json"
      ? jsonLanguage()
      : language === "javascript"
      ? javascriptLanguage()
      : htmlLanguage(),
    syntaxHighlighting(defaultHighlightStyle),
    lineNumbers(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
    baseSourceTheme,
    themeExtensions[theme],
    stripeThemes[theme],
  ];
  if (readOnly) {
    extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
  }
  return extensions;
};

const stripEditorArtifacts = (value: string) =>
  value
    .replace(/\sdata-list-item-id="[^"]*"/g, "")
    .replace(/\sdata-list-id="[^"]*"/g, "");

class LessonHtmlEditor extends ClassicEditor {}

LessonHtmlEditor.builtinPlugins = [
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
  Alignment,
  FontColor,
  FontBackgroundColor,
  FontFamily,
  FontSize,
  Highlight,
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  MediaEmbed,
  Table,
  TableToolbar,
  RemoveFormat,
  SpecialCharacters,
  SpecialCharactersEssentials,
  Base64UploadAdapter,
  GeneralHtmlSupport,
];

LessonHtmlEditor.defaultConfig = {
  licenseKey: "GPL",
  toolbar: {
    items: [
      "heading",
      "|",
      "bold",
      "italic",
      "strikethrough",
      "underline",
      "subscript",
      "superscript",
      "fontSize",
      "fontFamily",
      "fontColor",
      "fontBackgroundColor",
      "highlight",
      "|",
      "link",
      "bulletedList",
      "numberedList",
      "insertTable",
      "alignment",
      "blockQuote",
      "codeBlock",
      "imageUpload",
      "mediaEmbed",
      "specialCharacters",
      "removeFormat",
      "|",
      "undo",
      "redo",
    ],
  },
  image: {
    toolbar: [
      "imageTextAlternative",
      "imageStyle:alignLeft",
      "imageStyle:alignCenter",
      "imageStyle:alignRight",
      "imageStyle:side",
      "imageStyle:block",
    ],
    styles: {
      options: ["alignLeft", "alignCenter", "alignRight", "side", "block"],
    },
    resizeOptions: [
      {
        name: "resizeImage:original",
        value: null,
        label: "Original",
      },
      {
        name: "resizeImage:50",
        value: "50",
        label: "50%",
      },
      {
        name: "resizeImage:75",
        value: "75",
        label: "75%",
      },
    ],
    resizeUnit: "%",
  },
  table: {
    contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
  },
  mediaEmbed: {
    previewsInData: true,
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
      { language: "html", label: "HTML" },
      { language: "css", label: "CSS" },
      { language: "javascript", label: "JavaScript" },
      { language: "json", label: "JSON" },
    ],
  },
};

type SectionEditorProps = {
  content: string;
  onChange: (content: string) => void;
  onSave: (
    contentOverride?: string,
    language?: SourceLanguage
  ) => Promise<boolean> | boolean;
  saving?: boolean;
  disabled?: boolean;
  dirty?: boolean;
  editorKey: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onCancelEdit: () => void;
  onDirtyClose: () => void;
  sourceOverrides?: Partial<Record<SourceLanguage, string>>;
  exerciseGeneratorActive?: boolean;
  exerciseGeneratorSource?: string;
};

const SectionEditor = ({
  content,
  onChange,
  onSave,
  saving,
  disabled,
  dirty,
  editorKey,
  isEditing,
  onToggleEdit,
  onCancelEdit,
  onDirtyClose,
  sourceOverrides,
  exerciseGeneratorActive,
  exerciseGeneratorSource,
}: SectionEditorProps) => {
  const editorRef = useRef<ClassicEditor | null>(null);
  const isSyncingRef = useRef(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceValue, setSourceValue] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>("html");
  const [sourceError, setSourceError] = useState("");
  const [sourceTheme, setSourceTheme] =
    useState<SourceThemeKey>("vscodeLight");
  const [suppressJsonAutoOpen, setSuppressJsonAutoOpen] = useState(false);
  const sourceDraftsRef = useRef<Partial<Record<SourceLanguage, string>>>({});
  const sourceContainerRef = useRef<HTMLDivElement | null>(null);
  const sourceViewRef = useRef<EditorView | null>(null);
  const jsonContainerRef = useRef<HTMLDivElement | null>(null);
  const jsonViewRef = useRef<EditorView | null>(null);
  const jsonModeRef = useRef<{
    readOnly: boolean;
    theme: SourceThemeKey;
    language: SourceLanguage;
  } | null>(null);
  const jsonContainerNodeRef = useRef<HTMLDivElement | null>(null);
  const isJsonSection = editorKey === "exercises" || /^exercises-\d+$/.test(editorKey);
  const generatorActive = Boolean(exerciseGeneratorActive);

  const getSourceSeed = (language: SourceLanguage, fallback: string) => {
    const draft = sourceDraftsRef.current[language];
    if (typeof draft === "string") {
      return draft;
    }
    const override = sourceOverrides?.[language];
    if (typeof override === "string") {
      return override;
    }
    return fallback;
  };

  useEffect(() => {
    sourceDraftsRef.current[sourceLanguage] = sourceValue;
  }, [sourceLanguage, sourceValue]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const instance = editorRef.current;
    if (!instance) {
      return;
    }
    if (instance.getData() !== (content || "")) {
      isSyncingRef.current = true;
      instance.setData(content || "");
      window.setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    }
  }, [content, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setSuppressJsonAutoOpen(false);
    }
    if (!isJsonSection || !isEditing || sourceOpen) {
      return;
    }
    if (suppressJsonAutoOpen) {
      return;
    }
    const preferredLanguage: SourceLanguage =
      sourceOverrides?.javascript ? "javascript" : "json";
    setSourceValue(getSourceSeed(preferredLanguage, content || ""));
    setSourceError("");
    setSourceLanguage(preferredLanguage);
    setSourceOpen(true);
  }, [
    content,
    isEditing,
    isJsonSection,
    sourceOpen,
    sourceOverrides,
    suppressJsonAutoOpen,
  ]);

  useEffect(() => {
    if (!isJsonSection) {
      jsonViewRef.current?.destroy();
      jsonViewRef.current = null;
      jsonModeRef.current = null;
      jsonContainerNodeRef.current = null;
      return;
    }
    const container = jsonContainerRef.current;
    if (!container) {
      return;
    }
    const containerChanged = jsonContainerNodeRef.current !== container;
    if (containerChanged) {
      jsonContainerNodeRef.current = container;
    }
    const readOnly = true;
    const docValue = generatorActive
      ? exerciseGeneratorSource || ""
      : typeof content === "string"
      ? content
      : "";
    const language: SourceLanguage = generatorActive ? "javascript" : "json";
    const mode = jsonModeRef.current;
    const shouldRebuild =
      containerChanged ||
      !jsonViewRef.current ||
      !mode ||
      mode.readOnly !== readOnly ||
      mode.theme !== sourceTheme ||
      mode.language !== language;
    if (shouldRebuild) {
      jsonViewRef.current?.destroy();
      jsonViewRef.current = new EditorView({
        parent: container,
        state: EditorState.create({
          doc: docValue,
          extensions: buildSourceExtensions(
            language,
            sourceTheme,
            (value) => {
              if (!readOnly) {
                onChange(value);
              }
            },
            readOnly
          ),
        }),
      });
      jsonModeRef.current = { readOnly, theme: sourceTheme, language };
      return;
    }
    const view = jsonViewRef.current;
    if (!view) {
      return;
    }
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== docValue) {
      const state = EditorState.create({
        doc: docValue,
        extensions: buildSourceExtensions(
          language,
          sourceTheme,
          (value) => {
            if (!readOnly) {
              onChange(value);
            }
          },
          readOnly
        ),
      });
      view.setState(state);
    }
  }, [
    content,
    exerciseGeneratorSource,
    generatorActive,
    isJsonSection,
    onChange,
    sourceTheme,
  ]);

  const handleSourceLanguageChange = (event: SelectChangeEvent) => {
    const value = event.target.value as SourceLanguage;
    setSourceLanguage(value);
    setSourceValue(getSourceSeed(value, sourceValue));
    setSourceError("");
  };

  const initSourceEditor = () => {
    if (!sourceContainerRef.current) {
      return;
    }
    const docValue = typeof sourceValue === "string" ? sourceValue : String(sourceValue ?? "");
    sourceViewRef.current?.destroy();
    sourceViewRef.current = new EditorView({
      parent: sourceContainerRef.current,
      state: EditorState.create({
        doc: docValue,
        extensions: buildSourceExtensions(sourceLanguage, sourceTheme, (value) => {
          setSourceValue(value);
          if (sourceError) {
            setSourceError("");
          }
        }),
      }),
    });
  };

  const destroySourceEditor = () => {
    sourceViewRef.current?.destroy();
    sourceViewRef.current = null;
  };

  useEffect(() => {
    if (!sourceOpen || !sourceViewRef.current) {
      return;
    }
    const state = EditorState.create({
      doc: sourceViewRef.current.state.doc.toString(),
      extensions: buildSourceExtensions(sourceLanguage, sourceTheme, (value) => {
        setSourceValue(value);
        if (sourceError) {
          setSourceError("");
        }
      }),
    });
    sourceViewRef.current.setState(state);
  }, [sourceLanguage, sourceOpen, sourceTheme]);

  const formatSource = async (value: string, language: SourceLanguage) => {
    try {
      const parser = language === "javascript" ? "babel" : language;
      const formatted = await prettier.format(value, {
        parser,
        plugins: language === "html" ? [parserHtml] : [parserBabel, parserEstree],
      });
      return { formatted, error: "" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to format source.";
      return { formatted: value, error: message };
    }
  };

  const handleCloseSourceModal = () => {
    setSourceOpen(false);
    if (isJsonSection) {
      setSuppressJsonAutoOpen(true);
      setSourceError("");
      onCancelEdit();
    }
  };

  return (
    <Box sx={{ position: "relative" }}>
      {isEditing ? (
        <>
          <IconButton
            onClick={() => onSave()}
            disabled={Boolean(saving || disabled || !dirty)}
            sx={{
              position: "absolute",
              top: "2rem",
              mt: "3px",
              right: 44,
              zIndex: 2,
              color: "text.secondary",
            }}
          >
            <SaveRoundedIcon />
          </IconButton>
          <IconButton
            onClick={() => {
              if (!content) {
                return;
              }
              navigator.clipboard.writeText(content);
            }}
            sx={{
              position: "absolute",
              top: "2rem",
              mt: "3px",
              right: 88,
              zIndex: 2,
              color: "text.secondary",
            }}
          >
            <ContentCopyRoundedIcon />
          </IconButton>
          <IconButton
            onClick={() => {
              if (dirty) {
                onDirtyClose();
              } else {
                onCancelEdit();
              }
            }}
            sx={{
              position: "absolute",
              top: "2rem",
              mt: "3px",
              right: 8,
              zIndex: 2,
              color: disabled ? "text.disabled" : "text.secondary",
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
          <IconButton
            onClick={async () => {
              const language: SourceLanguage = isJsonSection
                ? sourceOverrides?.javascript
                  ? "javascript"
                  : "json"
                : "html";
              const fallback = isJsonSection
                ? content ?? ""
                : stripEditorArtifacts(editorRef.current?.getData() ?? content ?? "");
              const startValue = getSourceSeed(language, fallback);
              const { formatted, error } = await formatSource(startValue, language);
              setSourceValue(formatted);
              setSourceError(error);
              setSourceLanguage(language);
              setSourceOpen(true);
            }}
            disabled={Boolean(disabled)}
            sx={{
              position: "absolute",
              top: "2rem",
              mt: "3px",
              right: 124,
              zIndex: 2,
              color: disabled ? "text.disabled" : "text.secondary",
            }}
          >
            <CodeRoundedIcon />
          </IconButton>
          <Box sx={{ pt: "2rem" }}>
            {isJsonSection ? (
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  overflow: "hidden",
                  minHeight: "18rem",
                  backgroundColor: "background.paper",
                }}
              >
                <Box ref={jsonContainerRef} sx={{ height: "100%", minHeight: "18rem" }} />
              </Box>
            ) : (
              <CKEditor
                key={editorKey}
                editor={LessonHtmlEditor}
                data={content || ""}
                disabled={disabled}
                onReady={(editor) => {
                  editorRef.current = editor;
                }}
                onChange={() => {
                  const instance = editorRef.current;
                  if (!instance || isSyncingRef.current) {
                    return;
                  }
                  onChange(stripEditorArtifacts(instance.getData()));
                }}
              />
            )}
          </Box>
          <Dialog
            open={sourceOpen}
            onClose={handleCloseSourceModal}
            fullScreen
            PaperProps={{
              sx: {
                m: "2rem",
                width: "calc(100% - 4rem)",
                height: "calc(100% - 4rem)",
              },
            }}
            TransitionProps={{
              onEntered: initSourceEditor,
              onExit: destroySourceEditor,
            }}
          >
            <DialogContent sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <Box
                sx={{
                  flex: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  overflow: "hidden",
                  backgroundColor: "#1e1e1e",
                }}
              >
                <Box ref={sourceContainerRef} sx={{ height: "100%", minHeight: 0 }} />
              </Box>
              {sourceError ? (
                <Box mt={1}>
                  <Alert severity="error">{sourceError}</Alert>
                </Box>
              ) : null}
            </DialogContent>
            <DialogActions sx={{ justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Select
                  size="small"
                  value={sourceLanguage}
                  onChange={handleSourceLanguageChange}
                  sx={{ minWidth: 110 }}
                >
                  {!isJsonSection ? <MenuItem value="html">HTML</MenuItem> : null}
                  <MenuItem value="json">JSON</MenuItem>
                  {isJsonSection ? (
                    <MenuItem value="javascript">JavaScript</MenuItem>
                  ) : null}
                </Select>
                <Select
                  size="small"
                  value={sourceTheme}
                  onChange={(event) => {
                    const value = event.target.value as SourceThemeKey;
                    setSourceTheme(value);
                  }}
                  sx={{ minWidth: 110 }}
                >
                  <MenuItem value="vscodeLight">VS Code Light</MenuItem>
                  <MenuItem value="vscodeDark">VS Code Dark</MenuItem>
                  <MenuItem value="oneDark">One Dark</MenuItem>
                  <MenuItem value="dracula">Dracula</MenuItem>
                  <MenuItem value="nord">Nord</MenuItem>
                  <MenuItem value="solarizedLight">Solarized Light</MenuItem>
                  <MenuItem value="solarizedDark">Solarized Dark</MenuItem>
                  <MenuItem value="monokai">Monokai</MenuItem>
                </Select>
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button onClick={handleCloseSourceModal}>Cancel</Button>
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sourceValue);
                    } catch {
                      const temp = document.createElement("textarea");
                      temp.value = sourceValue;
                      temp.style.position = "fixed";
                      temp.style.opacity = "0";
                      document.body.appendChild(temp);
                      temp.focus();
                      temp.select();
                      document.execCommand("copy");
                      document.body.removeChild(temp);
                    }
                  }}
                >
                  Copy
                </Button>
                <Button
                  onClick={async () => {
                    const { formatted, error } = await formatSource(
                      sourceValue,
                      sourceLanguage
                    );
                    setSourceValue(formatted);
                    setSourceError(error);
                  }}
                >
                  Format
                </Button>
                <Button
                  variant="contained"
                  onClick={async () => {
                    const currentValue =
                      sourceViewRef.current?.state.doc.toString() ?? sourceValue;
                    const { formatted, error } = await formatSource(
                      currentValue,
                      sourceLanguage
                    );
                    if (error) {
                      setSourceError(error);
                      return;
                    }
                    const cleaned = stripEditorArtifacts(formatted);
                    setSourceValue(cleaned);
                    const instance = editorRef.current;
                    if (sourceLanguage === "html") {
                      if (!instance) {
                        setSourceOpen(false);
                        return;
                      }
                      isSyncingRef.current = true;
                      instance.setData(cleaned);
                      onChange(cleaned);
                      window.setTimeout(() => {
                        isSyncingRef.current = false;
                      }, 0);
                    } else if (sourceLanguage === "json") {
                      onChange(cleaned);
                      const saved = await onSave(cleaned, "json");
                      if (!saved) {
                        return;
                      }
                    } else {
                      sourceDraftsRef.current.javascript = cleaned;
                      setSourceValue(cleaned);
                      setSuppressJsonAutoOpen(true);
                      const saved = await onSave(cleaned, "javascript");
                      if (!saved) {
                        return;
                      }
                    }
                    setSourceOpen(false);
                  }}
                >
                  Save
                </Button>
              </Box>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <>
          <Box
            sx={{
              position: "relative",
              border: "1px solid transparent",
              borderRadius: "0.75rem",
              padding: "1rem",
              minHeight: "auto",
              backgroundColor: "transparent",
              "&:hover .section-edit-button": {
                opacity: disabled ? 0 : 1,
              },
            }}
          >
            {!disabled ? (
              <IconButton
                onClick={onToggleEdit}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 2,
                  color: "primary.main",
                  backgroundColor: "transparent",
                  border: "none",
                  "&:hover": { backgroundColor: "action.hover" },
                  opacity: 0,
                  transition: "opacity 0.2s ease",
                }}
                className="section-edit-button"
              >
                <EditRoundedIcon />
              </IconButton>
            ) : null}
            <Box
              data-section-preview={editorKey}
              sx={{
                "&:hover .section-edit-button": {
                  opacity: disabled ? 0 : 1,
                },
              }}
            >
              {isJsonSection ? (
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                    minHeight: "12rem",
                    backgroundColor: "background.paper",
                  }}
                >
                  <Box ref={jsonContainerRef} sx={{ height: "100%", minHeight: "12rem" }} />
                </Box>
              ) : (
                <HtmlPreview value={content || ""} />
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default SectionEditor;
