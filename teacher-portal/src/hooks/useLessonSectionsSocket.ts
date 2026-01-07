import { useEffect, useRef } from "react";
import type { GetAccessTokenSilently } from "../auth/buildAuthHeaders";

type UseLessonSectionsSocketOptions = {
  apiBaseUrl: string;
  auth0Audience: string;
  lessonId: string | null;
  isAuthenticated: boolean;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
  onSectionCreated: () => void;
  onSectionUpdated: (sectionKey: string) => void;
  onSectionDeleted?: (sectionKey: string) => void;
};

const buildLessonsWsUrl = (apiBaseUrl: string, token: string) => {
  const trimmed = apiBaseUrl.replace(/\/$/, "");
  const wsBase = trimmed.replace(/^http/, "ws");
  const url = new URL(`${wsBase}/ws/lessons`);
  url.searchParams.set("token", token);
  return url.toString();
};

export const useLessonSectionsSocket = ({
  apiBaseUrl,
  auth0Audience,
  lessonId,
  isAuthenticated,
  getAccessTokenSilently,
  onPulse,
  onSectionCreated,
  onSectionUpdated,
  onSectionDeleted,
}: UseLessonSectionsSocketOptions) => {
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const backoffRef = useRef(15000);
  const lastPongRef = useRef<number>(Date.now());
  const onSectionCreatedRef = useRef(onSectionCreated);
  const onSectionUpdatedRef = useRef(onSectionUpdated);
  const onSectionDeletedRef = useRef(onSectionDeleted);
  const onPulseRef = useRef(onPulse);

  useEffect(() => {
    onSectionCreatedRef.current = onSectionCreated;
  }, [onSectionCreated]);

  useEffect(() => {
    onSectionUpdatedRef.current = onSectionUpdated;
  }, [onSectionUpdated]);

  useEffect(() => {
    onSectionDeletedRef.current = onSectionDeleted;
  }, [onSectionDeleted]);

  useEffect(() => {
    onPulseRef.current = onPulse;
  }, [onPulse]);

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
      if (reconnectRef.current) {
        return;
      }
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, 120000);
      reconnectRef.current = window.setTimeout(() => {
        reconnectRef.current = null;
        connect();
      }, delay);
    };

    const connect = async () => {
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (socketRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return;
      }
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
          onPulseRef.current?.("success");
          backoffRef.current = 15000;
          lastPongRef.current = Date.now();
          clearTimers();
          heartbeatRef.current = window.setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
            }
            if (Date.now() - lastPongRef.current > 15000) {
              socket.close();
            }
          }, 10000);
        };
        socket.onclose = () => {
          onPulseRef.current?.("error");
          clearTimers();
          scheduleReconnect();
        };
        socket.onerror = () => {
          onPulseRef.current?.("error");
          scheduleReconnect();
        };
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              type?: string;
              lessonId?: string;
              sectionKey?: string;
            };
            if (payload.type === "pong") {
              lastPongRef.current = Date.now();
              return;
            }
            if (!payload.type?.startsWith("section.")) {
              return;
            }
            if (payload.lessonId !== lessonId) {
              return;
            }
            if (payload.type === "section.created") {
              onSectionCreatedRef.current();
            }
            if (payload.type === "section.updated" && payload.sectionKey) {
              onSectionUpdatedRef.current(payload.sectionKey);
            }
            if (payload.type === "section.deleted" && payload.sectionKey) {
              onSectionDeletedRef.current?.(payload.sectionKey);
            }
            onPulseRef.current?.("success");
          } catch {
            // Ignore malformed payloads.
          }
        };
      } catch {
        onPulseRef.current?.("error");
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      active = false;
      clearTimers();
      closeSocket();
    };
  }, [apiBaseUrl, auth0Audience, getAccessTokenSilently, isAuthenticated, lessonId]);
};
