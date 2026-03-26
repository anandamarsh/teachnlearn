import { getEffectiveAccountHeader } from "./effectiveAccount";

export type GetAccessTokenSilently = (options?: {
  authorizationParams?: { audience?: string };
}) => Promise<string>;

export const buildAuthHeaders = async (
  getAccessTokenSilently: GetAccessTokenSilently,
  audience: string
) => {
  const token = await getAccessTokenSilently({
    authorizationParams: { audience },
  });
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  Object.assign(headers, getEffectiveAccountHeader());
  return headers;
};
