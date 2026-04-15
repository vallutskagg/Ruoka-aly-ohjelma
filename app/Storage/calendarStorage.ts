// app/storage/calendarStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CalendarData, SavedAnalysis, WeightEntry, WeightLog } from "./Types";

const KEY = "calendar";
const WEIGHT_KEY = "weightLog";

// Lataa kaikki kalenteritiedot
export const loadCalendar = async (): Promise<CalendarData> => {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
};

// Tallenna kaikki kalenteritiedot
export const saveCalendar = async (data: CalendarData) => {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
};

// Lisää analyysi ja sen tuotteet tietylle päivälle
export const addAnalysisToDate = async (
  date: string,
  analysis: SavedAnalysis,
  loggedAt?: number
) => {
  const calendar = await loadCalendar();

  if (!calendar[date]) {
    calendar[date] = { date, entries: [] };
  }

  analysis.products?.forEach((p) => {
    calendar[date].entries.push({
      analysisId: analysis.id,
      product: p,
      loggedAt: loggedAt ?? Date.now(),
    });
  });

  await saveCalendar(calendar);
};

// ================== PAINOMITTAUKSET ==================

// Lataa kaikki painomittaukset
export const loadWeightLog = async (): Promise<WeightLog> => {
  const raw = await AsyncStorage.getItem(WEIGHT_KEY);
  return raw ? JSON.parse(raw) : {};
};

// Tallenna kaikki painomittaukset
export const saveWeightLog = async (data: WeightLog) => {
  await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(data));
};

// Lisää uusi painomittaus
export const addWeightEntry = async (
  weight: number,
  date?: string,
  timestampOverride?: number
) => {
  const weightLog = await loadWeightLog();
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  const entry: WeightEntry = {
    date: dateStr,
    weight: weight,
    timestamp: timestampOverride ?? Date.now(),
  };
  
  weightLog[dateStr] = entry;
  await saveWeightLog(weightLog);
  
  return entry;
};

// Hae painomittaus tietyltä päivältä
export const getWeightForDate = async (date: string): Promise<WeightEntry | null> => {
  const weightLog = await loadWeightLog();
  return weightLog[date] || null;
};

// Hae kaikki painomittaukset järjestyksessä
export const getAllWeights = async (): Promise<WeightEntry[]> => {
  const weightLog = await loadWeightLog();
  return Object.values(weightLog).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};
