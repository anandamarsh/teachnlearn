export type Lesson = {
  id: string;
  title: string;
  status: string;
  iconUrl?: string | null;
  content?: string | null;
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
  const iconUrl = (item.iconUrl as string) || (item.icon as string) || null;
  const content =
    (item.content as string) ||
    (item.description as string) ||
    (item.summary as string) ||
    null;
  return {
    id: String(id),
    title,
    status,
    iconUrl,
    content,
  };
};
