import { useEffect, useRef } from "react";
import { Box, IconButton } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { Editor, Viewer } from "@toast-ui/react-editor";
import "@toast-ui/editor/dist/toastui-editor.css";

type SectionEditorProps = {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
  dirty?: boolean;
  editorKey: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onCancelEdit: () => void;
  onDirtyClose: () => void;
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
}: SectionEditorProps) => {
  const editorRef = useRef<Editor>(null);
  const isSyncingRef = useRef(true);
  const viewerRef = useRef<Viewer>(null);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const handle = window.setTimeout(() => {
      const instance = editorRef.current?.getInstance();
      if (!instance) {
        return;
      }
      isSyncingRef.current = true;
      if (instance.getMarkdown() !== content) {
        instance.setMarkdown(content || "");
      }
      window.setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [content, isEditing]);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    const instance = viewerRef.current?.getInstance?.();
    if (!instance) {
      return;
    }
    instance.setMarkdown(content || "");
  }, [content, isEditing]);

  return (
    <Box sx={{ position: "relative" }}>
      {isEditing ? (
        <>
          <IconButton
            onClick={onSave}
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
              color: "text.secondary",
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
          <Box sx={{ pt: "2rem" }}>
            <Editor
              key={editorKey}
              ref={editorRef}
              initialValue={content || ""}
              previewStyle="tab"
              height="auto"
              initialEditType="wysiwyg"
              useCommandShortcut
              hideModeSwitch
              toolbarItems={[
                ["heading", "bold", "italic", "strike"],
                ["hr", "quote"],
                ["ul", "ol", "task"],
                ["link"],
                ["code", "codeblock"],
              ]}
              onChange={() => {
                const instance = editorRef.current?.getInstance();
                if (!instance) {
                  return;
                }
                if (isSyncingRef.current) {
                  return;
                }
                onChange(instance.getMarkdown());
              }}
              readOnly={disabled}
            />
          </Box>
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
                opacity: 1,
              },
            }}
          >
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
            <Box
              sx={{
                "&:hover .section-edit-button": {
                  opacity: 1,
                },
              }}
            >
            <Viewer ref={viewerRef} initialValue={content || ""} />
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default SectionEditor;
