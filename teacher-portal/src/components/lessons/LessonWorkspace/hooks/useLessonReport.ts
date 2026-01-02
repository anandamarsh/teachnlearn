import { useCallback, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../../../../auth/buildAuthHeaders";
import {
  createLessonReport,
  deleteLessonReport,
  fetchLessonReport,
} from "../../../../api/lessons";
import { Lesson } from "../../../../state/lessonTypes";
import { buildReportHtml } from "../utils/reportHtml";

type SectionKey = {
  key: string;
};

type UseLessonReportOptions = {
  lesson: Lesson | null;
  titleDraft: string;
  contentDraft: string;
  sections: SectionKey[];
  printSelections: Record<string, boolean>;
  contents: Record<string, string>;
  loadSection: (key: string) => Promise<void> | void;
  isPublished: boolean;
  apiBaseUrl: string;
  auth0Audience: string;
  getAccessTokenSilently: GetAccessTokenSilently;
};

type EnsureReportOptions = {
  forceCreate?: boolean;
};

const ensureSectionPreviews = async (
  keys: string[],
  loadSection: (key: string) => Promise<void> | void
) => {
  if (!keys.length) {
    return {} as Record<string, string>;
  }
  await Promise.all(keys.map((key) => loadSection(key)));
  const waitForPreview = (key: string) =>
    new Promise<void>((resolve) => {
      let attempts = 0;
      const check = () => {
        const node = document.querySelector(`[data-section-preview="${key}"]`);
        const state = node?.getAttribute("data-content-state");
        if (state === "loaded") {
          resolve();
          return;
        }
        attempts += 1;
        if (attempts > 80) {
          resolve();
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
  await Promise.all(keys.map((key) => waitForPreview(key)));
  return keys.reduce<Record<string, string>>((acc, key) => {
    const node = document.querySelector(`[data-section-preview="${key}"]`);
    acc[key] = node?.innerHTML ?? "";
    return acc;
  }, {});
};

export const useLessonReport = ({
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
}: UseLessonReportOptions) => {
  const [openingReport, setOpeningReport] = useState(false);
  const ensureReportUrl = useCallback(
    async (options?: EnsureReportOptions) => {
      if (!lesson || !apiBaseUrl || !auth0Audience) {
        return null;
      }
      const headers = await buildAuthHeaders(
        getAccessTokenSilently,
        auth0Audience
      );
      const endpoint = `${apiBaseUrl}/lesson/id/${lesson.id}/report`;
      if (!options?.forceCreate) {
        try {
          const existing = await fetchLessonReport(endpoint, headers);
          if (existing.url) {
            return existing.url;
          }
        } catch {
          // continue
        }
      }
      const selectedKeys = sections
        .filter((section) => printSelections[section.key] ?? true)
        .map((section) => section.key);
      const previewMap = await ensureSectionPreviews(selectedKeys, loadSection);
      const html = buildReportHtml({
        lesson,
        titleDraft,
        contentDraft,
        sections,
        printSelections,
        includePrintScript: false,
        contentsByKey: previewMap,
      });
      if (!html) {
        return null;
      }
      const created = await createLessonReport(endpoint, headers, { html });
      return created.url || null;
    },
    [
      apiBaseUrl,
      auth0Audience,
      contentDraft,
      getAccessTokenSilently,
      lesson,
      loadSection,
      printSelections,
      sections,
      titleDraft,
    ]
  );

  const handleOpenReport = useCallback(async () => {
    setOpeningReport(true);
    if (!lesson) {
      setOpeningReport(false);
      return;
    }
    if (!isPublished) {
      const selectedKeys = sections
        .filter((section) => printSelections[section.key] ?? true)
        .map((section) => section.key);
      const previewMap = await ensureSectionPreviews(selectedKeys, loadSection);
      const html = buildReportHtml({
        lesson,
        titleDraft,
        contentDraft,
        sections,
        printSelections,
        includePrintScript: false,
        contentsByKey: previewMap,
      });
      if (!html) {
        setOpeningReport(false);
        return;
      }
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 20000);
      setOpeningReport(false);
      return;
    }
    if (apiBaseUrl && auth0Audience) {
      try {
        const headers = await buildAuthHeaders(
          getAccessTokenSilently,
          auth0Audience
        );
        await deleteLessonReport(
          `${apiBaseUrl}/lesson/id/${lesson.id}/report`,
          headers
        );
      } catch {
        // Ignore delete failures (missing report, etc).
      }
    }
    const url = await ensureReportUrl({ forceCreate: true });
    if (!url) {
      setOpeningReport(false);
      return;
    }
    await navigator.clipboard.writeText(url);
    window.open(url, "_blank", "noopener,noreferrer");
    setOpeningReport(false);
  }, [
    apiBaseUrl,
    auth0Audience,
    contentDraft,
    ensureReportUrl,
    isPublished,
    lesson,
    loadSection,
    getAccessTokenSilently,
    contents,
    printSelections,
    sections,
    titleDraft,
  ]);

  return { ensureReportUrl, handleOpenReport, openingReport };
};
