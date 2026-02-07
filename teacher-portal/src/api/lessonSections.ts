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
    method: "POST",
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
  payload: { contentHtml?: string; content?: unknown }
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
  return data as { key?: string; sectionKey?: string };
};

export const fetchExerciseSection = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load exercise"));
  }
  return data as { key: string; content?: unknown };
};

export const createExerciseSection = async (
  endpoint: string,
  headers: Record<string, string>,
  items: unknown[]
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(items),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to create exercise"));
  }
  return data as { sectionKey: string; noOfQuestions: number };
};

export const appendExerciseQuestions = async (
  endpoint: string,
  headers: Record<string, string>,
  items: unknown[]
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(items),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to append exercises"));
  }
  return data as { sectionKey: string; noOfQuestions: number };
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

export const deleteExerciseSection = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers,
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to delete exercise"));
  }
  return data as { deleted?: boolean; sectionKey?: string };
};
