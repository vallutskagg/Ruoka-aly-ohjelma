// app/types/index.ts

export type HealthLevel = "🟢" | "🟡" | "🔴";
export type FilterType = HealthLevel | "ALL" | "FAVORITES";

export type UserGoal = "laihdutus" | "ylläpito" | "lihasmassa";

export type Gender = "male" | "female";

export type AgeRange = "15-18" | "18-30" | "31-50" | "51-65" | "65+";
export type TrainingIntensity = "kevyt" | "keskikova" | "kova";

export type UserProfile = {
  weight: number | null;
  height: number | null;
  goal: UserGoal | null;
  timeframe: number | null;
  targetWeight: number | null;
  targetMuscle: number | null;
  currentWeight: number | null; // Tamanhetkinen paino laihdutuksessa/lihasmassassa
  startDate: string | null;
  endDate: string | null;
  gender: Gender | null;
  ageRange: AgeRange | null;
  // Kuinka monta treenia viikossa (kaytetaan aktiivisuuskertoimeen)
  trainingSessionsPerWeek?: number | null;
  // Treenin intensiteetti hienosaataa aktiivisuuskerrointa
  trainingIntensity?: TrainingIntensity | null;
};
