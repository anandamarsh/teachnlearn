import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function isLikelyFooterLine(line) {
  const text = String(line || "").trim();
  return (
    /^(module|moule|mopule)\s*\d+/i.test(text) ||
    /properties\s+and\s+structure\s+of\s+matter/i.test(text) ||
    /introduction\s+to\s+quantitative\s+chemistry/i.test(text) ||
    /^\d{1,3}$/.test(text) ||
    /^[a-z]{0,3}\d{1,3}$/i.test(text)
  );
}

function findQuestionsHeaderIndex(lines) {
  return lines.findIndex((line) => /\bquestions\b/i.test(line));
}

function findQuestionStartIndex(lines) {
  return lines.findIndex((line) => /^[1Il]\.\s+/.test(line));
}

function trimQuestionLines(lines) {
  const startIndex = findQuestionStartIndex(lines);

  if (startIndex === -1) {
    return "";
  }

  const questionLines = [];
  let footerLineStreak = 0;

  for (const line of lines.slice(startIndex)) {
    if (isLikelyFooterLine(line)) {
      footerLineStreak += 1;
      if (footerLineStreak >= 1) {
        break;
      }
      continue;
    }

    footerLineStreak = 0;
    questionLines.push(line);
  }

  return questionLines.join("\n");
}

function extractQuestionsSectionFromColumns(leftText, rightText) {
  const leftLines = normalizeOcrText(leftText)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const rightLines = normalizeOcrText(rightText)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const leftHeaderIndex = findQuestionsHeaderIndex(leftLines);
  const rightHeaderIndex = findQuestionsHeaderIndex(rightLines);

  if (leftHeaderIndex !== -1) {
    return trimQuestionLines([
      ...leftLines.slice(leftHeaderIndex + 1),
      ...rightLines,
    ]);
  }

  if (rightHeaderIndex !== -1) {
    return trimQuestionLines(rightLines.slice(rightHeaderIndex + 1));
  }

  return trimQuestionLines([...leftLines, ...rightLines]);
}

export async function extractPageColumns(file, pageNumber = 1) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const pdf = await pdfjsLib.getDocument(objectUrl).promise;
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const mid = canvas.width / 2;

    const leftCanvas = document.createElement("canvas");
    const rightCanvas = document.createElement("canvas");

    leftCanvas.width = mid;
    leftCanvas.height = canvas.height;

    rightCanvas.width = mid;
    rightCanvas.height = canvas.height;

    leftCanvas
      .getContext("2d")
      .drawImage(canvas, 0, 0, mid, canvas.height, 0, 0, mid, canvas.height);

    rightCanvas
      .getContext("2d")
      .drawImage(canvas, mid, 0, mid, canvas.height, 0, 0, mid, canvas.height);

    const left = await Tesseract.recognize(leftCanvas, "eng");
    const right = await Tesseract.recognize(rightCanvas, "eng");

    const questionsSection = extractQuestionsSectionFromColumns(
      left.data.text,
      right.data.text,
    );

    return {
      left: left.data.text,
      right: right.data.text,
      combined: left.data.text + "\n\n" + right.data.text,
      questionsSection,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
