import { useEffect, useRef, useState } from "react";
import { Lesson } from "../../../../state/lessonTypes";
import { buildAuthHeaders } from "../../../../auth/buildAuthHeaders";
import { deleteLessonReport } from "../../../../api/lessons";
import { useLessonSections } from "../../../../hooks/useLessonSections";
import type { GetAccessTokenSilently } from "../../../../auth/buildAuthHeaders";
import { useLessonReport } from "./useLessonReport";

type UseLessonWorkspaceStateOptions = {
  lesson: Lesson | null;
  hasLessons: boolean;
  isAuthenticated: boolean;
  onUpdateTitle: (lessonId: string, title: string) => Promise<Lesson | null>;
  onUpdateContent: (lessonId: string, content: string) => Promise<Lesson | null>;
  onUpdateStatus: (lessonId: string, status: string) => Promise<Lesson | null>;
  onUpdateMeta: (
    lessonId: string,
    updates: { subject?: string | null; level?: string | null }
  ) => Promise<Lesson | null>;
  onNotify: (message: string, severity: "success" | "error") => void;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
};

export const useLessonWorkspaceState = ({
  lesson,
  isAuthenticated,
  onUpdateTitle,
  onUpdateContent,
  onUpdateStatus,
  onUpdateMeta,
  onNotify,
  getAccessTokenSilently,
  onPulse,
}: UseLessonWorkspaceStateOptions) => {
  const [titleDraft, setTitleDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [subjectDraft, setSubjectDraft] = useState("");
  const [levelDraft, setLevelDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [printSelections, setPrintSelections] = useState<
    Record<string, boolean>
  >({});
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [creatingSection, setCreatingSection] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteTargetKey, setDeleteTargetKey] = useState<string | null>(null);
  const prevContentsRef = useRef<Record<string, string>>({});

  const {
    sections,
    contents,
    loadingIndex,
    loadingSection,
    savingSection,
    error,
    setError,
    loadSection,
    saveSection,
    createSection,
    deleteSection,
  } = useLessonSections({
    apiBaseUrl: import.meta.env.VITE_TEACHNLEARN_API || "",
    auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE || "",
    lessonId: lesson?.id || null,
    isAuthenticated,
    getAccessTokenSilently,
    onPulse,
  });

  const statusValue = (lesson?.status || "draft").toLowerCase().trim();
  const isPublished =
    statusValue.includes("publish") || statusValue.includes("active");

  const { ensureReportUrl, handleOpenReport, openingReport } = useLessonReport({
    lesson,
    titleDraft,
    contentDraft,
    sections,
    printSelections,
    contents,
    loadSection,
    isPublished,
    apiBaseUrl: import.meta.env.VITE_TEACHNLEARN_API || "",
    auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE || "",
    getAccessTokenSilently,
  });

  useEffect(() => {
    setTitleDraft(lesson?.title || "");
    setContentDraft(lesson?.content || "");
    setSubjectDraft(lesson?.subject || "");
    setLevelDraft(lesson?.level || "");
  }, [lesson]);

  useEffect(() => {
    setExpandedKeys({});
    setDrafts({});
    setEditingKey(null);
    setConfirmClose(null);
  }, [lesson?.id]);

  useEffect(() => {
    if (!sections.length) {
      setPrintSelections({});
      return;
    }
    setPrintSelections((prev) => {
      const next: Record<string, boolean> = {};
      sections.forEach((section) => {
        next[section.key] = prev[section.key] ?? true;
      });
      return next;
    });
  }, [sections]);

  useEffect(() => {
    if (!error) {
      return;
    }
    onNotify(error, "error");
    setError("");
  }, [error, onNotify, setError]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      const previous = prevContentsRef.current;
      Object.entries(contents).forEach(([key, value]) => {
        const priorContent = previous[key];
        const currentDraft = prev[key];
        if (currentDraft === undefined || currentDraft === priorContent) {
          next[key] = value ?? "";
        }
      });
      prevContentsRef.current = { ...contents };
      return next;
    });
  }, [contents]);

  const handleSaveTitle = async () => {
    if (!lesson) {
      return;
    }
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === lesson.title) {
      setTitleDraft(lesson.title);
      return;
    }
    setSavingTitle(true);
    await onUpdateTitle(lesson.id, trimmed);
    setSavingTitle(false);
  };

  const handleSaveContent = async (nextContent?: string) => {
    if (!lesson) {
      return;
    }
    const trimmed = (nextContent ?? contentDraft).trim();
    const current = (lesson.content || "").trim();
    if (trimmed === current) {
      setContentDraft(lesson.content || "");
      return;
    }
    setSavingContent(true);
    await onUpdateContent(lesson.id, trimmed);
    setSavingContent(false);
  };

  const handlePublish = async () => {
    if (!lesson) {
      return;
    }
    await onUpdateStatus(lesson.id, "published");
    try {
      await ensureReportUrl();
    } catch {
      // Report generation is best-effort on publish.
    }
    setPublishOpen(false);
  };

  const handleUnpublish = async () => {
    if (!lesson) {
      return;
    }
    try {
      const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API || "";
      const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";
      if (apiBaseUrl && audience) {
        const headers = await buildAuthHeaders(getAccessTokenSilently, audience);
        await deleteLessonReport(`${apiBaseUrl}/lesson/id/${lesson.id}/report`, headers);
      }
    } catch {
      // Ignore report cleanup failures to unblock status change.
    }
    await onUpdateStatus(lesson.id, "draft");
    setUnpublishOpen(false);
  };

  const handleUpdateSubject = async (value: string) => {
    if (!lesson) {
      return;
    }
    const nextValue = value.trim();
    if ((lesson.subject || "") === nextValue) {
      setSubjectDraft(lesson.subject || "");
      return;
    }
    setSubjectDraft(nextValue);
    setSavingMeta(true);
    await onUpdateMeta(lesson.id, {
      subject: nextValue ? nextValue : null,
    });
    setSavingMeta(false);
  };

  const handleUpdateLevel = async (value: string) => {
    if (!lesson) {
      return;
    }
    const nextValue = value.trim();
    if ((lesson.level || "") === nextValue) {
      setLevelDraft(lesson.level || "");
      return;
    }
    setLevelDraft(nextValue);
    setSavingMeta(true);
    await onUpdateMeta(lesson.id, {
      level: nextValue ? nextValue : null,
    });
    setSavingMeta(false);
  };

  const handleAccordionChange =
    (key: string) => (_: unknown, expanded: boolean) => {
      setExpandedKeys((prev) => ({ ...prev, [key]: expanded }));
      if (expanded) {
        loadSection(key);
      }
    };

  const handleSaveSection = async (key: string, contentOverride?: string) => {
    const contentHtml = contentOverride ?? drafts[key] ?? "";
    if (contentOverride !== undefined) {
      setDrafts((prev) => ({ ...prev, [key]: contentOverride }));
    }
    const saved = await saveSection(key, contentHtml);
    if (saved) {
      onNotify("Section saved", "success");
      setEditingKey(null);
    }
  };

  const handleCreateSection = async (baseKey: string) => {
    if (!createSection || !lesson) {
      return;
    }
    setCreatingSection(true);
    const created = await createSection(baseKey);
    setCreatingSection(false);
    if (!created || !created.key) {
      return;
    }
    setExpandedKeys((prev) => ({ ...prev, [created.key]: true }));
    setEditingKey(created.key);
    loadSection(created.key);
  };

  const handleRequestDelete = (key: string) => {
    setDeleteTargetKey(key);
  };

  const handleDeleteSection = async () => {
    if (!deleteSection || !deleteTargetKey) {
      return false;
    }
    const success = await deleteSection(deleteTargetKey);
    if (success) {
      setDeleteTargetKey(null);
    }
    return success;
  };

  const handleConfirmClose = () => {
    if (!confirmClose) {
      return;
    }
    setEditingKey(null);
    setDrafts((prev) => ({
      ...prev,
      [confirmClose]: contents[confirmClose] ?? "",
    }));
    setConfirmClose(null);
  };

  const canEdit = !isPublished;
  const metaMap = lesson?.sectionsMeta || {};
  const allSectionsFilled =
    sections.length > 0 &&
    sections.every((section) => {
      const metaLength = metaMap[section.key]?.contentLength;
      const hasDraft = Object.prototype.hasOwnProperty.call(drafts, section.key);
      const hasContent = Object.prototype.hasOwnProperty.call(contents, section.key);
      if (hasDraft || hasContent) {
        const localValue = hasDraft
          ? drafts[section.key] ?? ""
          : contents[section.key] ?? "";
        return localValue.trim().length > 0;
      }
      if (typeof metaLength === "number") {
        return metaLength > 0;
      }
      return false;
    });
  const statusLabel = isPublished
    ? "Published"
    : allSectionsFilled
    ? "Ready"
    : "Draft";

  return {
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
    handleCreateSection,
    handleRequestDelete,
    handleDeleteSection,
    handleConfirmClose,
    handleUpdateSubject,
    handleUpdateLevel,
    isPublished,
    canEdit,
    statusLabel,
    isAuthenticated,
    lesson,
    subjectDraft,
    levelDraft,
    creatingSection,
    deleteMode,
    setDeleteMode,
    deleteTargetKey,
    setDeleteTargetKey,
  };
};
