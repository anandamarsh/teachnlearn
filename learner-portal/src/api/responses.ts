import { ExerciseResponseRecord, ResponseAttachment } from "../state/types";

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

export type SectionResponsesPayload = {
  responses: ExerciseResponseRecord[];
  updatedAt?: string | null;
};

export type ResponseAttachmentDraft = ResponseAttachment & {
  file?: File;
  uploadRef?: string;
};

export type ExerciseResponseDraft = {
  exerciseIndex: number;
  promptTitle?: string;
  questionHtml: string;
  answerMarkdown: string;
  teacherComment?: string;
  attachments: ResponseAttachmentDraft[];
};

export const fetchSectionResponses = async (
  apiBaseUrl: string,
  teacher: string,
  lessonId: string,
  sectionKey: string
) => {
  const response = await fetch(
    `${apiBaseUrl}/catalog/teacher/${teacher}/lesson/${lessonId}/responses/${sectionKey}`,
    { credentials: "include" }
  );
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to load responses"));
  }
  return data as SectionResponsesPayload;
};

export const saveSectionResponses = async (
  apiBaseUrl: string,
  teacher: string,
  lessonId: string,
  sectionKey: string,
  responses: ExerciseResponseDraft[]
) => {
  const formData = new FormData();
  const payload = {
    responses: responses.map((responseItem) => ({
      exerciseIndex: responseItem.exerciseIndex,
      promptTitle: responseItem.promptTitle || "",
      questionHtml: responseItem.questionHtml,
      answerMarkdown: responseItem.answerMarkdown,
      teacherComment: responseItem.teacherComment || "",
      attachments: responseItem.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        contentType: attachment.contentType || "",
        storageKey: attachment.storageKey || "",
        uploadRef: attachment.uploadRef || "",
      })),
    })),
  };
  formData.append("payload", JSON.stringify(payload));
  responses.forEach((responseItem) => {
    responseItem.attachments.forEach((attachment) => {
      if (attachment.file && attachment.uploadRef) {
        formData.append(attachment.uploadRef, attachment.file);
      }
    });
  });
  const response = await fetch(
    `${apiBaseUrl}/catalog/teacher/${teacher}/lesson/${lessonId}/responses/${sectionKey}`,
    {
      method: "PUT",
      credentials: "include",
      body: formData,
    }
  );
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, "Failed to save responses"));
  }
  return data as SectionResponsesPayload;
};
