// app/CalendarView.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import CalendarModal from "./CalendarModal";
import { STORAGE_KEYS } from "./constants";
import { addWeightEntry, loadCalendar, saveCalendar } from "./Storage/calendarStorage";
import { CalendarData, CalendarDay, CalendarProduct, SavedAnalysis, WeightEntry } from "./Storage/Types";
import { AgeRange, UserProfile } from "./types";
import { getActivityFactor } from "./utils/activity";

type Props = {
  visible: boolean;
  slideFrom?: "up" | "none";
  onClose: () => void;
  onOpenRecipes?: () => void;
  onOpenAnalyses?: () => void;
  onOpenProfile?: () => void;
  onOpenCamera?: () => void;
  initialSection?: "diary" | "calendar";
};

export default function CalendarView({
  visible,
  slideFrom = "up",
  onClose,
  onOpenRecipes,
  onOpenAnalyses,
  onOpenProfile,
  onOpenCamera,
  initialSection = "diary",
}: Props) {
  const insets = useSafeAreaInsets();
  const toIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const parseIsoDate = (value: string): Date | null => {
    const [yearStr, monthStr, dayStr] = value.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  };
  const shiftIsoDate = (isoDate: string, days: number): string => {
    const parsed = parseIsoDate(isoDate);
    if (!parsed) return isoDate;
    parsed.setDate(parsed.getDate() + days);
    return toIsoDate(parsed);
  };
  const formatDateLabel = (isoDate: string): string => {
    const date = parseIsoDate(isoDate);
    if (!date) return isoDate;
    const todayIso = toIsoDate(new Date());
    const yesterdayIso = shiftIsoDate(todayIso, -1);
    const tomorrowIso = shiftIsoDate(todayIso, 1);
    if (isoDate === todayIso) return "Tänään";
    if (isoDate === yesterdayIso) return "Eilen";
    if (isoDate === tomorrowIso) return "Huomenna";
    return date.toLocaleDateString("fi-FI", { weekday: "short", day: "numeric", month: "numeric" });
  };

  const [calendar, setCalendar] = useState<CalendarData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [useProfile, setUseProfile] = useState<boolean>(true);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showCaloriesSummary, setShowCaloriesSummary] = useState(false);
  const [showTargetCalories, setShowTargetCalories] = useState(false);
  const [showWeeklyMacros, setShowWeeklyMacros] = useState(false);
  const [showWeightProgress, setShowWeightProgress] = useState(false);
  const [expandedEntryIndex, setExpandedEntryIndex] = useState<number | null>(null);
  const [showCopyEntryModal, setShowCopyEntryModal] = useState(false);
  const [copyEntryIndex, setCopyEntryIndex] = useState<number | null>(null);
  const [copyEntryTargetDates, setCopyEntryTargetDates] = useState<string[]>([]);
  const [showEditAmountModal, setShowEditAmountModal] = useState(false);
  const [editAmountEntryIndex, setEditAmountEntryIndex] = useState<number | null>(null);
  const [editAmountInput, setEditAmountInput] = useState("");
  const [editAmountMode, setEditAmountMode] = useState<"per100" | "portion">("portion");
  const [showAnalysisPicker, setShowAnalysisPicker] = useState(false);
  const [savedAnalysesForCalendar, setSavedAnalysesForCalendar] = useState<
    SavedAnalysis[]
  >([]);
  const [analysisSearchQuery, setAnalysisSearchQuery] = useState("");
  const [selectedAnalysisForAdd, setSelectedAnalysisForAdd] =
    useState<SavedAnalysis | null>(null);
  const [showAddFromAnalysisModal, setShowAddFromAnalysisModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightDateForInput, setWeightDateForInput] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"diary" | "calendar">(initialSection);
  const screenHeight = Dimensions.get("window").height;
  const revealMaskY = useRef(new Animated.Value(0)).current;

  const normalizeGoal = (value: unknown): UserProfile["goal"] => {
    if (value === "laihdutus" || value === "ylläpito" || value === "lihasmassa") return value;
    if (typeof value !== "string") return null;

    const canonical = value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");

    if (canonical === "yllapito" || canonical === "yllpito") return "ylläpito";
    return null;
  };

  useEffect(() => {
    if (visible) {
      loadData();
      loadProfileData();
      setActiveSection(initialSection);
      if (initialSection === "diary") {
        setSelectedDate(toIsoDate(new Date()));
      } else {
        setSelectedDate(null);
        setSelectedDay(null);
      }
    } else {
      // Nollaa valinta kun kalenteri suljetaan
      setSelectedDate(null);
      setSelectedDay(null);
      setShowDatePicker(false);
      closeWeightModal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialSection]);

  useEffect(() => {
    if (!visible) return;
    if (slideFrom !== "up") {
      revealMaskY.setValue(-screenHeight);
      return;
    }
    revealMaskY.setValue(0);
    Animated.timing(revealMaskY, {
      toValue: -screenHeight,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, slideFrom, screenHeight, revealMaskY]);

  // Pidä valitun päivän data aina synkassa kalenterin kanssa
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDay(null);
      closeEditAmountModal();
      return;
    }
    setSelectedDay(calendar[selectedDate] || null);
  }, [calendar, selectedDate]);

  const loadData = async () => {
    const data = await loadCalendar();
    setCalendar(data);
  };

  const loadSavedAnalysesForCalendar = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.ANALYSES);
      if (!raw) {
        setSavedAnalysesForCalendar([]);
        return;
      }

      const parsed = JSON.parse(raw) as SavedAnalysis[];
      const available = parsed.filter(
        (a) =>
          !a.isRecipe &&
          Array.isArray(a.products) &&
          a.products.length > 0
      );
      setSavedAnalysesForCalendar(available);
    } catch {
      setSavedAnalysesForCalendar([]);
    }
  };

  const loadProfileData = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (data) {
        const parsed = JSON.parse(data) as UserProfile;
        setProfile({
          ...parsed,
          goal: normalizeGoal(parsed.goal),
        });
      }
      
      const useProfileData = await AsyncStorage.getItem(STORAGE_KEYS.USE_PROFILE);
      if (useProfileData !== null) {
        setUseProfile(JSON.parse(useProfileData));
      }
    } catch (err) {
      console.error("Profiilin lataaminen epäonnistui:", err);
    }
  };

  const commitCalendar = async (next: CalendarData) => {
    setCalendar(next);
    if (selectedDate) {
      setSelectedDay(next[selectedDate] || null);
    }
    await saveCalendar(next);
  };

  const handleDeleteEntry = (index: number) => {
    if (!selectedDate) return;
    const next: CalendarData = { ...calendar };
    const day = next[selectedDate];
    if (!day) return;

    const newEntries = day.entries.filter((_, i) => i !== index);
    if (newEntries.length === 0 && !day.weightEntry) {
      delete next[selectedDate];
    } else {
      day.entries = newEntries;
    }

    setExpandedEntryIndex(null);
    commitCalendar(next);
  };

  const openCopyEntry = (index: number) => {
    if (!selectedDay?.entries[index]) return;
    setCopyEntryIndex(index);
    setCopyEntryTargetDates([]);
    setShowCopyEntryModal(true);
  };

  const copyEntryToDates = async (targetDates: string[], mode: "append" | "replace") => {
    if (!selectedDate || copyEntryIndex === null) return;
    const validTargets = targetDates.filter((d) => d !== selectedDate);
    if (validTargets.length === 0) return;

    const source = calendar[selectedDate];
    if (!source) return;
    const entry = source.entries[copyEntryIndex];
    if (!entry) return;

    const remapLoggedAtToDate = (targetDate: string, loggedAt?: number) => {
      if (typeof loggedAt !== "number" || !Number.isFinite(loggedAt)) return undefined;
      const sourceTime = new Date(loggedAt);
      const mapped = new Date(`${targetDate}T00:00:00`);
      mapped.setHours(sourceTime.getHours(), sourceTime.getMinutes(), 0, 0);
      return mapped.getTime();
    };

    const next: CalendarData = { ...calendar };
    validTargets.forEach((targetDate) => {
      const target = next[targetDate];
      const clonedEntry = {
        ...entry,
        product: { ...entry.product },
        loggedAt: remapLoggedAtToDate(targetDate, entry.loggedAt),
      };

      if (!target) {
        next[targetDate] = { date: targetDate, entries: [clonedEntry] };
      } else if (mode === "replace") {
        next[targetDate] = { ...target, entries: [clonedEntry] };
      } else {
        next[targetDate] = { ...target, entries: [...target.entries, clonedEntry] };
      }
    });

    await commitCalendar(next);
    setShowCopyEntryModal(false);
    setCopyEntryIndex(null);
    setCopyEntryTargetDates([]);
  };

  const inferAmountMode = (product: CalendarProduct): "per100" | "portion" => {
    if (product.amountMode === "per100" || product.amountMode === "portion") {
      return product.amountMode;
    }
    if (
      typeof product.amount === "number" &&
      product.amount > 10 &&
      typeof product.baseCalories === "number"
    ) {
      return "per100";
    }
    return "portion";
  };

  const applyAmountToProduct = (
    product: CalendarProduct,
    amountValue: number,
    mode: "per100" | "portion"
  ): CalendarProduct => {
    const normalizedAmount = Math.max(amountValue, 0);
    const multiplier = mode === "per100" ? normalizedAmount / 100 : normalizedAmount;

    const baseCalories =
      typeof product.baseCalories === "number" ? product.baseCalories : product.calories;
    const baseCarbs =
      typeof product.baseCarbs === "number" ? product.baseCarbs : product.carbs;
    const baseSugar =
      typeof product.baseSugar === "number" ? product.baseSugar : product.sugar;
    const baseProtein =
      typeof product.baseProtein === "number" ? product.baseProtein : product.protein;
    const baseFat = typeof product.baseFat === "number" ? product.baseFat : product.fat;

    const scaleMacro = (value: number | undefined) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.round(value * multiplier)
        : value;

    return {
      ...product,
      baseCalories,
      baseCarbs,
      baseSugar,
      baseProtein,
      baseFat,
      calories: Math.round(baseCalories * multiplier),
      carbs: scaleMacro(baseCarbs),
      sugar: scaleMacro(baseSugar),
      protein: scaleMacro(baseProtein),
      fat: scaleMacro(baseFat),
      amount: normalizedAmount,
      amountMode: mode,
    };
  };

  const formatAmountNumber = (value: number) =>
    Number.isInteger(value)
      ? value.toString()
      : value.toLocaleString("fi-FI", { maximumFractionDigits: 2 });

  const getEntryTitleWithAmount = (product: CalendarProduct) => {
    const mode = inferAmountMode(product);
    if (mode !== "portion") return product.name;

    const amount =
      typeof product.amount === "number" && product.amount > 0 ? product.amount : 1;
    if (Math.abs(amount - 1) < 1e-9) return product.name;
    const isSinglePiece = Math.abs(amount - 1) < 1e-9;
    const pieceLabel = isSinglePiece ? "kappale" : "kappaletta";
    return `${product.name} (${formatAmountNumber(amount)} ${pieceLabel})`;
  };

  const openEditEntryAmount = (index: number) => {
    if (!selectedDay?.entries[index]) return;
    const product = selectedDay.entries[index].product;
    const mode = inferAmountMode(product);
    const defaultAmount =
      typeof product.amount === "number" && product.amount > 0
        ? product.amount
        : mode === "per100"
        ? 100
        : 1;

    setEditAmountEntryIndex(index);
    setEditAmountMode(mode);
    setEditAmountInput(defaultAmount.toString().replace(".", ","));
    setShowEditAmountModal(true);
  };

  const closeEditAmountModal = () => {
    setShowEditAmountModal(false);
    setEditAmountEntryIndex(null);
    setEditAmountInput("");
  };

  const saveEditedEntryAmount = async () => {
    if (!selectedDate || editAmountEntryIndex === null) return;
    const parsedAmount = parseFloat(editAmountInput.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("⚠️ Syötä kelvollinen määrä");
      return;
    }

    const next: CalendarData = { ...calendar };
    const day = next[selectedDate];
    if (!day || !day.entries[editAmountEntryIndex]) return;

    const entry = day.entries[editAmountEntryIndex];
    const updatedProduct = applyAmountToProduct(
      entry.product,
      parsedAmount,
      editAmountMode
    );
    day.entries = day.entries.map((existingEntry, idx) =>
      idx === editAmountEntryIndex
        ? { ...existingEntry, product: updatedProduct }
        : existingEntry
    );

    await commitCalendar(next);
    closeEditAmountModal();
  };

  const selectDate = (dateString: string) => {
    setSelectedDate(dateString);
    setSelectedDay(calendar[dateString] || null);
    setExpandedEntryIndex(null);
    setShowWeightProgress(false);
    closeEditAmountModal();
    setShowDatePicker(false);
  };

  const openDiarySection = () => {
    setActiveSection("diary");
    selectDate(toIsoDate(new Date()));
  };

  const openCalendarSection = () => {
    setActiveSection("calendar");
    setSelectedDate(null);
    setSelectedDay(null);
    setShowWeightProgress(false);
    setExpandedEntryIndex(null);
    closeEditAmountModal();
    setShowDatePicker(false);
  };

  const handleDayPress = (day: DateData) => {
    selectDate(day.dateString);
  };

  const openWeightModal = (dateOverride?: string) => {
    const targetDate = dateOverride ?? selectedDate ?? toIsoDate(new Date());
    const existingWeight = calendar[targetDate]?.weightEntry?.weight;
    setWeightDateForInput(targetDate);
    setWeightInput(
      typeof existingWeight === "number" && Number.isFinite(existingWeight)
        ? existingWeight.toString().replace(".", ",")
        : ""
    );
    setShowWeightModal(true);
  };

  const closeWeightModal = () => {
    setShowWeightModal(false);
    setWeightDateForInput(null);
    setWeightInput("");
  };

  const saveWeightForDate = async () => {
    if (!weightDateForInput) return;
    const parsed = parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert("⚠️ Syötä kelvollinen paino (kg)");
      return;
    }

    const entryTimestamp = Date.now();
    const next: CalendarData = { ...calendar };
    const existingDay = next[weightDateForInput];
    const weightEntry = {
      date: weightDateForInput,
      weight: parsed,
      timestamp: entryTimestamp,
    };

    if (existingDay) {
      next[weightDateForInput] = { ...existingDay, weightEntry };
    } else {
      next[weightDateForInput] = { date: weightDateForInput, entries: [], weightEntry };
    }

    await commitCalendar(next);
    await addWeightEntry(parsed, weightDateForInput, entryTimestamp);

    if (profile) {
      const updatedProfile: UserProfile = { ...profile, currentWeight: parsed };
      setProfile(updatedProfile);
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PROFILE,
        JSON.stringify(updatedProfile)
      );
    }

    closeWeightModal();
  };

  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatEntryLoggedTime = (loggedAt?: number) => {
    if (typeof loggedAt !== "number" || !Number.isFinite(loggedAt)) return null;
    const date = new Date(loggedAt);
    if (Number.isNaN(date.getTime())) return null;
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  };
  const parseFiDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split(".");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
    const parsed = new Date(year, month, day);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };
  const getWeekStartIso = (isoDate: string): string => {
    const parsed = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    const dayOfWeek = parsed.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    parsed.setDate(parsed.getDate() + diffToMonday);
    return toIsoDate(parsed);
  };

  // Laske päivittäiset tavoitekalorit profiilin perusteella
  const calculateDailyTargetCalories = (): number | null => {
    if (!useProfile || !profile || !profile.weight || !profile.height) return null;

    // Käytä currentWeight jos saatavilla, muuten alkuperäinen paino
    const currentWeight = profile.currentWeight && profile.currentWeight > 0 
      ? profile.currentWeight 
      : profile.weight;
    const height = profile.height;

    // Laske BMR (Basal Metabolic Rate) käyttäen Mifflin-St Jeor -kaavaa, jos
    // sukupuoli ja ikähaarukka on asetettu. Muuten käytetään yksinkertaistettua
    // arviota kuten aiemmin.
    let bmr: number;

    const ageFromRange = (range: AgeRange | null): number | null => {
      if (!range) return null;
      switch (range) {
        case "15-18":
          return 17;
        case "18-30":
          return 24;
        case "31-50":
          return 40;
        case "51-65":
          return 58;
        case "65+":
          return 70;
        default:
          return null;
      }
    };

    const age = ageFromRange(profile.ageRange ?? null);

    if (profile.gender && age !== null) {
      if (profile.gender === "male") {
        // Miehille: 10 * paino + 6.25 * pituus - 5 * ikä + 5
        bmr = 10 * currentWeight + 6.25 * height - 5 * age + 5;
      } else {
        // Naisille: 10 * paino + 6.25 * pituus - 5 * ikä - 161
        bmr = 10 * currentWeight + 6.25 * height - 5 * age - 161;
      }
    } else {
      // Yksinkertaistettu arvio, jos tarkempia tietoja ei ole
      bmr = 10 * currentWeight + 6.25 * height - 100;
    }
    
    const activityFactor = getActivityFactor(
      profile.trainingSessionsPerWeek ?? null,
      profile.trainingIntensity ?? null
    );
    const maintenanceCalories = bmr * activityFactor;

    if (profile.goal === "ylläpito") {
      return Math.round(maintenanceCalories);
    }

    if (profile.goal === "laihdutus" && profile.targetWeight && profile.timeframe) {
      const weightToLose = currentWeight - profile.targetWeight; // Käyttää tämänhetkistä painoa
      const daysInTimeframe = profile.timeframe * 30; // kuukaudet -> päivät
      
      // 1 kg rasva ≈ 7700 kcal
      const totalCalorieDeficit = weightToLose * 7700;
      const dailyDeficit = totalCalorieDeficit / daysInTimeframe;
      
      return Math.round(maintenanceCalories - dailyDeficit);
    }

    if (profile.goal === "lihasmassa" && profile.targetMuscle && profile.timeframe) {
      const muscleToGain = profile.targetMuscle;
      const daysInTimeframe = profile.timeframe * 30;
      
      // Lihaksen kasvattamiseen tarvitaan kaloriylimäärä
      // Noin 2500-3000 kcal per 1kg lihasta
      const totalCalorieSurplus = muscleToGain * 2750;
      const dailySurplus = totalCalorieSurplus / daysInTimeframe;
      
      return Math.round(maintenanceCalories + dailySurplus);
    }

    return Math.round(maintenanceCalories);
  };

  const dailyTarget = calculateDailyTargetCalories();

  const markedDates = Object.keys(calendar).reduce((acc, date) => {
    const dayData = calendar[date];
    const dayTotal = dayData.entries.reduce(
      (sum, e) => sum + e.product.calories,
      0
    );

    let dotColor = "#4ade80"; // oletus: vihreä

    if (useProfile && dailyTarget && profile?.goal) {
      if (profile.goal === "laihdutus" && dayTotal > dailyTarget) {
        dotColor = "#ef4444"; // punainen jos ylittää tavoitteen laihdutuksessa
      }
      if (profile.goal === "lihasmassa" && dayTotal < dailyTarget) {
        dotColor = "#ef4444"; // punainen jos alittaa tavoitteen lihasmassassa
      }
    }

    acc[date] = { marked: true, dotColor };
    return acc;
  }, {} as any);

  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] ?? {}),
      selected: true,
      selectedColor: "#2d5a3d",
    };
  }

  const selectedDayMacros = selectedDay
    ? selectedDay.entries.reduce(
        (acc, entry) => {
          acc.carbs += entry.product.carbs ?? 0;
          acc.sugar += entry.product.sugar ?? 0;
          acc.protein += entry.product.protein ?? 0;
          acc.fat += entry.product.fat ?? 0;
          return acc;
        },
        { carbs: 0, sugar: 0, protein: 0, fat: 0 }
      )
    : { carbs: 0, sugar: 0, protein: 0, fat: 0 };

  // Laske viime viikon (maanantai–sunnuntai) kalorit ja keskiarvo
  const getLastWeekStats = () => {
    const now = new Date();

    const currentWeekStart = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = su, 1 = ma, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(now.getDate() + diffToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setDate(currentWeekStart.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

    let total = 0;
    Object.keys(calendar).forEach((dateStr) => {
      const date = new Date(dateStr);
      if (date >= lastWeekStart && date <= lastWeekEnd) {
        const dayData = calendar[dateStr];
        const dayTotal = dayData.entries.reduce(
          (sum, e) => sum + e.product.calories,
          0
        );
        total += dayTotal;
      }
    });

    const daysInWeek = 7;
    const avgPerDay = daysInWeek > 0 ? total / daysInWeek : 0;
    return {
      total: Math.round(total),
      avgPerDay,
    };
  };

  const { total: lastWeekCalories, avgPerDay: lastWeekAvgPerDay } = getLastWeekStats();

  // Laske kuluvan viikon (maanantai–tänään) kalorit ja keskiarvo / päivä
  const getThisWeekCalories = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // maanantai
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    let total = 0;
    Object.keys(calendar).forEach((dateStr) => {
      const date = new Date(dateStr);
      if (date >= startOfWeek && date <= now) {
        const dayData = calendar[dateStr];
        const dayTotal = dayData.entries.reduce(
          (sum, e) => sum + e.product.calories,
          0
        );
        total += dayTotal;
      }
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const daysInRange =
      Math.floor((todayStart.getTime() - startOfWeek.getTime()) / msPerDay) + 1;

    const roundedTotal = Math.round(total);
    const avgPerDay = daysInRange > 0 ? roundedTotal / daysInRange : 0;

    return {
      total: roundedTotal,
      avgPerDay,
    };
  };

  const { total: thisWeekCalories, avgPerDay: thisWeekAvgPerDay } = getThisWeekCalories();

  // Laske kuluvan viikon makrot (yhteensä ja keskiarvo per päivä)
  const getThisWeekMacroAverages = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // maanantai
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    let totalCarbs = 0;
    let totalSugar = 0;
    let totalProtein = 0;
    let totalFat = 0;

    Object.keys(calendar).forEach((dateStr) => {
      const date = new Date(dateStr);
      if (date >= startOfWeek && date <= now) {
        const dayData = calendar[dateStr];
        dayData.entries.forEach((e) => {
          totalCarbs += e.product.carbs ?? 0;
          totalSugar += e.product.sugar ?? 0;
          totalProtein += e.product.protein ?? 0;
          totalFat += e.product.fat ?? 0;
        });
      }
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysInRange = Math.max(
      1,
      Math.floor((now.setHours(0, 0, 0, 0) - startOfWeek.getTime()) / msPerDay) + 1
    );

    return {
      carbs: totalCarbs / daysInRange,
      sugar: totalSugar / daysInRange,
      protein: totalProtein / daysInRange,
      fat: totalFat / daysInRange,
    } as const;
  };

  // Laske päivittäiset makrotavoitteet profiilin ja tavoitekalorien perusteella
  const calculateDailyMacroTargets = () => {
    if (!useProfile || !profile || !profile.weight || !dailyTarget) return null;

    const currentWeight = profile.currentWeight && profile.currentWeight > 0
      ? profile.currentWeight
      : profile.weight;

    let proteinPerKg = 1.4;
    let fatPerKg = 0.9;

    if (profile.goal === "laihdutus") {
      proteinPerKg = 1.8;
      fatPerKg = 0.8;
    } else if (profile.goal === "lihasmassa") {
      proteinPerKg = 2.0;
      fatPerKg = 1.0;
    }

    const proteinGrams = currentWeight * proteinPerKg;
    const fatGrams = currentWeight * fatPerKg;

    const caloriesFromProtein = proteinGrams * 4;
    const caloriesFromFat = fatGrams * 9;
    const remainingCalories = Math.max(dailyTarget - (caloriesFromProtein + caloriesFromFat), 0);
    const carbsGrams = remainingCalories / 4;
    let sugarCaloriesRatio = 0.1;
    if (profile.goal === "laihdutus") sugarCaloriesRatio = 0.08;
    if (profile.goal === "lihasmassa") sugarCaloriesRatio = 0.12;
    const sugarGrams = Math.min((dailyTarget * sugarCaloriesRatio) / 4, carbsGrams);

    return {
      carbs: Math.round(carbsGrams),
      sugar: Math.round(sugarGrams),
      protein: Math.round(proteinGrams),
      fat: Math.round(fatGrams),
    } as const;
  };

  const dailyMacroTargets = calculateDailyMacroTargets();
  const todayDate = toIsoDate(new Date());
  const todayCalories = calendar[todayDate]
    ? calendar[todayDate].entries.reduce((sum, e) => sum + e.product.calories, 0)
    : 0;
  const selectedDayCalories = selectedDate
    ? (calendar[selectedDate]?.entries ?? []).reduce((sum, e) => sum + e.product.calories, 0)
    : 0;
  const selectedDayCalorieDelta =
    dailyTarget !== null ? Math.round(dailyTarget - selectedDayCalories) : null;
  const weightLog = Object.values(calendar)
    .map((day) => day.weightEntry)
    .filter((entry): entry is WeightEntry => !!entry && Number.isFinite(entry.weight))
    .sort((a, b) => {
      const tsA = Number.isFinite(a.timestamp)
        ? a.timestamp
        : new Date(`${a.date}T12:00:00`).getTime();
      const tsB = Number.isFinite(b.timestamp)
        ? b.timestamp
        : new Date(`${b.date}T12:00:00`).getTime();
      return tsA - tsB;
    });
  const firstWeight = profile?.weight && profile.weight > 0 ? profile.weight : null;
  const latestWeightFromLog = weightLog.length > 0 ? weightLog[weightLog.length - 1].weight : null;
  const currentWeightForProgress =
    profile?.currentWeight && profile.currentWeight > 0
      ? profile.currentWeight
      : latestWeightFromLog ?? firstWeight;
  const canShowWeightProgress =
    !!profile &&
    (profile.goal === "laihdutus" || profile.goal === "lihasmassa") &&
    firstWeight !== null &&
    currentWeightForProgress !== null;
  const weightDelta =
    firstWeight !== null && currentWeightForProgress !== null
      ? currentWeightForProgress - firstWeight
      : null;
  const weightDeltaPercent =
    firstWeight !== null && weightDelta !== null && firstWeight > 0
      ? ((weightDelta / firstWeight) * 100).toFixed(1)
      : null;
  const weightTrendColor =
    weightDelta === null ? "#9ca3af" : weightDelta > 0 ? "#ef4444" : weightDelta < 0 ? "#22c55e" : "#9ca3af";

  const startDateParsed = parseFiDate(profile?.startDate ?? null);
  const endDateParsed = parseFiDate(profile?.endDate ?? null);
  const totalTimelineMonths =
    startDateParsed && endDateParsed && endDateParsed > startDateParsed
      ? Math.max(
          0.1,
          Math.ceil((endDateParsed.getTime() - startDateParsed.getTime()) / (1000 * 60 * 60 * 24)) / 30
        )
      : null;
  let monthlyGoalText: string | null = null;
  let monthlyGoalSubtext: string | null = null;
  if (profile?.goal === "laihdutus" && firstWeight !== null && profile.targetWeight && totalTimelineMonths) {
    const totalLoss = firstWeight - profile.targetWeight;
    if (totalLoss > 0) {
      monthlyGoalText = `📉 Tavoite: ${(totalLoss / totalTimelineMonths).toFixed(1)} kg/kk`;
      monthlyGoalSubtext = `Aikaa jäljellä: ${totalTimelineMonths.toFixed(1)} kk`;
    }
  } else if (profile?.goal === "lihasmassa" && profile.targetMuscle && totalTimelineMonths) {
    monthlyGoalText = `💪 Tavoite: ${(profile.targetMuscle / totalTimelineMonths).toFixed(1)} kg/kk`;
    monthlyGoalSubtext = `Aikaa jäljellä: ${totalTimelineMonths.toFixed(1)} kk`;
  }

  let progressPercentForGoal: number | null = null;
  let progressTextForGoal: string | null = null;
  if (
    profile?.goal === "laihdutus" &&
    firstWeight !== null &&
    currentWeightForProgress !== null &&
    profile.targetWeight
  ) {
    const totalLoss = firstWeight - profile.targetWeight;
    const achievedLoss = Math.max(firstWeight - currentWeightForProgress, 0);
    if (totalLoss > 0) {
      progressPercentForGoal = Math.max(0, Math.min(100, (achievedLoss / totalLoss) * 100));
      progressTextForGoal = `${achievedLoss.toFixed(1)} kg / ${totalLoss.toFixed(1)} kg pudotettu 🎯`;
    }
  } else if (
    profile?.goal === "lihasmassa" &&
    firstWeight !== null &&
    currentWeightForProgress !== null &&
    profile.targetMuscle
  ) {
    const totalGain = profile.targetMuscle;
    const achievedGain = Math.max(currentWeightForProgress - firstWeight, 0);
    if (totalGain > 0) {
      progressPercentForGoal = Math.max(0, Math.min(100, (achievedGain / totalGain) * 100));
      progressTextForGoal = `${achievedGain.toFixed(1)} kg / +${totalGain.toFixed(1)} kg kasvatettu`;
    }
  }

  const bmiForProgress =
    currentWeightForProgress !== null && profile?.height && profile.height > 0
      ? currentWeightForProgress / Math.pow(profile.height / 100, 2)
      : null;
  const bmiCategory =
    bmiForProgress === null
      ? null
      : bmiForProgress < 18.5
      ? { label: "Alipaino", color: "#60a5fa" }
      : bmiForProgress < 25
      ? { label: "Normaali", color: "#4ade80" }
      : bmiForProgress < 30
      ? { label: "Ylipaino", color: "#fbbf24" }
      : { label: "Lihavuus", color: "#f87171" };
  const weeklyWeightMap: Record<string, WeightEntry> = {};
  weightLog.forEach((entry) => {
    const weekKey = getWeekStartIso(entry.date);
    const existing = weeklyWeightMap[weekKey];
    if (
      !existing ||
      entry.weight < existing.weight ||
      (entry.weight === existing.weight && entry.timestamp > existing.timestamp)
    ) {
      weeklyWeightMap[weekKey] = entry;
    }
  });
  const weeklyWeightEntries = Object.values(weeklyWeightMap).sort(
    (a, b) => new Date(`${a.date}T12:00:00`).getTime() - new Date(`${b.date}T12:00:00`).getTime()
  );

  type WeightChartSlot = {
    index: number;
    label: string;
    weekEndOffset: number;
    weight: number | null;
  };

  const WEEK_BUCKET_SIZE = 2;
  const dayMs = 24 * 60 * 60 * 1000;
  let chartSlots: WeightChartSlot[] = [];
  let chartSubtitle = "";
  let chartTotalWeeks = 0;

  const chartStartDate = parseFiDate(profile?.startDate ?? null);
  const chartEndDate = parseFiDate(profile?.endDate ?? null);
  const hasTimelineChart =
    !!chartStartDate &&
    !!chartEndDate &&
    chartEndDate.getTime() > chartStartDate.getTime();

  if (hasTimelineChart && chartStartDate && chartEndDate) {
    chartTotalWeeks = Math.max(
      1,
      Math.ceil((chartEndDate.getTime() - chartStartDate.getTime() + dayMs) / (7 * dayMs))
    );
    const slotCount = Math.max(1, Math.ceil(chartTotalWeeks / WEEK_BUCKET_SIZE));
    chartSlots = Array.from({ length: slotCount }, (_, i) => ({
      index: i,
      label: `${Math.min((i + 1) * WEEK_BUCKET_SIZE, chartTotalWeeks)}`,
      weekEndOffset: Math.min((i + 1) * WEEK_BUCKET_SIZE - 1, chartTotalWeeks - 1),
      weight: null,
    }));

    weightLog.forEach((entry) => {
      const entryDate = new Date(`${entry.date}T12:00:00`);
      if (Number.isNaN(entryDate.getTime()) || entryDate < chartStartDate || entryDate > chartEndDate) {
        return;
      }
      const weekOffset = Math.floor((entryDate.getTime() - chartStartDate.getTime()) / (7 * dayMs));
      const slotIndex = Math.floor(weekOffset / WEEK_BUCKET_SIZE);
      if (slotIndex < 0 || slotIndex >= chartSlots.length) return;
      const slot = chartSlots[slotIndex];
      if (slot.weight === null || entry.weight < slot.weight) {
        chartSlots[slotIndex] = { ...slot, weight: entry.weight };
      }
    });

    chartSubtitle = `Viikot 1-${chartTotalWeeks} (${WEEK_BUCKET_SIZE} viikon välein, jakson pienin paino)`;
  } else {
    const fallbackEveryOther = [...weeklyWeightEntries]
      .reverse()
      .filter((_, idx) => idx % WEEK_BUCKET_SIZE === 0)
      .slice(0, 8)
      .reverse();
    chartTotalWeeks = Math.max(fallbackEveryOther.length * WEEK_BUCKET_SIZE, WEEK_BUCKET_SIZE);
    chartSlots = fallbackEveryOther.map((entry, index) => ({
      index,
      label: `${(index + 1) * WEEK_BUCKET_SIZE}`,
      weekEndOffset: (index + 1) * WEEK_BUCKET_SIZE - 1,
      weight: entry.weight,
    }));
    chartSubtitle = `Viikot 1-${chartTotalWeeks} (${WEEK_BUCKET_SIZE} viikon välein)`;
  }

  const chartActualPoints = chartSlots
    .map((slot) => (slot.weight === null ? null : { index: slot.index, weight: slot.weight }))
    .filter((point): point is { index: number; weight: number } => !!point);
  const hasWeeklyGraph = chartActualPoints.length > 0;

  const expectedStartWeight = firstWeight !== null ? firstWeight : null;
  const expectedEndWeight =
    profile?.goal === "laihdutus" && profile.targetWeight
      ? profile.targetWeight
      : profile?.goal === "lihasmassa" &&
          expectedStartWeight !== null &&
          profile.targetMuscle
        ? expectedStartWeight + profile.targetMuscle
        : null;
  const hasExpectedLine =
    expectedStartWeight !== null &&
    expectedEndWeight !== null &&
    chartSlots.length > 1 &&
    chartTotalWeeks > 1;

  const expectedWeightsBySlot = chartSlots.map((slot) => {
    if (!hasExpectedLine || expectedStartWeight === null || expectedEndWeight === null) return null;
    const denominator = Math.max(chartTotalWeeks - 1, 1);
    const ratio = slot.weekEndOffset / denominator;
    return expectedStartWeight + (expectedEndWeight - expectedStartWeight) * ratio;
  });

  const chartScaleValues = [
    ...chartActualPoints.map((p) => p.weight),
    ...expectedWeightsBySlot.filter((w): w is number => typeof w === "number" && Number.isFinite(w)),
  ];
  const weeklyGraphMin = hasWeeklyGraph ? Math.min(...chartScaleValues) : 0;
  const weeklyGraphMax = hasWeeklyGraph ? Math.max(...chartScaleValues) : 0;
  const weeklyGraphSpread = weeklyGraphMax - weeklyGraphMin;
  const weeklyGraphPadding = weeklyGraphSpread === 0 ? 0.4 : Math.max(0.2, weeklyGraphSpread * 0.2);
  const weeklyGraphAxisMin = weeklyGraphMin - weeklyGraphPadding;
  const weeklyGraphAxisMax = weeklyGraphMax + weeklyGraphPadding;
  const weeklyGraphAxisRange = Math.max(weeklyGraphAxisMax - weeklyGraphAxisMin, 0.1);
  const weeklyGraphTicks = hasWeeklyGraph
    ? [weeklyGraphAxisMax, weeklyGraphAxisMin + weeklyGraphAxisRange / 2, weeklyGraphAxisMin]
    : [];
  const weeklyGraphToY = (weight: number) =>
    94 - ((weight - weeklyGraphAxisMin) / weeklyGraphAxisRange) * 88;
  const weeklyGraphToX = (index: number) =>
    chartSlots.length <= 1 ? 50 : (index / (chartSlots.length - 1)) * 100;
  const weeklyGraphLinePoints = chartActualPoints
    .map((entry) => `${weeklyGraphToX(entry.index)},${weeklyGraphToY(entry.weight)}`)
    .join(" ");
  const weeklyExpectedLinePoints = expectedWeightsBySlot
    .map((weight, index) =>
      typeof weight === "number" && Number.isFinite(weight)
        ? `${weeklyGraphToX(index)},${weeklyGraphToY(weight)}`
        : null
    )
    .filter((point): point is string => !!point)
    .join(" ");

  const analysisSearchNormalized = analysisSearchQuery.trim().toLowerCase();
  const filteredSavedAnalysesForCalendar =
    analysisSearchNormalized.length === 0
      ? savedAnalysesForCalendar
      : savedAnalysesForCalendar.filter((analysis) => {
          const haystack = `${analysis.name} ${analysis.text ?? ""}`.toLowerCase();
          return haystack.includes(analysisSearchNormalized);
        });
  const calendarTheme = {
    backgroundColor: MAIN_BACKGROUND_COLOR,
    calendarBackground: MAIN_BACKGROUND_COLOR,
    textSectionTitleColor: "#9ca3af",
    selectedDayBackgroundColor: "#4b5563",
    selectedDayTextColor: "#ffffff",
    todayTextColor: "#4ade80",
    dayTextColor: "#ffffff",
    textDisabledColor: "#4b5563",
    monthTextColor: "#ffffff",
    textMonthFontWeight: "bold" as const,
    dotColor: "#4ade80",
    selectedDotColor: "#ffffff",
    arrowColor: "#d1d5db",
  };

  return (
    <Modal 
      visible={visible} 
      animationType="none" 
      transparent={false}
      statusBarTranslucent={false}
    >
      <View style={[styles.modalBackdropDark, activeSection === "diary" && styles.modalBackdropDiary]}>
        <View style={[styles.container, activeSection === "diary" && styles.containerDiary]}>
          <View style={styles.header}>
            <Text style={[styles.title, activeSection === "diary" && styles.titleDiary]}>
              {activeSection === "calendar" ? "📅 Kalenteri" : "📔 Päiväkirja"}
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={[
              styles.mainScrollContent,
              { paddingBottom: Math.max(120, insets.bottom + 104) },
            ]}
          >
          {activeSection === "calendar" && (
            <>
              <View style={styles.calendarSectionCard}>
                <View style={styles.calendarWidgetWrap}>
                  <Calendar
                    onDayPress={handleDayPress}
                    markedDates={markedDates}
                    theme={calendarTheme}
                  />
                </View>
              </View>
              {selectedDate && (
                <Pressable style={styles.calendarBackButton} onPress={openCalendarSection}>
                  <Text style={styles.diaryButtonText}>↩️ Takaisin kalenterinäkymään</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.weightQuickButton}
                onPress={() => openWeightModal(selectedDate ?? toIsoDate(new Date()))}
              >
                <Text style={styles.diaryButtonText}>
                  ⚖️ Aseta paino {selectedDate ? `(${selectedDate})` : "(Tänään)"}
                </Text>
              </Pressable>
            </>
          )}
          {selectedDate && activeSection === "diary" && (
            <View style={styles.topSummarySection}>
              <View style={styles.kcalHeroCard}>
                <Text style={styles.kcalHeroLabel}>
                  {selectedDate === todayDate
                    ? "Kcal tänään"
                    : selectedDate === shiftIsoDate(todayDate, -1)
                      ? "Kcal eilen"
                      : selectedDate === shiftIsoDate(todayDate, 1)
                        ? "Kcal huomenna"
                      : `Kcal ${selectedDate}`}
                </Text>
                <Text style={styles.kcalHeroValue}>
                  {Math.round(selectedDayCalories).toLocaleString()} kcal
                </Text>
                <Text style={styles.kcalHeroSubText}>
                  {selectedDayCalorieDelta === null
                    ? "Ei tavoitetta asetettu"
                    : selectedDayCalorieDelta >= 0
                      ? `${selectedDayCalorieDelta.toLocaleString()} kcal jäljellä / ${dailyTarget!.toLocaleString()} kcal`
                      : `+${Math.abs(selectedDayCalorieDelta).toLocaleString()} kcal yli / ${dailyTarget!.toLocaleString()} kcal`}
                </Text>
              </View>

              <View style={styles.dateNavRow}>
                <Pressable
                  style={styles.dateNavArrow}
                  onPress={() => selectDate(shiftIsoDate(selectedDate, -1))}
                >
                  <Ionicons name="chevron-back" size={20} color="#ffffff" />
                </Pressable>
                <View style={styles.datePickerButton}>
                  <Ionicons name="calendar-outline" size={18} color="#e5e7eb" />
                  <Text style={styles.datePickerPrimaryText}>{formatDateLabel(selectedDate)}</Text>
                  <Text style={styles.datePickerSecondaryText}>{selectedDate}</Text>
                </View>
                <Pressable
                  style={styles.dateNavArrow}
                  onPress={() => selectDate(shiftIsoDate(selectedDate, 1))}
                >
                  <Ionicons name="chevron-forward" size={20} color="#ffffff" />
                </Pressable>
              </View>

              {useProfile && dailyMacroTargets && (
                <View style={styles.macroTileCard}>
                  <Text style={styles.diaryTileTitle}>Makrot</Text>
                  <View style={styles.macroCircleGrid}>
                    {[
                      { key: "protein", label: "🍗 Proteiini", value: selectedDayMacros.protein, target: dailyMacroTargets.protein, color: "#fca5a5" },
                      { key: "fat", label: "🥑 Rasvat", value: selectedDayMacros.fat, target: dailyMacroTargets.fat, color: "#fde68a" },
                      { key: "carbs", label: "🍞 Hiilarit", value: selectedDayMacros.carbs, target: dailyMacroTargets.carbs, color: "#86efac" },
                      { key: "sugar", label: "🍬 Sokeri", value: selectedDayMacros.sugar, target: dailyMacroTargets.sugar, color: "#fdba74" },
                    ].map((item) => (
                      <View key={item.key} style={styles.macroCircleItem}>
                        <View style={[styles.macroCircleRing, { borderColor: item.color }]}>
                          <Text style={styles.macroCircleValue}>{Math.round(item.value)}</Text>
                          <Text style={styles.macroCircleTarget}>/{item.target}g</Text>
                        </View>
                        <Text style={styles.macroCircleLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {selectedDate && (
            <View style={styles.dayDetails}>
              <Text style={styles.dayTitle}>Päivän merkinnät</Text>

              <ScrollView style={styles.entriesList} nestedScrollEnabled>
                {selectedDay && selectedDay.entries.length > 0 ? (
                  selectedDay.entries.map((entry, index) => {
                    const isExpanded = expandedEntryIndex === index;
                    const { name, calories, carbs, sugar, protein, fat } = entry.product;
                    const titleWithAmount = getEntryTitleWithAmount(entry.product);
                    const entryTime = formatEntryLoggedTime(entry.loggedAt);

                    return (
                      <Pressable
                        key={index}
                        style={styles.entryRow}
                        onPress={() =>
                          setExpandedEntryIndex(isExpanded ? null : index)
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.productName}>{titleWithAmount || name}</Text>
                          {entryTime && <Text style={styles.productTime}>klo {entryTime}</Text>}
                          <Text style={styles.productCalories}>
                            {Math.round(calories)} kcal
                          </Text>

                          {isExpanded && (
                            <View style={styles.entryDetailsBox}>
                              <Text style={styles.entryDetailsTitle}>Makrot</Text>
                              <Text style={styles.entryDetailsText}>
                                🍞 Hiilarit: {Math.round(carbs ?? 0)} g
                              </Text>
                              <Text style={styles.entryDetailsText}>
                                🍬 Sokerit: {Math.round(sugar ?? 0)} g
                              </Text>
                              <Text style={styles.entryDetailsText}>
                                🍗 Proteiini: {Math.round(protein ?? 0)} g
                              </Text>
                              <Text style={styles.entryDetailsText}>
                                🥑 Rasva: {Math.round(fat ?? 0)} g
                              </Text>
                              <View style={styles.entryActions}>
                                <Pressable
                                  style={[styles.entryActionButton, styles.entryAmountButton]}
                                  onPress={() => openEditEntryAmount(index)}
                                >
                                  <Text style={styles.entryActionText}>Muokkaa</Text>
                                </Pressable>
                                <Pressable
                                  style={[styles.entryActionButton, styles.entryCopyButton]}
                                  onPress={() => openCopyEntry(index)}
                                >
                                  <Text style={styles.entryActionText}>Kopioi tuote</Text>
                                </Pressable>
                                <Pressable
                                  style={[styles.entryActionButton, styles.entryDeleteButton]}
                                  onPress={() => handleDeleteEntry(index)}
                                >
                                  <Text style={styles.entryActionText}>Poista</Text>
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text
                    style={{
                      color: "#999",
                      textAlign: "center",
                      marginVertical: 20,
                    }}
                  >
                    Ei lisättyjä tuotteita
                  </Text>
                )}
              </ScrollView>
              
              <View style={styles.addActionsCard}>
                <Pressable
                  style={styles.weightQuickButton}
                  onPress={() => openWeightModal(selectedDate ?? toIsoDate(new Date()))}
                >
                  <Text style={styles.diaryButtonText}>⚖️ Aseta paino</Text>
                </Pressable>
                <Pressable
                  style={styles.addManualButton}
                  onPress={() => setShowManualAdd(true)}
                >
                  <Text style={styles.diaryButtonText}>➕ Lisää manuaalisesti</Text>
                </Pressable>

                <Pressable
                  style={styles.addFromAnalysesButton}
                  onPress={async () => {
                    if (!selectedDate) return;
                    await loadSavedAnalysesForCalendar();
                    setAnalysisSearchQuery("");
                    setShowAnalysisPicker(true);
                  }}
                >
                  <Text style={styles.diaryButtonText}>📁 Lisää analyyseista</Text>
                </Pressable>

                {onOpenRecipes && (
                  <Pressable
                    style={styles.addFromRecipesButton}
                    onPress={onOpenRecipes}
                  >
                    <Text style={styles.diaryButtonText}>📖 Lisää resepteistä</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {!selectedDate && (
            <View style={styles.weekCaloriesContainer}>
              <Pressable
                style={styles.expandButton}
                onPress={() => setShowCaloriesSummary(!showCaloriesSummary)}
              >
                <Text style={styles.expandButtonText}>📊 Kalorit</Text>
                <Ionicons
                  name={showCaloriesSummary ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#ffffff"
                />
              </Pressable>

              {showCaloriesSummary && (
                <View style={styles.weekCaloriesBox}>
                  <Text style={styles.weekCaloriesLabel}>Tämän viikon kalorit:</Text>
                  <Text style={styles.weekCaloriesValue}>
                    {Math.round(thisWeekCalories).toLocaleString()} kcal
                  </Text>
                  <Text style={styles.weekCaloriesAvg}>
                    Keskimäärin {Math.round(thisWeekAvgPerDay).toLocaleString()} kcal / päivä
                  </Text>
                  <View style={styles.weekCaloriesDivider} />
                  <Text style={styles.weekCaloriesLabel}>Viime viikon kalorit:</Text>
                  <Text style={styles.weekCaloriesSubText}>
                    {Math.round(lastWeekCalories).toLocaleString()} kcal
                  </Text>
                  <Text style={styles.weekCaloriesAvg}>
                    Keskimäärin {Math.round(lastWeekAvgPerDay).toLocaleString()} kcal / päivä
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Viikon makrot (keskiarvo per päivä) */}
          {!selectedDate && useProfile && dailyMacroTargets && (
            <View style={styles.weekMacrosContainer}>
              <Pressable
                style={styles.expandButton}
                onPress={() => setShowWeeklyMacros(!showWeeklyMacros)}
              >
                <Text style={styles.expandButtonText}>🥗 Makrot (viikon keskiarvo)</Text>
                <Ionicons
                  name={showWeeklyMacros ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#ffffff"
                />
              </Pressable>

              {showWeeklyMacros && (() => {
                const avg = getThisWeekMacroAverages();
                const carbsRatio = dailyMacroTargets.carbs
                  ? avg.carbs / dailyMacroTargets.carbs
                  : 0;
                const sugarRatio = dailyMacroTargets.sugar
                  ? avg.sugar / dailyMacroTargets.sugar
                  : 0;
                const proteinRatio = dailyMacroTargets.protein
                  ? avg.protein / dailyMacroTargets.protein
                  : 0;
                const fatRatio = dailyMacroTargets.fat
                  ? avg.fat / dailyMacroTargets.fat
                  : 0;
                return (
                  <View style={styles.weekMacrosBox}>
                    <Text style={styles.weekMacrosHint}>
                      Keskimäärin per päivä tällä viikolla
                    </Text>
                    <View style={styles.macroGaugeRow}>
                      <View style={styles.macroRow}>
                        <Text style={styles.macroLabel}>🍞 Hiilarit</Text>
                        <Text style={styles.macroValue}>
                          <Text
                            style={
                              carbsRatio > 1
                                ? styles.macroValueOver
                                : styles.macroValueOk
                            }
                          >
                            {Math.round(avg.carbs)}
                          </Text>
                          <Text style={styles.macroValueTarget}>
                            {" / "}
                            {dailyMacroTargets.carbs} g
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(carbsRatio * 100, 100)}%`,
                              backgroundColor:
                                carbsRatio > 1 ? "#ef4444" : "#4ade80",
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.macroGaugeRow}>
                      <View style={styles.macroRow}>
                        <Text style={styles.macroLabel}>🍬 Sokerit</Text>
                        <Text style={styles.macroValue}>
                          <Text
                            style={
                              sugarRatio > 1
                                ? styles.macroValueOver
                                : styles.macroValueOk
                            }
                          >
                            {Math.round(avg.sugar)}
                          </Text>
                          <Text style={styles.macroValueTarget}>
                            {" / "}
                            {dailyMacroTargets.sugar} g
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(sugarRatio * 100, 100)}%`,
                              backgroundColor:
                                sugarRatio > 1 ? "#ef4444" : "#4ade80",
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.macroGaugeRow}>
                      <View style={styles.macroRow}>
                        <Text style={styles.macroLabel}>🍗 Proteiini</Text>
                        <Text style={styles.macroValue}>
                          <Text
                            style={
                              proteinRatio > 1
                                ? styles.macroValueOver
                                : styles.macroValueOk
                            }
                          >
                            {Math.round(avg.protein)}
                          </Text>
                          <Text style={styles.macroValueTarget}>
                            {" / "}
                            {dailyMacroTargets.protein} g
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(proteinRatio * 100, 100)}%`,
                              backgroundColor:
                                proteinRatio > 1 ? "#ef4444" : "#4ade80",
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.macroGaugeRow}>
                      <View style={styles.macroRow}>
                        <Text style={styles.macroLabel}>🥑 Rasva</Text>
                        <Text style={styles.macroValue}>
                          <Text
                            style={
                              fatRatio > 1
                                ? styles.macroValueOver
                                : styles.macroValueOk
                            }
                          >
                            {Math.round(avg.fat)}
                          </Text>
                          <Text style={styles.macroValueTarget}>
                            {" / "}
                            {dailyMacroTargets.fat} g
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(fatRatio * 100, 100)}%`,
                              backgroundColor:
                                fatRatio > 1 ? "#ef4444" : "#4ade80",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* Tavoitekalorit (profiilin perusteella) */}
          {!selectedDate && useProfile && dailyTarget && (
            <View style={styles.targetCaloriesContainer}>
              <Pressable 
                style={styles.expandButton}
                onPress={() => setShowTargetCalories(!showTargetCalories)}
              >
                <Text style={styles.expandButtonText}>
                  🎯 Tavoitekalorit
                </Text>
                <Ionicons 
                  name={showTargetCalories ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#ffffff" 
                />
              </Pressable>
              
              {showTargetCalories && (
                <>
                  <View style={styles.targetBox}>
                    <Text style={styles.targetCaloriesLabel}>
                      Tavoite tälle päivälle:
                    </Text>
                    <Text style={styles.targetCaloriesValue}>
                      {dailyTarget.toLocaleString()} kcal
                    </Text>
                    {profile && (
                      <Text style={styles.goalLabel}>
                        Laskettu painolla {(
                          (profile.currentWeight && profile.currentWeight > 0
                            ? profile.currentWeight
                            : profile.weight) ?? 0
                        ).toFixed(1).replace(".", ",")} kg
                      </Text>
                    )}
                    {profile?.goal && (
                      <Text style={styles.goalLabel}>
                        {profile.goal === "laihdutus" && "📉 Laihdutus"}
                        {profile.goal === "ylläpito" && "➡️ Ylläpito"}
                        {profile.goal === "lihasmassa" && "💪 Lihasmassa"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.todayBox}>
                    <Text style={styles.progressText}>
                      Tänään: {todayCalories} / {dailyTarget} kcal
                    </Text>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            width: `${Math.min((todayCalories / dailyTarget) * 100, 100)}%`,
                            backgroundColor: todayCalories > dailyTarget ? "#ef4444" : "#4ade80"
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[
                      styles.remainingText,
                      { color: todayCalories > dailyTarget ? "#ef4444" : "#4ade80" }
                    ]}>
                      {todayCalories > dailyTarget 
                        ? `+${(todayCalories - dailyTarget).toLocaleString()} kcal yli` 
                        : `${(dailyTarget - todayCalories).toLocaleString()} kcal jäljellä`}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {!selectedDate && canShowWeightProgress && (
            <View style={styles.progressSection}>
              <Pressable
                style={styles.expandButton}
                onPress={() => setShowWeightProgress((prev) => !prev)}
              >
                <Text style={styles.expandButtonText}>⚖️ Painon kehitys</Text>
                <Ionicons
                  name={showWeightProgress ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#ffffff"
                />
              </Pressable>

              {showWeightProgress && (
                <>
                  {monthlyGoalText && (
                    <View style={styles.monthlyGoalBox}>
                      <Text style={styles.monthlyGoalText}>{monthlyGoalText}</Text>
                      {monthlyGoalSubtext && (
                        <Text style={styles.monthlyGoalSubtext}>{monthlyGoalSubtext}</Text>
                      )}
                    </View>
                  )}

                  {progressPercentForGoal !== null && progressTextForGoal && (
                    <View style={styles.progressIndicator}>
                      <Text style={styles.progressTextLabel}>{progressTextForGoal}</Text>
                      <View style={styles.progressBarGoal}>
                        <View
                          style={[
                            styles.progressFillGoal,
                            {
                              width: `${progressPercentForGoal}%`,
                              backgroundColor:
                                profile?.goal === "lihasmassa" ? "#4ade80" : "#3b82f6",
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressPercent}>
                        {Math.round(progressPercentForGoal)}% valmis
                      </Text>
                    </View>
                  )}

                  {currentWeightForProgress !== null && weightDelta !== null && (
                    <View style={styles.weightSummary}>
                      <Text style={styles.weightCurrent}>
                        Nykyinen: {currentWeightForProgress.toFixed(1)} kg
                      </Text>
                      <Text style={[styles.weightChange, { color: weightTrendColor }]}>
                        {weightDelta > 0 ? "+" : ""}
                        {weightDelta.toFixed(1)} kg
                        {weightDeltaPercent !== null ? ` (${weightDelta > 0 ? "+" : ""}${weightDeltaPercent}%)` : ""}
                      </Text>
                      {bmiForProgress !== null && bmiCategory && (
                        <View style={styles.bmiInfo}>
                          <Text style={styles.bmiText}>
                            📊 BMI:{" "}
                            <Text style={[styles.bmiBold, { color: bmiCategory.color }]}>
                              {bmiForProgress.toFixed(1)}
                            </Text>
                          </Text>
                          <Text style={[styles.bmiCategory, { color: bmiCategory.color }]}>
                            {bmiCategory.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {hasWeeklyGraph && (
                    <View style={styles.weightChartBox}>
                      <Text style={styles.weightChartTitle}>📈 Viikkograafi</Text>
                      {hasExpectedLine && expectedStartWeight !== null && expectedEndWeight !== null && (
                        <View style={styles.weightChartTargetsRow}>
                          <Text style={styles.weightChartTargetText}>
                            Lähtöpaino:{" "}
                            <Text style={styles.weightChartTargetValue}>
                              {expectedStartWeight.toFixed(1)} kg
                            </Text>
                          </Text>
                          <Text style={styles.weightChartTargetText}>
                            Tavoitepaino:{" "}
                            <Text style={styles.weightChartTargetValue}>
                              {expectedEndWeight.toFixed(1)} kg
                            </Text>
                          </Text>
                        </View>
                      )}
                      <Text style={styles.weightChartSubtitle}>{chartSubtitle}</Text>
                      <View style={styles.weightChartArea}>
                        <View style={styles.weightChartYAxis}>
                          {weeklyGraphTicks.map((tick, idx) => (
                            <View
                              key={`tick-${idx}`}
                              style={[styles.weightChartYAxisTick, { top: `${weeklyGraphToY(tick)}%` }]}
                            >
                              <Text style={styles.weightChartYAxisLabel}>{tick.toFixed(1)} kg</Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.weightChartPlotWrap}>
                          <View style={styles.weightChartPlot}>
                            <Svg
                              width="100%"
                              height="100%"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                            >
                              {Array.from({ length: 9 }, (_, i) => i * 12.5).map((y) => (
                                <Line
                                  key={`grid-${y}`}
                                  x1={0}
                                  y1={y}
                                  x2={100}
                                  y2={y}
                                  stroke="#4b5563"
                                  strokeWidth={0.25}
                                  strokeDasharray="2 2"
                                />
                              ))}

                              {chartSlots.length > 1 &&
                                chartSlots.map((slot, index) => (
                                  <Line
                                    key={`grid-v-${slot.label}-${index}`}
                                    x1={weeklyGraphToX(index)}
                                    y1={0}
                                    x2={weeklyGraphToX(index)}
                                    y2={100}
                                    stroke="#4b5563"
                                    strokeWidth={0.2}
                                    strokeDasharray="2 2"
                                  />
                                ))}

                              {hasExpectedLine && weeklyExpectedLinePoints.length > 0 && (
                                <Polyline
                                  points={weeklyExpectedLinePoints}
                                  fill="none"
                                  stroke="#ef4444"
                                  strokeWidth={1.1}
                                  strokeDasharray="3 3"
                                />
                              )}

                              {chartActualPoints.length > 1 && (
                                <Polyline
                                  points={weeklyGraphLinePoints}
                                  fill="none"
                                  stroke="#60a5fa"
                                  strokeWidth={1.25}
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                />
                              )}

                              {chartActualPoints.map((entry) => (
                                <Circle
                                  key={`pt-${entry.index}`}
                                  cx={weeklyGraphToX(entry.index)}
                                  cy={weeklyGraphToY(entry.weight)}
                                  r={1.15}
                                  fill="#93c5fd"
                                />
                              ))}
                            </Svg>
                          </View>
                          <View style={styles.weightChartXAxis}>
                            {chartSlots.map((slot, index) => (
                              <View key={`label-${slot.label}-${index}`} style={styles.weightChartXAxisCell}>
                                <Text style={styles.weightChartXAxisLabel}>
                                  {slot.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                          <Text style={styles.weightChartXAxisUnit}>vko</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {weightLog.length > 0 ? (
                    <ScrollView style={styles.weightList} nestedScrollEnabled>
                      {weightLog
                        .slice()
                        .reverse()
                        .map((entry, index) => {
                          const dateObj = new Date(entry.timestamp);
                          const time =
                            Number.isNaN(dateObj.getTime())
                              ? "--:--"
                              : `${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;
                          return (
                            <View key={`${entry.date}-${entry.timestamp}-${index}`} style={styles.weightEntry}>
                              <Text style={styles.weightDate}>{entry.date}</Text>
                              <Text style={styles.weightTime}>klo {time}</Text>
                              <Text style={styles.weightValue}>{entry.weight.toFixed(1)} kg</Text>
                            </View>
                          );
                        })}
                    </ScrollView>
                  ) : (
                    <Text style={styles.weekCaloriesAvg}>
                      Ei vielä painomittauksia kalenterissa.
                    </Text>
                  )}
                </>
              )}
            </View>
          )}

          </ScrollView>
          <View
            style={[
              styles.bottomNavBar,
              { bottom: insets.bottom > 0 ? 12 : 16 },
            ]}
          >
            <Pressable
              style={[
                styles.bottomNavItem,
                activeSection === "diary" && styles.bottomNavItemActive,
              ]}
              onPress={openDiarySection}
            >
              <Ionicons
                name="book-outline"
                size={20}
                color={activeSection === "diary" ? "#ffffff" : "#9ca3af"}
              />
              <Text
                style={[
                  styles.bottomNavLabel,
                  activeSection === "diary" && styles.bottomNavLabelActive,
                ]}
              >
                Päiväkirja
              </Text>
            </Pressable>
            <Pressable style={styles.bottomNavItem} onPress={onOpenAnalyses}>
              <Ionicons name="analytics-outline" size={20} color="#9ca3af" />
              <Text style={styles.bottomNavLabel}>Analyysit</Text>
            </Pressable>
            <Pressable style={styles.bottomNavItem} onPress={onOpenCamera}>
              <Ionicons name="camera-outline" size={20} color="#9ca3af" />
              <Text style={styles.bottomNavLabel}>Kamera</Text>
            </Pressable>
            <Pressable style={styles.bottomNavItem} onPress={onOpenProfile}>
              <Ionicons name="person-outline" size={20} color="#9ca3af" />
              <Text style={styles.bottomNavLabel}>Profiili</Text>
            </Pressable>
            <Pressable
              style={[
                styles.bottomNavItem,
                activeSection === "calendar" && styles.bottomNavItemActive,
              ]}
              onPress={openCalendarSection}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={activeSection === "calendar" ? "#ffffff" : "#9ca3af"}
              />
              <Text
                style={[
                  styles.bottomNavLabel,
                  activeSection === "calendar" && styles.bottomNavLabelActive,
                ]}
              >
                Kalenteri
              </Text>
            </Pressable>
          </View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.modalRevealMask,
            { transform: [{ translateY: revealMaskY }] },
          ]}
        />
      </View>

      <Modal transparent visible={showDatePicker && activeSection === "diary"} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.datePickerModalBox}>
            <Text style={styles.datePickerModalTitle}>Valitse päivä</Text>
            <Calendar
              onDayPress={handleDayPress}
              markedDates={markedDates}
              theme={calendarTheme}
            />
            <Pressable
              style={[styles.copyActionButton, styles.copyCancelButton]}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.copyActionText}>Sulje</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showWeightModal} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.amountEditBox}>
            <Text style={styles.amountEditTitle}>⚖️ Aseta paino</Text>
            {weightDateForInput && (
              <Text style={styles.amountEditHint}>Päivä: {weightDateForInput}</Text>
            )}
            <TextInput
              style={styles.amountEditInput}
              keyboardType="decimal-pad"
              placeholder="esim. 75,4"
              placeholderTextColor="#9ca3af"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <View style={styles.amountEditActions}>
              <Pressable
                style={[styles.amountEditButton, styles.weightModalCancelButton]}
                onPress={closeWeightModal}
              >
                <Text style={styles.amountEditButtonText}>Peruuta</Text>
              </Pressable>
              <Pressable
                style={[styles.amountEditButton, styles.weightModalSaveButton]}
                onPress={saveWeightForDate}
              >
                <Text style={styles.amountEditButtonText}>Tallenna</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Kopioi yksittäinen tuote */}
      <Modal visible={showCopyEntryModal} animationType="slide" transparent={false}>
        <View style={styles.copyModalContainer}>
          <Text style={styles.copyModalTitle}>📋 Kopioi tuote</Text>

          <Calendar
            onDayPress={(day) =>
              setCopyEntryTargetDates((prev) =>
                prev.includes(day.dateString)
                  ? prev.filter((d) => d !== day.dateString)
                  : [...prev, day.dateString]
              )
            }
            markedDates={copyEntryTargetDates.reduce((acc, date) => {
              acc[date] = { selected: true, selectedColor: "#2d5a3d" };
              return acc;
            }, {} as Record<string, { selected: boolean; selectedColor: string }>)}
            theme={{
              backgroundColor: MAIN_BACKGROUND_COLOR,
              calendarBackground: MAIN_BACKGROUND_COLOR,
              textSectionTitleColor: DIARY_TEXT_MUTED,
              selectedDayBackgroundColor: "#2d5a3d",
              selectedDayTextColor: "#ffffff",
              todayTextColor: "#4ade80",
              dayTextColor: "#ffffff",
              textDisabledColor: "#4b5563",
              monthTextColor: "#ffffff",
              textMonthFontWeight: "bold",
            }}
          />

          <Text style={styles.copyModalHint}>
            Valitse yksi tai useampi päivä. Paina päivää uudelleen poistaaksesi valinnan.
          </Text>

          {copyEntryTargetDates.includes(selectedDate || "") && (
            <Text style={styles.copyModalWarning}>
              Nykyinen päivä ohitetaan kopioinnissa automaattisesti.
            </Text>
          )}

          {copyEntryTargetDates.filter((d) => d !== selectedDate).length > 0 && (
            <>
              <Pressable
                style={[styles.copyActionButton, styles.copyAppendButton]}
                onPress={() => copyEntryToDates(copyEntryTargetDates, "append")}
              >
                <Text style={styles.copyActionText}>
                  ✅ Kopioi ({copyEntryTargetDates.filter((d) => d !== selectedDate).length})
                </Text>
              </Pressable>
            </>
          )}

          <Pressable
            style={[styles.copyActionButton, styles.copyCancelButton]}
            onPress={() => {
              setShowCopyEntryModal(false);
              setCopyEntryIndex(null);
              setCopyEntryTargetDates([]);
            }}
          >
            <Text style={styles.copyActionText}>Sulje</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Muokkaa tuotteen määrää */}
      <Modal transparent visible={showEditAmountModal} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.amountEditBox}>
            <Text style={styles.amountEditTitle}>🔢 Muokkaa määrää</Text>
            {editAmountEntryIndex !== null && selectedDay?.entries[editAmountEntryIndex] && (
              <Text style={styles.amountEditProductName}>
                {selectedDay.entries[editAmountEntryIndex].product.name}
              </Text>
            )}
            <Text style={styles.amountEditHint}>
              {editAmountMode === "portion"
                ? "Syötä määrä kappaleina (esim. 2 = tuplaa)."
                : "Syötä määrä grammoina/ml (esim. 200)."}
            </Text>
            <TextInput
              value={editAmountInput}
              onChangeText={setEditAmountInput}
              keyboardType="decimal-pad"
              placeholder={editAmountMode === "portion" ? "Esim. 2" : "Esim. 200"}
              placeholderTextColor="#777"
              style={styles.amountEditInput}
            />
            <View style={styles.amountEditActions}>
              <Pressable
                style={[styles.amountEditButton, styles.amountEditCancelButton]}
                onPress={closeEditAmountModal}
              >
                <Text style={styles.amountEditButtonText}>Peruuta</Text>
              </Pressable>
              <Pressable
                style={[styles.amountEditButton, styles.amountEditSaveButton]}
                onPress={saveEditedEntryAmount}
              >
                <Text style={styles.amountEditButtonText}>Tallenna</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lisää tallennetuista analyyseista */}
      <Modal
        visible={showAnalysisPicker}
        animationType="slide"
        transparent={false}
        statusBarTranslucent={false}
      >
        <View style={styles.analysisPickerContainer}>
          <Text style={styles.analysisPickerTitle}>📁 Valitse analyysi</Text>
          {selectedDate && (
            <Text style={styles.analysisPickerSubtitle}>
              Lisätään päivälle {selectedDate}
            </Text>
          )}

          <TextInput
            value={analysisSearchQuery}
            onChangeText={setAnalysisSearchQuery}
            placeholder="Hae analyysiä..."
            placeholderTextColor="#9ca3af"
            style={styles.analysisSearchInput}
          />

          <ScrollView
            style={styles.analysisPickerList}
            contentContainerStyle={styles.analysisPickerListContent}
          >
            {filteredSavedAnalysesForCalendar.length > 0 ? (
              filteredSavedAnalysesForCalendar.map((analysis) => (
                <Pressable
                  key={analysis.id}
                  style={styles.analysisPickerRow}
                  onPress={() => {
                    setSelectedAnalysisForAdd(analysis);
                    setAnalysisSearchQuery("");
                    setShowAddFromAnalysisModal(true);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.analysisPickerName}>
                      {analysis.level} {analysis.name}
                    </Text>
                    {typeof analysis.totalCalories === "number" && (
                      <Text style={styles.analysisPickerMeta}>
                        {Math.round(analysis.totalCalories)} kcal{" "}
                        {analysis.analysisSource === "image"
                          ? "/ annos"
                          : "/ 100 g"}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </Pressable>
              ))
            ) : (
              <Text style={styles.analysisPickerEmpty}>
                {analysisSearchNormalized.length > 0
                  ? "Ei hakutuloksia."
                  : "Ei tallennettuja analyysejä."}
              </Text>
            )}
          </ScrollView>

          <Pressable
            style={[styles.copyActionButton, styles.copyCancelButton]}
            onPress={() => {
              setAnalysisSearchQuery("");
              setShowAnalysisPicker(false);
            }}
          >
            <Text style={styles.copyActionText}>Sulje</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Manuaalinen lisäys modal */}
      <CalendarModal
        visible={showManualAdd}
        analysis={null}
        allowManualEntry={true}
        preselectedDate={selectedDate}
        onClose={() => setShowManualAdd(false)}
        onSaved={async () => {
          await loadData();
          setShowManualAdd(false);
        }}
      />

      <CalendarModal
        visible={showAddFromAnalysisModal}
        analysis={selectedAnalysisForAdd}
        preselectedDate={selectedDate}
        isImageAnalysis={selectedAnalysisForAdd?.analysisSource === "image"}
        onClose={() => {
          setShowAddFromAnalysisModal(false);
          setSelectedAnalysisForAdd(null);
          setAnalysisSearchQuery("");
          setShowAnalysisPicker(false);
        }}
        onSaved={async () => {
          await loadData();
          setShowAddFromAnalysisModal(false);
          setSelectedAnalysisForAdd(null);
          setAnalysisSearchQuery("");
          setShowAnalysisPicker(false);
        }}
      />
    </Modal>
  );
}

const MAIN_BACKGROUND_COLOR = "#1e1e1e";
const DIARY_SURFACE_COLOR = "#2a2a2a";
const DIARY_TILE_COLOR = "#333";
const DIARY_TEXT_PRIMARY = "#ffffff";
const DIARY_TEXT_MUTED = "#9ca3af";
const DIARY_BORDER_COLOR = "#3a3a3a";
const NAV_BAR_COLOR = "#2d3137";
const NAV_BORDER_COLOR = "#3f4652";

const styles = StyleSheet.create({
  modalBackdropDark: {
    flex: 1,
    backgroundColor: MAIN_BACKGROUND_COLOR,
  },
  modalBackdropDiary: {
    backgroundColor: MAIN_BACKGROUND_COLOR,
  },
  modalSlideLayer: {
    flex: 1,
  },
  modalRevealMask: {
    ...StyleSheet.absoluteFillObject,

  },

  container: {
    flex: 1,
    backgroundColor: MAIN_BACKGROUND_COLOR,
    padding: 20,
    paddingTop: 60,
  },
  containerDiary: {
    backgroundColor: MAIN_BACKGROUND_COLOR,
  },
  mainScrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerSideSlot: {
    width: 56,
  },
  headerBackButton: {
    width: 56,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 4,
  },
  headerCloseButton: {
    width: 56,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingVertical: 4,
  },
  headerCloseText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "700",
  },
  headerCloseTextDiary: {
    color: "#9ca3af",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  titleDiary: {
    color: DIARY_TEXT_PRIMARY,
  },
  topSummarySection: {
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 14,
    padding: 14,
  },
  calendarSectionCard: {
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    padding: 10,
    overflow: "hidden",
  },
  calendarWidgetWrap: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: DIARY_TILE_COLOR,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  calendarBackButton: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#374151",
    borderWidth: 1,
    borderColor: "#6b7280",
    borderRadius: 12,
    alignItems: "center",
  },
  kcalHeroCard: {
    backgroundColor: DIARY_TILE_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  kcalHeroLabel: {
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
    marginBottom: 4,
  },
  kcalHeroValue: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 30,
    fontWeight: "700",
  },
  kcalHeroSubText: {
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
    marginTop: 4,
  },
  dateNavRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateNavArrow: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: DIARY_TILE_COLOR,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  datePickerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: DIARY_TILE_COLOR,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  macroTileCard: {
    marginTop: 12,
    backgroundColor: DIARY_TILE_COLOR,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    padding: 12,
  },
  diaryTileTitle: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  datePickerPrimaryText: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  datePickerSecondaryText: {
    color: DIARY_TEXT_MUTED,
    fontSize: 12,
  },
  macroCircleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  macroCircleItem: {
    width: "47%",
    alignItems: "center",
  },
  macroCircleRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DIARY_SURFACE_COLOR,
  },
  macroCircleValue: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
  },
  macroCircleTarget: {
    color: DIARY_TEXT_MUTED,
    fontSize: 12,
  },
  macroCircleLabel: {
    marginTop: 6,
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
    fontWeight: "600",
  },
  dayDetails: {
    marginTop: 20,
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 12,
    padding: 16,
    maxHeight: 600,
  },
  dayTitle: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  caloriesTotal: {
    color: "#4ade80",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  macroSummaryBox: {
    backgroundColor: DIARY_SURFACE_COLOR,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  macroTitle: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  macroGaugeRow: {
    marginTop: 4,
    marginBottom: 6,
  },
  macroLabel: {
    color: DIARY_TEXT_MUTED,
    fontSize: 14,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  macroValueTarget: {
    color: DIARY_TEXT_PRIMARY,
  },
  macroSubText: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: -2,
    marginBottom: 8,
  },
  macroValueOk: {
    color: "#4ade80",
  },
  macroValueOver: {
    color: "#ef4444",
  },
  entriesList: {
    maxHeight: 180,
  },
  entryRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  productName: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 16,
  },
  productTime: {
    color: DIARY_TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  productCalories: {
    color: DIARY_TEXT_MUTED,
    fontSize: 16,
  },
  entryDetailsBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: DIARY_SURFACE_COLOR,
  },
  entryDetailsTitle: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  entryDetailsText: {
    color: DIARY_TEXT_MUTED,
    fontSize: 12,
  },
  entryActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  entryActionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  entryCopyButton: {
    backgroundColor: "#3a3f47",
  },
  entryAmountButton: {
    backgroundColor: "#2d5a3d",
  },
  entryDeleteButton: {
    backgroundColor: "#3b1e1e",
  },
  entryActionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  noData: {
    marginTop: 20,
    padding: 20,
    alignItems: "center",
  },
  weekCaloriesContainer: {
    marginTop: 16,
    padding: 14,
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  weekCaloriesLabel: {
    color: DIARY_TEXT_MUTED,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  weekCaloriesValue: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  weekCaloriesBox: {
    backgroundColor: DIARY_TILE_COLOR,
    padding: 12,
    borderRadius: 12,
  },
  weekCaloriesDivider: {
    height: 1,
    backgroundColor: DIARY_BORDER_COLOR,
    marginVertical: 8,
  },
  weekCaloriesSubText: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "600",
  },
  weekCaloriesAvg: {
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
    marginTop: 4,
  },
  weekMacrosContainer: {
    marginTop: 16,
    padding: 14,
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  weekMacrosBox: {
    backgroundColor: DIARY_TILE_COLOR,
    padding: 12,
    borderRadius: 12,
  },
  weekMacrosHint: {
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
    marginBottom: 8,
  },
  targetCaloriesContainer: {
    marginTop: 16,
    padding: 14,
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  targetBox: {
    backgroundColor: DIARY_TILE_COLOR,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  todayBox: {
    backgroundColor: DIARY_TILE_COLOR,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  expandButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: DIARY_TILE_COLOR,
    borderRadius: 12,
    marginBottom: 12,
  },
  expandButtonText: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "600",
  },
  targetCaloriesLabel: {
    color: DIARY_TEXT_MUTED,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  targetCaloriesValue: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  goalLabel: {
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    color: DIARY_TEXT_MUTED,
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 10,
    backgroundColor: DIARY_BORDER_COLOR,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  remainingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 20,
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 12,
    alignItems: "center",
  },
  weightContainer: {
    marginTop: 20,
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 16,
  },
  weightTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  weightSummary: {
    backgroundColor: DIARY_TILE_COLOR,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    marginBottom: 12,
  },
  weightChartBox: {
    backgroundColor: DIARY_TILE_COLOR,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    padding: 12,
    marginBottom: 12,
  },
  weightChartTitle: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  weightChartSubtitle: {
    color: DIARY_TEXT_MUTED,
    fontSize: 12,
    marginBottom: 10,
  },
  weightChartTargetsRow: {
    marginTop: 4,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  weightChartTargetText: {
    color: DIARY_TEXT_MUTED,
    fontSize: 12,
    flex: 1,
  },
  weightChartTargetValue: {
    color: DIARY_TEXT_PRIMARY,
    fontWeight: "700",
  },
  weightChartArea: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  weightChartYAxis: {
    width: 54,
    height: 170,
    position: "relative",
    marginRight: 6,
  },
  weightChartYAxisTick: {
    position: "absolute",
    right: 0,
    transform: [{ translateY: -7 }],
  },
  weightChartYAxisLabel: {
    color: DIARY_TEXT_MUTED,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "right",
    includeFontPadding: false,
  },
  weightChartPlotWrap: {
    flex: 1,
  },
  weightChartPlot: {
    height: 170,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: DIARY_SURFACE_COLOR,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  weightChartXAxis: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  weightChartXAxisCell: {
    flex: 1,
    alignItems: "center",
  },
  weightChartXAxisLabel: {
    color: DIARY_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  weightChartXAxisUnit: {
    marginTop: 4,
    color: DIARY_TEXT_MUTED,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    includeFontPadding: false,
  },
  weightCurrent: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  weightChange: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  bmiInfo: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DIARY_BORDER_COLOR,
  },
  bmiText: {
    color: DIARY_TEXT_MUTED,
    fontSize: 15,
    marginBottom: 4,
  },
  bmiBold: {
    fontSize: 17,
    fontWeight: "bold",
  },
  bmiCategory: {
    fontSize: 14,
    fontWeight: "600",
  },
  weightList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  weightEntry: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: DIARY_TILE_COLOR,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    marginBottom: 6,
  },
  weightDate: {
    color: DIARY_TEXT_MUTED,
    fontSize: 14,
  },
  weightTime: {
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
  },
  weightValue: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "600",
  },
  progressSection: {
    marginTop: 20,
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
  },
  progressSectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  monthlyGoalBox: {
    backgroundColor: DIARY_TILE_COLOR,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#4ade80",
  },
  monthlyGoalText: {
    color: "#4ade80",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  monthlyGoalSubtext: {
    color: DIARY_TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
  },
  progressIndicator: {
    backgroundColor: DIARY_TILE_COLOR,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    marginBottom: 12,
  },
  progressTextLabel: {
    color: DIARY_TEXT_PRIMARY,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  progressBarGoal: {
    height: 12,
    backgroundColor: DIARY_BORDER_COLOR,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFillGoal: {
    height: "100%",
    borderRadius: 6,
  },
  progressPercent: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  weightInputSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 8,
  },
  weightInputToggle: {
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  weightInputToggleText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  weightInputLabel: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 8,
  },
  weightTimeLabel: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
  },
  weightTimeButton: {
    marginTop: 10,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  weightTimeButtonIdle: {
    backgroundColor: DIARY_SURFACE_COLOR,
  },
  weightTimeButtonConfirmed: {
    backgroundColor: "#2d5a3d",
  },
  weightTimeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  timePickerSection: {
    marginTop: 12,
  },
  inlineTimePickerContainer: {
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: DIARY_SURFACE_COLOR,
  },
  manualTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  manualTimeInput: {
    width: 50,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: DIARY_SURFACE_COLOR,
    color: "#e5e7eb",
    borderRadius: 8,
    fontSize: 20,
    textAlign: "center",
  },
  manualTimeColon: {
    color: "white",
    fontSize: 22,
    marginHorizontal: 4,
  },
  timePickerActionsInline: {
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  timePickerOkButton: {
    minWidth: 150,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#2d5a3d",
    borderRadius: 8,
    alignItems: "center",
  },
  timePickerOkButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  weightInputField: {
    flex: 1,
    backgroundColor: DIARY_SURFACE_COLOR,
    color: "white",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  saveWeightBtn: {
    backgroundColor: "#2d5a3d",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  futureDateWarning: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 8,
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
  toastButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  amountEditBox: {
    backgroundColor: "#222",
    padding: 20,
    borderRadius: 16,
    width: "84%",
  },
  amountEditTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  amountEditProductName: {
    color: "#e5e7eb",
    fontSize: 14,
    marginBottom: 8,
  },
  amountEditHint: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 12,
  },
  amountEditInput: {
    backgroundColor: "#333",
    color: "white",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  amountEditActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  amountEditButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  amountEditCancelButton: {
    backgroundColor: "#333",
  },
  amountEditSaveButton: {
    backgroundColor: "#2d5a3d",
  },
  amountEditButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#333",
  },
  okButton: {
    flex: 1,
    backgroundColor: "#2d5a3d",
  },
  addManualButton: {
    marginTop: 10,
    padding: 14,
    backgroundColor: "#1f5134",
    borderWidth: 1,
    borderColor: "#4ade80",
    borderRadius: 12,
    alignItems: "center",
  },
  weightQuickButton: {
    marginTop: 10,
    padding: 14,
    backgroundColor: "#1b3347",
    borderWidth: 1,
    borderColor: "#4f7da8",
    borderRadius: 12,
    alignItems: "center",
  },
  weightModalCancelButton: {
    backgroundColor: "#2f3642",
  },
  weightModalSaveButton: {
    backgroundColor: "#264635",
  },
  emptyText: {
    color: "#999",
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  addFromAnalysesButton: {
    marginTop: 10,
    padding: 14,
    backgroundColor: "#4b2c20",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 12,
    alignItems: "center",
  },
  addFromRecipesButton: {
    marginTop: 10,
    padding: 14,
    backgroundColor: "#3b1e1e",
    borderWidth: 1,
    borderColor: "#f87171",
    borderRadius: 12,
    alignItems: "center",
  },
  addActionsCard: {
    marginTop: 12,
    backgroundColor: DIARY_TILE_COLOR,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    borderRadius: 12,
    padding: 12,
  },
  diaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  analysisPickerContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
    paddingTop: 60,
  },
  bottomNavBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: NAV_BAR_COLOR,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NAV_BORDER_COLOR,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  bottomNavItemActive: {
    backgroundColor: "#23272d",
  },
  bottomNavLabel: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  bottomNavLabelActive: {
    color: "#ffffff",
  },
  datePickerModalBox: {
    backgroundColor: DIARY_SURFACE_COLOR,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    width: "92%",
    padding: 16,
  },
  datePickerModalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  analysisPickerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 6,
  },
  analysisPickerSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 14,
  },
  analysisSearchInput: {
    backgroundColor: DIARY_TILE_COLOR,
    color: "white",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DIARY_BORDER_COLOR,
    marginBottom: 12,
  },
  analysisPickerList: {
    flex: 1,
  },
  analysisPickerListContent: {
    paddingBottom: 12,
  },
  analysisPickerRow: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analysisPickerName: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  analysisPickerMeta: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 4,
  },
  analysisPickerEmpty: {
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
  copyModalContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
    paddingTop: 60,
  },
  copyModalTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 6,
  },
  copyModalHint: {
    color: "#e5e7eb",
    fontSize: 13,
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  copyModalWarning: {
    color: "#f87171",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  copyActionButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  copyAppendButton: {
    backgroundColor: "#2d5a3d",
  },
  copyReplaceButton: {
    backgroundColor: "#3b1e1e",
  },
  copyCancelButton: {
    backgroundColor: "#333",
    marginTop: 18,
  },
  copyActionText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});





