import { useCallback } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../../../../auth/buildAuthHeaders";
import { createLessonReport, fetchLessonReport } from "../../../../api/lessons";
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
  loadSection: (key: string) => Promise<void> | void;
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
    return;
  }
  await Promise.all(keys.map((key) => loadSection(key)));
  const waitForPreview = (key: string) =>
    new Promise<void>((resolve) => {
      let attempts = 0;
      const check = () => {
        const node = document.querySelector(`[data-section-preview="${key}"]`);
        if (node?.innerHTML) {
          resolve();
          return;
        }
        attempts += 1;
        if (attempts > 20) {
          resolve();
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
  await Promise.all(keys.map((key) => waitForPreview(key)));
};

export const useLessonReport = ({
  lesson,
  titleDraft,
  contentDraft,
  sections,
  printSelections,
  loadSection,
  apiBaseUrl,
  auth0Audience,
  getAccessTokenSilently,
}: UseLessonReportOptions) => {
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
      await ensureSectionPreviews(selectedKeys, loadSection);
      const html = buildReportHtml({
        lesson,
        titleDraft,
        contentDraft,
        sections,
        printSelections,
        includePrintScript: false,
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
    if (!lesson) {
      return;
    }
    const url = await ensureReportUrl({ forceCreate: true });
    if (!url) {
      return;
    }
    await navigator.clipboard.writeText(url);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [ensureReportUrl, lesson]);

  return { ensureReportUrl, handleOpenReport };
};
