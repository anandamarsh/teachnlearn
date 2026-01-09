import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../auth/buildAuthHeaders";
import {
  fetchSectionContent,
  fetchSectionsIndex,
  fetchSectionsList,
  createSectionContent,
  deleteSectionContent,
  saveSectionContent,
} from "../api/lessonSections";
import { useLessonSectionsSocket } from "./useLessonSectionsSocket";

type SectionSummary = {
  key: string;
  filename: string;
};

type IndexRequestState = {
  inFlight?: Promise<void>;
  lastDone?: number;
};

const indexRequestCache = new Map<string, IndexRequestState>();

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
  "concepts",
  "background",
  "lesson",
  "exercises",
];

const getBaseKey = (key: string) => {
  const match = key.match(/^([a-z_]+)-\d+$/);
  return match ? match[1] : key;
};

const getKeyIndex = (key: string) => {
  const match = key.match(/-(\d+)$/);
  if (!match) {
    return 1;
  }
  return Number(match[1]) || 1;
};

const isExerciseSection = (key: string) => getBaseKey(key) === "exercises";
const HIDDEN_BASE_KEYS = new Set(["samples", "references"]);

const orderSections = (sections: SectionSummary[], order: string[]) => {
  const sequence = order.length ? order : DEFAULT_ORDER;
  const orderMap = new Map(sequence.map((key, idx) => [key, idx]));
  return [...sections].sort((left, right) => {
    const leftBase = getBaseKey(left.key);
    const rightBase = getBaseKey(right.key);
    const leftRank = orderMap.get(leftBase) ?? 999;
    const rightRank = orderMap.get(rightBase) ?? 999;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    if (leftBase === rightBase) {
      return getKeyIndex(left.key) - getKeyIndex(right.key);
    }
    return left.key.localeCompare(right.key);
  });
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
  const sectionOrderRef = useRef<string[]>([]);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [loadingSection, setLoadingSection] = useState<Record<string, boolean>>({});
  const [savingSection, setSavingSection] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const loadedKeysRef = useRef<Set<string>>(new Set());
  const recentlySavedRef = useRef<Record<string, number>>({});

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

  useEffect(() => {
    sectionOrderRef.current = sectionOrder;
  }, [sectionOrder]);

  const loadIndex = useCallback(async () => {
    if (!isAuthenticated || !baseEndpoint) {
      setSections([]);
      return;
    }
    const requestKey = baseEndpoint;
    const cached = indexRequestCache.get(requestKey);
    if (cached?.inFlight) {
      await cached.inFlight;
      return;
    }
    if (cached?.lastDone && Date.now() - cached.lastDone < 750) {
      return;
    }
    setLoadingIndex(true);
    setError("");
    const request = (async () => {
      try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      let order = sectionOrderRef.current;
      if (!order.length && sectionsListEndpoint) {
        const listData = await fetchSectionsList(sectionsListEndpoint, headers);
        order = (listData.sections || []).filter(
          (key) => !HIDDEN_BASE_KEYS.has(getBaseKey(key))
        );
        setSectionOrder(order);
        sectionOrderRef.current = order;
      }
      const data = await fetchSectionsIndex(`${baseEndpoint}/index`, headers);
      const entries = Object.entries(data.sections || {})
        .filter(([key]) => !HIDDEN_BASE_KEYS.has(getBaseKey(key)))
        .map(([key, filename]) => ({
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
        indexRequestCache.set(requestKey, { lastDone: Date.now() });
      }
    })();
    indexRequestCache.set(requestKey, { inFlight: request });
    try {
      await request;
    } finally {
      const entry = indexRequestCache.get(requestKey);
      if (entry?.inFlight === request) {
        indexRequestCache.set(requestKey, { lastDone: Date.now() });
      }
    }
  }, [
    auth0Audience,
    baseEndpoint,
    getAccessTokenSilently,
    isAuthenticated,
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
    loadedKeysRef.current = new Set();
  }, [lessonId]);

  const loadSection = useCallback(
    async (key: string) => {
      if (!isAuthenticated || !baseEndpoint) {
        return;
      }
      if (loadedKeysRef.current.has(key) || loadingSection[key]) {
        return;
      }
      setLoadingSection((prev) => ({ ...prev, [key]: true }));
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await fetchSectionContent(`${baseEndpoint}/${key}`, headers);
        if (isExerciseSection(key) && Array.isArray(data.content)) {
          setContents((prev) => ({
            ...prev,
            [key]: JSON.stringify(data.content, null, 2),
          }));
        } else {
          setContents((prev) => ({ ...prev, [key]: data.contentHtml || "" }));
        }
        loadedKeysRef.current.add(key);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to load section";
        setError(detail);
      } finally {
        setLoadingSection((prev) => ({ ...prev, [key]: false }));
      }
    },
    [auth0Audience, baseEndpoint, getAccessTokenSilently, isAuthenticated, loadingSection]
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
        if (isExerciseSection(key) && Array.isArray(data.content)) {
          setContents((prev) => ({
            ...prev,
            [key]: JSON.stringify(data.content, null, 2),
          }));
        } else {
          setContents((prev) => ({ ...prev, [key]: data.contentHtml || "" }));
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to load section";
        setError(detail);
      } finally {
        setLoadingSection((prev) => ({ ...prev, [key]: false }));
      }
    },
    [auth0Audience, baseEndpoint, getAccessTokenSilently, isAuthenticated]
  );

  const handleSectionUpdated = useCallback(
    (key: string) => {
      const lastSaved = recentlySavedRef.current[key];
      if (lastSaved && Date.now() - lastSaved < 2000) {
        return;
      }
      if (savingSection[key]) {
        return;
      }
      refreshSection(key);
    },
    [refreshSection, savingSection]
  );

  useLessonSectionsSocket({
    apiBaseUrl,
    auth0Audience,
    lessonId,
    isAuthenticated,
    getAccessTokenSilently,
    onPulse,
    onSectionCreated: loadIndex,
    onSectionUpdated: handleSectionUpdated,
    onSectionDeleted: () => {
      loadIndex();
    },
  });

  const saveSection = useCallback(
    async (key: string, contentHtml: string) => {
      if (!isAuthenticated || !baseEndpoint) {
        return false;
      }
      setSavingSection((prev) => ({ ...prev, [key]: true }));
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        let payload: { contentHtml?: string; content?: unknown };
        if (isExerciseSection(key)) {
          try {
            payload = { content: JSON.parse(contentHtml || "[]") };
          } catch (err) {
            const detail =
              err instanceof Error ? err.message : "Invalid JSON in exercises";
            throw new Error(detail);
          }
        } else {
          payload = { contentHtml };
        }
        const data = await saveSectionContent(`${baseEndpoint}/${key}`, headers, payload);
        if (isExerciseSection(key) && Array.isArray(data.content)) {
          setContents((prev) => ({
            ...prev,
            [key]: JSON.stringify(data.content, null, 2),
          }));
        } else {
          setContents((prev) => ({ ...prev, [key]: data.contentHtml || contentHtml }));
        }
        recentlySavedRef.current = { ...recentlySavedRef.current, [key]: Date.now() };
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
    createSection: async (baseKey: string) => {
      if (!isAuthenticated || !baseEndpoint) {
        return null;
      }
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const contentPayload =
          baseKey === "exercises" ? { content: [], createNew: true } : { contentHtml: "", createNew: true };
        const section = await createSectionContent(
          `${baseEndpoint}/${baseKey}`,
          headers,
          contentPayload
        );
        await loadIndex();
        return section;
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to create section";
        setError(detail);
        return null;
      }
    },
    deleteSection: async (key: string) => {
      if (!isAuthenticated || !baseEndpoint) {
        return false;
      }
      setError("");
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        await deleteSectionContent(`${baseEndpoint}/${key}`, headers);
        setContents((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        loadedKeysRef.current.delete(key);
        await loadIndex();
        return true;
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to delete section";
        setError(detail);
        return false;
      }
    },
  };
};
