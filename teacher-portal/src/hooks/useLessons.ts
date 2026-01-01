import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../auth/buildAuthHeaders";
import {
  createLesson,
  deleteLesson,
  fetchLesson,
  listLessons,
  updateLesson,
} from "../api/lessons";
import { Lesson, normalizeLesson } from "../state/lessonTypes";

type UseLessonsOptions = {
  apiBaseUrl: string;
  auth0Audience: string;
  isAuthenticated: boolean;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
};

const buildLessonsWsUrl = (apiBaseUrl: string, token: string) => {
  const trimmed = apiBaseUrl.replace(/\/$/, "");
  const wsBase = trimmed.replace(/^http/, "ws");
  const url = new URL(`${wsBase}/ws/lessons`);
  url.searchParams.set("token", token);
  return url.toString();
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
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const backoffRef = useRef(10000);

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
        setSelectedLessonId(normalized[0].id);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to load lessons";
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, lessonsEndpoint]);

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

  useEffect(() => {
    if (!isAuthenticated || !apiBaseUrl || !auth0Audience) {
      return;
    }
    let active = true;

    const clearTimers = () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    const closeSocket = () => {
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onclose = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (!active) {
        return;
      }
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, 60000);
      reconnectRef.current = window.setTimeout(connect, delay);
    };

    const connect = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: auth0Audience },
        });
        if (!active) {
          return;
        }
        const wsUrl = buildLessonsWsUrl(apiBaseUrl, token);
        closeSocket();
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        socket.onopen = () => {
          if (!active) {
            socket.close();
            return;
          }
          setWsConnected(true);
          onPulse?.("success");
          backoffRef.current = 10000;
          clearTimers();
          heartbeatRef.current = window.setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
            }
          }, 10000);
        };
        socket.onclose = () => {
          setWsConnected(false);
          onPulse?.("error");
          clearTimers();
          scheduleReconnect();
        };
        socket.onerror = () => {
          setWsConnected(false);
          onPulse?.("error");
        };
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { type?: string };
            if (payload.type?.startsWith("lesson.")) {
              fetchLessons();
            }
            onPulse?.("success");
          } catch {
            // Ignore malformed payloads.
          }
        };
      } catch {
        setWsConnected(false);
        onPulse?.("error");
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      active = false;
      clearTimers();
      closeSocket();
    };
  }, [apiBaseUrl, auth0Audience, fetchLessons, getAccessTokenSilently, isAuthenticated]);

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
    deleteLesson: handleDeleteLesson,
  };
};
