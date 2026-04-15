import { TrainingIntensity } from "../types";

const getBaseActivityFactor = (sessionsPerWeek: number | null): number => {
  if (!sessionsPerWeek || !Number.isFinite(sessionsPerWeek) || sessionsPerWeek <= 0) {
    return 1.5;
  }
  if (sessionsPerWeek <= 1) return 1.2;
  if (sessionsPerWeek <= 3) return 1.4;
  if (sessionsPerWeek <= 5) return 1.6;
  if (sessionsPerWeek <= 7) return 1.75;
  return 1.9;
};

export const getActivityFactor = (
  sessionsPerWeek: number | null | undefined,
  intensity: TrainingIntensity | null | undefined
): number => {
  const base = getBaseActivityFactor(sessionsPerWeek ?? null);

  if (!intensity) return base;

  const adjustment =
    intensity === "kevyt" ? -0.05 : intensity === "keskikova" ? 0 : 0.1;

  return Math.min(Math.max(base + adjustment, 1.2), 1.95);
};
