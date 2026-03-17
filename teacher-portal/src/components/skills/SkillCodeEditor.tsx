import { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, lineNumbers } from "@codemirror/view";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { json as jsonLanguage } from "@codemirror/lang-json";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";

type SkillCodeEditorProps = {
  label?: string;
  helperText?: string;
  language: "markdown" | "json";
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "0.92rem",
    minHeight: "280px",
  },
  ".cm-scroller": {
    minHeight: "280px",
    fontFamily:
      'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    backgroundColor: "#fffdf7",
  },
  ".cm-gutters": {
    backgroundColor: "#f7f0df",
    color: "#7b6f54",
    border: "none",
  },
  ".cm-content": {
    padding: "14px 12px",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(244, 167, 66, 0.08)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(244, 167, 66, 0.14)",
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "rgba(66, 133, 244, 0.25)",
  },
});

const buildExtensions = (
  language: "markdown" | "json",
  onChange: (value: string) => void
): Extension[] => [
  lineNumbers(),
  drawSelection(),
  highlightActiveLine(),
  syntaxHighlighting(defaultHighlightStyle),
  language === "json" ? jsonLanguage() : markdownLanguage(),
  EditorView.lineWrapping,
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  }),
  editorTheme,
];

const SkillCodeEditor = ({
  label,
  helperText,
  language,
  value,
  onChange,
  error,
}: SkillCodeEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: value,
        extensions: buildExtensions(language, (nextValue) => {
          onChangeRef.current(nextValue);
        }),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
  }, [value]);

  return (
    <Box>
      {label ? (
        <Typography fontWeight={700} mb={0.5}>
          {label}
        </Typography>
      ) : null}
      {helperText ? (
        <Typography variant="body2" color="text.secondary" mb={1}>
          {helperText}
        </Typography>
      ) : null}
      <Box
        sx={{
          border: "1px solid",
          borderColor: error ? "error.main" : "rgba(0,0,0,0.12)",
          borderRadius: "18px",
          overflow: "hidden",
          background:
            "linear-gradient(180deg, rgba(255,249,235,0.9) 0%, rgba(255,255,255,1) 100%)",
        }}
      >
        <Box ref={containerRef} />
      </Box>
      <Typography variant="caption" color={error ? "error.main" : "text.secondary"}>
        {error || "Changes save locally straight away in this preview build."}
      </Typography>
    </Box>
  );
};

export default SkillCodeEditor;
