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

export type TeacherStudent = {
  id: string;
  name: string;
  passcode: string;
};

export type TeacherStudentsPayload = {
  students: TeacherStudent[];
};

export const fetchTeacherStudents = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load students"));
  }
  return data as TeacherStudentsPayload;
};

export const updateTeacherStudents = async (
  endpoint: string,
  headers: Record<string, string>,
  payload: TeacherStudentsPayload
) => {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to save students"));
  }
  return data as TeacherStudentsPayload;
};
