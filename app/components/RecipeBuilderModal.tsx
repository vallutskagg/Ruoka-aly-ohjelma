import React, { useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { CalendarProduct, RecipeIngredient } from "../Storage/Types";

type Props = {
  visible: boolean;
  products: CalendarProduct[];
  suggestedName?: string;
  onClose: () => void;
  onSaveRecipe: (data: {
    name: string;
    servings: number;
    ingredients: RecipeIngredient[];
    perServing: {
      calories: number;
      carbs?: number;
      sugar?: number;
      protein?: number;
      fat?: number;
    };
  }) => void;
};

export default function RecipeBuilderModal({
  visible,
  products,
  suggestedName,
  onClose,
  onSaveRecipe,
}: Props) {
  const [name, setName] = useState(suggestedName ?? "");
  const [servingsText, setServingsText] = useState("4");
  const [entries, setEntries] = useState(
    products.map((p) => ({
      product: p,
      gramsText: "100",
      enabled: true,
    }))
  );

  const servings = useMemo(() => {
    const n = parseInt(servingsText, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [servingsText]);

  const totals = useMemo(() => {
    let calories = 0;
    let carbs = 0;
    let sugar = 0;
    let protein = 0;
    let fat = 0;

    entries.forEach(({ product, gramsText, enabled }) => {
      if (!enabled) return;
      const grams = parseFloat(gramsText.replace(",", "."));
      if (!Number.isFinite(grams) || grams <= 0) return;
      const factor = grams / 100;

      calories += (product.calories || 0) * factor;
      carbs += (product.carbs || 0) * factor;
      sugar += (product.sugar || 0) * factor;
      protein += (product.protein || 0) * factor;
      fat += (product.fat || 0) * factor;
    });

    return { calories, carbs, sugar, protein, fat };
  }, [entries]);

  const perServing = useMemo(() => {
    if (servings <= 0) return { calories: 0, carbs: 0, sugar: 0, protein: 0, fat: 0 };
    return {
      calories: totals.calories / servings,
      carbs: totals.carbs / servings,
      sugar: totals.sugar / servings,
      protein: totals.protein / servings,
      fat: totals.fat / servings,
    };
  }, [totals, servings]);

  const handleChangeGrams = (index: number, text: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, gramsText: text } : e))
    );
  };

  const toggleEnabled = (index: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const ingredients: RecipeIngredient[] = [];

    entries.forEach(({ product, gramsText, enabled }) => {
      if (!enabled) return;
      const grams = parseFloat(gramsText.replace(",", "."));
      if (!Number.isFinite(grams) || grams <= 0) return;
      const factor = grams / 100;

      const calories = (product.calories || 0) * factor;
      const carbs = (product.carbs || 0) * factor;
      const sugar = (product.sugar || 0) * factor;
      const protein = (product.protein || 0) * factor;
      const fat = (product.fat || 0) * factor;

      ingredients.push({
        name: product.name,
        grams,
        calories,
        carbs,
        sugar,
        protein,
        fat,
      });
    });

    if (ingredients.length === 0) return;

    const validServings = servings > 0 ? servings : 1;

    onSaveRecipe({
      name: trimmedName,
      servings: validServings,
      ingredients,
      perServing: {
        calories: perServing.calories,
        carbs: perServing.carbs,
        sugar: perServing.sugar,
        protein: perServing.protein,
        fat: perServing.fat,
      },
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={false}
      statusBarTranslucent={false}
    >
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={{ paddingTop: 40, paddingBottom: 40 }}
          showsVerticalScrollIndicator
        >
          <Text style={styles.title}>ðŸ“– Luo resepti</Text>

          <Text style={styles.label}>Reseptin nimi</Text>
          <TextInput
            placeholder="Esim. Kanapasta"
            placeholderTextColor="#777"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          <Text style={styles.label}>Annoksia yhteensÃ¤</Text>
          <TextInput
            placeholder="Esim. 4"
            placeholderTextColor="#777"
            value={servingsText}
            onChangeText={setServingsText}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.sectionTitle}>Ainesosat analyysistÃ¤</Text>
          {entries.length === 0 && (
            <Text style={styles.helperText}>
              Analyysi ei palauttanut erillisiÃ¤ ainesosia. ReseptiÃ¤ ei voi
              muodostaa.
            </Text>
          )}

          {entries.map((entry, index) => (
            <View key={index} style={styles.ingredientRow}>
              <Pressable
                style={[styles.ingredientToggle, entry.enabled && styles.ingredientToggleActive]}
                onPress={() => toggleEnabled(index)}
              >
                <Text style={styles.ingredientToggleText}>
                  {entry.enabled ? "âœ“" : ""}
                </Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingredientName}>{entry.product.name}</Text>
                <Text style={styles.ingredientInfo}>
                  {entry.product.calories} kcal / 100 g
                </Text>
              </View>
              <View style={styles.gramsBox}>
                <Text style={styles.gramsLabel}>g</Text>
                <TextInput
                  value={entry.gramsText}
                  onChangeText={(t) => handleChangeGrams(index, t)}
                  keyboardType="numeric"
                  style={styles.gramsInput}
                />
              </View>
            </View>
          ))}

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Yhteenveto per annos</Text>
            <Text style={styles.summaryText}>
              ðŸ”¥ {Math.round(perServing.calories || 0)} kcal
            </Text>
            <Text style={styles.summaryText}>
              ðŸž Hiilarit: {Math.round(perServing.carbs || 0)} g
            </Text>
            <Text style={styles.summaryText}>
              ðŸ¬ Sokerit: {Math.round(perServing.sugar || 0)} g
            </Text>
            <Text style={styles.summaryText}>
              ðŸ— Proteiini: {Math.round(perServing.protein || 0)} g
            </Text>
            <Text style={styles.summaryText}>
              ðŸ¥‘ Rasva: {Math.round(perServing.fat || 0)} g
            </Text>
          </View>
        </ScrollView>

        <Pressable style={styles.button} onPress={onClose}>
          <Text style={{ color: "white" }}>Peruuta</Text>
        </Pressable>
        <Pressable style={styles.buttonPrimary} onPress={handleSave}>
          <Text style={{ color: "white" }}>ðŸ’¾ Tallenna resepti</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
  },
  title: {
    color: "white",
    fontSize: 20,
    marginBottom: 16,
  },
  label: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#333",
    color: "white",
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 8,
  },
  helperText: {
    color: "#777",
    fontSize: 13,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#333",
    gap: 8,
  },
  ingredientToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientToggleActive: {
    backgroundColor: "#2d5a3d",
    borderColor: "#2d5a3d",
  },
  ingredientToggleText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  ingredientName: {
    color: "white",
    fontSize: 15,
  },
  ingredientInfo: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  gramsBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  gramsLabel: {
    color: "#aaa",
    fontSize: 13,
    marginRight: 4,
  },
  gramsInput: {
    color: "white",
    width: 60,
    textAlign: "right",
  },
  summaryBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#222",
    borderRadius: 12,
  },
  summaryTitle: {
    color: "white",
    fontSize: 16,
    marginBottom: 8,
  },
  summaryText: {
    color: "#e5e5e5",
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 12,
    alignItems: "center",
  },
  buttonPrimary: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#2d5a3d",
    borderRadius: 12,
    alignItems: "center",
  },
});


