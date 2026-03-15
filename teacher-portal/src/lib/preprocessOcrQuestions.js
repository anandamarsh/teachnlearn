function normalizeInput(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBoundaryPrefix(line) {
  return String(line || "")
    .trim()
    .replace(/^[il|]\s+(?=\([a-z]\))/i, "")
    .replace(/^\((¢)\)/, "(c)");
}

function expandInlineSubparts(line) {
  const text = String(line || "").trim();
  if (!text) {
    return [];
  }

  const matches = [...text.matchAll(/\([a-z]\)\s+/gi)];
  if (matches.length <= 1) {
    return [text];
  }

  const parts = [];
  const firstIndex = matches[0].index ?? -1;

  if (firstIndex > 0) {
    const leading = text.slice(0, firstIndex).trim();
    if (leading) {
      parts.push(leading);
    }
  }

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      parts.push(chunk);
    }
  }

  return parts;
}

function isMainQuestionStart(line) {
  return /^\d+\.\s+/.test(line);
}

function isSubpartStart(line) {
  return /^\([a-z]\)\s+/i.test(line);
}

function isQuestionBoundary(line) {
  return isMainQuestionStart(line) || isSubpartStart(line);
}

function joinWrappedLine(current, next) {
  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  if (/[(/-]$/.test(current)) {
    return `${current}${next}`;
  }

  return `${current} ${next}`;
}

function flushBuffer(result, buffer) {
  const text = String(buffer || "").trim();
  if (text) {
    result.push(text);
  }
}

export function preprocessOcrQuestionText(text) {
  const normalized = normalizeInput(text);
  if (!normalized) {
    return "";
  }

  const lines = normalized
    .split("\n")
    .map((line) => normalizeBoundaryPrefix(line))
    .flatMap((line) => expandInlineSubparts(line))
    .map((line) => line.trim())
    .filter(Boolean);

  const result = [];
  let buffer = "";

  for (const line of lines) {
    if (isQuestionBoundary(line)) {
      flushBuffer(result, buffer);
      buffer = line;
      continue;
    }

    buffer = joinWrappedLine(buffer, line);
  }

  flushBuffer(result, buffer);

  return result.join("\n");
}
