// app/constants/index.ts

const getEnvValue = (value?: string) => (value ?? "").trim();

export const GOOGLE_VISION_API_KEY = getEnvValue(
  process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY
);

const DEFAULT_BACKEND_BASE_URL = "https://foodscanbackend.food";

const normalizeBackendUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return `${DEFAULT_BACKEND_BASE_URL}/analyze`;

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  if (/\/analyze$/i.test(withoutTrailingSlash)) return withoutTrailingSlash;

  return `${withoutTrailingSlash}/analyze`;
};

export const BACKEND_URL = normalizeBackendUrl(
  getEnvValue(process.env.EXPO_PUBLIC_BACKEND_URL)
);
export const STORAGE_KEYS = {
  ANALYSES: "analyses",
  WEEKLY_REPORTS: "weeklyReports",
  WEEKLY_REPORTS_ENABLED: "weeklyReportsEnabled",
  APP_FIRST_USED_AT: "appFirstUsedAt",
  PROFILE_FIRST_SET_AT: "profileFirstSetAt",
  USER_PROFILE: "userProfile",
  USE_PROFILE: "useProfile",
  ONBOARDING_SEEN: "onboardingSeen",
  INGREDIENTS: "storedIngredients",
};
