import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../auth/buildAuthHeaders";
import {
  fetchSectionContent,
  fetchSectionsIndex,
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
};

const DEFAULT_ORDER = ["assessment", "analysis", "profile"];

const orderSections = (sections: SectionSummary[]) => {
  const byKey = new Map(sections.map((section) => [section.key, section]));
  const ordered: SectionSummary[] = [];
  DEFAULT_ORDER.forEach((key) => {
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
}: UseLessonSectionsOptions) => {
  const [sections, setSections] = useState<SectionSummary[]>([]);
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

  const loadIndex = useCallback(async () => {
    if (!isAuthenticated || !baseEndpoint) {
      setSections([]);
      return;
    }
    setLoadingIndex(true);
    setError("");
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const data = await fetchSectionsIndex(`${baseEndpoint}/index`, headers);
      const entries = Object.entries(data.sections || {}).map(([key, filename]) => ({
        key,
        filename,
      }));
      setSections(orderSections(entries));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to load sections index";
      setError(detail);
      setSections([]);
    } finally {
      setLoadingIndex(false);
    }
  }, [auth0Audience, baseEndpoint, getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

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
  };
};
