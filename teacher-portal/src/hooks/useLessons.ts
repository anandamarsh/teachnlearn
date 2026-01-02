import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../auth/buildAuthHeaders";
import {
  createLesson,
  deleteLesson,
  duplicateLesson,
  fetchLesson,
  listLessons,
  updateLesson,
} from "../api/lessons";
import { Lesson, normalizeLesson } from "../state/lessonTypes";
import { useLessonsSocket } from "./useLessonsSocket";

type UseLessonsOptions = {
  apiBaseUrl: string;
  auth0Audience: string;
  isAuthenticated: boolean;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
};

export const useLessons = ({
  apiBaseUrl,
  auth0Audience,
  isAuthenticated,
  getAccessTokenSilently,
  onPulse,
}: UseLessonsOptions) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lessonsEndpoint = useMemo(() => (apiBaseUrl ? `${apiBaseUrl}/lesson` : ""), [
    apiBaseUrl,
  ]);

  const selectedLesson = useMemo(() => {
    if (!lessons.length) {
      return null;
    }
    return lessons.find((lesson) => lesson.id === selectedLessonId) || lessons[0];
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (!selectedLessonId && lessons.length) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const fetchLessons = useCallback(async () => {
    if (!isAuthenticated || !lessonsEndpoint) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const data = await listLessons(lessonsEndpoint, headers);
      const payload = Array.isArray(data) ? data : (data as { lessons?: unknown[] }).lessons;
      const normalized = (payload || []).map((item, index) =>
        normalizeLesson(item as Record<string, unknown>, `lesson-${index}`)
      );
      setLessons(normalized);
      if (normalized.length) {
        setSelectedLessonId((prev) => {
          if (prev && normalized.some((lesson) => lesson.id === prev)) {
            return prev;
          }
          return normalized[0].id;
        });
      } else {
        setSelectedLessonId(null);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to load lessons";
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]);

  const refreshLesson = useCallback(
    async (lessonId: string) => {
      if (!isAuthenticated || !lessonsEndpoint || !lessonId) {
        return;
      }
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await fetchLesson(`${lessonsEndpoint}/id/${lessonId}`, headers);
        const updated = normalizeLesson(data as Record<string, unknown>, lessonId);
        setLessons((prev) =>
          prev.map((lesson) => (lesson.id === lessonId ? updated : lesson))
        );
      } catch {
        // Ignore detail fetch failures to avoid breaking list view.
      }
    },
    [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]
  );

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  useEffect(() => {
    const loadLessonDetail = async () => {
      if (!isAuthenticated || !lessonsEndpoint || !selectedLessonId) {
        return;
      }
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await fetchLesson(`${lessonsEndpoint}/id/${selectedLessonId}`, headers);
        const updated = normalizeLesson(data as Record<string, unknown>, selectedLessonId);
        setLessons((prev) =>
          prev.map((lesson) => (lesson.id === selectedLessonId ? updated : lesson))
        );
      } catch {
        // Ignore detail fetch failures to avoid breaking list view.
      }
    };

    loadLessonDetail();
  }, [
    auth0Audience,
    getAccessTokenSilently,
    isAuthenticated,
    lessonsEndpoint,
    selectedLessonId,
  ]);

  const { wsConnected } = useLessonsSocket({
    apiBaseUrl,
    auth0Audience,
    isAuthenticated,
    getAccessTokenSilently,
    onPulse,
    onRefresh: fetchLessons,
    onLessonUpdated: refreshLesson,
  });

  const handleCreateLesson = useCallback(async () => {
    if (!isAuthenticated || !lessonsEndpoint) {
      return null;
    }
    setError("");
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const data = await createLesson(lessonsEndpoint, headers, { title: "New lesson" });
      const created = normalizeLesson(
        data as Record<string, unknown>,
        `lesson-${Date.now()}`
      );
      setLessons((prev) => [created, ...prev]);
      setSelectedLessonId(created.id);
      return created;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to create lesson";
      setError(detail);
      return null;
    }
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]);

  const handleUpdateLessonTitle = useCallback(
    async (lessonId: string, title: string) => {
      if (!isAuthenticated || !lessonsEndpoint) {
        return null;
      }
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await updateLesson(`${lessonsEndpoint}/id/${lessonId}`, headers, {
          title,
        });
        const updated = normalizeLesson(
          data as Record<string, unknown>,
          lessonId
        );
        setLessons((prev) =>
          prev.map((lesson) => (lesson.id === lessonId ? updated : lesson))
        );
        return updated;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Failed to update lesson";
        setError(detail);
        return null;
      }
    },
    [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]
  );

  const handleUpdateLessonContent = useCallback(
    async (lessonId: string, content: string) => {
      if (!isAuthenticated || !lessonsEndpoint) {
        return null;
      }
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await updateLesson(`${lessonsEndpoint}/id/${lessonId}`, headers, {
          content,
        });
        const updated = normalizeLesson(data as Record<string, unknown>, lessonId);
        setLessons((prev) =>
          prev.map((lesson) => (lesson.id === lessonId ? updated : lesson))
        );
        return updated;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Failed to update lesson";
        setError(detail);
        return null;
      }
    },
    [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]
  );

  const handleUpdateLessonStatus = useCallback(
    async (lessonId: string, status: string) => {
      if (!isAuthenticated || !lessonsEndpoint) {
        return null;
      }
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await updateLesson(`${lessonsEndpoint}/id/${lessonId}`, headers, {
          status,
        });
        const updated = normalizeLesson(data as Record<string, unknown>, lessonId);
        setLessons((prev) =>
          prev.map((lesson) => (lesson.id === lessonId ? updated : lesson))
        );
        return updated;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Failed to update lesson";
        setError(detail);
        return null;
      }
    },
    [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]
  );

  const handleDeleteLesson = useCallback(
    async (lessonId: string) => {
      if (!isAuthenticated || !lessonsEndpoint) {
        return false;
      }
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        await deleteLesson(`${lessonsEndpoint}/id/${lessonId}`, headers);
        setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
        setSelectedLessonId((prev) => (prev === lessonId ? null : prev));
        return true;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Failed to delete lesson";
        setError(detail);
        return false;
      }
    },
    [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]
  );

  const handleDuplicateLesson = useCallback(
    async (lessonId: string) => {
      if (!isAuthenticated || !lessonsEndpoint) {
        return null;
      }
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await duplicateLesson(
          `${lessonsEndpoint}/id/${lessonId}/duplicate`,
          headers
        );
        const created = normalizeLesson(
          data as Record<string, unknown>,
          `lesson-${Date.now()}`
        );
        setLessons((prev) => [created, ...prev]);
        setSelectedLessonId(created.id);
        return created;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Failed to duplicate lesson";
        setError(detail);
        return null;
      }
    },
    [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]
  );

  return {
    lessons,
    selectedLesson,
    selectedLessonId,
    setSelectedLessonId,
    loading,
    error,
    setError,
    wsConnected,
    refreshLessons: fetchLessons,
    createLesson: handleCreateLesson,
    updateLessonTitle: handleUpdateLessonTitle,
    updateLessonContent: handleUpdateLessonContent,
    updateLessonStatus: handleUpdateLessonStatus,
    deleteLesson: handleDeleteLesson,
    duplicateLesson: handleDuplicateLesson,
  };
};
