import { CatalogLesson } from "../state/types";

export const listCatalogLessons = async (
  fetchWithAuth: (path: string) => Promise<{ lessons?: CatalogLesson[] }>
) => {
  const payload = await fetchWithAuth("/catalog/lessons");
  return payload.lessons || [];
};
