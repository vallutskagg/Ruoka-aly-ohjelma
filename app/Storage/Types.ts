// app/storage/types.ts

// ================== ANALYSIS ==================
export type HealthLevel = "🟢" | "🟡" | "🔴";

export type RecipeIngredient = {
  name: string;
  grams: number;
  calories: number;
  carbs?: number;
  sugar?: number;
  protein?: number;
  fat?: number;
};

export type SavedAnalysis = {
  id: string;
  name: string;
  text: string;
  level: HealthLevel;
  favorite: boolean;
  analysisSource?: "ocr" | "image";
  usedProfile?: boolean;
  products?: CalendarProduct[]; // tuotteet, jotka halutaan lisätä kalenteriin (reseptissä: annos)
  totalCalories?: number; // reseptissä: kalorit per annos
  // Merkitäänkö tämä analyysi reseptiksi (näkyy reseptilistassa)
  isRecipe?: boolean;
  servings?: number; // annosten määrä reseptissä
  recipeIngredients?: RecipeIngredient[]; // reseptin ainesosat ja määrät
};

// ================== CALENDAR ==================
export type CalendarProduct = {
  name: string;
  calories: number;
  // Makrot per merkintä (yleensä annos, ei per 100 g)
  carbs?: number;   // g
  sugar?: number;   // g (osa hiilihydraateista)
  protein?: number; // g
  fat?: number;     // g
  // Merkinnän määrä (esim. grammaa/ml). Voi puuttua vanhoista merkinnöistä.
  amount?: number;
  // Määrän tulkinta: per100 = grammaa/ml, portion = annos/kpl-kerroin
  amountMode?: "per100" | "portion";
  // Per-100g/ml pohjatiedot määrän muokkaukseen (jos saatavilla)
  baseCalories?: number;
  baseCarbs?: number;
  baseSugar?: number;
  baseProtein?: number;
  baseFat?: number;
};

export type WeeklyReportProduct = {
  name: string;
  calories: number;
  count: number;
};

export type WeeklyReport = {
  id: string;
  weekKey: string; // esim. 2026-W07
  weekLabel: string; // esim. VKO 7 (09.02.2026-15.02.2026)
  reportType?: "weekly" | "period";
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  createdAt: number;
  level: "🟢" | "🟡" | "🔴";
  score: number;
  summary: string;
  suggestions: string[];
  topProducts: WeeklyReportProduct[];
  totalCalories: number;
  avgCaloriesPerDay: number;
  avgCarbs: number;
  avgSugar: number;
  avgProtein: number;
  avgFat: number;
  weightChangeKg: number | null; // positiivinen = paino noussut
  periodMetrics?: {
    totalDays: number;
    loggedDays: number;
    loggingRatePercent: number;
    calorieTargetHitRatePercent: number | null;
    successEstimatePercent: number | null;
  };
  source: "ai" | "fallback";
};

// Tallennettu ainesosa reseptikirjastoon (per 100 g)
export type StoredIngredient = {
  id: string;
  name: string;
  calories: number;
  carbs?: number;
  sugar?: number;
  protein?: number;
  fat?: number;
};

export type CalendarEntry = {
  analysisId: string;
  product: CalendarProduct;
  // Milloin merkintä lisättiin (ms), käytetään kellonajan näyttöön päiväkirjassa
  loggedAt?: number;
};

export type WeightEntry = {
  date: string; // YYYY-MM-DD
  weight: number; // kg
  timestamp: number; // millisekunneissa
};

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  entries: CalendarEntry[];
  weightEntry?: WeightEntry; // Painomittaus tÃ¤lle pÃ¤ivÃ¤lle
};

export type CalendarData = {
  [date: string]: CalendarDay;
};

export type WeightLog = {
  [date: string]: WeightEntry;
};
