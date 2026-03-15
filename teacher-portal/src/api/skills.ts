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

export const listSkills = async (endpoint: string, headers: Record<string, string>) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load skills"));
  }
  return data as { skills?: unknown[] };
};

export const createSkill = async (endpoint: string, headers: Record<string, string>) => {
  const response = await fetch(endpoint, { method: "POST", headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to create skill"));
  }
  return data;
};

export const updateSkill = async (
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
    throw new Error(extractError(data, "Failed to update skill"));
  }
  return data;
};

export const deleteSkill = async (endpoint: string, headers: Record<string, string>) => {
  const response = await fetch(endpoint, { method: "DELETE", headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to delete skill"));
  }
  return data as { deleted?: boolean };
};

export const duplicateSkill = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { method: "POST", headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to duplicate skill"));
  }
  return data;
};

export const resetSkills = async (endpoint: string, headers: Record<string, string>) => {
  const response = await fetch(endpoint, { method: "POST", headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to reset skills"));
  }
  return data as { skills?: unknown[] };
};
