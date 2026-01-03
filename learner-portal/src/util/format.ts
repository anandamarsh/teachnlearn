export const formatTeacherEmail = (value: string | undefined) => {
  if (!value) {
    return "";
  }
  return value.replace(/_at_/g, "@").replace(/_dot_/g, ".");
};

export const withCacheBuster = (url: string, token?: string | null) => {
  if (!token) {
    return url;
  }
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}v=${encodeURIComponent(token)}`;
};
