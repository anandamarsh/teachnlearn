import { useMemo } from "react";
import { createAuthedFetch } from "../api/client";

export const useApiClient = (apiBaseUrl: string) => {
  return useMemo(
    () => createAuthedFetch(apiBaseUrl),
    [apiBaseUrl]
  );
};
