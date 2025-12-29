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
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};
