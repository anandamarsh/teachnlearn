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

export type TeacherLessonProgressQuestion = {
  questionKey: string;
  sectionKey: string;
  exerciseIndex: number;
  promptTitle: string;
  questionHtml: string;
};

export type TeacherLessonProgressAttachment = {
  id: string;
  name: string;
  size: number;
  contentType?: string;
  storageKey?: string;
  url?: string;
  previewPath?: string;
};

export type TeacherLessonProgressResponse = TeacherLessonProgressQuestion & {
  answerMarkdown: string;
  teacherComment?: string;
  reviewStatus?: "approved" | "rejected" | null;
  attachments: TeacherLessonProgressAttachment[];
  answered: boolean;
};

export type TeacherLessonProgressStudent = {
  id: string;
  name: string;
  status: "answered" | "part_answered" | "unanswered";
  answeredCount: number;
  questionStates: Array<"unanswered" | "answered" | "approved" | "rejected">;
  responses: TeacherLessonProgressResponse[];
};

export type TeacherLessonProgressSummary = {
  studentCount: number;
  answeredCount: number;
  partAnsweredCount: number;
  unansweredCount: number;
};

export type TeacherLessonProgressPayload = {
  summary: TeacherLessonProgressSummary;
  questions: TeacherLessonProgressQuestion[];
  students: TeacherLessonProgressStudent[];
};

export const fetchTeacherLessonProgress = async (
  endpoint: string,
  headers: Record<string, string>
) => {
  const response = await fetch(endpoint, { headers });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load lesson progress"));
  }
  return data as TeacherLessonProgressPayload;
};

export const saveTeacherLessonComment = async (
  endpoint: string,
  headers: Record<string, string>,
  payload: {
    sectionKey: string;
    exerciseIndex: number;
    promptTitle: string;
    questionHtml: string;
    teacherComment: string;
    reviewStatus?: "approved" | "rejected" | null;
  }
) => {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to save teacher comment"));
  }
  return data as { teacherComment?: string; reviewStatus?: "approved" | "rejected" | null };
};
