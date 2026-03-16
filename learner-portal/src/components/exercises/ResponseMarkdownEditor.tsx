import { useEffect, useRef } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import { renderToStaticMarkup } from "react-dom/server";
import { Editor as ToastEditor } from "@toast-ui/editor";
import type { EditorOptions } from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import type { ResponseAttachment } from "../../state/types";

type ResponseMarkdownEditorProps = {
  value: string;
  teacherComment?: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onAttachFiles: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  attachments: ResponseAttachment[];
  dirty: boolean;
  saving: boolean;
  error?: string | null;
};

const ResponseMarkdownEditor = ({
  value,
  teacherComment,
  onChange,
  onSave,
  onAttachFiles,
  onRemoveAttachment,
  attachments,
  dirty,
  saving,
  error,
}: ResponseMarkdownEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ToastEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const suppressChangeRef = useRef(false);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const options: EditorOptions = {
      el: container,
      initialValue: value,
      initialEditType: "wysiwyg",
      previewStyle: "vertical",
      height: "320px",
      hideModeSwitch: true,
      usageStatistics: false,
      autofocus: false,
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task"],
        ["table", "link"],
        ["code", "codeblock"],
      ],
    };
    const editor = new ToastEditor(options);
    editor.on("change", () => {
      if (suppressChangeRef.current) {
        suppressChangeRef.current = false;
        return;
      }
      if (!userInteractedRef.current) {
        return;
      }
      onChangeRef.current(editor.getMarkdown());
    });
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const currentValue = editor.getMarkdown();
    if (currentValue === value) {
      return;
    }
    suppressChangeRef.current = true;
    editor.setMarkdown(value, false);
  }, [value]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const markInteracted = () => {
      userInteractedRef.current = true;
    };
    container.addEventListener("keydown", markInteracted, true);
    container.addEventListener("beforeinput", markInteracted, true);
    container.addEventListener("paste", markInteracted, true);
    container.addEventListener("cut", markInteracted, true);
    container.addEventListener("drop", markInteracted, true);

    const toolbar = container.querySelector(".toastui-editor-toolbar");
    if (!toolbar) {
      return () => {
        container.removeEventListener("keydown", markInteracted, true);
        container.removeEventListener("beforeinput", markInteracted, true);
        container.removeEventListener("paste", markInteracted, true);
        container.removeEventListener("cut", markInteracted, true);
        container.removeEventListener("drop", markInteracted, true);
      };
    }

    const actionHost = document.createElement("div");
    actionHost.className = "response-editor-toolbar-actions";

    const attachButton = document.createElement("button");
    attachButton.type = "button";
    attachButton.className = "response-editor-toolbar-action";
    attachButton.setAttribute("aria-label", "Attach files");
    attachButton.innerHTML = renderToStaticMarkup(
      <AttachFileRoundedIcon fontSize="small" />
    );
    attachButton.onclick = () => fileInputRef.current?.click();

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "response-editor-toolbar-action";
    saveButton.setAttribute("aria-label", "Save response");
    saveButton.innerHTML = renderToStaticMarkup(
      <SaveRoundedIcon fontSize="small" />
    );
    saveButton.disabled = !dirty || saving;
    saveButton.onclick = () => {
      if (!saveButton.disabled) {
        onSave();
      }
    };

    actionHost.appendChild(attachButton);
    actionHost.appendChild(saveButton);
    toolbar.appendChild(actionHost);

    return () => {
      actionHost.remove();
      container.removeEventListener("keydown", markInteracted, true);
      container.removeEventListener("beforeinput", markInteracted, true);
      container.removeEventListener("paste", markInteracted, true);
      container.removeEventListener("cut", markInteracted, true);
      container.removeEventListener("drop", markInteracted, true);
    };
  }, [dirty, onSave, saving]);

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
          <Box ref={containerRef} />
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
