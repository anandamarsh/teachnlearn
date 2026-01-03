export const formatTeacherEmail = (value: string | undefined) => {
  if (!value) {
    return "";
  }
  return value.replaceAll("_at_", "@").replaceAll("_dot_", ".");
};

export const withCacheBuster = (url: string, token?: string | null) => {
  if (!token) {
    return url;
  }
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}v=${encodeURIComponent(token)}`;
};
