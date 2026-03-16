import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";
import { preprocessOcrQuestionText } from "./preprocessOcrQuestions";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const OCR_OPTIONS = {
  tessedit_pageseg_mode: 6,
  preserve_interword_spaces: 1,
};

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

function thresholdCanvas(canvas, threshold = 170) {
  const context = canvas.getContext("2d");
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const nextValue = luminance > threshold ? 255 : 0;
    pixels[index] = nextValue;
    pixels[index + 1] = nextValue;
    pixels[index + 2] = nextValue;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function cropCanvas(sourceCanvas, x, y, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));

  canvas
    .getContext("2d")
    .drawImage(
      sourceCanvas,
      x,
      y,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );

  return canvas;
}

function cleanExtractedTitle(text) {
  const lines = String(text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) =>
      String(line || "")
        .replace(/[|]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter(Boolean);

  for (const rawLine of lines) {
    let value = rawLine
      .replace(/^[^\dA-Za-z]+/, "")
      .replace(/[^\w)\]]+$/, "")
      .trim();

    value = value.replace(/\bS0\b/g, "50");
    value = value.replace(/\bS1\b/g, "51");
    value = value.replace(/\bO\b(?=\s+[A-Z][a-z])/, "0");

    if (!/^\d{1,3}\s+\S+/.test(value)) {
      continue;
    }

    value = value.replace(
      /\s+[A-Z][A-Za-z'’.-]*\s+(is|are|was|were|has|have|had|can|could|will|would|should|does|do|did)\b[\s\S]*$/,
      ""
    );

    value = value.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

async function extractTitleFromCanvas(canvas) {
  const width = canvas.width;
  const height = canvas.height;

  // top-left crop where the orange chapter heading appears
  const cropX = width * 0.04;
  const cropY = height * 0.03;
  const cropWidth = width * 0.48;
  const cropHeight = height * 0.12;

  const rawCropCanvas = cropCanvas(canvas, cropX, cropY, cropWidth, cropHeight);

  // scale up a bit for better OCR
  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = rawCropCanvas.width * 2;
  scaledCanvas.height = rawCropCanvas.height * 2;

  scaledCanvas
    .getContext("2d")
    .drawImage(
      rawCropCanvas,
      0,
      0,
      rawCropCanvas.width,
      rawCropCanvas.height,
      0,
      0,
      scaledCanvas.width,
      scaledCanvas.height,
    );

  thresholdCanvas(scaledCanvas, 185);

  const result = await Tesseract.recognize(scaledCanvas, "eng", {
    tessedit_pageseg_mode: 7,
    preserve_interword_spaces: 1,
  });

  const title = cleanExtractedTitle(result.data.text);

  if (title) {
    return title;
  }

  // fallback: try multi-line mode in case OCR split the heading
  const fallbackResult = await Tesseract.recognize(rawCropCanvas, "eng", {
    tessedit_pageseg_mode: 6,
    preserve_interword_spaces: 1,
  });

  return cleanExtractedTitle(fallbackResult.data.text);
}

async function extractPageNumberFromCanvas(canvas) {
  const width = canvas.width;
  const height = canvas.height;

  const cropWidth = width * 0.14;
  const cropHeight = height * 0.12;
  const cropX = width - cropWidth;
  const cropY = height - cropHeight;

  const cropCanvasEl = cropCanvas(canvas, cropX, cropY, cropWidth, cropHeight);
  thresholdCanvas(cropCanvasEl, 170);

  const result = await Tesseract.recognize(cropCanvasEl, "eng", {
    tessedit_pageseg_mode: 7,
    tessedit_char_whitelist: "0123456789",
  });

  const text = String(result.data.text || "");
  const match = text.match(/\d{1,3}/);

  return match ? parseInt(match[0], 10) : null;
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

    const [title, pageNumberDetected] = await Promise.all([
      extractTitleFromCanvas(canvas),
      extractPageNumberFromCanvas(canvas),
    ]);

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

    const [left, right] = await Promise.all([
      Tesseract.recognize(leftCanvas, "eng", OCR_OPTIONS),
      Tesseract.recognize(rightCanvas, "eng", OCR_OPTIONS),
    ]);

    const rawQuestionsSection = extractQuestionsSectionFromColumns(
      left.data.text,
      right.data.text,
    );
    const questionsSection = preprocessOcrQuestionText(rawQuestionsSection);

    return {
      title,
      pageNumber: pageNumberDetected,
      left: left.data.text,
      right: right.data.text,
      combined: left.data.text + "\n\n" + right.data.text,
      questionsSection,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
