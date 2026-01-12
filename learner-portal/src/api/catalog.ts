import { CatalogLesson, ExerciseConfig } from "../state/types";
import { AuthedFetch } from "./client";

export const listCatalogLessons = async (
  fetchWithAuth: AuthedFetch
) => {
  const payload = await fetchWithAuth("/catalog/lessons");
  return (payload.lessons || []).map((lesson: unknown) => {
    const raw = lesson as CatalogLesson & {
      requires_login?: boolean | null;
      exercise_config?: ExerciseConfig | null;
    };
    const requiresLogin =
      raw.requiresLogin ?? raw.requires_login ?? null;
    const exerciseConfig = raw.exerciseConfig ?? raw.exercise_config ?? null;
    return {
      ...raw,
      requiresLogin,
      exerciseConfig,
    };
  });
};
