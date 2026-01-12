import { GetTokenSilentlyOptions } from "@auth0/auth0-react";

export type AuthedFetchOptions = {
  responseType?: "json" | "text";
};

export type AuthedFetch = (
  path: string,
  options?: AuthedFetchOptions
) => Promise<any>;

type TokenFetcher = (options?: GetTokenSilentlyOptions) => Promise<string>;

export const createAuthedFetch = (
  getAccessTokenSilently: TokenFetcher,
  apiBaseUrl: string,
  auth0Audience: string,
  isAuthenticated: boolean
) => {
  return async (path: string, options: AuthedFetchOptions = {}) => {
    let headers: Record<string, string> | undefined;
    if (isAuthenticated) {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: auth0Audience },
      });
      headers = {
        Authorization: `Bearer ${token}`,
      };
    }
    const response = await fetch(`${apiBaseUrl}${path}`, { headers });
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
