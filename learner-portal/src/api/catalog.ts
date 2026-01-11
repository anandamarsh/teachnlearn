import { CatalogLesson } from "../state/types";

export const listCatalogLessons = async (
  fetchWithAuth: (path: string) => Promise<{ lessons?: CatalogLesson[] }>
) => {
  const payload = await fetchWithAuth("/catalog/lessons");
  return (payload.lessons || []).map((lesson) => {
    const raw = lesson as CatalogLesson & { requires_login?: boolean | null };
    const requiresLogin =
      raw.requiresLogin ?? raw.requires_login ?? null;
    return {
      ...raw,
      requiresLogin,
    };
  });
};
