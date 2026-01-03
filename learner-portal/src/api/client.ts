import { GetTokenSilentlyOptions } from "@auth0/auth0-react";

type TokenFetcher = (options?: GetTokenSilentlyOptions) => Promise<string>;

export const createAuthedFetch = (
  getAccessTokenSilently: TokenFetcher,
  apiBaseUrl: string,
  auth0Audience: string
) => {
  return async (path: string) => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: auth0Audience },
    });
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.detail || "Request failed";
      throw new Error(message);
    }
    return response.json();
  };
};
