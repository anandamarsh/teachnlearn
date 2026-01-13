const parseJson = async (response: Response) => {
  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : null;
};

const extractError = (data: unknown, fallback: string) => {
  if (data && typeof data === "object" && "detail" in data) {
    return String((data as { detail?: string }).detail || fallback);
  }
  return fallback;
};

export const fetchSectionsIndex = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load sections index"));
  }
  return data as { sections?: Record<string, string> };
};

export const fetchSectionsList = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load sections list"));
  }
  return data as { sections?: string[]; descriptions?: Record<string, string> };
};

export const fetchSectionContent = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load section"));
  }
  return data as {
    key: string;
    contentHtml?: string;
    content?: unknown;
    contentType?: string;
    exerciseMode?: string;
  };
};

export const saveSectionContent = async (
  endpoint: string,
  headers: Record<string, string>,
  payload: {
    contentHtml?: string;
    content?: unknown;
    contentType?: string;
    code?: string;
  }
) => {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to save section"));
  }
  return data as {
    key?: string;
    contentHtml?: string;
    content?: unknown;
    generator?: { updatedAt?: string; filename?: string; contentLength?: number };
  };
};

export const createSectionContent = async (
  endpoint: string,
  headers: Record<string, string>,
  payload: { contentHtml?: string; content?: unknown; createNew?: boolean }
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to create section"));
  }
  return data as { key: string; contentHtml?: string; content?: unknown };
};

export const deleteSectionContent = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers,
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to delete section"));
  }
  return data as { deleted?: boolean; sectionKey?: string };
};
