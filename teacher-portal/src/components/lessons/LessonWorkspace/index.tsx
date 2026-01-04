import { Box } from "@mui/material";
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
    updates: { subject?: string | null; level?: string | null }
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
  const {
    sections,
    contents,
    loadingIndex,
    loadingSection,
    savingSection,
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
    handleConfirmClose,
    handleUpdateSubject,
    handleUpdateLevel,
    isPublished,
    canEdit,
    statusLabel,
    subjectDraft,
    levelDraft,
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
          savingMeta={savingMeta}
          onSubjectChange={handleUpdateSubject}
          onLevelChange={handleUpdateLevel}
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
      <SectionsList
        sections={sections}
        expandedKeys={expandedKeys}
        loadingIndex={loadingIndex}
        loadingSection={loadingSection}
        savingSection={savingSection}
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
      />
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
