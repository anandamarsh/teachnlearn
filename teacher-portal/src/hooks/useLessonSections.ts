import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../auth/buildAuthHeaders";
import {
  fetchSectionContent,
  fetchSectionsIndex,
  fetchSectionsList,
  saveSectionContent,
} from "../api/lessonSections";

type SectionSummary = {
  key: string;
  filename: string;
};

type UseLessonSectionsOptions = {
  apiBaseUrl: string;
  auth0Audience: string;
  lessonId: string | null;
  isAuthenticated: boolean;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
};

const DEFAULT_ORDER = [
  "assessment",
  "samples",
  "concepts",
  "background",
  "lesson",
  "references",
  "exercises",
];

const buildLessonsWsUrl = (apiBaseUrl: string, token: string) => {
  const trimmed = apiBaseUrl.replace(/\/$/, "");
  const wsBase = trimmed.replace(/^http/, "ws");
  const url = new URL(`${wsBase}/ws/lessons`);
  url.searchParams.set("token", token);
  return url.toString();
};

const orderSections = (sections: SectionSummary[], order: string[]) => {
  const byKey = new Map(sections.map((section) => [section.key, section]));
  const ordered: SectionSummary[] = [];
  const sequence = order.length ? order : DEFAULT_ORDER;
  sequence.forEach((key) => {
    const match = byKey.get(key);
    if (match) {
      ordered.push(match);
      byKey.delete(key);
    }
  });
  const rest = Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
  return [...ordered, ...rest];
};

export const useLessonSections = ({
  apiBaseUrl,
  auth0Audience,
  lessonId,
  isAuthenticated,
  getAccessTokenSilently,
  onPulse,
}: UseLessonSectionsOptions) => {
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [loadingSection, setLoadingSection] = useState<Record<string, boolean>>({});
  const [savingSection, setSavingSection] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const backoffRef = useRef(10000);

  const baseEndpoint = useMemo(() => {
    if (!apiBaseUrl || !lessonId) {
      return "";
    }
    return `${apiBaseUrl}/lesson/id/${lessonId}/sections`;
  }, [apiBaseUrl, lessonId]);

  const sectionsListEndpoint = useMemo(() => {
    if (!apiBaseUrl) {
      return "";
    }
    return `${apiBaseUrl}/lesson/sections/list`;
  }, [apiBaseUrl]);

  const loadIndex = useCallback(async () => {
    if (!isAuthenticated || !baseEndpoint) {
      setSections([]);
      return;
    }
    setLoadingIndex(true);
    setError("");
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      let order = sectionOrder;
      if (!order.length && sectionsListEndpoint) {
        const listData = await fetchSectionsList(sectionsListEndpoint, headers);
        order = listData.sections || [];
        setSectionOrder(order);
      }
      const data = await fetchSectionsIndex(`${baseEndpoint}/index`, headers);
      const entries = Object.entries(data.sections || {}).map(([key, filename]) => ({
        key,
        filename,
      }));
      setSections(orderSections(entries, order));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to load sections index";
      setError(detail);
      setSections([]);
    } finally {
      setLoadingIndex(false);
    }
  }, [
    auth0Audience,
    baseEndpoint,
    getAccessTokenSilently,
    isAuthenticated,
    sectionOrder,
    sectionsListEndpoint,
  ]);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    setSections([]);
    setContents({});
    setLoadingSection({});
    setSavingSection({});
    setError("");
  }, [lessonId]);

  const loadSection = useCallback(
    async (key: string) => {
      if (!isAuthenticated || !baseEndpoint) {
        return;
      }
      if (contents[key]) {
        return;
      }
      setLoadingSection((prev) => ({ ...prev, [key]: true }));
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await fetchSectionContent(`${baseEndpoint}/${key}`, headers);
        setContents((prev) => ({ ...prev, [key]: data.contentMd || "" }));
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to load section";
        setError(detail);
      } finally {
        setLoadingSection((prev) => ({ ...prev, [key]: false }));
      }
    },
    [auth0Audience, baseEndpoint, contents, getAccessTokenSilently, isAuthenticated]
  );

  const refreshSection = useCallback(
    async (key: string) => {
      if (!isAuthenticated || !baseEndpoint) {
        return;
      }
      setLoadingSection((prev) => ({ ...prev, [key]: true }));
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await fetchSectionContent(`${baseEndpoint}/${key}`, headers);
        setContents((prev) => ({ ...prev, [key]: data.contentMd || "" }));
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to load section";
        setError(detail);
      } finally {
        setLoadingSection((prev) => ({ ...prev, [key]: false }));
      }
    },
    [auth0Audience, baseEndpoint, getAccessTokenSilently, isAuthenticated]
  );

  useEffect(() => {
    if (!isAuthenticated || !apiBaseUrl || !auth0Audience || !lessonId) {
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
          onPulse?.("error");
          clearTimers();
          scheduleReconnect();
        };
        socket.onerror = () => {
          onPulse?.("error");
          // Keep reconnect logic on close.
        };
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              type?: string;
              lessonId?: string;
              sectionKey?: string;
            };
            if (!payload.type?.startsWith("section.")) {
              return;
            }
            if (payload.lessonId !== lessonId) {
              return;
            }
            if (payload.type === "section.created") {
              loadIndex();
            }
            if (payload.sectionKey) {
              refreshSection(payload.sectionKey);
            }
            onPulse?.("success");
          } catch {
            // Ignore malformed payloads.
          }
        };
      } catch {
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
  }, [
    apiBaseUrl,
    auth0Audience,
    getAccessTokenSilently,
    isAuthenticated,
    lessonId,
    loadIndex,
    refreshSection,
  ]);

  const saveSection = useCallback(
    async (key: string, contentMd: string) => {
      if (!isAuthenticated || !baseEndpoint) {
        return false;
      }
      setSavingSection((prev) => ({ ...prev, [key]: true }));
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await saveSectionContent(`${baseEndpoint}/${key}`, headers, {
          contentMd,
        });
        setContents((prev) => ({ ...prev, [key]: data.contentMd || contentMd }));
        return true;
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to save section";
        setError(detail);
        return false;
      } finally {
        setSavingSection((prev) => ({ ...prev, [key]: false }));
      }
    },
    [auth0Audience, baseEndpoint, getAccessTokenSilently, isAuthenticated]
  );

  return {
    sections,
    contents,
    loadingIndex,
    loadingSection,
    savingSection,
    error,
    setError,
    loadSection,
    saveSection,
    refreshIndex: loadIndex,
    refreshSection,
  };
};
