import { useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { createAuthedFetch } from "../api/client";

export const useApiClient = (apiBaseUrl: string, auth0Audience: string) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useMemo(
    () =>
      createAuthedFetch(
        getAccessTokenSilently,
        apiBaseUrl,
        auth0Audience,
        isAuthenticated
      ),
    [apiBaseUrl, auth0Audience, getAccessTokenSilently, isAuthenticated]
  );
};
