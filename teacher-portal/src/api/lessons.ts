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

export const listLessons = async (endpoint: string, headers: Record<string, string>) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load lessons"));
  }
  return data;
};

export const createLesson = async (
  endpoint: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to create lesson"));
  }
  return data;
};

export const updateLesson = async (
  endpoint: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>
) => {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to update lesson"));
  }
  return data;
};

export const deleteLesson = async (endpoint: string, headers: Record<string, string>) => {
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers,
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to delete lesson"));
  }
  return data;
};

export const duplicateLesson = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to duplicate lesson"));
  }
  return data;
};

export const fetchLesson = async (endpoint: string, headers: Record<string, string>) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load lesson"));
  }
  return data;
};

export const fetchLessonReport = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Report not found"));
  }
  return data as { url?: string };
};

export const createLessonReport = async (
  endpoint: string,
  headers: Record<string, string>,
  payload: { html: string }
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to create report"));
  }
  return data as { url?: string };
};

export const deleteLessonReport = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { method: "DELETE", headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to delete report"));
  }
  return data as { status?: string };
};
