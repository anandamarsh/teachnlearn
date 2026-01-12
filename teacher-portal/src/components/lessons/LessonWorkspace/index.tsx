import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { Lesson } from "../../../state/lessonTypes";
import type { GetAccessTokenSilently } from "../../../auth/buildAuthHeaders";
import { useLessonWorkspaceState } from "./hooks/useLessonWorkspaceState";
import EmptyState from "./components/EmptyState";
import TitleHeader from "./components/TitleHeader";
import SummaryEditor from "./components/SummaryEditor";
import SectionsList from "./components/SectionsList";
import WorkspaceDialogs from "./components/WorkspaceDialogs";
import SectionPreviewCache from "./components/SectionPreviewCache";
import PrintOnly from "./components/PrintOnly";

type LessonWorkspaceProps = {
  lesson: Lesson | null;
  hasLessons: boolean;
  isAuthenticated: boolean;
  onUpdateTitle: (lessonId: string, title: string) => Promise<Lesson | null>;
  onUpdateContent: (
    lessonId: string,
    content: string
  ) => Promise<Lesson | null>;
  onUpdateStatus: (lessonId: string, status: string) => Promise<Lesson | null>;
  onUpdateMeta: (
    lessonId: string,
    updates: {
      subject?: string | null;
      level?: string | null;
      requiresLogin?: boolean;
      exerciseConfig?: {
        questionsPerExercise?: number | null;
        exercisesCount?: number | null;
      } | null;
    }
  ) => Promise<Lesson | null>;
  onNotify: (message: string, severity: "success" | "error") => void;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
};

