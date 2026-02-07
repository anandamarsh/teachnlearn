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
  const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API || "";
  const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";
  const [titleDraft, setTitleDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [subjectDraft, setSubjectDraft] = useState("");
  const [levelDraft, setLevelDraft] = useState("");
  const [requiresLoginDraft, setRequiresLoginDraft] = useState(false);
  const [questionsPerExerciseDraft, setQuestionsPerExerciseDraft] = useState(0);
  const [exercisesCountDraft, setExercisesCountDraft] = useState(0);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [printSelections, setPrintSelections] = useState<
    Record<string, boolean>
  >({});
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [exerciseGeneratorSource, setExerciseGeneratorSource] = useState("");
  const [exerciseGeneratorLoaded, setExerciseGeneratorLoaded] = useState(false);
  const [exerciseGeneratorLoading, setExerciseGeneratorLoading] = useState(false);
  const [exerciseGeneratorSaving, setExerciseGeneratorSaving] = useState(false);
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
    setSectionContent,
  } = useLessonSections({
    apiBaseUrl,
    auth0Audience,
    lessonId: lesson?.id || null,
    isAuthenticated,
    getAccessTokenSilently,
    onPulse,
  });

  const statusValue = (lesson?.status || "draft").toLowerCase().trim();
  const isPublished =
    statusValue.includes("publish") || statusValue.includes("active");

  const isExerciseSection = (key: string) =>
    key === "exercises" || /^exercises-\d+$/.test(key);

  const { ensureReportUrl, handleOpenReport, openingReport } = useLessonReport({
    lesson,
    titleDraft,
    contentDraft,
    sections,
    printSelections,
    contents,
    loadSection,
    isPublished,
    apiBaseUrl,
    auth0Audience,
    getAccessTokenSilently,
  });

  useEffect(() => {
    setTitleDraft(lesson?.title || "");
    setContentDraft(lesson?.summary || "");
    setSubjectDraft(lesson?.subject || "");
    setLevelDraft(lesson?.level || "");
    setRequiresLoginDraft(Boolean(lesson?.requiresLogin));
    setQuestionsPerExerciseDraft(
      lesson?.exerciseConfig?.questionsPerExercise ?? 0
    );
    setExercisesCountDraft(lesson?.exerciseConfig?.exercisesCount ?? 0);
  }, [lesson]);

  useEffect(() => {
    setExpandedKeys({});
    setDrafts({});
    setEditingKey(null);
    setConfirmClose(null);
    setExerciseGeneratorLoaded(false);
    setExerciseGeneratorSource("");
  }, [lesson?.id]);

  useEffect(() => {
    let cancelled = false;
    const shouldLoadGenerator = Boolean(
      lesson?.exerciseMode === "generator" && lesson?.exerciseGenerator
    );
    if (!lesson || !apiBaseUrl || !isAuthenticated || !shouldLoadGenerator) {
      setExerciseGeneratorLoaded(false);
      setExerciseGeneratorSource("");
      setExerciseGeneratorLoading(false);
      return;
    }
    const load = async () => {
      setExerciseGeneratorLoading(true);
      try {
        const headers = await buildAuthHeaders(
          getAccessTokenSilently,
          auth0Audience
        );
        const endpoint = `${apiBaseUrl}/lesson/id/${lesson.id}/exercise/generator`;
        const response = await fetch(endpoint, { headers });
        if (response.status === 404) {
          if (!cancelled) {
            setExerciseGeneratorSource("");
            setExerciseGeneratorLoaded(true);
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to load generator");
        }
        const source = await response.text();
        if (!cancelled) {
          setExerciseGeneratorSource(source);
          setExerciseGeneratorLoaded(true);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load generator";
        onNotify(message, "error");
      } finally {
        if (!cancelled) {
          setExerciseGeneratorLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    auth0Audience,
    getAccessTokenSilently,
    isAuthenticated,
    lesson,
    onNotify,
  ]);

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
    const current = (lesson.summary || "").trim();
    if (trimmed === current) {
      setContentDraft(lesson.summary || "");
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

  const handleUpdateRequiresLogin = async (nextValue: boolean) => {
    if (!lesson) {
      return;
    }
    if (Boolean(lesson.requiresLogin) === nextValue) {
      setRequiresLoginDraft(Boolean(lesson.requiresLogin));
      return;
    }
    setRequiresLoginDraft(nextValue);
    setSavingMeta(true);
    await onUpdateMeta(lesson.id, { requiresLogin: nextValue });
    setSavingMeta(false);
  };

  const handleUpdateExerciseConfig = async (
    nextQuestions: number,
    nextExercises: number
  ) => {
    if (!lesson) {
      return;
    }
    const normalizedQuestions = Math.min(99, Math.max(0, nextQuestions));
    const normalizedExercises = Math.min(99, Math.max(0, nextExercises));
    const currentQuestions = lesson.exerciseConfig?.questionsPerExercise ?? 0;
    const currentExercises = lesson.exerciseConfig?.exercisesCount ?? 0;
    if (
      normalizedQuestions === currentQuestions &&
      normalizedExercises === currentExercises
    ) {
      setQuestionsPerExerciseDraft(currentQuestions);
      setExercisesCountDraft(currentExercises);
      return;
    }
    setQuestionsPerExerciseDraft(normalizedQuestions);
    setExercisesCountDraft(normalizedExercises);
    setSavingMeta(true);
    await onUpdateMeta(lesson.id, {
      exerciseConfig: {
        questionsPerExercise: normalizedQuestions,
        exercisesCount: normalizedExercises,
      },
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

  const handleSaveSection = async (
    key: string,
    contentOverride?: string,
    language?: "html" | "json" | "javascript"
  ): Promise<boolean> => {
    const contentHtml = contentOverride ?? drafts[key] ?? "";
    if (contentOverride !== undefined && language !== "javascript") {
      setDrafts((prev) => ({ ...prev, [key]: contentOverride }));
    }
    if (language === "javascript" && isExerciseSection(key)) {
      if (!lesson || !isAuthenticated) {
        return false;
      }
      if (!contentHtml.trim()) {
        onNotify("Generator code is required", "error");
        return false;
      }
      setExerciseGeneratorSaving(true);
      const saved = await saveSection(key, contentHtml, { contentType: "js" });
      setExerciseGeneratorSaving(false);
      if (saved) {
        setExerciseGeneratorSource(contentHtml);
        setSectionContent(key, "[]");
        onNotify("Exercise generator saved", "success");
        setEditingKey(null);
        return true;
      }
      onNotify("Failed to save generator", "error");
      return false;
    }
    const saved = await saveSection(key, contentHtml);
    if (saved) {
      onNotify("Section saved", "success");
      setEditingKey(null);
      return true;
    }
    return false;
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
      const meta = metaMap[section.key] as
        | { contentLength?: number; content_length?: number }
        | undefined;
      const metaLength = meta?.contentLength ?? meta?.content_length;
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

  useEffect(() => {
    if (!lesson || isPublished || syncingStatus) {
      return;
    }
    const nextStatus = allSectionsFilled ? "ready" : "draft";
    if (statusValue === nextStatus) {
      return;
    }
    const update = async () => {
      setSyncingStatus(true);
      await onUpdateStatus(lesson.id, nextStatus);
      setSyncingStatus(false);
    };
    update();
  }, [
    allSectionsFilled,
    isPublished,
    lesson,
    onUpdateStatus,
    statusValue,
    syncingStatus,
  ]);

  return {
    sections,
    contents,
    loadingIndex,
    loadingSection,
    savingSection,
    exerciseGeneratorSource,
    exerciseGeneratorLoaded,
    exerciseGeneratorLoading,
    exerciseGeneratorSaving,
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
    isAuthenticated,
    lesson,
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
  };
};
