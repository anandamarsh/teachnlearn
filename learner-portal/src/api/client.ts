import { GetTokenSilentlyOptions } from "@auth0/auth0-react";

type TokenFetcher = (options?: GetTokenSilentlyOptions) => Promise<string>;

export const createAuthedFetch = (
  getAccessTokenSilently: TokenFetcher,
  apiBaseUrl: string,
  auth0Audience: string,
  isAuthenticated: boolean
) => {
  return async (path: string) => {
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
    return response.json();
  };
};
