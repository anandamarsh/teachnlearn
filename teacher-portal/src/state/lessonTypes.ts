export type Lesson = {
  id: string;
  title: string;
  status: string;
  subject?: string | null;
  level?: string | null;
  updated_at?: string;
  iconUrl?: string | null;
  content?: string | null;
  sections?: Record<string, string>;
  sectionsMeta?: Record<
    string,
    {
      key?: string;
      updatedAt?: string;
      version?: number;
      contentLength?: number;
    }
  >;
};

export const normalizeLesson = (
  item: Record<string, unknown>,
  fallbackId: string
): Lesson => {
  const id =
    (item.id as string) ||
    (item._id as string) ||
    (item.lessonId as string) ||
    fallbackId;
  const title =
    (item.title as string) ||
    (item.name as string) ||
    (item.lessonName as string) ||
    "Untitled lesson";
  const status = (item.status as string) || (item.state as string) || "Draft";
  const subject = (item.subject as string) || null;
  const level = (item.level as string) || null;
  const updated_at =
    (item.updated_at as string) || (item.updatedAt as string) || undefined;
  const iconUrl = (item.iconUrl as string) || (item.icon as string) || null;
  const content =
    (item.content as string) ||
    (item.description as string) ||
    (item.summary as string) ||
    null;
  const sections = item.sections as Record<string, string> | undefined;
  const sectionsMeta = item.sectionsMeta as
    | Record<
        string,
        {
          key?: string;
          updatedAt?: string;
          version?: number;
          contentLength?: number;
        }
      >
    | undefined;
  return {
    id: String(id),
    title,
    status,
    subject,
    level,
    updated_at,
    iconUrl,
    content,
    sections,
    sectionsMeta,
  };
};
