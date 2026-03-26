const STORAGE_KEY = "tp_effective_account_v1";

const normalizeEmail = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase();

export const getStoredEffectiveAccount = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return normalizeEmail(window.localStorage.getItem(STORAGE_KEY));
};

export const setStoredEffectiveAccount = (email: string | null | undefined) => {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeEmail(email);
  if (!normalized) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, normalized);
};

export const clearStoredEffectiveAccount = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
};

export const getEffectiveAccountHeader = () => {
  const effectiveAccount = getStoredEffectiveAccount();
  const headers: Record<string, string> = {};
  if (effectiveAccount) {
    headers["X-Effective-Account"] = effectiveAccount;
  }
  return headers;
};

export const appendEffectiveAccountQueryParam = (url: URL) => {
  const effectiveAccount = getStoredEffectiveAccount();
  if (effectiveAccount) {
    url.searchParams.set("effective_account", effectiveAccount);
  }
  return url;
};
