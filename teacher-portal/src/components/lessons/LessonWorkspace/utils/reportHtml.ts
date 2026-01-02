import { Lesson } from "../../../../state/lessonTypes";

type SectionKey = {
  key: string;
};

type BuildReportHtmlOptions = {
  lesson: Lesson;
  titleDraft: string;
  contentDraft: string;
  sections: SectionKey[];
  printSelections: Record<string, boolean>;
  includePrintScript: boolean;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildReportHtml = ({
  lesson,
  titleDraft,
  contentDraft,
  sections,
  printSelections,
  includePrintScript,
}: BuildReportHtmlOptions) => {
  const selectedSections = sections.filter(
    (section) => printSelections[section.key] ?? true
  );
  const summaryHtml = contentDraft
    ? `<p class="summary">${escapeHtml(contentDraft)}</p>`
    : "";
  const hasSections = selectedSections.length > 0;
  const footerHtml =
    "(C) TeachNLearn - Individualised Lessons for each child";
  const tocHtml = selectedSections
    .map((section) => {
      const heading = section.key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
      return `<li><a href="#section-${section.key}">${escapeHtml(
        heading
      )}</a></li>`;
    })
    .join("");
  const sectionHtml = selectedSections
    .map((section) => {
      const heading = section.key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
      const bodyHtml = document.querySelector(
        `[data-section-preview="${section.key}"]`
      )?.innerHTML;
      return `
          <section class="section-block" id="section-${section.key}">
            <h2>${escapeHtml(heading)}</h2>
            <div class="section-body">${bodyHtml || ""}</div>
          </section>
        `;
    })
    .join("");

  return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(titleDraft || lesson.title || "Lesson")}</title>
          <link rel="stylesheet" href="https://uicdn.toast.com/editor/latest/toastui-editor.css">
          <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: "Helvetica Neue", Arial, sans-serif; padding: 32px; color: #1f2933; }
            h1 { font-size: 24px; margin: 0 0 8px; }
            h2 { font-size: 18px; margin: 24px 0 8px; color: #1f63b5; }
            .summary { margin: 0; color: #4b5563; text-align: left; max-width: 720px; }
            .section-body {
              line-height: 1.6;
              border: none;
              border-radius: 12px;
              padding: 16px;
              background: #fff;
            }
            .section-block {
              position: relative;
              padding-bottom: 48px;
            }
            .section-block + .section-block {
              break-before: page;
              page-break-before: always;
            }
            .section-body table,
            .section-body th,
            .section-body td {
              border: none !important;
            }
            .cover-page {
              break-after: page;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              gap: 10rem;
            }
            .cover-logo { margin-top: 4rem; }
            .cover-title { text-align: center; margin: 0; }
            .cover-title-wrap {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
            }
            .cover-summary {
              margin: 0;
              width: 100%;
              max-width: 720px;
              align-self: flex-start;
            }
            .cover-summary .summary { text-align: left; }
            .toc-block {
              margin-top: -6rem;
            }
            .toc { margin: 24px 0 0; padding-left: 18px; }
            .toc li { margin-bottom: 6px; }
            .toc a { color: #1f63b5; text-decoration: none; }
            .toc a:hover { text-decoration: underline; }
            .logo { max-width: 160px; margin: 0; }
            .page-footer {
              position: fixed;
              bottom: 16px;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <section class="cover-page">
            <img class="logo cover-logo" src="${
              window.location.origin
            }/logo.png" alt="Logo" />
            <div class="cover-title-wrap">
              <h1 class="cover-title">${escapeHtml(
                titleDraft || lesson.title || "Lesson"
              )}</h1>
            </div>
            <div class="cover-summary">
              ${summaryHtml}
            </div>
          ${
            hasSections
              ? `<div class="toc-block">
              <h2>Table of Contents</h2>
              <ol class="toc">${tocHtml}</ol>
            </div>`
              : ""
          }
          </section>
          ${sectionHtml}
          <footer class="page-footer">${escapeHtml(footerHtml)}</footer>
          ${
            includePrintScript
              ? `<script>
            window.onload = () => {
              window.print();
            };
          </script>`
              : `<script>
            window.onload = () => {
            };
          </script>`
          }
        </body>
      </html>
    `;
};
