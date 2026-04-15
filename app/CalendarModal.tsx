// app/CalendarModal.tsx
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { SavedAnalysis } from "./Storage/Types";
import { addAnalysisToDate } from "./Storage/calendarStorage";

type Props = {
  visible: boolean;
  analysis: SavedAnalysis | null;
  onClose: () => void;
  onSaved?: () => void;
  allowManualEntry?: boolean;
  preselectedDate?: string | null;
};

export default function CalendarModal({
  visible,
  analysis,
  onClose,
  onSaved,
  allowManualEntry = false,
  preselectedDate = null,
  isImageAnalysis = false,
}: Props & { isImageAnalysis?: boolean }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");

  const resetForm = () => {
    setSelectedDate(null);
    setAmount("");
    setManualName("");
    setManualCalories("");
  };

  const handleSaveToCalendar = async () => {
    const dateToUse = preselectedDate || selectedDate;
    if (!dateToUse) return;

    let finalAnalysis: SavedAnalysis;

    if (allowManualEntry && !analysis) {
      if (!manualName.trim() || !manualCalories.trim()) return;

      const calories = parseFloat(manualCalories.replace(",", "."));
      if (isNaN(calories)) return;

      finalAnalysis = {
        id: Date.now().toString(),
        name: manualName.trim(),
        text: `Manuaalisesti lisätty: ${manualName.trim()}`,
        level: "🟢",
        favorite: false,
        products: [{ name: manualName.trim(), calories }],
        totalCalories: calories,
      };
    } else if (analysis) {
      let adjustedAnalysis = { ...analysis };
      const amountNum = parseFloat(amount.replace(",", "."));
      const hasAmountInput = amount.trim().length > 0 && !isNaN(amountNum);
      const scaleMacro = (value: number | undefined, multiplier: number) =>
        typeof value === "number" && Number.isFinite(value)
          ? Math.round(value * multiplier)
          : value;

      if (isImageAnalysis) {
        const portionPercent = hasAmountInput ? Math.max(amountNum, 0) : 100;
        const multiplier = portionPercent / 100;
        adjustedAnalysis = {
          ...analysis,
          totalCalories:
            typeof analysis.totalCalories === "number"
              ? Math.round(analysis.totalCalories * multiplier)
              : analysis.totalCalories,
          name: hasAmountInput ? `${analysis.name} (${portionPercent}%)` : analysis.name,
          products: analysis.products?.map((p) => {
            const baseCalories =
              typeof p.baseCalories === "number" ? p.baseCalories : p.calories;
            const baseCarbs =
              typeof p.baseCarbs === "number" ? p.baseCarbs : p.carbs;
            const baseSugar =
              typeof p.baseSugar === "number" ? p.baseSugar : p.sugar;
            const baseProtein =
              typeof p.baseProtein === "number" ? p.baseProtein : p.protein;
            const baseFat = typeof p.baseFat === "number" ? p.baseFat : p.fat;

            return {
              ...p,
              baseCalories,
              baseCarbs,
              baseSugar,
              baseProtein,
              baseFat,
              calories: Math.round(baseCalories * multiplier),
              carbs: scaleMacro(baseCarbs, multiplier),
              sugar: scaleMacro(baseSugar, multiplier),
              protein: scaleMacro(baseProtein, multiplier),
              fat: scaleMacro(baseFat, multiplier),
              amount: multiplier,
              amountMode: "portion" as const,
            };
          }),
        };
      } else {
        const grams = hasAmountInput ? Math.max(amountNum, 0) : 100;
        const multiplier = grams / 100;
        adjustedAnalysis = {
          ...analysis,
          totalCalories:
            typeof analysis.totalCalories === "number"
              ? Math.round(analysis.totalCalories * multiplier)
              : analysis.totalCalories,
          name: hasAmountInput ? `${analysis.name} (${grams}g)` : analysis.name,
          products: analysis.products?.map((p) => {
            const baseCalories =
              typeof p.baseCalories === "number" ? p.baseCalories : p.calories;
            const baseCarbs =
              typeof p.baseCarbs === "number" ? p.baseCarbs : p.carbs;
            const baseSugar =
              typeof p.baseSugar === "number" ? p.baseSugar : p.sugar;
            const baseProtein =
              typeof p.baseProtein === "number" ? p.baseProtein : p.protein;
            const baseFat = typeof p.baseFat === "number" ? p.baseFat : p.fat;

            return {
              ...p,
              baseCalories,
              baseCarbs,
              baseSugar,
              baseProtein,
              baseFat,
              calories: Math.round(baseCalories * multiplier),
              carbs: scaleMacro(baseCarbs, multiplier),
              sugar: scaleMacro(baseSugar, multiplier),
              protein: scaleMacro(baseProtein, multiplier),
              fat: scaleMacro(baseFat, multiplier),
              amount: grams,
              amountMode: "per100" as const,
            };
          }),
        };
      }

      finalAnalysis = adjustedAnalysis;
    } else {
      return;
    }

    await addAnalysisToDate(dateToUse, finalAnalysis);
    resetForm();
    onSaved?.();
    onClose();
  };

  if (!analysis && !allowManualEntry) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={false}
    >
      <View style={styles.container}>
        {preselectedDate === null || preselectedDate === undefined ? (
          <>
            <Text style={styles.title}>Valitse päivä</Text>
            {analysis && (
              <Text style={styles.subtitle}>Lisätään: {analysis.name}</Text>
            )}

            <Calendar
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
              }}
              markedDates={
                selectedDate
                  ? {
                      [selectedDate]: { selected: true, selectedColor: "#2d5a3d" },
                    }
                  : undefined
              }
              theme={{
                backgroundColor: "#1e1e1e",
                calendarBackground: "#1e1e1e",
                textSectionTitleColor: "#b6c1cd",
                selectedDayBackgroundColor: "#2d5a3d",
                selectedDayTextColor: "#ffffff",
                todayTextColor: "#4ade80",
                dayTextColor: "#ffffff",
                textDisabledColor: "#555",
                monthTextColor: "#ffffff",
                textMonthFontWeight: "bold",
              }}
            />
          </>
        ) : (
          <Text style={styles.title}>🗓️ Lisätään päivälle {preselectedDate}</Text>
        )}

        {(selectedDate || preselectedDate) && analysis && (
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>
              {isImageAnalysis
                ? "Paljonko söit annoksesta? (%)"
                : "Paljonko söit/joit? (grammaa/ml)"}
            </Text>
            <TextInput
              placeholder={isImageAnalysis ? "Esim. 70" : "Esim. 150"}
              placeholderTextColor="#777"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={styles.amountInput}
            />
            {analysis.totalCalories &&
              amount.trim() &&
              !isNaN(parseFloat(amount.replace(",", "."))) && (
                <Text style={styles.caloriePreview}>
                  {"~ "}
                  {Math.round(
                    (analysis.totalCalories * parseFloat(amount.replace(",", "."))) / 100
                  )}{" "}
                  kcal
                </Text>
              )}
          </View>
        )}

        {(selectedDate || preselectedDate) && allowManualEntry && !analysis && (
          <View style={styles.manualInputContainer}>
            <Text style={styles.inputLabel}>Tuotteen nimi</Text>
            <TextInput
              placeholder="Esim. Proteiinipatukka"
              placeholderTextColor="#777"
              value={manualName}
              onChangeText={setManualName}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Kalorit (kcal)</Text>
            <TextInput
              placeholder="Esim. 250"
              placeholderTextColor="#777"
              value={manualCalories}
              onChangeText={setManualCalories}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        )}

        {(selectedDate || preselectedDate) && (
          <Pressable
            style={[styles.closeButton, { backgroundColor: "#2d5a3d" }]}
            onPress={handleSaveToCalendar}
          >
            <Text style={{ color: "white" }}>Tallenna</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.closeButton}
          onPress={() => {
            resetForm();
            onClose();
          }}
        >
          <Text style={{ color: "white" }}>Sulje</Text>
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
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 40,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 16,
    marginBottom: 24,
  },
  closeButton: {
    marginTop: 20,
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 12,
    alignItems: "center",
  },
  amountContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
  },
  amountLabel: {
    color: "white",
    fontSize: 16,
    marginBottom: 8,
  },
  amountInput: {
    backgroundColor: "#333",
    color: "white",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  caloriePreview: {
    color: "#4ade80",
    fontSize: 14,
    marginTop: 8,
    fontWeight: "bold",
  },
  manualInputContainer: {
    marginTop: 20,
    gap: 12,
  },
  inputLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#2a2a2a",
    color: "white",
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#444",
  },
});
