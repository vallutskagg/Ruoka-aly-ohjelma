// app/components/ProfileModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgeRange, Gender, TrainingIntensity, UserGoal } from "../types";

type Props = {
  visible: boolean;
  slideFrom?: "left" | "right";
  onClose: () => void;
  onSave: () => void;
  useProfile: boolean;
  setUseProfile: (value: boolean) => void;
  weight: string;
  setWeight: (value: string) => void;
  height: string;
  setHeight: (value: string) => void;
  goal: UserGoal | null;
  setGoal: (value: UserGoal | null) => void;
  timeframe: string;
  setTimeframe: (value: string) => void;
  derivedTimeframe: number | null;
  targetWeight: string;
  setTargetWeight: (value: string) => void;
  targetMuscle: string;
  setTargetMuscle: (value: string) => void;
  currentWeight: string;
  setCurrentWeight: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  gender: Gender | null;
  setGender: (value: Gender | null) => void;
  ageRange: AgeRange | null;
  setAgeRange: (value: AgeRange | null) => void;
  trainingSessionsPerWeek: string;
  setTrainingSessionsPerWeek: (value: string) => void;
  trainingIntensity: TrainingIntensity | null;
  setTrainingIntensity: (value: TrainingIntensity | null) => void;
  onOpenDiary?: () => void;
  onOpenAnalyses?: () => void;
  onOpenCamera?: () => void;
  onOpenCalendar?: () => void;
};

