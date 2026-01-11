import { useCallback, useEffect, useState } from "react";
import { listCatalogLessons } from "../api/catalog";
import { CatalogLesson } from "../state/types";

type UseCatalogOptions = {
  fetchWithAuth: (path: string) => Promise<{ lessons?: CatalogLesson[] }>;
};

export const useCatalog = ({ fetchWithAuth }: UseCatalogOptions) => {
  const [lessons, setLessons] = useState<CatalogLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lessonList = await listCatalogLessons(fetchWithAuth);
      setLessons(lessonList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load lessons");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  return { lessons, loading, error, reload: load };
};
