import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { StoredIngredient } from "../Storage/Types";

export const useIngredients = () => {
  const [ingredients, setIngredients] = useState<StoredIngredient[]>([]);

  const loadIngredients = async () => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.INGREDIENTS);
    if (data) {
      try {
        setIngredients(JSON.parse(data));
      } catch {
        setIngredients([]);
      }
    }
  };

  const saveIngredients = async (items: StoredIngredient[]) => {
    setIngredients(items);
    await AsyncStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(items));
  };

  return {
    ingredients,
    loadIngredients,
    saveIngredients,
  };
};