const LessonWorkspace = ({
  lesson,
  hasLessons,
  isAuthenticated,
  onUpdateTitle,
  onUpdateContent,
  onUpdateStatus,
  onUpdateMeta,
  onNotify,
  getAccessTokenSilently,
  onPulse,
}: LessonWorkspaceProps) => {
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingSection, setDeletingSection] = useState(false);
  const {
    sections,
    contents,
    loadingIndex,
    loadingSection,
    savingSection,
    exerciseGeneratorSource,
    titleDraft,
    setTitleDraft,
    contentDraft,
    setContentDraft,
    savingTitle,
    savingContent,
    savingMeta,
    editingTitle,
    setEditingTitle,
    editingSummary,
    setEditingSummary,
    publishOpen,
    setPublishOpen,
    unpublishOpen,
    setUnpublishOpen,
    printSelections,
    setPrintSelections,
    expandedKeys,
    drafts,
    setDrafts,
    editingKey,
    setEditingKey,
    confirmClose,
    setConfirmClose,
    handleSaveTitle,
    handleSaveContent,
    handlePublish,
    handleUnpublish,
    handleOpenReport,
    openingReport,
    handleAccordionChange,
    handleSaveSection,
    handleCreateSection,
    handleRequestDelete,
    handleDeleteSection,
    handleConfirmClose,
    handleUpdateSubject,
    handleUpdateLevel,
    handleUpdateRequiresLogin,
    isPublished,
    canEdit,
    statusLabel,
    subjectDraft,
    levelDraft,
    requiresLoginDraft,
    questionsPerExerciseDraft,
    exercisesCountDraft,
    creatingSection,
    deleteMode,
    setDeleteMode,
    deleteTargetKey,
    setDeleteTargetKey,
    handleUpdateExerciseConfig,
  } = useLessonWorkspaceState({
    lesson,
    hasLessons,
    isAuthenticated,
    onUpdateTitle,
    onUpdateContent,
    onUpdateStatus,
    onUpdateMeta,
    onNotify,
    getAccessTokenSilently,
    onPulse,
  });

  if (!lesson) {
    return <EmptyState hasLessons={hasLessons} />;
  }

  const addButtonsDisabled = !canEdit || creatingSection || deleteMode;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 0,
          width: "100%",
        }}
      >
        <TitleHeader
          titleDraft={titleDraft}
          editingTitle={editingTitle}
          savingTitle={savingTitle}
          isAuthenticated={isAuthenticated}
          canEdit={canEdit}
          statusLabel={statusLabel}
          isPublished={isPublished}
          lessonId={lesson.id}
          subjectValue={subjectDraft}
          levelValue={levelDraft}
          requiresLogin={requiresLoginDraft}
          savingMeta={savingMeta}
          onSubjectChange={handleUpdateSubject}
          onLevelChange={handleUpdateLevel}
          onRequiresLoginChange={handleUpdateRequiresLogin}
          onEditTitle={() => setEditingTitle(true)}
          onTitleChange={setTitleDraft}
          onFinishTitle={() => {
            handleSaveTitle();
            setEditingTitle(false);
          }}
          onPublishClick={() => setPublishOpen(true)}
          onUnpublishClick={() => setUnpublishOpen(true)}
          onOpenReport={handleOpenReport}
          openingReport={openingReport}
          deleteMode={deleteMode}
        />
        <SummaryEditor
          contentDraft={contentDraft}
          editingSummary={editingSummary}
          savingContent={savingContent}
          isAuthenticated={isAuthenticated}
          canEdit={canEdit}
          onEditSummary={() => setEditingSummary(true)}
          onSummaryChange={setContentDraft}
          onFinishSummary={(value) => {
            handleSaveContent(value);
            setEditingSummary(false);
          }}
        />
      </Box>
      {!isPublished ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            mb: "0.5rem",
            mr: "0.5rem",
          }}
        >
          <Box
            role="button"
            onClick={() => {
              if (addButtonsDisabled) {
                return;
              }
              handleCreateSection("lesson");
            }}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              px: 2,
              py: 0.75,
              borderRadius: "5rem",
              backgroundColor: "info.main",
              color: "common.white",
              fontSize: "0.85rem",
              fontWeight: 700,
              textTransform: "capitalize",
              cursor: "pointer",
              opacity: addButtonsDisabled ? 0.6 : 1,
              userSelect: "none",
              "&:hover": {
                backgroundColor: addButtonsDisabled ? "info.main" : "info.dark",
              },
              "&:active": {
                backgroundColor: addButtonsDisabled ? "info.main" : "info.dark",
              },
            }}
          >
            Add Lesson
          </Box>
          <Box
            role="button"
            onClick={() => {
              if (addButtonsDisabled) {
                return;
              }
              handleCreateSection("exercises");
            }}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              px: 2,
              py: 0.75,
              borderRadius: "5rem",
              backgroundColor: "secondary.main",
              color: "common.white",
              fontSize: "0.85rem",
              fontWeight: 700,
              textTransform: "capitalize",
              cursor: "pointer",
              opacity: addButtonsDisabled ? 0.6 : 1,
              userSelect: "none",
              "&:hover": {
                backgroundColor:
                  addButtonsDisabled ? "secondary.main" : "secondary.dark",
              },
              "&:active": {
                backgroundColor:
                  addButtonsDisabled ? "secondary.main" : "secondary.dark",
              },
            }}
          >
            Add Exercise
          </Box>
        <Box
          role="button"
          onClick={() => {
            if (!canEdit) {
              return;
            }
            setDeleteMode((prev) => !prev);
            setDeleteTargetKey(null);
            setDeleteConfirmText("");
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            px: 2,
            py: 0.75,
            borderRadius: "5rem",
            backgroundColor: deleteMode ? "success.main" : "error.main",
            color: "common.white",
            fontSize: "0.85rem",
            fontWeight: 700,
            textTransform: "capitalize",
            cursor: "pointer",
            opacity: !canEdit ? 0.6 : 1,
            width: 92,
            justifyContent: "center",
            userSelect: "none",
            "&:hover": {
              backgroundColor: !canEdit
                ? deleteMode
                  ? "success.main"
                    : "error.main"
                  : deleteMode
                  ? "success.dark"
                  : "error.dark",
              },
              "&:active": {
                backgroundColor: !canEdit
                  ? deleteMode
                    ? "success.main"
                    : "error.main"
                  : deleteMode
                  ? "success.dark"
                  : "error.dark",
              },
            }}
          >
            {deleteMode ? "Done" : "Delete"}
          </Box>
        </Box>
      ) : null}
      <SectionsList
        sections={sections}
        expandedKeys={expandedKeys}
        loadingIndex={loadingIndex}
        loadingSection={loadingSection}
        savingSection={savingSection}
        exerciseGeneratorSource={exerciseGeneratorSource}
        exerciseMode={lesson.exerciseMode}
        questionsPerExercise={questionsPerExerciseDraft}
        exercisesCount={exercisesCountDraft}
        onExerciseConfigChange={handleUpdateExerciseConfig}
        printSelections={printSelections}
        setPrintSelections={setPrintSelections}
        isPublished={isPublished}
        canEdit={canEdit}
        contents={contents}
        drafts={drafts}
        sectionsMeta={lesson.sectionsMeta}
        setDrafts={setDrafts}
        editingKey={editingKey}
        setEditingKey={setEditingKey}
        handleAccordionChange={handleAccordionChange}
        handleSaveSection={handleSaveSection}
        onDirtyClose={(key) => setConfirmClose(key)}
        deleteMode={deleteMode}
        onRequestDelete={(key) => {
          setDeleteConfirmText("");
          handleRequestDelete(key);
        }}
      />
      <Dialog
        open={Boolean(deleteTargetKey)}
        onClose={() => {
          if (deletingSection) {
            return;
          }
          setDeleteTargetKey(null);
          setDeleteConfirmText("");
        }}
      >
        <DialogTitle>Delete section?</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography>
            Type <strong>Delete</strong> to permanently remove this section.
          </Typography>
          <TextField
            autoFocus
            label="Type Delete to confirm"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (deletingSection) {
                return;
              }
              setDeleteTargetKey(null);
              setDeleteConfirmText("");
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteConfirmText.trim() !== "Delete" || deletingSection}
            onClick={async () => {
              setDeletingSection(true);
              const success = await handleDeleteSection();
              setDeletingSection(false);
              if (success) {
                setDeleteConfirmText("");
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <WorkspaceDialogs
        confirmClose={confirmClose}
        onCancelClose={() => setConfirmClose(null)}
        onConfirmClose={handleConfirmClose}
        publishOpen={publishOpen}
        onCancelPublish={() => setPublishOpen(false)}
        onConfirmPublish={handlePublish}
        unpublishOpen={unpublishOpen}
        onCancelUnpublish={() => setUnpublishOpen(false)}
        onConfirmUnpublish={handleUnpublish}
      />
      <SectionPreviewCache sections={sections} contents={contents} />
      <PrintOnly
        lesson={lesson}
        titleDraft={titleDraft}
        contentDraft={contentDraft}
        sections={sections}
        printSelections={printSelections}
        contents={contents}
      />
    </>
  );
};

export default LessonWorkspace;
