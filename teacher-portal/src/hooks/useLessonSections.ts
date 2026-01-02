import { useCallback, useEffect, useMemo, useState } from "react";
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
  "answers",
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

  useLessonSectionsSocket({
    apiBaseUrl,
    auth0Audience,
    lessonId,
    isAuthenticated,
    getAccessTokenSilently,
    onPulse,
    onSectionCreated: loadIndex,
    onSectionUpdated: refreshSection,
  });

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
