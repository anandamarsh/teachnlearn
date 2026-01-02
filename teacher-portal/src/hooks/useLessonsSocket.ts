import { useEffect, useRef, useState } from "react";
import type { GetAccessTokenSilently } from "../auth/buildAuthHeaders";

type UseLessonsSocketOptions = {
  apiBaseUrl: string;
  auth0Audience: string;
  isAuthenticated: boolean;
  getAccessTokenSilently: GetAccessTokenSilently;
  onPulse?: (color: "success" | "error") => void;
  onRefresh: () => void;
};

const buildLessonsWsUrl = (apiBaseUrl: string, token: string) => {
  const trimmed = apiBaseUrl.replace(/\/$/, "");
  const wsBase = trimmed.replace(/^http/, "ws");
  const url = new URL(`${wsBase}/ws/lessons`);
  url.searchParams.set("token", token);
  return url.toString();
};

export const useLessonsSocket = ({
  apiBaseUrl,
  auth0Audience,
  isAuthenticated,
  getAccessTokenSilently,
  onPulse,
  onRefresh,
}: UseLessonsSocketOptions) => {
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const backoffRef = useRef(15000);
  const lastPongRef = useRef<number>(Date.now());
  const onRefreshRef = useRef(onRefresh);
  const onPulseRef = useRef(onPulse);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    onPulseRef.current = onPulse;
  }, [onPulse]);

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
          setWsConnected(true);
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
          setWsConnected(false);
          onPulseRef.current?.("error");
          clearTimers();
          scheduleReconnect();
        };
        socket.onerror = () => {
          setWsConnected(false);
          onPulseRef.current?.("error");
          scheduleReconnect();
        };
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { type?: string };
            if (payload.type === "pong") {
              lastPongRef.current = Date.now();
              return;
            }
            if (payload.type?.startsWith("lesson.")) {
              onRefreshRef.current();
            }
            onPulseRef.current?.("success");
          } catch {
            // Ignore malformed payloads.
          }
        };
      } catch {
        setWsConnected(false);
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
  }, [apiBaseUrl, auth0Audience, getAccessTokenSilently, isAuthenticated]);

  return { wsConnected };
};
