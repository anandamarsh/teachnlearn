export type AuthedFetchOptions = {
  responseType?: "json" | "text";
};

export type AuthedFetch = (
  path: string,
  options?: AuthedFetchOptions
) => Promise<any>;

export const createAuthedFetch = (
  apiBaseUrl: string
) => {
  return async (path: string, options: AuthedFetchOptions = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: "include",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.detail || "Request failed";
      throw new Error(message);
    }
    if (options.responseType === "text") {
      return response.text();
    }
    return response.json();
  };
};
