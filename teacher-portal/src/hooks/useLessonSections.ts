import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../auth/buildAuthHeaders";
import {
  fetchSectionContent,
  fetchSectionsIndex,
  fetchSectionsList,
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
  "samples",
  "concepts",
  "background",
  "lesson",
  "references",
  "exercises",
];

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
  return ordered;
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
        order = listData.sections || [];
        setSectionOrder(order);
        sectionOrderRef.current = order;
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
        setContents((prev) => ({ ...prev, [key]: data.contentHtml || "" }));
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
        setContents((prev) => ({ ...prev, [key]: data.contentHtml || "" }));
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
        const data = await saveSectionContent(`${baseEndpoint}/${key}`, headers, {
          contentHtml,
        });
        setContents((prev) => ({ ...prev, [key]: data.contentHtml || contentHtml }));
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
  };
};
