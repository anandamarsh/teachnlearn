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

export type StudentSession = {
  authenticated: boolean;
  student: {
    id: string;
    name: string;
  };
};

export const fetchStudentSession = async (apiBaseUrl: string) => {
  const response = await fetch(`${apiBaseUrl}/student/session`, {
    credentials: "include",
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load student session"));
  }
  return data as StudentSession;
};

export const loginStudent = async (
  apiBaseUrl: string,
  payload: { name: string; passcode: string }
) => {
  const response = await fetch(`${apiBaseUrl}/student/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Login failed"));
  }
  return data as StudentSession;
};

export const logoutStudent = async (apiBaseUrl: string) => {
  const response = await fetch(`${apiBaseUrl}/student/logout`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Logout failed"));
  }
  return data as { authenticated: false };
};
