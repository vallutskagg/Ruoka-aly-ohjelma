// app/hooks/useAnalyses.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { SavedAnalysis } from "../Storage/Types";
import { HealthLevel } from "../types";

export const useAnalyses = () => {
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [search, setSearch] = useState("");

  const loadSavedAnalyses = async () => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ANALYSES);
    if (data) setSavedAnalyses(JSON.parse(data));
  };

  const saveToStorage = async (items: SavedAnalysis[]) => {
    setSavedAnalyses(items);
    await AsyncStorage.setItem(STORAGE_KEYS.ANALYSES, JSON.stringify(items));
  };

  const getLevelFromText = (text: string): HealthLevel => {
    if (text.includes("🟢")) return "🟢";
    if (text.includes("🟡")) return "🟡";
    return "🔴";
  };

  const toggleFavorite = async (id: string) => {
    const updated = savedAnalyses.map((a) =>
      a.id === id ? { ...a, favorite: !a.favorite } : a
    );
    await saveToStorage(updated);
  };

  const deleteOne = async (id: string) => {
    await saveToStorage(savedAnalyses.filter((a) => a.id !== id));
  };

  const deleteAll = async () => {
    // Tyhjennä vain analyysit, mutta säilytä reseptit.
    await saveToStorage(savedAnalyses.filter((a) => a.isRecipe));
  };

  return {
    savedAnalyses,
    showSaved,
    setShowSaved,
    showSavedToast,
    setShowSavedToast,
    search,
    setSearch,
    loadSavedAnalyses,
    saveToStorage,
    getLevelFromText,
    toggleFavorite,
    deleteOne,
    deleteAll,
  };
};