export default function ProfileModal({
  visible,
  slideFrom = "right",
  onClose,
  onSave,
  useProfile,
  setUseProfile,
  weight,
  setWeight,
  height,
  setHeight,
  goal,
  setGoal,
  timeframe,
  setTimeframe,
  derivedTimeframe,
  targetWeight,
  setTargetWeight,
  targetMuscle,
  setTargetMuscle,
  currentWeight,
  setCurrentWeight,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  gender,
  setGender,
  ageRange,
  setAgeRange,
  trainingSessionsPerWeek,
  setTrainingSessionsPerWeek,
  trainingIntensity,
  setTrainingIntensity,
  onOpenDiary,
  onOpenAnalyses,
  onOpenCamera,
  onOpenCalendar,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showWeightSavedToast, setShowWeightSavedToast] = useState(false);
  const [activeDateField, setActiveDateField] = useState<"start" | "end" | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const screenWidth = Dimensions.get("window").width;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const startX = slideFrom === "right" ? screenWidth : -screenWidth;
    translateX.setValue(startX);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, slideFrom, screenWidth, translateX]);

  const handleDateSelect = (isoDate: string) => {
    const parts = isoDate.split("-");
    if (parts.length !== 3) return;
    const [year, month, day] = parts;
    const finnish = `${day}.${month}.${year}`;

    if (activeDateField === "start") {
      setStartDate(finnish);
    } else if (activeDateField === "end") {
      setEndDate(finnish);
    }

    setCalendarSelectedDate(isoDate);
    setActiveDateField(null);
  };

  const hasTrainingSessionsInput = trainingSessionsPerWeek.trim().length > 0;

  return (
    <>
    <Modal 
      visible={visible} 
      animationType="none" 
      transparent={false}
      statusBarTranslucent={false}
      navigationBarTranslucent={false}
    >
      <View style={styles.modalBackdropDark}>
        <Animated.View
          style={[
            styles.modalSlideLayer,
            { transform: [{ translateX }] },
          ]}
        >
          <Animated.View
            style={[
              styles.modalSlideLayer,
              { transform: [{ translateX: Animated.multiply(translateX, -1) }] },
            ]}
          >
            <View
              style={[
                styles.container,
                { paddingBottom: Math.max(120, insets.bottom + 104) },
              ]}
            >
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={styles.header}>
              <Text style={styles.title}>👤 Terveysprofiili</Text>
              <Pressable
                style={[styles.toggle, useProfile && styles.toggleActive]}
                onPress={() => setUseProfile(!useProfile)}
              >
                <Text style={styles.toggleText}>
                  {useProfile ? "🟢 Käytössä" : "⚫ Pois"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.subtitle}>
              {useProfile
                ? "Analyysi perustuu profiiliisi"
                : "Profiilin käyttö on pois päältä - normaali analyysi"}
            </Text>

            <Text style={styles.label}>⚖️ Paino (kg)</Text>
            <TextInput
              placeholder="esim. 75"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              style={styles.input}
            />

            <Text style={styles.label}>📏 Pituus (cm)</Text>
            <TextInput
              placeholder="esim. 180"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
              style={styles.input}
            />

            <Text style={styles.label}>🚻 Sukupuoli</Text>
            <View style={styles.buttonGroup}>
              {([
                { key: "male" as Gender, label: "Mies" },
                { key: "female" as Gender, label: "Nainen" },
              ]).map((option) => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.goalButton,
                    gender === option.key && styles.goalButtonActive,
                  ]}
                  onPress={() =>
                    setGender(gender === option.key ? null : option.key)
                  }
                >
                  <Text
                    style={[
                      styles.goalButtonText,
                      gender === option.key && styles.goalButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>🎂 Ikähaarukka</Text>
            <View style={styles.buttonGroup}>
              {([
                { key: "15-18" as AgeRange, label: "15-18 v" },
                { key: "18-30" as AgeRange, label: "18-30 v" },
                { key: "31-50" as AgeRange, label: "31-50 v" },
                { key: "51-65" as AgeRange, label: "51-65 v" },
                { key: "65+" as AgeRange, label: "65+ v" },
              ]).map((option) => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.goalButton,
                    styles.ageButton,
                    ageRange === option.key && styles.goalButtonActive,
                  ]}
                  onPress={() =>
                    setAgeRange(ageRange === option.key ? null : option.key)
                  }
                >
                  <Text
                    style={[
                      styles.goalButtonText,
                      styles.ageButtonText,
                      ageRange === option.key && styles.goalButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>🏃 Treenikerrat viikossa</Text>
            <Text style={styles.hint}>
              Esim. 0-1 = hyvin vähän, 2-3 = kevyt, 4-5 = kohtalainen, 6+ = korkea aktiivisuus.
            </Text>
            <TextInput
              placeholder="esim. 3"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
              value={trainingSessionsPerWeek}
              onChangeText={(value) => {
                setTrainingSessionsPerWeek(value);
                if (value.trim().length === 0) {
                  setTrainingIntensity(null);
                }
              }}
              style={styles.input}
            />
            {hasTrainingSessionsInput && (
              <>
            <Text style={styles.label}>🔥 Treenin intensiteetti</Text>
            <Text style={styles.hint}>
              Valitse arvio: kevyt, keskikova tai kova.
            </Text>
            <View style={styles.buttonGroup}>
              {([
                { key: "kevyt" as TrainingIntensity, label: "Kevyt" },
                { key: "keskikova" as TrainingIntensity, label: "Keskikova" },
                { key: "kova" as TrainingIntensity, label: "Kova" },
              ]).map((option) => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.goalButton,
                    trainingIntensity === option.key && styles.goalButtonActive,
                  ]}
                  onPress={() =>
                    setTrainingIntensity(
                      trainingIntensity === option.key ? null : option.key
                    )
                  }
                >
                  <Text
                    style={[
                      styles.goalButtonText,
                      trainingIntensity === option.key &&
                        styles.goalButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

              </>
            )}
            {/* BMI-indikaattori */}
            {weight && height && parseFloat(weight) > 0 && parseFloat(height) > 0 && (() => {
              const bmi = parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2);
              const bmiRounded = bmi.toFixed(1);
              
              // BMI-kategoriat: < 18.5 alipainoa, 18.5-24.9 normaali, 25-29.9 ylipaino, >= 30 lihavuus
              let category = "";
              let color = "";
              let position = 0;
              
              if (bmi < 18.5) {
                category = "Alipaino";
                color = "#9ca3af";
                position = (bmi / 18.5) * 25; // 0-25%
              } else if (bmi < 25) {
                category = "Normaali";
                color = "#4ade80"; // vihreä
                position = 25 + ((bmi - 18.5) / (25 - 18.5)) * 35; // 25-60%
              } else if (bmi < 30) {
                category = "Ylipaino";
                color = "#fbbf24"; // keltainen
                position = 60 + ((bmi - 25) / (30 - 25)) * 25; // 60-85%
              } else {
                category = "Lihavuus";
                color = "#f87171"; // punainen
                position = 85 + Math.min(((bmi - 30) / 10) * 15, 15); // 85-100%
              }
              
              return (
                <View style={styles.bmiContainer}>
                  <Text style={styles.bmiLabel}>📊 BMI: {bmiRounded}</Text>
                  <Text style={[styles.bmiCategory, { color }]}>{category}</Text>
                  
                  <View style={styles.bmiMeter}>
                    <View style={[styles.bmiSection, { backgroundColor: '#9ca3af', flex: 25 }]} />
                    <View style={[styles.bmiSection, { backgroundColor: '#4ade80', flex: 35 }]} />
                    <View style={[styles.bmiSection, { backgroundColor: '#fbbf24', flex: 25 }]} />
                    <View style={[styles.bmiSection, { backgroundColor: '#f87171', flex: 15 }]} />
                    
                    <View style={[styles.bmiIndicator, { left: `${Math.min(Math.max(position, 0), 100)}%` }]} />
                  </View>
                  
                  <View style={styles.bmiLabels}>
                    <Text style={styles.bmiLabelText}> 18.5</Text>
                    <Text style={styles.bmiLabelText}>18.5-25</Text>
                    <Text style={styles.bmiLabelText}>25-30</Text>
                    <Text style={styles.bmiLabelText}>≥ 30</Text>
                  </View>
                </View>
              );
            })()}

            <Text style={styles.label}>🎯 Tavoite</Text>
            <View style={styles.buttonGroup}>
              {(["laihdutus", "ylläpito", "lihasmassa"] as const).map((g) => (
                <Pressable
                  key={g}
                  style={[styles.goalButton, goal === g && styles.goalButtonActive]}
                  onPress={() => setGoal(g)}
                >
                  <Text
                    style={[
                      styles.goalButtonText,
                      goal === g && styles.goalButtonTextActive,
                    ]}
                  >
                    {g === "laihdutus" && "📉 Laihdutus"}
                    {g === "ylläpito" && "➡️ Ylläpito"}
                    {g === "lihasmassa" && "💪 Lihasmassa"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {goal === "laihdutus" && (
              <>
                <Text style={styles.label}>📉 Tavoitepaino (kg)</Text>
                <TextInput
                  placeholder="esim. 70"
                  placeholderTextColor="#777"
                  keyboardType="decimal-pad"
                  value={targetWeight}
                  onChangeText={setTargetWeight}
                  style={styles.input}
                />
              </>
            )}

            {goal === "lihasmassa" && (
              <>
                <Text style={styles.label}>💪 Tavoite lihasmassa (kg)</Text>
                <TextInput
                  placeholder="esim. 1-5"
                  placeholderTextColor="#777"
                  keyboardType="decimal-pad"
                  value={targetMuscle}
                  onChangeText={setTargetMuscle}
                  style={styles.input}
                />
              </>
            )}

            {(goal === "laihdutus" || goal === "lihasmassa") && (
              <>
                <Text style={styles.label}>📅 Aikajänne</Text>
                <Text style={styles.hint}>
                  Muoto: pp.kk.vvvv (esim. 01.01.2026)
                </Text>

                <Text style={styles.label}>Alkamispäivä</Text>
                <Pressable
                  onPress={() => {
                    setActiveDateField("start");
                    setCalendarSelectedDate(null);
                  }}
                  style={styles.dateInput}
                >
                  <Text
                    style={startDate ? styles.dateInputText : styles.datePlaceholderText}
                  >
                    {startDate || "pp.kk.vvvv"}
                  </Text>
                </Pressable>

                <Text style={styles.label}>Päättymispäivä</Text>
                <Pressable
                  onPress={() => {
                    setActiveDateField("end");
                    setCalendarSelectedDate(null);
                  }}
                  style={styles.dateInput}
                >
                  <Text
                    style={endDate ? styles.dateInputText : styles.datePlaceholderText}
                  >
                    {endDate || "pp.kk.vvvv"}
                  </Text>
                </Pressable>

                {derivedTimeframe !== null && derivedTimeframe > 0 && (
                  <Text style={styles.hint}>
                    Arvioitu aikajänne: ~
                    {derivedTimeframe.toFixed(1).replace(".", ",")} kk
                  </Text>
                )}
              </>
            )}
          </ScrollView>

              <View style={styles.buttonRow}>
                <Pressable style={styles.cancelButton} onPress={onClose}>
                  <Text style={{ color: "white" }}>Peruuta</Text>
                </Pressable>

                <Pressable style={styles.saveButton} onPress={onSave}>
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    ✅ Tallenna
                  </Text>
                </Pressable>
              </View>
              <View
                style={[
                  styles.profileNavBar,
                  { bottom: insets.bottom > 0 ? 12 : 16 },
                ]}
              >
                <Pressable style={styles.profileNavItem} onPress={onOpenDiary}>
                  <Ionicons name="book-outline" size={20} color="#9ca3af" />
                  <Text style={styles.profileNavLabel}>Päiväkirja</Text>
                </Pressable>
                <Pressable style={styles.profileNavItem} onPress={onOpenAnalyses}>
                  <Ionicons name="analytics-outline" size={20} color="#9ca3af" />
                  <Text style={styles.profileNavLabel}>Analyysit</Text>
                </Pressable>
                <Pressable style={styles.profileNavItem} onPress={onOpenCamera}>
                  <Ionicons name="camera-outline" size={20} color="#9ca3af" />
                  <Text style={styles.profileNavLabel}>Kamera</Text>
                </Pressable>
                <Pressable style={[styles.profileNavItem, styles.profileNavItemActive]}>
                  <Ionicons name="person-outline" size={20} color="#ffffff" />
                  <Text style={[styles.profileNavLabel, styles.profileNavLabelActive]}>Profiili</Text>
                </Pressable>
                <Pressable style={styles.profileNavItem} onPress={onOpenCalendar}>
                  <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
                  <Text style={styles.profileNavLabel}>Kalenteri</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>

    </Modal>
    <Modal
      visible={activeDateField !== null}
      transparent
      animationType="fade"
    >
      <View style={styles.dateOverlay}>
        <View style={styles.datePickerContainer}>
          <Text style={styles.dateTitle}>
            {activeDateField === "start" ? "Valitse alkamispäivä" : "Valitse päättymispäivä"}
          </Text>
          <Calendar
            onDayPress={(day) => handleDateSelect(day.dateString)}
            markedDates={calendarSelectedDate ? {
              [calendarSelectedDate]: { selected: true, selectedColor: "#2d5a3d" },
            } : undefined}
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
          <Pressable
            style={styles.dateCancelButton}
            onPress={() => {
              setActiveDateField(null);
              setCalendarSelectedDate(null);
            }}
          >
            <Text style={styles.dateCancelButtonText}>Peruuta</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    {/* Toast-ilmoitus painon tallennuksesta */}
    <Modal transparent visible={showWeightSavedToast} animationType="fade">
      <View style={styles.toastOverlay}>
        <View style={styles.toastBox}>
          <Text style={{ color: "white", marginBottom: 16 }}>
            ✅ Paino tallennettu
          </Text>
          <Pressable
            style={styles.toastButton}
            onPress={() => setShowWeightSavedToast(false)}
          >
            <Text style={{ color: "white" }}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdropDark: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  modalSlideLayer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#999",
    marginBottom: 20,
    fontSize: 13,
  },
  label: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  hint: {
    color: "#999",
    fontSize: 12,
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#333",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  dateInput: {
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  dateInputText: {
    color: "white",
    fontSize: 16,
  },
  datePlaceholderText: {
    color: "#777",
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  goalButton: {
    flex: 1,
    marginRight: 8,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#333",
    borderRadius: 8,
    alignItems: "center",
  },
  ageButton: {
    minWidth: 80,
  },
  goalButtonActive: {
    backgroundColor: "#2d5a3d",
    borderWidth: 2,
    borderColor: "#4a9d6f",
  },
  goalButtonText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  ageButtonText: {
    fontSize: 11,
  },
  goalButtonTextActive: {
    color: "#4ade80",
    fontWeight: "bold",
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#555",
    borderWidth: 1,
    borderColor: "#777",
  },
  toggleActive: {
    backgroundColor: "#2d5a3d",
    borderColor: "#4a9d6f",
  },
  toggleText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    backgroundColor: "#333",
    borderRadius: 8,
    alignItems: "center",
  },
  saveButton: {
    flex: 1,
    padding: 12,
    backgroundColor: "#2d5a3d",
    borderRadius: 8,
    alignItems: "center",
  },
  profileNavBar: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3f4652",
    backgroundColor: "#2d3137",
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 8,
    zIndex: 10,
  },
  profileNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 10,
    paddingVertical: 2,
  },
  profileNavItemActive: {
    backgroundColor: "#23272d",
  },
  profileNavLabel: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  profileNavLabelActive: {
    color: "#ffffff",
  },
  bmiContainer: {
    backgroundColor: "#2a2a2a",
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  bmiLabel: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  bmiCategory: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  bmiMeter: {
    height: 20,
    borderRadius: 10,
    flexDirection: "row",
    overflow: "hidden",
    position: "relative",
    marginBottom: 8,
  },
  bmiSection: {
    height: "100%",
  },
  bmiIndicator: {
    position: "absolute",
    top: -4,
    width: 3,
    height: 28,
    backgroundColor: "white",
    borderRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  bmiLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  bmiLabelText: {
    color: "#999",
    fontSize: 10,
    fontWeight: "500",
  },
  progressContainer: {
    backgroundColor: "#2a2a2a",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  progressLabel: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: "#333",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4ade80",
    borderRadius: 6,
  },
  monthlyGoalContainer: {
    backgroundColor: "#2a2a2a",
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 2,
    borderColor: "#4ade80",
  },
  monthlyGoalWarning: {
    borderColor: "#fbbf24",
  },
  monthlyGoalText: {
    color: "#4ade80",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
  warningText: {
    color: "#fbbf24",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  saveWeightButton: {
    backgroundColor: "#2d5a3d",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    minWidth: 48,
  },
  saveWeightButtonText: {
    fontSize: 18,
  },
  toastOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  toastBox: {
    backgroundColor: "#222",
    padding: 24,
    borderRadius: 16,
    width: "80%",
    alignItems: "center",
  },
  toastButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#333",
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  dateOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerContainer: {
    backgroundColor: "#1e1e1e",
    padding: 16,
    borderRadius: 12,
    width: "90%",
  },
  dateTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  dateCancelButton: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#333",
    borderRadius: 8,
    alignItems: "center",
  },
  dateCancelButtonText: {
    color: "white",
    fontSize: 14,
  },
});

