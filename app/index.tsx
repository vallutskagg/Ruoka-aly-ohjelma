// app/index-refactored.tsx
// Tämä on refaktoroitu versio - korvaa index.tsx tällä kun olet valmis

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  GestureResponderEvent,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CalendarModal from "./CalendarModal";
import CalendarView from "./CalendarView";
import AnalysisModal from "./components/AnalysisModal";
import ProfileModal from "./components/ProfileModal";
import { BACKEND_URL, GOOGLE_VISION_API_KEY, STORAGE_KEYS } from "./constants";
import { useAnalyses } from "./hooks/useAnalyses";
import { useIngredients } from "./hooks/useIngredients";
import { useProfile } from "./hooks/useProfile";
import RecipesView from "./RecipesView";
import { getAllWeights, loadCalendar } from "./Storage/calendarStorage";
import { CalendarProduct, SavedAnalysis, StoredIngredient, WeeklyReport, WeeklyReportProduct } from "./Storage/Types";
import { FilterType, UserProfile } from "./types";
import { getActivityFactor } from "./utils/activity";

type NotificationsModule = typeof import("expo-notifications");
type NotificationRequest = import("expo-notifications").NotificationRequest;
type VisionCameraModule = typeof import("react-native-vision-camera");

const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";
let Notifications: NotificationsModule | null = null;
let VisionCameraLib: VisionCameraModule | null = null;

if (!IS_EXPO_GO) {
  try {
    // Ladataan vain dev/prod buildissa, Expo Go:ssa tämä moduuli aiheuttaa virheen.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require("expo-notifications") as NotificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    Notifications = null;
  }

  try {
    // Ladataan Vision Camera vain ympäristöissä, joissa natiivimoduuli on käytettävissä.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    VisionCameraLib = require("react-native-vision-camera") as VisionCameraModule;
  } catch {
    VisionCameraLib = null;
  }
}

export default function App() {
  const insets = useSafeAreaInsets();
  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
  const isExpoGo = IS_EXPO_GO;
  const VisionCamera = VisionCameraLib?.Camera ?? null;
  const useCameraPermissionHook =
    VisionCameraLib?.useCameraPermission ??
    (() => ({
      hasPermission: false,
      requestPermission: async () => false,
    }));
  const useCameraDeviceHook =
    VisionCameraLib?.useCameraDevice ?? (() => null);

  const { hasPermission, requestPermission } = useCameraPermissionHook();
  const cameraRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);
  const focusIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Camera state
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [focusIndicator, setFocusIndicator] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });
  const cameraDevice = useCameraDeviceHook(facing);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isFromSaved, setIsFromSaved] = useState(false);

  // Frozen preview while analysoidaan
  const [frozenPhotoUri, setFrozenPhotoUri] = useState<string | null>(null);

  // Pre-analysis flow state
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [showPreAnalysis, setShowPreAnalysis] = useState(false);
  const [
    portionMultiplier,
    setPortionMultiplier,
  ] = useState<0.5 | 0.7 | 1 | 1.2 | 1.4>(1);
  const [oilAdded, setOilAdded] = useState<"no" | "yes">("no");
  const [
    servingContext,
    setServingContext,
  ] = useState<"home" | "restaurant" | "readymeal">("home");
  const [
    adjustmentPercent,
    setAdjustmentPercent,
  ] = useState<-20 | -15 | -10 | -5 | 0 | 5 | 10 | 15 | 20>(0);
  const [mealDescription, setMealDescription] = useState("");

  // Camera mode: OCR vs AI-image
  const [cameraMode, setCameraMode] = useState<"ocr" | "image">("ocr");

  // Analysis state
  const [analysisProducts, setAnalysisProducts] = useState<
    CalendarProduct[]
  >([]);
  const [analysisCalories, setAnalysisCalories] = useState<number | null>(null);
  const [analysisSource, setAnalysisSource] = useState<"ocr" | "image" | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const [analysisName, setAnalysisName] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [addedToCalendar, setAddedToCalendar] = useState(false);
  const [addedToIngredients, setAddedToIngredients] = useState(false);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCalendarView, setShowCalendarView] = useState(true);
  const [calendarInitialSection, setCalendarInitialSection] =
    useState<"diary" | "calendar">("diary");
  const [calendarViewSlideFrom, setCalendarViewSlideFrom] = useState<"up" | "none">("none");
  const [openedFromSaved, setOpenedFromSaved] = useState(false);
  const [showRecipesView, setShowRecipesView] = useState(false);
  const [openedRecipesFromSaved, setOpenedRecipesFromSaved] = useState(false);

  // Filters
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [showFilterBox, setShowFilterBox] = useState(false);
  const [showAnalysisTypeFilterBox, setShowAnalysisTypeFilterBox] =
    useState(false);
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState<
    "basic" | "profile" | "all"
  >("all");
  const [savedSort, setSavedSort] = useState<
    | "newest"
    | "oldest"
    | "favorites"
    | "protein_desc"
    | "protein_asc"
    | "carbs_desc"
    | "carbs_asc"
    | "sugar_desc"
    | "sugar_asc"
    | "fat_desc"
    | "fat_asc"
    | "calories_desc"
    | "calories_asc"
  >("newest");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [isGeneratingWeeklyReport, setIsGeneratingWeeklyReport] = useState(false);
  const [isGeneratingPeriodSummary, setIsGeneratingPeriodSummary] = useState(false);
  const [weeklyReportsEnabled, setWeeklyReportsEnabled] = useState(true);
  const [expandedWeeklyReportId, setExpandedWeeklyReportId] = useState<string | null>(null);
  const [showPeriodEndedPrompt, setShowPeriodEndedPrompt] = useState(false);
  const [closedPeriodLabel, setClosedPeriodLabel] = useState<string | null>(null);
  const [savedModalDirection, setSavedModalDirection] = useState<"left" | "right">("left");
  const [profileModalDirection, setProfileModalDirection] = useState<"left" | "right">("right");
  const screenWidth = Dimensions.get("window").width;
  const savedModalTranslateX = useRef(new Animated.Value(screenWidth)).current;
  const lastCheckedClosedPeriodKeyRef = useRef<string | null>(null);
  const WEEKLY_REPORT_REMINDER_TYPE = "weekly_report_reminder";
  const PERIOD_SUMMARY_REMINDER_TYPE = "period_summary_reminder";
  const SUMMARY_NOTIFICATION_CHANNEL_ID = "weekly-reports";
  const WEEKLY_REMINDER_WEEKDAY = 2; // Monday
  const WEEKLY_REMINDER_HOUR = 10;
  const WEEKLY_REMINDER_MINUTE = 0;
  const WEEKLY_REMINDER_WEEKS_AHEAD = 12;
  const PERIOD_REMINDER_HOUR = 20;
  const PERIOD_REMINDER_MINUTE = 0;

  // Custom hooks
  const profile = useProfile();
  const analyses = useAnalyses();
  const ingredients = useIngredients();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (isExpoGo || !VisionCamera) {
      setCameraReady(true);
    }
  }, [isExpoGo, VisionCamera]);

  useEffect(() => {
    console.log(`[FoodScan] BACKEND_URL runtime value: ${BACKEND_URL}`);
    analyses.loadSavedAnalyses();
    profile.loadProfile();
    ingredients.loadIngredients();
    loadWeeklyReportsEnabled();
    (async () => {
      try {
        const firstUsedAt = await AsyncStorage.getItem(STORAGE_KEYS.APP_FIRST_USED_AT);
        if (!firstUsedAt) {
          await AsyncStorage.setItem(
            STORAGE_KEYS.APP_FIRST_USED_AT,
            Date.now().toString()
          );
        }

        const seen = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN);
        if (!seen) {
          setShowOnboarding(true);
        }
      } catch {
        // Ignoroi virheet, ei estä sovelluksen käynnistymistä
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (focusIndicatorTimeoutRef.current) {
        clearTimeout(focusIndicatorTimeoutRef.current);
      }
    };
  }, []);

  // Esitäytä nimi AI-ehdotuksella vain modalin avautuessa (tai kun ehdotus vaihtuu),
  // älä käyttäjän kirjoituksen aikana.
  useEffect(() => {
    if (!pendingSave || !suggestedName) return;
    setAnalysisName((prev) => prev || suggestedName);
  }, [pendingSave, suggestedName]);

  useEffect(() => {
    if (!analyses.showSaved) return;
    const startX = savedModalDirection === "right" ? screenWidth : -screenWidth;
    savedModalTranslateX.setValue(startX);
    Animated.timing(savedModalTranslateX, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [analyses.showSaved, savedModalDirection, screenWidth, savedModalTranslateX]);

  const openSaved = useCallback(
    (direction: "left" | "right") => {
      setSavedModalDirection(direction);
      analyses.setShowSaved(true);
    },
    [analyses]
  );

  const openProfile = useCallback(
    (direction: "left" | "right") => {
      setProfileModalDirection(direction);
      profile.setShowProfile(true);
    },
    [profile]
  );

  const openDiaryView = useCallback(() => {
    setOpenedFromSaved(false);
    setCalendarInitialSection("diary");
    setCalendarViewSlideFrom("none");
    setShowCalendarView(true);
  }, []);

  const openCalendarHistoryView = useCallback(() => {
    setOpenedFromSaved(false);
    setCalendarInitialSection("calendar");
    setCalendarViewSlideFrom("none");
    setShowCalendarView(true);
  }, []);

  const toIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatFiDate = (date: Date) => {
    const d = `${date.getDate()}`.padStart(2, "0");
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  };

  const formatFiDateFromIso = (isoDate: string) => {
    const [y, m, d] = isoDate.split("-");
    if (!y || !m || !d) return isoDate;
    return `${d}.${m}.${y}`;
  };

  const getIsoWeekNumber = (date: Date) => {
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  };

  const getLastWeekRange = () => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(now.getDate() + diffToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const start = new Date(currentWeekStart);
    start.setDate(currentWeekStart.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(currentWeekStart);
    end.setDate(currentWeekStart.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    const isoWeek = getIsoWeekNumber(start);
    const weekKey = `${start.getFullYear()}-W${String(isoWeek).padStart(2, "0")}`;
    const weekLabel = `VKO ${isoWeek} (${formatFiDate(start)}-${formatFiDate(end)})`;
    return { start, end, weekKey, weekLabel };
  };

  const parseFinnishDate = (value: string): Date | null => {
    if (!value) return null;
    const parts = value.split(".");
    if (parts.length !== 3) return null;
    const [dayStr, monthStr, yearStr] = parts;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
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

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const calculateDailyTargetCalories = (p: UserProfile | null): number | null => {
    if (!p || !p.weight || !p.height) return null;
    const currentWeight = p.currentWeight && p.currentWeight > 0 ? p.currentWeight : p.weight;
    const height = p.height;

    const ageFromRange = (range: UserProfile["ageRange"]): number | null => {
      if (!range) return null;
      if (range === "15-18") return 17;
      if (range === "18-30") return 24;
      if (range === "31-50") return 40;
      if (range === "51-65") return 58;
      if (range === "65+") return 70;
      return null;
    };

    const age = ageFromRange(p.ageRange ?? null);
    let bmr: number;
    if (p.gender && age) {
      bmr = p.gender === "male"
        ? 10 * currentWeight + 6.25 * height - 5 * age + 5
        : 10 * currentWeight + 6.25 * height - 5 * age - 161;
    } else {
      bmr = 10 * currentWeight + 6.25 * height - 5 * 30 + 5;
    }

    const activityFactor = getActivityFactor(
      p.trainingSessionsPerWeek ?? null,
      p.trainingIntensity ?? null
    );

    const maintenance = bmr * activityFactor;

    if (p.goal === "laihdutus" && p.targetWeight && p.timeframe) {
      const totalDeficit = Math.max(currentWeight - p.targetWeight, 0) * 7700;
      const days = Math.max(1, p.timeframe * 30);
      return Math.round(maintenance - totalDeficit / days);
    }

    if (p.goal === "lihasmassa" && p.targetMuscle && p.timeframe) {
      const totalSurplus = Math.max(p.targetMuscle, 0) * 2750;
      const days = Math.max(1, p.timeframe * 30);
      return Math.round(maintenance + totalSurplus / days);
    }

    return Math.round(maintenance);
  };

  const calculateDailyMacroTargets = (p: UserProfile | null, dailyTarget: number | null) => {
    if (!p || !p.weight || !dailyTarget) return null;
    const currentWeight = p.currentWeight && p.currentWeight > 0 ? p.currentWeight : p.weight;
    let proteinPerKg = 1.4;
    let fatPerKg = 0.9;
    if (p.goal === "laihdutus") {
      proteinPerKg = 1.8;
      fatPerKg = 0.8;
    } else if (p.goal === "lihasmassa") {
      proteinPerKg = 2.0;
      fatPerKg = 1.0;
    }
    const proteinGrams = currentWeight * proteinPerKg;
    const fatGrams = currentWeight * fatPerKg;
    const carbsGrams = Math.max(
      dailyTarget - (proteinGrams * 4 + fatGrams * 9),
      0
    ) / 4;

    let sugarRatio = 0.1;
    if (p.goal === "laihdutus") sugarRatio = 0.08;
    if (p.goal === "lihasmassa") sugarRatio = 0.12;
    const sugarGrams = Math.min((dailyTarget * sugarRatio) / 4, carbsGrams);

    return {
      carbs: Math.round(carbsGrams),
      sugar: Math.round(sugarGrams),
      protein: Math.round(proteinGrams),
      fat: Math.round(fatGrams),
    } as const;
  };

  const weeklyReportInstruction = `
Arvioi käyttäjän viime viikon ravinto ja tee viikkoraportti suomeksi.
Palauta vain JSON muodossa:
{
  "level": "🟢|🟡|🔴",
  "score": number,
  "summary": string,
  "suggestions": string[2..4]
}
Säännöt:
- Arvio perustuu tuotteisiin, kaloreihin, makroihin (hiilarit, sokerit, proteiini, rasva), painon kehitykseen ja käyttäjän tavoitteeseen (ylläpito/laihdutus/lihasmassa).
- Nosta esiin käytetyin tuote ja anna tarvittaessa vähennys/lisäys-suositus.
- Ehdotusten tulee olla konkreettisia ja turvallisia, ei lääketieteellisiä diagnooseja.
- Ytimekäs sävy, ei markdownia, vain JSON.
  `.trim();

  const periodSummaryInstruction = `
Arvioi käyttäjän koko sulkeutunut tavoitejakso ja tee jakson loppuyhteenveto suomeksi.
Palauta vain JSON muodossa:
{
  "level": "🟢|🟡|🔴",
  "score": number,
  "summary": string,
  "suggestions": string[3..6]
}
Säännöt:
- Arvioi onnistuminen tavoitteen näkökulmasta (onnistui / osittain / jäi tavoitteesta) käyttäen kaloreita, makroja, painon muutosta, lokitietojen kattavuutta ja jakson pituutta.
- Kerro selkeästi mikä meni hyvin ja mikä heikensi tulosta.
- Ehdotusten tulee olla konkreettisia, turvallisia ja käytännöllisiä.
- Ei lääketieteellisiä diagnooseja.
- Ytimekäs sävy, ei markdownia, vain JSON.
  `.trim();

  const getScheduledNotificationMeta = (request: NotificationRequest) => {
    const data = request.content.data as { type?: unknown; signature?: unknown } | undefined;
    return {
      type: typeof data?.type === "string" ? data.type : null,
      signature: typeof data?.signature === "string" ? data.signature : null,
    };
  };

  const getStoredProfileData = async (): Promise<UserProfile | null> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  };

  const getPeriodSummaryReminderConfig = async (): Promise<{
    periodKey: string;
    signature: string;
    triggerDate: Date;
  } | null> => {
    const storedProfile = await getStoredProfileData();
    if (!storedProfile?.startDate || !storedProfile.endDate) return null;
    if (storedProfile.goal !== "laihdutus" && storedProfile.goal !== "lihasmassa") return null;

    const periodStartDate = parseFinnishDate(storedProfile.startDate);
    const periodEndDate = parseFinnishDate(storedProfile.endDate);
    if (!periodStartDate || !periodEndDate) return null;

    const start = startOfDay(periodStartDate);
    const end = endOfDay(periodEndDate);
    if (start.getTime() > end.getTime()) return null;

    const triggerDate = new Date(periodEndDate);
    triggerDate.setHours(PERIOD_REMINDER_HOUR, PERIOD_REMINDER_MINUTE, 0, 0);
    if (triggerDate.getTime() <= Date.now()) return null;

    const periodKey = `period-${toIsoDate(start)}-${toIsoDate(end)}`;
    const signature = `${periodKey}-${triggerDate.getTime()}-v1`;
    return { periodKey, signature, triggerDate };
  };

  const getUpcomingWeeklyReminderDates = (weeksAhead: number): Date[] => {
    if (weeksAhead <= 0) return [];

    const now = new Date();
    const targetJsWeekday = WEEKLY_REMINDER_WEEKDAY % 7; // 1..7 (expo) -> 1..6,0 (JS Sunday=0)
    const first = new Date(now);
    first.setHours(WEEKLY_REMINDER_HOUR, WEEKLY_REMINDER_MINUTE, 0, 0);

    let dayOffset = targetJsWeekday - first.getDay();
    if (dayOffset < 0) dayOffset += 7;
    first.setDate(first.getDate() + dayOffset);
    if (first.getTime() <= now.getTime()) {
      first.setDate(first.getDate() + 7);
    }

    return Array.from({ length: weeksAhead }, (_, index) => {
      const reminderDate = new Date(first);
      reminderDate.setDate(first.getDate() + index * 7);
      reminderDate.setHours(WEEKLY_REMINDER_HOUR, WEEKLY_REMINDER_MINUTE, 0, 0);
      return reminderDate;
    });
  };

  const syncSummaryReminderNotifications = async () => {
    try {
      if (isExpoGo || !Notifications) return;

      const currentPermission = await Notifications.getPermissionsAsync();
      let granted = currentPermission.granted;
      if (!granted) {
        const requested = await Notifications.requestPermissionsAsync();
        granted = requested.granted;
      }
      if (!granted) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(SUMMARY_NOTIFICATION_CHANNEL_ID, {
          name: "Viikkoraportit",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const cancelScheduled = async (items: NotificationRequest[]) => {
        await Promise.all(
          items.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
        );
      };

      const weeklyRequests = scheduled.filter(
        (request) => getScheduledNotificationMeta(request).type === WEEKLY_REPORT_REMINDER_TYPE
      );

      if (!weeklyReportsEnabled) {
        await cancelScheduled(weeklyRequests);
      } else {
        const targetDates = getUpcomingWeeklyReminderDates(WEEKLY_REMINDER_WEEKS_AHEAD);
        const targetSignatures = targetDates.map((date) => `weekly-${date.getTime()}-v2`);
        const targetSignatureSet = new Set(targetSignatures);

        const requestsBySignature = new Map<string, NotificationRequest[]>();
        weeklyRequests.forEach((request) => {
          const signature = getScheduledNotificationMeta(request).signature;
          if (!signature) return;
          const existing = requestsBySignature.get(signature) ?? [];
          existing.push(request);
          requestsBySignature.set(signature, existing);
        });

        const toCancel: NotificationRequest[] = [];
        requestsBySignature.forEach((requests, signature) => {
          if (!targetSignatureSet.has(signature)) {
            toCancel.push(...requests);
            return;
          }
          if (requests.length > 1) {
            toCancel.push(...requests.slice(1));
          }
        });
        if (toCancel.length > 0) {
          await cancelScheduled(toCancel);
        }

        for (let i = 0; i < targetDates.length; i += 1) {
          const signature = targetSignatures[i];
          const hasScheduled = (requestsBySignature.get(signature)?.length ?? 0) > 0;
          if (hasScheduled) continue;

          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📬 Viikkoraportti saatavilla",
              body: "Avaa sovellus ja katso viikon yhteenveto.",
              sound: true,
              data: {
                type: WEEKLY_REPORT_REMINDER_TYPE,
                signature,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDates[i],
              ...(Platform.OS === "android"
                ? { channelId: SUMMARY_NOTIFICATION_CHANNEL_ID }
                : {}),
            },
          });
        }
      }

      const periodRequests = scheduled.filter(
        (request) => getScheduledNotificationMeta(request).type === PERIOD_SUMMARY_REMINDER_TYPE
      );
      const periodReminderConfig = await getPeriodSummaryReminderConfig();
      if (!periodReminderConfig) {
        await cancelScheduled(periodRequests);
        return;
      }

      const keepPeriod = periodRequests.find(
        (request) => getScheduledNotificationMeta(request).signature === periodReminderConfig.signature
      );
      await cancelScheduled(
        periodRequests.filter((request) => request.identifier !== keepPeriod?.identifier)
      );

      if (!keepPeriod) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🏁 Aikaväli päättynyt",
            body: "Avaa sovellus, niin saat loppuraportin näkyviin.",
            sound: true,
            data: {
              type: PERIOD_SUMMARY_REMINDER_TYPE,
              signature: periodReminderConfig.signature,
              periodKey: periodReminderConfig.periodKey,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: periodReminderConfig.triggerDate,
            ...(Platform.OS === "android"
              ? { channelId: SUMMARY_NOTIFICATION_CHANNEL_ID }
              : {}),
          },
        });
      }
    } catch (error) {
      console.warn("[FoodScan] Summary reminder notification sync failed:", error);
    }
  };

  const loadWeeklyReports = async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_REPORTS);
    if (!raw) {
      setWeeklyReports([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as WeeklyReport[];
      const sorted = [...parsed].sort(
        (a, b) => b.createdAt - a.createdAt || b.weekKey.localeCompare(a.weekKey)
      );
      setWeeklyReports(sorted);
    } catch {
      setWeeklyReports([]);
    }
  };

  const loadWeeklyReportsEnabled = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_REPORTS_ENABLED);
      setWeeklyReportsEnabled(raw !== "false");
    } catch {
      setWeeklyReportsEnabled(true);
    }
  };

  const setWeeklyReportsFeatureEnabled = async (enabled: boolean) => {
    setWeeklyReportsEnabled(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS_ENABLED, enabled ? "true" : "false");
    if (!enabled) setExpandedWeeklyReportId(null);
  };

  const saveWeeklyReports = async (items: WeeklyReport[]) => {
    const sorted = [...items].sort(
      (a, b) => b.createdAt - a.createdAt || b.weekKey.localeCompare(a.weekKey)
    );
    setWeeklyReports(sorted);
    await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(sorted));
  };

  const sendWeeklyReportNotification = async (
    report: WeeklyReport,
    mode: "new" | "updated"
  ) => {
    try {
      if (isExpoGo || !Notifications) return;
      const currentPermission = await Notifications.getPermissionsAsync();
      let granted = currentPermission.granted;
      if (!granted) {
        const requested = await Notifications.requestPermissionsAsync();
        granted = requested.granted;
      }
      if (!granted) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("weekly-reports", {
          name: "Viikkoraportit",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const presented = await Notifications.getPresentedNotificationsAsync();
      const previousWeeklyNotificationIds = presented
        .filter((n) => {
          const data = n.request.content.data as { type?: string } | undefined;
          return data?.type === "weekly_report";
        })
        .map((n) => n.request.identifier);
      await Promise.all(
        previousWeeklyNotificationIds.map((id) => Notifications.dismissNotificationAsync(id))
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: mode === "new" ? "📬 Uusi viikkoraportti" : "🔄 Viikkoraportti päivitetty",
          body: report.weekLabel,
          sound: true,
          data: {
            type: "weekly_report",
            weekKey: report.weekKey,
            mode,
          },
        },
        trigger: null,
      });
    } catch {
      // Ei estä raportin tallennusta, vaikka ilmoitus epäonnistuisi
    }
  };

  const hasUsedEnoughForWeeklyReports = async (hasProfileData: boolean) => {
    const now = Date.now();
    const appFirstUsedAtRaw = await AsyncStorage.getItem(STORAGE_KEYS.APP_FIRST_USED_AT);
    const appFirstUsedAt = appFirstUsedAtRaw ? Number(appFirstUsedAtRaw) : NaN;
    if (!Number.isFinite(appFirstUsedAt)) {
      await AsyncStorage.setItem(STORAGE_KEYS.APP_FIRST_USED_AT, now.toString());
      return false;
    }
    if (now - appFirstUsedAt < ONE_WEEK_MS) return false;

    if (!hasProfileData) return true;

    const profileFirstSetAtRaw = await AsyncStorage.getItem(
      STORAGE_KEYS.PROFILE_FIRST_SET_AT
    );
    const profileFirstSetAt = profileFirstSetAtRaw
      ? Number(profileFirstSetAtRaw)
      : NaN;
    if (!Number.isFinite(profileFirstSetAt)) {
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE_FIRST_SET_AT, now.toString());
      return false;
    }

    return now - profileFirstSetAt >= ONE_WEEK_MS;
  };

  const deleteWeeklyReportByWeekKey = async (weekKey: string) => {
    const next = weeklyReports.filter((r) => r.weekKey !== weekKey);
    if (expandedWeeklyReportId) {
      const expanded = weeklyReports.find((r) => r.id === expandedWeeklyReportId);
      if (expanded?.weekKey === weekKey) {
        setExpandedWeeklyReportId(null);
      }
    }
    await saveWeeklyReports(next);
  };

  const generateLatestWeeklyReport = async (force = false) => {
    if (!weeklyReportsEnabled) return;
    if (isGeneratingWeeklyReport) return;
    setIsGeneratingWeeklyReport(true);
    try {
      const profileData = (profile.getProfileData?.() ?? null) as UserProfile | null;
      const hasEnoughUsage = await hasUsedEnoughForWeeklyReports(!!profileData);
      if (!hasEnoughUsage) return;

      const range = getLastWeekRange();
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_REPORTS);
      const currentReports = raw ? (JSON.parse(raw) as WeeklyReport[]) : weeklyReports;
      const existing = currentReports.find((r) => r.weekKey === range.weekKey);
      if (existing && !force) return;

      const calendar = await loadCalendar();
      const weights = await getAllWeights();

      const productsByName: Record<string, WeeklyReportProduct> = {};
      let totalCalories = 0;
      let totalCarbs = 0;
      let totalSugar = 0;
      let totalProtein = 0;
      let totalFat = 0;

      Object.keys(calendar).forEach((dateStr) => {
        const date = new Date(`${dateStr}T00:00:00`);
        if (date >= range.start && date <= range.end) {
          calendar[dateStr].entries.forEach((entry) => {
            const p = entry.product;
            const key = (p.name || "Tuntematon").trim().toLowerCase();
            if (!productsByName[key]) {
              productsByName[key] = {
                name: p.name || "Tuntematon",
                calories: 0,
                count: 0,
              };
            }
            productsByName[key].calories += p.calories || 0;
            productsByName[key].count += 1;
            totalCalories += p.calories || 0;
            totalCarbs += p.carbs || 0;
            totalSugar += p.sugar || 0;
            totalProtein += p.protein || 0;
            totalFat += p.fat || 0;
          });
        }
      });

      const topProducts = Object.values(productsByName)
        .sort((a, b) => b.count - a.count || b.calories - a.calories)
        .slice(0, 5);
      const avgCaloriesPerDay = totalCalories / 7;
      const avgCarbs = totalCarbs / 7;
      const avgSugar = totalSugar / 7;
      const avgProtein = totalProtein / 7;
      const avgFat = totalFat / 7;

      const startWeight = [...weights]
        .reverse()
        .find((w) => new Date(`${w.date}T23:59:59`).getTime() <= range.start.getTime())
        ?.weight ?? null;
      const endWeight = [...weights]
        .reverse()
        .find((w) => new Date(`${w.date}T23:59:59`).getTime() <= range.end.getTime())
        ?.weight ?? null;
      const weightChangeKg =
        startWeight !== null && endWeight !== null ? Number((endWeight - startWeight).toFixed(1)) : null;

      const dailyTarget = calculateDailyTargetCalories(profileData);
      const macroTargets = calculateDailyMacroTargets(profileData, dailyTarget);

      let aiPayload: any = null;
      try {
        const res = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "weekly_report",
            instructions: weeklyReportInstruction,
            data: {
              week: {
                weekKey: range.weekKey,
                periodStart: toIsoDate(range.start),
                periodEnd: toIsoDate(range.end),
              },
              goal: profileData?.goal ?? null,
              dailyTargetCalories: dailyTarget,
              dailyMacroTargets: macroTargets,
              products: topProducts,
              totals: {
                calories: Math.round(totalCalories),
                avgCaloriesPerDay: Math.round(avgCaloriesPerDay),
                avgCarbs: Math.round(avgCarbs),
                avgSugar: Math.round(avgSugar),
                avgProtein: Math.round(avgProtein),
                avgFat: Math.round(avgFat),
              },
              weightChangeKg,
            },
          }),
        });
        if (res.ok) {
          aiPayload = await res.json();
        } else {
          const responseText = await res.text();
          console.warn(
            `[FoodScan] Weekly report backend error ${res.status}: ${responseText.slice(0, 300)}`
          );
        }
      } catch (error) {
        console.warn("[FoodScan] Weekly report request failed:", error);
        aiPayload = null;
      }

      const topProduct = topProducts[0];
      const ratio = dailyTarget && dailyTarget > 0 ? avgCaloriesPerDay / dailyTarget : null;
      let fallbackScore = 65;
      if (ratio !== null) {
        if (profileData?.goal === "laihdutus") fallbackScore = ratio <= 1.0 ? 78 : 55;
        else if (profileData?.goal === "lihasmassa") fallbackScore = ratio >= 1.0 ? 78 : 58;
        else fallbackScore = ratio >= 0.92 && ratio <= 1.08 ? 80 : 62;
      }
      if (topProduct && totalCalories > 0 && topProduct.calories / totalCalories > 0.4) fallbackScore -= 10;
      if (weightChangeKg !== null && profileData?.goal === "laihdutus" && weightChangeKg > 0) fallbackScore -= 10;
      if (weightChangeKg !== null && profileData?.goal === "lihasmassa" && weightChangeKg < 0) fallbackScore -= 10;
      fallbackScore = Math.max(30, Math.min(95, Math.round(fallbackScore)));

      const fallbackLevel = fallbackScore >= 80 ? "🟢" : fallbackScore >= 60 ? "🟡" : "🔴";
      const fallbackSuggestions: string[] = [];
      if (profileData?.goal === "laihdutus") {
        if (topProduct) fallbackSuggestions.push(`Vähennä tuotetta "${topProduct.name}" 1-3 kertaa ensi viikolla.`);
        fallbackSuggestions.push("Lisää vähäkalorisia, proteiinipitoisia vaihtoehtoja päivän aterioihin.");
      } else if (profileData?.goal === "lihasmassa") {
        fallbackSuggestions.push("Lisää energiapitoista välipalaa treenipäiville.");
        fallbackSuggestions.push("Nosta proteiinia jokaisella pääaterialla.");
      } else {
        fallbackSuggestions.push("Pidä energiansaanti tasaisena viikon aikana.");
        fallbackSuggestions.push("Vaihtele tuotteita, jotta ruokavalio pysyy monipuolisena.");
      }

      const report: WeeklyReport = {
        id: `${range.weekKey}-${Date.now()}`,
        weekKey: range.weekKey,
        weekLabel: range.weekLabel,
        reportType: "weekly",
        periodStart: toIsoDate(range.start),
        periodEnd: toIsoDate(range.end),
        createdAt: Date.now(),
        level:
          aiPayload?.level === "🟢" || aiPayload?.level === "🟡" || aiPayload?.level === "🔴"
            ? aiPayload.level
            : fallbackLevel,
        score:
          typeof aiPayload?.score === "number"
            ? Math.max(0, Math.min(100, Math.round(aiPayload.score)))
            : fallbackScore,
        summary:
          typeof aiPayload?.summary === "string" && aiPayload.summary.trim()
            ? aiPayload.summary.trim()
            : "Viikkoraportti muodostettu viime viikon tuotteiden, kalorien, makrojen ja painokehityksen perusteella.",
        suggestions:
          Array.isArray(aiPayload?.suggestions) && aiPayload.suggestions.length > 0
            ? aiPayload.suggestions.slice(0, 4)
            : fallbackSuggestions,
        topProducts,
        totalCalories: Math.round(totalCalories),
        avgCaloriesPerDay: Math.round(avgCaloriesPerDay),
        avgCarbs: Math.round(avgCarbs),
        avgSugar: Math.round(avgSugar),
        avgProtein: Math.round(avgProtein),
        avgFat: Math.round(avgFat),
        weightChangeKg,
        source: aiPayload ? "ai" : "fallback",
      };

      const next = existing
        ? currentReports.map((r) => (r.weekKey === range.weekKey ? report : r))
        : [report, ...currentReports];
      await saveWeeklyReports(next);
      if (!existing) {
        setExpandedWeeklyReportId(report.id);
        await sendWeeklyReportNotification(report, "new");
      } else if (force) {
        setExpandedWeeklyReportId(report.id);
        await sendWeeklyReportNotification(report, "updated");
      }
    } finally {
      setIsGeneratingWeeklyReport(false);
    }
  };

  const sendPeriodSummaryNotification = async (report: WeeklyReport) => {
    try {
      if (isExpoGo || !Notifications) return;
      const currentPermission = await Notifications.getPermissionsAsync();
      let granted = currentPermission.granted;
      if (!granted) {
        const requested = await Notifications.requestPermissionsAsync();
        granted = requested.granted;
      }
      if (!granted) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("weekly-reports", {
          name: "Viikkoraportit",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🏁 Aikaväli päättynyt",
          body: "Aikavälin AI-yhteenveto on valmis. Haluatko päivittää terveysprofiilia?",
          sound: true,
          data: {
            type: "period_summary",
            periodKey: report.weekKey,
          },
        },
        trigger: null,
      });
    } catch {
      // Ei estä raportin tallennusta, vaikka ilmoitus epäonnistuisi
    }
  };

  const clearProfileTimeRange = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      const parsed = raw ? (JSON.parse(raw) as UserProfile) : null;
      if (parsed) {
        const updated: UserProfile = {
          ...parsed,
          startDate: null,
          endDate: null,
          timeframe: null,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
      }
    } catch {
      // jatketaan vaikka tallennus epäonnistuisi
    } finally {
      profile.setStartDate("");
      profile.setEndDate("");
      profile.setTimeframe("");
    }
  };

  const generateClosedPeriodSummaryIfNeeded = async () => {
    if (isGeneratingPeriodSummary) return;
    const rawProfile = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    const storedProfile = rawProfile ? (JSON.parse(rawProfile) as UserProfile) : null;
    if (!storedProfile?.startDate || !storedProfile.endDate) {
      lastCheckedClosedPeriodKeyRef.current = null;
      return;
    }
    if (storedProfile.goal !== "laihdutus" && storedProfile.goal !== "lihasmassa") {
      lastCheckedClosedPeriodKeyRef.current = null;
      return;
    }

    const periodStartDate = parseFinnishDate(storedProfile.startDate);
    const periodEndDate = parseFinnishDate(storedProfile.endDate);
    if (!periodStartDate || !periodEndDate) {
      lastCheckedClosedPeriodKeyRef.current = null;
      return;
    }

    const start = startOfDay(periodStartDate);
    const end = endOfDay(periodEndDate);
    if (start.getTime() > end.getTime()) {
      lastCheckedClosedPeriodKeyRef.current = null;
      return;
    }
    if (Date.now() <= end.getTime()) {
      lastCheckedClosedPeriodKeyRef.current = null;
      return;
    }

    const periodStartIso = toIsoDate(start);
    const periodEndIso = toIsoDate(end);
    const periodKey = `period-${periodStartIso}-${periodEndIso}`;

    if (lastCheckedClosedPeriodKeyRef.current === periodKey) return;
    lastCheckedClosedPeriodKeyRef.current = periodKey;
    setIsGeneratingPeriodSummary(true);

    try {
      const rawReports = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_REPORTS);
      const currentReports = rawReports
        ? (JSON.parse(rawReports) as WeeklyReport[])
        : weeklyReports;
      const existing = currentReports.find((r) => r.weekKey === periodKey);

      if (existing) {
        setExpandedWeeklyReportId(existing.id);
        await clearProfileTimeRange();
        setClosedPeriodLabel(existing.weekLabel);
        setShowPeriodEndedPrompt(true);
        return;
      }

      const profileData = storedProfile ?? ((profile.getProfileData?.() ?? null) as UserProfile | null);

      const calendar = await loadCalendar();
      const weights = await getAllWeights();

      const totalDays = Math.max(
        1,
        Math.floor((startOfDay(periodEndDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      const productsByName: Record<string, WeeklyReportProduct> = {};
      const loggedDates = new Set<string>();
      const dailyCaloriesByDate: Record<string, number> = {};
      let totalCalories = 0;
      let totalCarbs = 0;
      let totalSugar = 0;
      let totalProtein = 0;
      let totalFat = 0;

      Object.keys(calendar).forEach((dateStr) => {
        const date = new Date(`${dateStr}T00:00:00`);
        if (date < start || date > end) return;
        const dayEntries = calendar[dateStr]?.entries ?? [];
        if (dayEntries.length === 0) return;
        loggedDates.add(dateStr);

        let dayCalories = 0;
        dayEntries.forEach((entry) => {
          const p = entry.product;
          const key = (p.name || "Tuntematon").trim().toLowerCase();
          if (!productsByName[key]) {
            productsByName[key] = {
              name: p.name || "Tuntematon",
              calories: 0,
              count: 0,
            };
          }
          const calories = p.calories || 0;
          const carbs = p.carbs || 0;
          const sugar = p.sugar || 0;
          const protein = p.protein || 0;
          const fat = p.fat || 0;

          productsByName[key].calories += calories;
          productsByName[key].count += 1;
          totalCalories += calories;
          totalCarbs += carbs;
          totalSugar += sugar;
          totalProtein += protein;
          totalFat += fat;
          dayCalories += calories;
        });

        dailyCaloriesByDate[dateStr] = Math.round(dayCalories);
      });

      const topProducts = Object.values(productsByName)
        .sort((a, b) => b.count - a.count || b.calories - a.calories)
        .slice(0, 8);

      const loggedDays = loggedDates.size;
      const loggingRatePercent = Math.round((loggedDays / totalDays) * 100);
      const avgCaloriesPerDay = totalCalories / totalDays;
      const avgCarbs = totalCarbs / totalDays;
      const avgSugar = totalSugar / totalDays;
      const avgProtein = totalProtein / totalDays;
      const avgFat = totalFat / totalDays;

      const startWeight = [...weights]
        .reverse()
        .find((w) => new Date(`${w.date}T23:59:59`).getTime() <= start.getTime())
        ?.weight ?? null;
      const endWeight = [...weights]
        .reverse()
        .find((w) => new Date(`${w.date}T23:59:59`).getTime() <= end.getTime())
        ?.weight ?? null;
      const weightChangeKg =
        startWeight !== null && endWeight !== null
          ? Number((endWeight - startWeight).toFixed(1))
          : null;

      const dailyTarget = calculateDailyTargetCalories(profileData);
      const macroTargets = calculateDailyMacroTargets(profileData, dailyTarget);

      let calorieTargetHitDays = 0;
      if (dailyTarget && dailyTarget > 0) {
        for (let i = 0; i < totalDays; i++) {
          const day = new Date(start);
          day.setDate(start.getDate() + i);
          const iso = toIsoDate(day);
          const dayCalories = dailyCaloriesByDate[iso] ?? 0;

          let hit = false;
          if (profileData?.goal === "laihdutus") {
            hit = dayCalories <= dailyTarget;
          } else if (profileData?.goal === "lihasmassa") {
            hit = dayCalories >= dailyTarget;
          } else {
            hit = Math.abs(dayCalories - dailyTarget) <= dailyTarget * 0.1;
          }
          if (hit) calorieTargetHitDays += 1;
        }
      }

      const calorieTargetHitRatePercent =
        dailyTarget && dailyTarget > 0
          ? Math.round((calorieTargetHitDays / totalDays) * 100)
          : null;

      let successEstimatePercent: number | null =
        calorieTargetHitRatePercent === null
          ? Math.round(loggingRatePercent * 0.7)
          : Math.round(calorieTargetHitRatePercent * 0.7 + loggingRatePercent * 0.3);

      if (successEstimatePercent !== null && weightChangeKg !== null) {
        if (profileData?.goal === "laihdutus" && weightChangeKg > 0) successEstimatePercent -= 12;
        if (profileData?.goal === "lihasmassa" && weightChangeKg < 0) successEstimatePercent -= 12;
      }
      if (successEstimatePercent !== null) {
        successEstimatePercent = Math.max(0, Math.min(100, successEstimatePercent));
      }

      let aiPayload: any = null;
      try {
        const res = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "period_summary",
            instructions: periodSummaryInstruction,
            data: {
              period: {
                periodKey,
                periodStart: periodStartIso,
                periodEnd: periodEndIso,
                totalDays,
                loggedDays,
                loggingRatePercent,
              },
              goal: profileData?.goal ?? null,
              dailyTargetCalories: dailyTarget,
              dailyMacroTargets: macroTargets,
              products: topProducts,
              totals: {
                calories: Math.round(totalCalories),
                avgCaloriesPerDay: Math.round(avgCaloriesPerDay),
                avgCarbs: Math.round(avgCarbs),
                avgSugar: Math.round(avgSugar),
                avgProtein: Math.round(avgProtein),
                avgFat: Math.round(avgFat),
              },
              adherence: {
                calorieTargetHitRatePercent,
                successEstimatePercent,
              },
              weightChangeKg,
            },
          }),
        });
        if (res.ok) {
          aiPayload = await res.json();
        } else {
          const responseText = await res.text();
          console.warn(
            `[FoodScan] Period summary backend error ${res.status}: ${responseText.slice(0, 300)}`
          );
        }
      } catch (error) {
        console.warn("[FoodScan] Period summary request failed:", error);
        aiPayload = null;
      }

      let fallbackScore = successEstimatePercent ?? 60;
      if (weightChangeKg !== null && profileData?.goal === "laihdutus" && weightChangeKg > 0) {
        fallbackScore -= 10;
      }
      if (weightChangeKg !== null && profileData?.goal === "lihasmassa" && weightChangeKg < 0) {
        fallbackScore -= 10;
      }
      fallbackScore = Math.max(25, Math.min(98, Math.round(fallbackScore)));
      const fallbackLevel = fallbackScore >= 80 ? "🟢" : fallbackScore >= 60 ? "🟡" : "🔴";

      const statusText =
        fallbackScore >= 80
          ? "onnistui hyvin"
          : fallbackScore >= 60
          ? "onnistui osittain"
          : "jäi tavoitteesta";
      const fallbackSummary = `Aikavälin kokonaisarvio: ${statusText}. Lokitietojen kattavuus oli ${loggingRatePercent} % ja arvioitu onnistumisprosentti ${successEstimatePercent ?? 0} %.`;

      const fallbackSuggestions: string[] = [];
      if (profileData?.goal === "laihdutus") {
        fallbackSuggestions.push("Päivitä uusi aikaväli realistiseksi ja pidä päivittäinen energiansaanti tasaisena.");
        fallbackSuggestions.push("Nosta proteiinia pääaterioilla, jotta kylläisyys pysyy paremmin.");
      } else {
        fallbackSuggestions.push("Aseta seuraava jakso nousujohteiseksi ja pidä energiansaanti tasaisesti tavoitteen yläpuolella.");
        fallbackSuggestions.push("Varmista jokaiselle päivälle riittävä proteiini ja säännöllinen ateriarytmi.");
      }
      if (topProducts[0]) {
        fallbackSuggestions.push(`Tarkista tuotteen "${topProducts[0].name}" viikkotiheys, jotta tavoite tukee arkea paremmin.`);
      }
      fallbackSuggestions.push("Avaa terveysprofiili ja säädä tavoite tai aikataulu ennen seuraavaa jaksoa.");

      const periodLabel = `🎯 Aikavälin yhteenveto (${formatFiDate(start)}-${formatFiDate(end)})`;
      const report: WeeklyReport = {
        id: `${periodKey}-${Date.now()}`,
        weekKey: periodKey,
        weekLabel: periodLabel,
        reportType: "period",
        periodStart: periodStartIso,
        periodEnd: periodEndIso,
        createdAt: Date.now(),
        level:
          aiPayload?.level === "🟢" || aiPayload?.level === "🟡" || aiPayload?.level === "🔴"
            ? aiPayload.level
            : fallbackLevel,
        score:
          typeof aiPayload?.score === "number"
            ? Math.max(0, Math.min(100, Math.round(aiPayload.score)))
            : fallbackScore,
        summary:
          typeof aiPayload?.summary === "string" && aiPayload.summary.trim()
            ? aiPayload.summary.trim()
            : fallbackSummary,
        suggestions:
          Array.isArray(aiPayload?.suggestions) && aiPayload.suggestions.length > 0
            ? aiPayload.suggestions.slice(0, 6)
            : fallbackSuggestions.slice(0, 6),
        topProducts,
        totalCalories: Math.round(totalCalories),
        avgCaloriesPerDay: Math.round(avgCaloriesPerDay),
        avgCarbs: Math.round(avgCarbs),
        avgSugar: Math.round(avgSugar),
        avgProtein: Math.round(avgProtein),
        avgFat: Math.round(avgFat),
        weightChangeKg,
        periodMetrics: {
          totalDays,
          loggedDays,
          loggingRatePercent,
          calorieTargetHitRatePercent,
          successEstimatePercent,
        },
        source: aiPayload ? "ai" : "fallback",
      };

      const next = [report, ...currentReports];
      await saveWeeklyReports(next);
      setExpandedWeeklyReportId(report.id);
      await sendPeriodSummaryNotification(report);
      await clearProfileTimeRange();
      setClosedPeriodLabel(periodLabel);
      setShowPeriodEndedPrompt(true);
    } finally {
      setIsGeneratingPeriodSummary(false);
    }
  };

  useEffect(() => {
    if (!analyses.showSaved) return;
    loadWeeklyReportsEnabled();
    loadWeeklyReports();
    // Raportti luodaan automaattisesti, jos edelliseltä viikolta ei ole vielä raporttia.
    if (weeklyReportsEnabled) {
      generateLatestWeeklyReport(false);
    }
    void generateClosedPeriodSummaryIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyses.showSaved, weeklyReportsEnabled]);

  useEffect(() => {
    if (profile.showProfile) return;
    if (weeklyReportsEnabled) {
      void generateLatestWeeklyReport(false);
    }
    void generateClosedPeriodSummaryIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.startDate, profile.endDate, profile.goal, weeklyReportsEnabled, profile.showProfile]);

  useEffect(() => {
    if (profile.showProfile) return;
    void syncSummaryReminderNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyReportsEnabled, profile.startDate, profile.endDate, profile.goal, profile.showProfile]);

  // OCR & Analysis
  const performOCRAndAnalysis = async (
    photoUri: string,
    options?: {
      portionMultiplier: number;
      oilAdded: boolean;
      servingContext: "home" | "restaurant" | "readymeal";
      adjustmentPercent: number;
      mealDescription?: string;
    }
  ) => {
    try {
      setIsLoading(true);

      if (!GOOGLE_VISION_API_KEY) {
        throw new Error(
          "EXPO_PUBLIC_GOOGLE_VISION_API_KEY puuttuu. Lisaa se .env-tiedostoon ennen OCR-skannausta."
        );
      }

      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: "base64",
      });

      const ocrUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
      let ocrResponse: Response;
      try {
        ocrResponse = await fetch(ocrUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64 },
                features: [{ type: "TEXT_DETECTION" }],
              },
            ],
          }),
        });
      } catch (error) {
        console.error("[FoodScan] OCR fetch failed:", {
          url: ocrUrl,
          message: getErrorMessage(error),
        });
        throw error;
      }

      if (!ocrResponse.ok) {
        const responseText = await ocrResponse.text();
        console.error("[FoodScan] OCR fetch failed:", {
          url: ocrUrl,
          status: ocrResponse.status,
          body: responseText.slice(0, 300),
        });
        throw new Error(`OCR ${ocrResponse.status}: ${responseText.slice(0, 300)}`);
      }

      const ocrData = await ocrResponse.json();
      const text = ocrData.responses?.[0]?.fullTextAnnotation?.text || "";

      const requestBody: any = { ocrText: text };
      const profileData = profile.getProfileData();
      if (profileData) {
        requestBody.profile = profileData;
      }

      if (options) {
        const userMealDescription = options.mealDescription?.trim();
        requestBody.mealAdjustments = {
          portionMultiplier: options.portionMultiplier,
          oilAdded: options.oilAdded,
          servingContext: options.servingContext,
          adjustmentPercent: options.adjustmentPercent,
          ...(userMealDescription ? { mealDescription: userMealDescription } : {}),
        };
        if (userMealDescription) {
          requestBody.mealDescription = userMealDescription;
        }
      }

      let backendResponse: Response;
      try {
        backendResponse = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      } catch (error) {
        console.error("[FoodScan] Backend fetch failed:", {
          url: BACKEND_URL,
          message: getErrorMessage(error),
        });
        throw error;
      }

      if (!backendResponse.ok) {
        const responseText = await backendResponse.text();
        console.error("[FoodScan] Backend fetch failed:", {
          url: BACKEND_URL,
          status: backendResponse.status,
          body: responseText.slice(0, 300),
        });
        throw new Error(
          `Backend ${backendResponse.status}: ${responseText.slice(0, 300)}`
        );
      }

      const backendData = await backendResponse.json();
      setAnalysisText(backendData.result ?? "Ei analyysiä");
      
      // Jos backend ei lähetä products/calories, yritä parsia tekstistä
      let products = backendData.products ?? [];
      let calories = backendData.totalCalories ?? null;
            // Tallenna ehdotettu nimi jos saatavilla
      if (backendData.suggestedName) {
        setSuggestedName(backendData.suggestedName);
      } else if (products.length === 1) {
        // Jos on tasan yksi tuote, ehdota sen nimeä
        setSuggestedName(products[0].name);
      } else {
        setSuggestedName("");
      }
            if (!calories && backendData.result) {
        // Yritä löytää kaloritieto muodosta "XXX kcal"
        const match = backendData.result.match(/(\d+)\s*kcal/i);
        if (match) {
          calories = parseInt(match[1], 10);
          // Luo placeholder-tuote
          products = [{ name: "Tuote", calories: calories }];
        }
      }
      
      setAnalysisProducts(products);
      setAnalysisCalories(calories);
      setAnalysisSource("ocr");
      setIsFromSaved(false);
      setAddedToCalendar(false);
      setAddedToIngredients(false);
    } catch (error) {
      console.error("[FoodScan] OCR analysis failed:", error);
      setAnalysisText("❌ Analyysi epäonnistui");
      setIsFromSaved(false);
      setAddedToCalendar(false);
      setAddedToIngredients(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Direct AI image analysis (no OCR step, but käyttää annosvalintoja)
  const performImageAnalysis = async (
    photoUri: string,
    options?: {
      portionMultiplier: number;
      oilAdded: boolean;
      servingContext: "home" | "restaurant" | "readymeal";
      adjustmentPercent: number;
      mealDescription?: string;
    }
  ) => {
    try {
      setIsLoading(true);

      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: "base64",
      });

      const requestBody: any = { imageBase64: base64 };
      const profileData = profile.getProfileData();
      if (profileData) {
        requestBody.profile = profileData;
      }

      if (options) {
        const userMealDescription = options.mealDescription?.trim();
        requestBody.mealAdjustments = {
          portionMultiplier: options.portionMultiplier,
          oilAdded: options.oilAdded,
          servingContext: options.servingContext,
          adjustmentPercent: options.adjustmentPercent,
          ...(userMealDescription ? { mealDescription: userMealDescription } : {}),
        };
        if (userMealDescription) {
          requestBody.mealDescription = userMealDescription;
        }
      }

      let backendResponse: Response;
      try {
        backendResponse = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      } catch (error) {
        console.error("[FoodScan] Image backend fetch failed:", {
          url: BACKEND_URL,
          message: getErrorMessage(error),
        });
        throw error;
      }

      if (!backendResponse.ok) {
        const responseText = await backendResponse.text();
        console.error("[FoodScan] Image backend fetch failed:", {
          url: BACKEND_URL,
          status: backendResponse.status,
          body: responseText.slice(0, 300),
        });
        throw new Error(
          `Backend ${backendResponse.status}: ${responseText.slice(0, 300)}`
        );
      }

      const backendData = await backendResponse.json();

      setAnalysisText(backendData.result ?? "Ei analyysiä");

      let products = backendData.products ?? [];
      let calories = backendData.totalCalories ?? null;

      if (backendData.suggestedName) {
        setSuggestedName(backendData.suggestedName);
      } else if (products.length === 1) {
        setSuggestedName(products[0].name);
      } else {
        setSuggestedName("");
      }

      if (!calories && backendData.result) {
        const match = backendData.result.match(/(\d+)\s*kcal/i);
        if (match) {
          calories = parseInt(match[1], 10);
          products = [{ name: "Tuote", calories: calories }];
        }
      }

      setAnalysisProducts(products);
      setAnalysisCalories(calories);
      setAnalysisSource("image");
      setIsFromSaved(false);
      setAddedToCalendar(false);
      setAddedToIngredients(false);
    } catch (error) {
      console.error("[FoodScan] Image analysis failed:", error);
      setAnalysisText("❌ Analyysi epäonnistui");
      setIsFromSaved(false);
      setAddedToCalendar(false);
      setAddedToIngredients(false);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerTapFocus = async (x: number, y: number) => {
    if (!VisionCamera) return;
    setFocusIndicator({ x, y, visible: true });
    if (focusIndicatorTimeoutRef.current) {
      clearTimeout(focusIndicatorTimeoutRef.current);
    }
    focusIndicatorTimeoutRef.current = setTimeout(() => {
      setFocusIndicator((prev) => ({ ...prev, visible: false }));
    }, 700);

    const camera = cameraRef.current;
    if (!camera || !cameraDevice?.supportsFocus) return;

    try {
      await camera.focus({ x, y });
    } catch (error) {
      console.warn("[FoodScan] Focus failed:", getErrorMessage(error));
    }
  };

  const handlePreviewTap = (event: GestureResponderEvent) => {
    if (!VisionCamera) return;
    const now = Date.now();
    const { locationX, locationY } = event.nativeEvent;

    if (now - lastTapRef.current < 300) {
      setFacing((prev) => {
        const next = prev === "back" ? "front" : "back";
        if (next === "front") {
          setTorchEnabled(false);
        }
        return next;
      });
      setFocusIndicator((prev) => ({ ...prev, visible: false }));
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;
    void triggerTapFocus(locationX, locationY);
  };

  const openSavedAnalysis = (item: SavedAnalysis) => {
    setAnalysisText(item.text);
    setIsFromSaved(true);
    setAnalysisProducts(item.products || []);
    setAnalysisCalories(item.totalCalories ?? null);
    setAnalysisName(item.name);
    setAnalysisSource(item.analysisSource ?? null);
    setAddedToCalendar(false);
    setAddedToIngredients(false);
    // Pidetään showSaved auki, jotta takaisin-nappi vie sinne
  };

  const handleSaveIngredientsFromAnalysis = async () => {
    if (!analysisProducts || analysisProducts.length === 0) return;

    const current = ingredients.ingredients;
    const updated: StoredIngredient[] = [...current];

    analysisProducts.forEach((p) => {
      const existingIndex = updated.findIndex(
        (ing) => ing.name.toLowerCase() === p.name.toLowerCase()
      );

      const base: StoredIngredient = {
        id:
          existingIndex >= 0
            ? updated[existingIndex].id
            : Date.now().toString() + Math.random().toString(16).slice(2),
        name: p.name,
        calories: p.calories,
        carbs: p.carbs,
        sugar: p.sugar,
        protein: p.protein,
        fat: p.fat,
      };

      if (existingIndex >= 0) {
        updated[existingIndex] = base;
      } else {
        updated.push(base);
      }
    });

    await ingredients.saveIngredients(updated);
    setAddedToIngredients(true);
  };

  const handleSaveAnalysis = async () => {
    if (!analysisName.trim() || !analysisText) return;

    const newItem: SavedAnalysis = {
      id: Date.now().toString(),
      name: analysisName.trim(),
      text: analysisText,
      level: analyses.getLevelFromText(analysisText),
      favorite: false,
      analysisSource: analysisSource === "image" ? "image" : "ocr",
      usedProfile: !!(profile.useProfile && profile.weight && profile.height),
      products: analysisProducts,
      totalCalories: analysisCalories ?? undefined,
    };

    await analyses.saveToStorage([newItem, ...analyses.savedAnalyses]);
    setPendingSave(false);
    setAnalysisText(null);
    setAnalysisName("");
    setSuggestedName("");
    setIsFromSaved(false);
    setAnalysisSource(null);
    analyses.setShowSavedToast(true);
  };

  const nonRecipeAnalyses = analyses.savedAnalyses.filter((a) => !a.isRecipe);

  const getPer100Metric = (
    item: SavedAnalysis,
    metric: "calories" | "carbs" | "sugar" | "protein" | "fat"
  ): number | null => {
    const p = item.products?.[0];
    if (!p) return null;

    if (metric === "calories") {
      const value =
        item.analysisSource === "image" && typeof p.baseCalories === "number"
          ? p.baseCalories
          : p.calories;
      return Number.isFinite(value) ? value : null;
    }

    const baseValue =
      metric === "carbs"
        ? p.baseCarbs
        : metric === "sugar"
        ? p.baseSugar
        : metric === "protein"
        ? p.baseProtein
        : p.baseFat;
    const fallbackValue =
      metric === "carbs"
        ? p.carbs
        : metric === "sugar"
        ? p.sugar
        : metric === "protein"
        ? p.protein
        : p.fat;
    const value =
      typeof baseValue === "number"
        ? baseValue
        : typeof fallbackValue === "number"
        ? fallbackValue
        : null;

    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const compareMetricSort = (
    a: SavedAnalysis,
    b: SavedAnalysis,
    metric: "calories" | "carbs" | "sugar" | "protein" | "fat",
    direction: "desc" | "asc"
  ) => {
    const aMetric = getPer100Metric(a, metric);
    const bMetric = getPer100Metric(b, metric);

    if (aMetric === null && bMetric === null) return 0;
    if (aMetric === null) return 1;
    if (bMetric === null) return -1;

    return direction === "desc" ? bMetric - aMetric : aMetric - bMetric;
  };

  const filteredAnalyses = nonRecipeAnalyses
    .filter((a) => a.name.toLowerCase().includes(analyses.search.toLowerCase()))
    .filter((a) => {
      if (filter === "ALL") return true;
      if (filter === "FAVORITES") return a.favorite;
      return a.level === filter;
    })
    .sort((a, b) => {
      if (savedSort === "favorites") {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        // Jos molemmat samaa suosikki-statusta, uusin ensin
        return b.id.localeCompare(a.id);
      }

      if (savedSort === "oldest") {
        return a.id.localeCompare(b.id);
      }

      if (savedSort === "protein_desc") {
        return compareMetricSort(a, b, "protein", "desc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "protein_asc") {
        return compareMetricSort(a, b, "protein", "asc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "carbs_desc") {
        return compareMetricSort(a, b, "carbs", "desc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "carbs_asc") {
        return compareMetricSort(a, b, "carbs", "asc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "sugar_desc") {
        return compareMetricSort(a, b, "sugar", "desc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "sugar_asc") {
        return compareMetricSort(a, b, "sugar", "asc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "fat_desc") {
        return compareMetricSort(a, b, "fat", "desc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "fat_asc") {
        return compareMetricSort(a, b, "fat", "asc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "calories_desc") {
        return compareMetricSort(a, b, "calories", "desc") || b.id.localeCompare(a.id);
      }

      if (savedSort === "calories_asc") {
        return compareMetricSort(a, b, "calories", "asc") || b.id.localeCompare(a.id);
      }

      // "newest" oletus: uusin ensin
      return b.id.localeCompare(a.id);
    });

  const totalAnalysesCount = filteredAnalyses.length;
  const basicAnalysesCount = filteredAnalyses.filter((a) => !a.usedProfile).length;
  const profileAnalysesCount = filteredAnalyses.filter((a) => a.usedProfile).length;
  const favoriteAnalysesCount = filteredAnalyses.filter((a) => a.favorite).length;
  const getSavedCaloriesLabel = (item: SavedAnalysis) =>
    item.analysisSource === "image" ? "kcal/annos" : "kcal/100g";
  const getMacroMetricFromSavedSort = (
    sort: typeof savedSort
  ): "carbs" | "sugar" | "protein" | "fat" | null => {
    if (sort === "protein_desc" || sort === "protein_asc") return "protein";
    if (sort === "carbs_desc" || sort === "carbs_asc") return "carbs";
    if (sort === "sugar_desc" || sort === "sugar_asc") return "sugar";
    if (sort === "fat_desc" || sort === "fat_asc") return "fat";
    return null;
  };
  const getMacroDisplayValue = (
    item: SavedAnalysis,
    metric: "carbs" | "sugar" | "protein" | "fat"
  ) => {
    const p = item.products?.[0];
    if (!p) return null;

    const perServingValue =
      metric === "carbs"
        ? p.carbs
        : metric === "sugar"
        ? p.sugar
        : metric === "protein"
        ? p.protein
        : p.fat;
    const per100Value =
      metric === "carbs"
        ? p.baseCarbs
        : metric === "sugar"
        ? p.baseSugar
        : metric === "protein"
        ? p.baseProtein
        : p.baseFat;

    const value =
      item.analysisSource === "image"
        ? typeof perServingValue === "number"
          ? perServingValue
          : per100Value
        : typeof per100Value === "number"
        ? per100Value
        : perServingValue;

    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const getMacroUnitLabel = (item: SavedAnalysis) =>
    item.analysisSource === "image" ? "g/annos" : "g/100g";
  const getSavedSecondaryLabel = (item: SavedAnalysis) => {
    const macroMetric = getMacroMetricFromSavedSort(savedSort);
    if (macroMetric) {
      const macroValue = getMacroDisplayValue(item, macroMetric);
      if (macroValue !== null) {
        return `~${Math.round(macroValue).toLocaleString()} ${getMacroUnitLabel(item)}`;
      }
    }

    if (typeof item.totalCalories === "number") {
      return `~${Math.round(item.totalCalories).toLocaleString()} ${getSavedCaloriesLabel(item)}`;
    }
    return null;
  };

  // Piilota kamera kokonaan kun jokin isompi näkymä/modaali on auki,
  // jotta kamera ei välähdä kalenteriin/analyyseihin siirtyessä
  const isOverlayOpen =
    !!analysisText ||
    pendingSave ||
    analyses.showSaved ||
    analyses.showSavedToast ||
    profile.showProfile ||
    showCalendar ||
    showPreAnalysis ||
    showCalendarView ||
    showRecipesView;

  const shouldShowCameraScene =
    !showCalendarView &&
    !showRecipesView &&
    !analyses.showSaved &&
    !profile.showProfile &&
    !showPreAnalysis &&
    !pendingSave &&
    !analysisText &&
    !showCalendar;

  if (!hasPermission && shouldShowCameraScene && !!VisionCamera) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ color: "white" }}>Pyydetään kameran lupaa</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={{ color: "white" }}>Myönnä lupa</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#1e1e1e" }}>
      <Pressable
        style={{ flex: 1 }}
        onPress={handlePreviewTap}
        disabled={isOverlayOpen || !VisionCamera}
      >
        {VisionCamera && cameraDevice ? (
          <VisionCamera
            ref={cameraRef}
            style={{ flex: 1 }}
            device={cameraDevice}
            isActive
            photo
            torch={torchEnabled && facing === "back" ? "on" : "off"}
            onInitialized={() => setCameraReady(true)}
          />
        ) : (
          <View style={styles.cameraPlaceholder}>
            {shouldShowCameraScene ? (
              <>
                <Ionicons name="phone-portrait-outline" size={34} color="#9ca3af" />
                <Text style={styles.cameraUnavailableTitle}>Kameratila ei käytössä Expo Go:ssa</Text>
                <Text style={styles.cameraUnavailableText}>
                  Käytä `expo run:android` / dev buildia kameratoiminnoille.
                </Text>
              </>
            ) : (
              <ActivityIndicator size="large" color="white" />
            )}
          </View>
        )}
      </Pressable>

      {!cameraReady && !isOverlayOpen && (
        <View style={styles.cameraPlaceholder}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}

      {isOverlayOpen && <View pointerEvents="none" style={styles.cameraMask} />}

      {frozenPhotoUri && (
        <Image
          source={{ uri: frozenPhotoUri }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {focusIndicator.visible && !isOverlayOpen && (
        <View
          pointerEvents="none"
          style={[
            styles.focusIndicator,
            {
              left: focusIndicator.x - 30,
              top: focusIndicator.y - 30,
            },
          ]}
        />
      )}

      {!isOverlayOpen && (
        <>
          <View style={styles.brandContainer}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.brandLogo}
            />
            <Text style={styles.brandText}>Ravintoäly</Text>
          </View>

          <Pressable
            style={[
              styles.torchButton,
              (!VisionCamera || facing !== "back") && styles.torchButtonDisabled,
            ]}
            onPress={() => setTorchEnabled((prev) => !prev)}
            disabled={!VisionCamera || facing !== "back"}
          >
            <Ionicons
              name={torchEnabled ? "flashlight" : "flashlight-outline"}
              size={24}
              color="white"
            />
          </Pressable>

          <Pressable
            style={styles.modeToggleButton}
            onPress={() =>
              setCameraMode((prev) => (prev === "ocr" ? "image" : "ocr"))
            }
          >
            <Ionicons
              name={cameraMode === "ocr" ? "document-text-outline" : "image-outline"}
              size={18}
              color="white"
            />
            <Text style={styles.modeToggleText}>
              {cameraMode === "ocr" ? "OCR" : "AI-kuva"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.captureButton,
              cameraMode === "image" && styles.captureButtonAi,
            ]}
            onPress={async () => {
              const camera = cameraRef.current;
              if (!VisionCamera || !camera || isLoading) return;
              const photo = await camera.takePhoto({ enableShutterSound: false });
              const photoUri = photo.path.startsWith("file://")
                ? photo.path
                : `file://${photo.path}`;
              if (cameraMode === "ocr") {
                // OCR: näytetään jäädytetty kuva analyysin ajaksi
                setFrozenPhotoUri(photoUri);
                try {
                  await performOCRAndAnalysis(photoUri);
                } finally {
                  setFrozenPhotoUri(null);
                  try {
                    await FileSystem.deleteAsync(photoUri, { idempotent: true });
                  } catch {
                    // ignore
                  }
                }
              } else {
                // AI-tila: vain otetaan kuva ja avataan annosmodaali
                setCapturedPhotoUri(photoUri);
                setMealDescription("");
                setShowPreAnalysis(true);
              }
            }}
          >
            {cameraMode === "image" && (
              <View
                style={[
                  styles.captureInner,
                  styles.captureInnerAi,
                ]}
              >
                <Text style={styles.captureLabel}>AI</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.quickNavBar}>
            <Pressable
              style={styles.quickNavItem}
              onPress={openDiaryView}
            >
              <Ionicons name="book-outline" size={20} color="#9ca3af" />
              <Text style={styles.quickNavLabel}>Päiväkirja</Text>
            </Pressable>
            <Pressable style={styles.quickNavItem} onPress={() => openSaved("left")}>
              <Ionicons name="analytics-outline" size={20} color="#9ca3af" />
              <Text style={styles.quickNavLabel}>Analyysit</Text>
            </Pressable>
            <Pressable style={[styles.quickNavItem, styles.quickNavItemActive]}>
              <Ionicons name="camera-outline" size={20} color="#ffffff" />
              <Text style={[styles.quickNavLabel, styles.quickNavLabelActive]}>Kamera</Text>
            </Pressable>
            <Pressable style={styles.quickNavItem} onPress={() => openProfile("right")}>
              <Ionicons name="person-outline" size={20} color="#9ca3af" />
              <Text style={styles.quickNavLabel}>Profiili</Text>
            </Pressable>
            <Pressable
              style={styles.quickNavItem}
              onPress={openCalendarHistoryView}
            >
              <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
              <Text style={styles.quickNavLabel}>Kalenteri</Text>
            </Pressable>
          </View>
        </>
      )}

      {isLoading && (
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.blurContent}>
            <ActivityIndicator size="large" color="white" />
            <Text style={{ color: "white", marginTop: 12 }}>Analysoidaan…</Text>
          </View>
        </BlurView>
      )}

      {/* Pre-analysis flow (portion, toggles, adjustment) */}
      <Modal transparent visible={showPreAnalysis} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.preAnalysisBox}>
            <ScrollView>
              <Text style={styles.nameTitle}>🍽️ Varmistetaan annos</Text>

              <Text style={styles.label}>A) Annoskoko (pakollinen)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
                contentContainerStyle={{
                  flexDirection: "row",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                <Pressable
                  style={[
                    styles.chipButton,
                    portionMultiplier === 0.5 && styles.chipButtonActive,
                  ]}
                  onPress={() => setPortionMultiplier(0.5)}
                >
                  <Text style={styles.chipText}>Pieni (0.5×)</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipButton,
                    portionMultiplier === 0.7 && styles.chipButtonActive,
                  ]}
                  onPress={() => setPortionMultiplier(0.7)}
                >
                  <Text style={styles.chipText}>Keskipieni (0.7×)</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipButton,
                    portionMultiplier === 1 && styles.chipButtonActive,
                  ]}
                  onPress={() => setPortionMultiplier(1)}
                >
                  <Text style={styles.chipText}>Normaali (1.0×)</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipButton,
                    portionMultiplier === 1.2 && styles.chipButtonActive,
                  ]}
                  onPress={() => setPortionMultiplier(1.2)}
                >
                  <Text style={styles.chipText}>Keskisuuri (1.2×)</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipButton,
                    portionMultiplier === 1.4 && styles.chipButtonActive,
                  ]}
                  onPress={() => setPortionMultiplier(1.4)}
                >
                  <Text style={styles.chipText}>Suuri (1.4×)</Text>
                </Pressable>
              </ScrollView>

              <Text style={styles.label}>Lisäkysymykset</Text>

              <Text style={styles.subLabel}>B) Lisättiinkö öljyä?</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <Pressable
                  style={[
                    styles.chipButton,
                    oilAdded === "no" && styles.chipButtonActive,
                  ]}
                  onPress={() => setOilAdded("no")}
                >
                  <Text style={styles.chipText}>Ei</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipButton,
                    oilAdded === "yes" && styles.chipButtonActive,
                  ]}
                  onPress={() => setOilAdded("yes")}
                >
                  <Text style={styles.chipText}>Kyllä (+100 kcal)</Text>
                </Pressable>
              </View>
              <Text style={styles.helperText}>
                Öljy on yleisin virhe kaloriarvioissa.
              </Text>

              <Text style={styles.subLabel}>C) Kotiruoka, valmisruoka vai ravintola?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
                contentContainerStyle={{
                  flexDirection: "row",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                <Pressable
                  style={[
                    styles.chipButton,
                    servingContext === "home" && styles.chipButtonActive,
                  ]}
                  onPress={() => setServingContext("home")}
                >
                  <Text style={styles.chipText}>Kotiruoka</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipButton,
                    servingContext === "readymeal" && styles.chipButtonActive,
                  ]}
                  onPress={() => setServingContext("readymeal")}
                >
                  <Text style={styles.chipText}>Valmisruoka (+10 %)</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipButton,
                    servingContext === "restaurant" && styles.chipButtonActive,
                  ]}
                  onPress={() => setServingContext("restaurant")}
                >
                  <Text style={styles.chipText}>Ravintola (+20 %)</Text>
                </Pressable>
              </ScrollView>
              <Text style={styles.helperText}>
                Ravintola-annokset ovat usein rasvaisempia ja suurempia.
              </Text>

              <Text style={styles.subLabel}>D) Haluatko säätää arviota?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
                contentContainerStyle={{
                  flexDirection: "row",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                {[-20, -15, -10, -5, 0, 5, 10, 15, 20].map((value) => (
                  <Pressable
                    key={value}
                    style={[
                      styles.chipButton,
                      adjustmentPercent === value && styles.chipButtonActive,
                    ]}
                    onPress={() =>
                      setAdjustmentPercent(
                        value as
                          | -20
                          | -15
                          | -10
                          | -5
                          | 0
                          | 5
                          | 10
                          | 15
                          | 20
                      )
                    }
                  >
                    <Text style={styles.chipText}>
                      {value > 0 ? `+${value}%` : `${value}%`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.helperText}>
                Pieni hienosäätö (−20 % … +20 %) antaa sinulle viimeisen
                sanan.
              </Text>

              <Text style={styles.subLabel}>E) Kuvaile annosta (valinnainen)</Text>
              <TextInput
                placeholder="Esim. Tämä näyttää suklaakeksiltä"
                placeholderTextColor="#777"
                value={mealDescription}
                onChangeText={setMealDescription}
                style={styles.nameInput}
                multiline
                maxLength={180}
              />
              <Text style={styles.helperText}>
                Vinkki: kerro jos kuva on epäselvä tai ruoka voi sekoittua samannäköiseen vaihtoehtoon.
              </Text>
            </ScrollView>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 16,
              }}
            >
              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  setShowPreAnalysis(false);
                  setCapturedPhotoUri(null);
                  setPortionMultiplier(1);
                  setOilAdded("no");
                  setServingContext("home");
                  setAdjustmentPercent(0);
                  setMealDescription("");
                }}
              >
                <Text style={{ color: "white" }}>Peruuta</Text>
              </Pressable>
              <Pressable
                style={styles.actionButton}
                onPress={async () => {
                  if (!capturedPhotoUri) return;
                  const uri = capturedPhotoUri;
                  setShowPreAnalysis(false);
                  setCapturedPhotoUri(null);
                  setFrozenPhotoUri(uri);
                  try {
                    await performImageAnalysis(uri, {
                      portionMultiplier,
                      oilAdded: oilAdded === "yes",
                      servingContext,
                      adjustmentPercent,
                      mealDescription,
                    });
                  } finally {
                    setFrozenPhotoUri(null);
                    try {
                      await FileSystem.deleteAsync(uri, { idempotent: true });
                    } catch {
                      // ignore
                    }
                  }
                  setPortionMultiplier(1);
                  setOilAdded("no");
                  setServingContext("home");
                  setAdjustmentPercent(0);
                  setMealDescription("");
                }}
              >
                <Text style={{ color: "white" }}>🤖 Analysoi</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Analysis Modal */}
      <AnalysisModal
        visible={!!analysisText}
        analysisText={analysisText || ""}
        isFromSaved={isFromSaved}
        useProfile={profile.useProfile}
        goal={profile.goal}
        addedToCalendar={addedToCalendar}
        addedToIngredients={addedToIngredients}
        onClose={() => {
          setAnalysisText(null);
          setIsFromSaved(false);
          setAddedToCalendar(false);
          setAddedToIngredients(false);
          setSuggestedName("");
          setAnalysisSource(null);
        }}
        onSave={() => setPendingSave(true)}
        canSaveIngredients={analysisProducts.length > 0}
        onSaveIngredients={handleSaveIngredientsFromAnalysis}
        onAddToCalendar={() => setShowCalendar(true)}
        onBack={() => {
          setAnalysisText(null);
          setIsFromSaved(false);
          setAddedToCalendar(false);
          setAddedToIngredients(false);
          setSuggestedName("");
          setAnalysisSource(null);
          openSaved("left");
        }}
      />

      {/* Save Analysis Name Modal */}
      <Modal transparent visible={pendingSave} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.nameBox}>
            <Text style={styles.nameTitle}>Nimeä analyysi</Text>
            {suggestedName && (
              <>
                <Text style={{ color: "#aaa", fontSize: 13, marginBottom: 8 }}>
                  AI tunnisti: {suggestedName}
                </Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: "#2d5a3d", marginBottom: 12 }]}
                  onPress={() => setAnalysisName(suggestedName)}
                >
                  <Text style={{ color: "white" }}>✅ Käytä ehdotettua nimeä</Text>
                </Pressable>
                <Text style={{ color: "#777", fontSize: 12, marginBottom: 8 }}>tai nimeä itse:</Text>
              </>
            )}
            <TextInput
              placeholder="Esim. Aamupala"
              placeholderTextColor="#777"
              value={analysisName}
              onChangeText={setAnalysisName}
              style={styles.nameInput}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  setPendingSave(false);
                  setAnalysisName("");
                  setSuggestedName("");
                }}
              >
                <Text style={{ color: "white" }}>Peruuta</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={handleSaveAnalysis}>
                <Text style={{ color: "white" }}>Tallenna</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Saved Analyses Modal */}
      <Modal 
        visible={analyses.showSaved} 
        animationType="none" 
        transparent={false}
        statusBarTranslucent={false}
        navigationBarTranslucent={false}
      >
        <View style={styles.modalBackdropDark}>
          <Animated.View
            style={[
              styles.modalSlideLayer,
              { transform: [{ translateX: savedModalTranslateX }] },
            ]}
          >
            <Animated.View
              style={[
                styles.modalSlideLayer,
                { transform: [{ translateX: Animated.multiply(savedModalTranslateX, -1) }] },
              ]}
            >
              <View
                style={[
                  styles.analysisContainer,
                  { paddingBottom: Math.max(20, insets.bottom + 14) },
                ]}
              >
              <View style={styles.savedHeader}>
            <Pressable
              style={styles.filterBox}
              onPress={() =>
                setShowAnalysisTypeFilterBox(!showAnalysisTypeFilterBox)
              }
            >
              <Text style={{ color: "white" }}>
                {analysisTypeFilter === "basic"
                  ? "\u{1F4CA} Perusanalyysit"
                  : analysisTypeFilter === "profile"
                  ? "\u{1F464} Profiilinanalyysit"
                  : "Analyysit"}{" "}
                {"\u25BE"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.filterBox}
              onPress={() => setShowFilterBox(!showFilterBox)}
            >
              <Text style={{ color: "white" }}>
                {filter === "ALL"
                  ? "Suodata"
                  : filter === "FAVORITES"
                  ? "\u2B50 Suosikit"
                  : filter}{" "}
                {"\u25BE"}
              </Text>
            </Pressable>
          </View>

          <TextInput
            placeholder="Hae analyysiä..."
            placeholderTextColor="#777"
            value={analyses.search}
            onChangeText={analyses.setSearch}
            style={styles.searchInput}
          />

          {showAnalysisTypeFilterBox && (
            <View style={styles.filterDropdown}>
              {[
                { key: "all", label: "Analyysit" },
                { key: "basic", label: "\u{1F4CA} Perusanalyysit" },
                { key: "profile", label: "\u{1F464} Profiilinanalyysit" },
              ].map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    setAnalysisTypeFilter(f.key as "basic" | "profile" | "all");
                    setShowAnalysisTypeFilterBox(false);
                  }}
                >
                  <Text style={styles.filterItem}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {showFilterBox && (
            <ScrollView
              style={styles.filterDropdown}
              contentContainerStyle={styles.filterDropdownContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              <Pressable
                onPress={() => {
                  setFilter("ALL");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>Kaikki</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFilter("FAVORITES");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>{"\u2B50 Suosikit"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFilter("\u{1F7E2}");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>{"\u{1F7E2} Terveellinen"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFilter("\u{1F7E1}");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>{"\u{1F7E1} Kohtalainen"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFilter("\u{1F534}");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>{"\u{1F534} Satunnainen"}</Text>
              </Pressable>
              <View style={styles.filterDivider} />
              <Pressable
                onPress={() => {
                  setSavedSort("newest");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "newest" ? "\u2713 " : ""}Uusin ensin
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("oldest");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "oldest" ? "\u2713 " : ""}Vanhin ensin
                </Text>
              </Pressable>
              <View style={styles.filterDivider} />
              <Text style={styles.filterSectionLabel}>Eniten 📈</Text>
              <Pressable
                onPress={() => {
                  setSavedSort("protein_desc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "protein_desc" ? "✓ " : ""}🍗 Proteiinia
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("carbs_desc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "carbs_desc" ? "✓ " : ""}🍞 Hiilareita
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("sugar_desc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "sugar_desc" ? "✓ " : ""}🍬 Sokeria
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("fat_desc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "fat_desc" ? "✓ " : ""}🥑 Rasvaa
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("calories_desc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "calories_desc" ? "✓ " : ""}🔥 Kaloreita 
                </Text>
              </Pressable>
              <View style={styles.filterDivider} />
              <Text style={styles.filterSectionLabel}>Vähiten 📉</Text>
              <Pressable
                onPress={() => {
                  setSavedSort("protein_asc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "protein_asc" ? "✓ " : ""}🍗 Proteiinia
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("carbs_asc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "carbs_asc" ? "✓ " : ""}🍞 Hiilareita
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("sugar_asc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "sugar_asc" ? "✓ " : ""}🍬 Sokeria
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("fat_asc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "fat_asc" ? "✓ " : ""}🥑 Rasvaa
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSavedSort("calories_asc");
                  setShowFilterBox(false);
                }}
              >
                <Text style={styles.filterItem}>
                  {savedSort === "calories_asc" ? "✓ " : ""}🔥 Kaloreita 
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {totalAnalysesCount > 0 && (
            <Text style={styles.savedSummary}>
              {totalAnalysesCount} analyysiä · {basicAnalysesCount} perus · {profileAnalysesCount} profiili · {favoriteAnalysesCount} suosikkia
            </Text>
          )}

          <ScrollView style={styles.savedList} nestedScrollEnabled contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={styles.weeklyReportHeaderRow}>
              <Text style={styles.weeklyReportSectionTitle}>{"\u{1F5D3}\uFE0F Viikkoraportit"}</Text>
              <Pressable
                style={weeklyReportsEnabled ? styles.weeklyReportToggleOn : styles.weeklyReportToggleOff}
                onPress={() => setWeeklyReportsFeatureEnabled(!weeklyReportsEnabled)}
              >
                <Text style={styles.weeklyReportToggleText}>
                  {weeklyReportsEnabled ? "Päällä" : "Pois"}
                </Text>
              </Pressable>
            </View>
            {!weeklyReportsEnabled ? (
              <Text style={styles.weeklyReportEmptyText}>
                Viikkoraportit on poistettu käytöstä.
              </Text>
            ) : weeklyReports.length === 0 ? (
              <Text style={styles.weeklyReportEmptyText}>
                Viikkoraportteja ei vielä ole. Raportti muodostuu automaattisesti edellisestä viikosta.
              </Text>
            ) : (
              <>
                {weeklyReports.length > 3 && (
                  <Text style={styles.weeklyReportScrollHint}>
                    Näytetään 3 raporttia kerralla. Skrollaa nähdäksesi vanhemmat raportit.
                  </Text>
                )}
                <ScrollView
                  style={styles.weeklyReportList}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={weeklyReports.length > 3}
                  contentContainerStyle={styles.weeklyReportListContent}
                >
                  {weeklyReports.map((report) => {
                    const isExpanded = expandedWeeklyReportId === report.id;
                    const isPeriodReport =
                      report.reportType === "period" || report.weekKey.startsWith("period-");
                    return (
                      <Pressable
                        key={report.id}
                        style={[styles.weeklyReportCard, isExpanded && styles.weeklyReportCardExpanded]}
                        onPress={() => setExpandedWeeklyReportId(isExpanded ? null : report.id)}
                      >
                        <View style={styles.weeklyReportTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.weeklyReportTitle}>{report.weekLabel}</Text>
                            <Text style={styles.weeklyReportLevel}>
                              {report.level}{" "}
                              {isPeriodReport
                                ? `Aikavälin onnistuminen: ${report.score}/100`
                                : `Ruokavalion arvio: ${report.score}/100`}
                            </Text>
                          </View>
                          <View style={styles.weeklyReportActions}>
                            <Pressable
                              style={styles.weeklyReportDeleteButton}
                              onPress={(event: GestureResponderEvent) => {
                                event.stopPropagation?.();
                                void deleteWeeklyReportByWeekKey(report.weekKey);
                              }}
                              hitSlop={8}
                            >
                              <Ionicons name="trash-outline" size={16} color="#fca5a5" />
                            </Pressable>
                            <Ionicons
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={18}
                              color="#e5e7eb"
                            />
                          </View>
                        </View>

                        {isExpanded && (
                          <>
                            {isPeriodReport && report.periodMetrics && (
                              <>
                                <Text style={styles.weeklyReportMetrics}>
                                  {"🗓️ Jakson pituus: "}
                                  {report.periodMetrics.totalDays} pv
                                </Text>
                                <Text style={styles.weeklyReportMetrics}>
                                  {"🧾 Lokipäivät: "}
                                  {report.periodMetrics.loggedDays}/{report.periodMetrics.totalDays} (
                                  {report.periodMetrics.loggingRatePercent} %)
                                </Text>
                                {report.periodMetrics.calorieTargetHitRatePercent !== null && (
                                  <Text style={styles.weeklyReportMetrics}>
                                    {"🎯 Kaloritavoitteen osumat: "}
                                    {report.periodMetrics.calorieTargetHitRatePercent} %
                                  </Text>
                                )}
                                {report.periodMetrics.successEstimatePercent !== null && (
                                  <Text style={styles.weeklyReportMetrics}>
                                    {"📌 Arvioitu onnistuminen: "}
                                    {report.periodMetrics.successEstimatePercent} %
                                  </Text>
                                )}
                              </>
                            )}
                            <Text style={styles.weeklyReportMetrics}>
                              {"\u{1F525} Kalorit: "}
                              {report.totalCalories.toLocaleString()} kcal ({report.avgCaloriesPerDay.toLocaleString()} / pv)
                            </Text>
                            <Text style={styles.weeklyReportMetrics}>{"\u{1F35E} Hiilihydraatit: "}{report.avgCarbs} g</Text>
                            <Text style={styles.weeklyReportMetrics}>{"\u{1F36C} Sokerit: "}{report.avgSugar} g</Text>
                            <Text style={styles.weeklyReportMetrics}>{"\u{1F357} Proteiini: "}{report.avgProtein} g</Text>
                            <Text style={styles.weeklyReportMetrics}>{"\u{1F951} Rasva: "}{report.avgFat} g</Text>
                            <Text style={styles.weeklyReportMetrics}>
                              {"\u{2696}\uFE0F Painon muutos: "}
                              {report.weightChangeKg === null ? "ei dataa" : `${report.weightChangeKg > 0 ? "+" : ""}${report.weightChangeKg} kg`}
                            </Text>
                            <Text style={styles.weeklyReportMetrics}>
                              {"\u{1F5D3}\uFE0F Pvm: "}
                              {formatFiDateFromIso(report.periodStart)}-{formatFiDateFromIso(report.periodEnd)}
                            </Text>
                            {report.topProducts.length > 0 && (
                              <Text style={styles.weeklyReportMetrics}>
                                {"\u{1F3C6} Käytetyin tuote: "}
                                {report.topProducts[0].name} ({report.topProducts[0].count} kertaa, {Math.round(report.topProducts[0].calories).toLocaleString()} kcal)
                              </Text>
                            )}
                            <Text style={styles.weeklyReportAnalysisTitle}>{"\u{1F4CA} Analyysi"}</Text>
                            <Text style={styles.weeklyReportSummary}>{report.summary}</Text>
                            {report.suggestions.map((s, i) => (
                              <Text key={`${report.id}-${i}`} style={styles.weeklyReportSuggestion}>• {s}</Text>
                            ))}
                          </>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {(analysisTypeFilter === "all" || analysisTypeFilter === "basic") &&
              filteredAnalyses.some((a) => !a.usedProfile) && (
                <>
                  <Text style={styles.sectionTitle}>{"\u{1F4CA} Perusanalyysit"}</Text>
                  {filteredAnalyses
                    .filter((a) => !a.usedProfile)
                    .map((a) => {
                      const secondaryLabel = getSavedSecondaryLabel(a);
                      return (
                        <View key={a.id} style={styles.savedRow}>
                          <Pressable onPress={() => analyses.toggleFavorite(a.id)}>
                            <Text style={styles.star}>
                              {a.favorite ? "\u2B50" : "\u2606"}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={{ flex: 1 }}
                            onPress={() => openSavedAnalysis(a)}
                          >
                            <View style={styles.savedTitleRow}>
                              <Text
                                style={styles.savedTitle}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {a.level} {a.name}
                              </Text>
                              {secondaryLabel && (
                                <Text style={styles.savedCalories}>
                                  {secondaryLabel}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                          <Pressable
                            style={styles.savedDeleteButton}
                            onPress={() => analyses.deleteOne(a.id)}
                          >
                            <Text style={{ color: "#ff5555", fontSize: 18 }}>{"\u2715"}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                </>
              )}

            {(analysisTypeFilter === "all" ||
              analysisTypeFilter === "profile") &&
              filteredAnalyses.some((a) => a.usedProfile) && (
                <>
                  <Text style={styles.sectionTitle}>{"\u{1F464} Profiilinanalyysit"}</Text>
                  {filteredAnalyses
                    .filter((a) => a.usedProfile)
                    .map((a) => {
                      const secondaryLabel = getSavedSecondaryLabel(a);
                      return (
                        <View key={a.id} style={styles.savedRow}>
                          <Pressable onPress={() => analyses.toggleFavorite(a.id)}>
                            <Text style={styles.star}>
                              {a.favorite ? "\u2B50" : "\u2606"}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={{ flex: 1 }}
                            onPress={() => openSavedAnalysis(a)}
                          >
                            <View style={styles.savedTitleRow}>
                              <Text
                                style={styles.savedTitle}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {a.level} {a.name}
                              </Text>
                              {secondaryLabel && (
                                <Text style={styles.savedCalories}>
                                  {secondaryLabel}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                          <Pressable
                            style={styles.savedDeleteButton}
                            onPress={() => analyses.deleteOne(a.id)}
                          >
                            <Text style={{ color: "#ff5555", fontSize: 18 }}>{"\u2715"}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                </>
              )}

            {filteredAnalyses.length === 0 && (
              <Text
                style={{ color: "#999", textAlign: "center", marginTop: 20 }}
              >
                Ei analyysejä
              </Text>
            )}
          </ScrollView>

          {showMoreOptions && (
            <>
              <Pressable
                style={styles.deleteAllButton}
                onPress={analyses.deleteAll}
              >
                <Text style={{ color: "white" }}>{"\u{1F5D1}\uFE0F Poista kaikki"}</Text>
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  analyses.setShowSaved(false);
                  setOpenedFromSaved(true);
                  setCalendarInitialSection("calendar");
                  setCalendarViewSlideFrom("none");
                  setShowCalendarView(true);
                }}
              >
                <Text style={{ color: "white" }}>{"\u{1F4C5} Näytä kalenteri"}</Text>
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  analyses.setShowSaved(false);
                  setShowMoreOptions(false);
                  setOpenedRecipesFromSaved(true);
                  setShowRecipesView(true);
                }}
              >
                <Text style={{ color: "white" }}>{"\u{1F4D6} Näytä reseptit"}</Text>
              </Pressable>
            </>
          )}

              <Pressable
                style={styles.toggleButton}
                onPress={() => setShowMoreOptions(!showMoreOptions)}
              >
                <Text style={{ color: "white" }}>
                  {showMoreOptions ? "\u25BC Piilota valinnat" : "\u25B6 Lisää vaihtoehtoja"}
                </Text>
              </Pressable>
              <View style={styles.savedNavBar}>
                <Pressable
                  style={styles.savedNavItem}
                  onPress={() => {
                    analyses.setShowSaved(false);
                    setShowMoreOptions(false);
                    openDiaryView();
                  }}
                >
                  <Ionicons name="book-outline" size={20} color="#9ca3af" />
                  <Text style={styles.savedNavLabel}>Päiväkirja</Text>
                </Pressable>
                <Pressable style={[styles.savedNavItem, styles.savedNavItemActive]}>
                  <Ionicons name="analytics-outline" size={20} color="#ffffff" />
                  <Text style={[styles.savedNavLabel, styles.savedNavLabelActive]}>Analyysit</Text>
                </Pressable>
                <Pressable
                  style={styles.savedNavItem}
                  onPress={() => {
                    analyses.setShowSaved(false);
                    setShowMoreOptions(false);
                  }}
                >
                  <Ionicons name="camera-outline" size={20} color="#9ca3af" />
                  <Text style={styles.savedNavLabel}>Kamera</Text>
                </Pressable>
                <Pressable
                  style={styles.savedNavItem}
                  onPress={() => {
                    analyses.setShowSaved(false);
                    setShowMoreOptions(false);
                    openProfile("right");
                  }}
                >
                  <Ionicons name="person-outline" size={20} color="#9ca3af" />
                  <Text style={styles.savedNavLabel}>Profiili</Text>
                </Pressable>
                <Pressable
                  style={styles.savedNavItem}
                  onPress={() => {
                    analyses.setShowSaved(false);
                    setShowMoreOptions(false);
                    openCalendarHistoryView();
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
                  <Text style={styles.savedNavLabel}>Kalenteri</Text>
                </Pressable>
              </View>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Modal>

      {/* Saved Toast */}
      <Modal transparent visible={analyses.showSavedToast} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.toastBox}>
            <Text style={{ color: "white", marginBottom: 16 }}>
              {"\u2705 Analyysi tallennettu"}
            </Text>
            <Pressable
              style={styles.actionButton}
              onPress={() => analyses.setShowSavedToast(false)}
            >
              <Text style={{ color: "white" }}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showPeriodEndedPrompt} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.periodPromptBox}>
            <Text style={styles.periodPromptTitle}>🏁 Aikaväli päättynyt</Text>
            <Text style={styles.periodPromptText}>
              {closedPeriodLabel
                ? `${closedPeriodLabel} on tallennettu Viikkoraportit-osioon.`
                : "Aikavälin yhteenveto on tallennettu Viikkoraportit-osioon."}
            </Text>
            <Text style={styles.periodPromptText}>
              Haluatko päivittää terveysprofiilia seuraavaa jaksoa varten?
            </Text>
            <View style={styles.periodPromptActions}>
              <Pressable
                style={[styles.actionButton, styles.periodPromptButtonSecondary]}
                onPress={() => setShowPeriodEndedPrompt(false)}
              >
                <Text style={{ color: "white" }}>Myöhemmin</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.periodPromptButtonPrimary]}
                onPress={() => {
                  setShowPeriodEndedPrompt(false);
                  openProfile("right");
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Avaa profiili</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Modal */}
      <ProfileModal
        visible={profile.showProfile}
        onClose={() => profile.setShowProfile(false)}
        slideFrom={profileModalDirection}
        onSave={profile.saveProfile}
        useProfile={profile.useProfile}
        setUseProfile={profile.toggleUseProfile}
        weight={profile.weight}
        setWeight={profile.setWeight}
        height={profile.height}
        setHeight={profile.setHeight}
        goal={profile.goal}
        setGoal={profile.setGoal}
        timeframe={profile.timeframe}
        setTimeframe={profile.setTimeframe}
        derivedTimeframe={profile.derivedTimeframe}
        targetWeight={profile.targetWeight}
        setTargetWeight={profile.setTargetWeight}
        targetMuscle={profile.targetMuscle}
        setTargetMuscle={profile.setTargetMuscle}
        currentWeight={profile.currentWeight}
        setCurrentWeight={profile.setCurrentWeight}
        onOpenDiary={() => {
          profile.setShowProfile(false);
          openDiaryView();
        }}
        onOpenAnalyses={() => {
          profile.setShowProfile(false);
          openSaved("left");
        }}
        onOpenCamera={() => profile.setShowProfile(false)}
        onOpenCalendar={() => {
          profile.setShowProfile(false);
          openCalendarHistoryView();
        }}
        startDate={profile.startDate}
        setStartDate={profile.setStartDate}
        endDate={profile.endDate}
        setEndDate={profile.setEndDate}
        gender={profile.gender}
        setGender={profile.setGender}
        ageRange={profile.ageRange}
        setAgeRange={profile.setAgeRange}
        trainingSessionsPerWeek={profile.trainingSessionsPerWeek}
        setTrainingSessionsPerWeek={profile.setTrainingSessionsPerWeek}
        trainingIntensity={profile.trainingIntensity}
        setTrainingIntensity={profile.setTrainingIntensity}
      />

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        analysis={
          analysisText
            ? {
                id: Date.now().toString(),
                name: analysisName || "Nimetön analyysi",
                text: analysisText,
                level: analyses.getLevelFromText(analysisText),
                favorite: false,
                usedProfile: isFromSaved ? (filteredAnalyses.find(a => a.text === analysisText)?.usedProfile ?? false) : profile.useProfile,
                products: analysisProducts,
                totalCalories: analysisCalories ?? undefined,
              }
            : null
        }
        isImageAnalysis={analysisSource === "image"}
        onClose={() => setShowCalendar(false)}
        onSaved={() => setAddedToCalendar(true)}
      />

      {/* Calendar View */}
      <CalendarView
        visible={showCalendarView}
        initialSection={calendarInitialSection}
        slideFrom={calendarViewSlideFrom}
        onOpenAnalyses={() => {
          setShowCalendarView(false);
          openSaved("left");
        }}
        onOpenCamera={() => {
          setOpenedFromSaved(false);
          setShowCalendarView(false);
        }}
        onOpenProfile={() => {
          openProfile("right");
        }}
        onOpenRecipes={() => {
          setShowCalendarView(false);
          if (openedFromSaved) {
            setOpenedFromSaved(false);
            setOpenedRecipesFromSaved(true);
          }
          setShowRecipesView(true);
        }}
        onClose={() => {
          if (openedFromSaved) {
            setOpenedFromSaved(false);
            openSaved("left");
          }
          setShowCalendarView(false);
        }}
      />
      <RecipesView
        visible={showRecipesView}
        analyses={analyses.savedAnalyses}
        onUpdateAnalyses={analyses.saveToStorage}
        ingredients={ingredients.ingredients}
        onUpdateIngredients={ingredients.saveIngredients}
        onClose={() => {
          if (openedRecipesFromSaved) {
            setOpenedRecipesFromSaved(false);
            openSaved("left");
          }
          setShowRecipesView(false);
        }}
      />
      {/* First-time onboarding modal */}
      <Modal
        transparent
        visible={showOnboarding}
        animationType="fade"
      >
        <View style={styles.toastOverlay}>
          <View style={styles.onboardingBox}>
            <Text style={styles.onboardingTitle}>👋 Tervetuloa Food Scan -sovellukseen</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              <Text style={styles.onboardingText}>
                • Ota kuva ateriasta tai ravintotiedoista.
              </Text>
              <Text style={styles.onboardingText}>
                • Valitse ennen analyysiä, onko kyseessä koti, ravintola vai valmisateria.
              </Text>
              <Text style={styles.onboardingText}>
                • Tallennat analyysin kalenteriin ja näet päivän kokonaiskalorit ja makrot.
              </Text>
              <Text style={styles.onboardingText}>
                • Avaa profiili-painikkeesta terveysprofiili, niin saat sinulle sopivat tavoitekalorit ja makrot.
              </Text>
              <Text style={styles.onboardingText}>
                • Kalenterissa voit napauttaa tuotetta (esim. pizza), jotta näet juuri sen annoksen makrot.
              </Text>
              <Text style={styles.onboardingText}>
                • Voit tallentaa OCR-analyysin ainesosiksi ja koota niistä reseptejä Reseptit-näkymässä.
              </Text>
              <Text style={styles.onboardingText}>
                • Reseptin annoksen saat tallennettua kalenteriin Reseptit-näkymästä painamalla Tallenna annos kalenteriin -painiketta.
              </Text>
            </ScrollView>
            <Pressable
              style={[styles.actionButton, { marginTop: 20 }]}
              onPress={async () => {
                try {
                  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, "true");
                } catch {
                  // ei haittaa, jos tallennus epäonnistuu
                }
                setShowOnboarding(false);
              }}
            >
              <Text style={{ color: "white" }}>Ymmärrän</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  captureButton: {
    position: "absolute",
    bottom: 106,
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "white",
  },
  brandContainer: {
    position: "absolute",
    top: Platform.OS === "android" ? 52 : 62,
    left: 16,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "70%",
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  brandText: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  torchButton: {
    position: "absolute",
    top: Platform.OS === "android" ? 52 : 62,
    right: 16,
    zIndex: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  torchButtonDisabled: {
    opacity: 0.45,
  },
  quickNavBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: Platform.OS === "ios" ? 18 : 14,
    zIndex: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3f4652",
    backgroundColor: "#2d3137",
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  quickNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 10,
    paddingVertical: 2,
  },
  quickNavItemActive: {
    backgroundColor: "#23272d",
  },
  quickNavLabel: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  quickNavLabelActive: {
    color: "#ffffff",
  },
  savedNavBar: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3f4652",
    backgroundColor: "#2d3137",
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  savedNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 10,
    paddingVertical: 2,
  },
  savedNavItemActive: {
    backgroundColor: "#23272d",
  },
  savedNavLabel: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  savedNavLabelActive: {
    color: "#ffffff",
  },
  blurContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdropDark: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  modalSlideLayer: {
    flex: 1,
  },
  analysisContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
  },
  actionButton: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 12,
    alignItems: "center",
  },
  savedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 12,
    paddingLeft: 4,
  },
  weeklyReportSectionTitle: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchInput: {
    backgroundColor: "#333",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  filterBox: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  filterDropdown: {
    backgroundColor: "#333",
    borderRadius: 8,
    marginBottom: 12,
    maxHeight: 230,
  },
  filterDropdownContent: {
    paddingBottom: 6,
  },
  filterItem: {
    color: "white",
    padding: 8,
  },
  filterSectionLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  filterDivider: {
    height: 1,
    backgroundColor: "#444",
    marginVertical: 4,
  },
  savedSummary: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 8,
    paddingLeft: 4,
  },
  weeklyReportEmptyText: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 8,
    paddingLeft: 4,
  },
  weeklyReportScrollHint: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 8,
    paddingLeft: 4,
  },
  weeklyReportList: {
    maxHeight: 300,
  },
  weeklyReportListContent: {
    paddingRight: 4,
  },
  weeklyReportHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 12,
    paddingLeft: 4,
  },
  weeklyReportToggleOn: {
    backgroundColor: "#1f5134",
    borderColor: "#2f7d50",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weeklyReportToggleOff: {
    backgroundColor: "#4b1f1f",
    borderColor: "#7f2d2d",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weeklyReportToggleText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  weeklyReportCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  weeklyReportCardExpanded: {
    backgroundColor: "#1f1f1f",
    borderColor: "#4b5563",
    borderWidth: 1.2,
  },
  weeklyReportTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  weeklyReportActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weeklyReportDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3f2626",
    borderWidth: 1,
    borderColor: "#6b2d2d",
  },
  weeklyReportTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  weeklyReportLevel: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  weeklyReportMetrics: {
    color: "#cbd5e1",
    fontSize: 12,
    marginBottom: 4,
  },
  weeklyReportSummary: {
    color: "#e5e7eb",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
  },
  weeklyReportAnalysisTitle: {
    color: "#f3f4f6",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 2,
  },
  weeklyReportSuggestion: {
    color: "#d1d5db",
    fontSize: 12,
    marginBottom: 2,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  savedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  savedTitle: {
    color: "white",
    fontSize: 16,
    flex: 1,
    marginRight: 6,
  },
  savedList: {
    flex: 1,
  },
  savedCalories: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "right",
  },
  savedDeleteButton: {
    paddingHorizontal: 8,
    marginLeft: 4,
  },
  star: {
    color: "#ffd700",
    fontSize: 22,
    marginRight: 10,
  },
  deleteAllButton: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#552222",
    borderRadius: 12,
    alignItems: "center",
  },
  toggleButton: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#2d5a3d",
    borderRadius: 12,
    alignItems: "center",
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
  periodPromptBox: {
    backgroundColor: "#222",
    padding: 20,
    borderRadius: 16,
    width: "88%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  periodPromptTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  periodPromptText: {
    color: "#d1d5db",
    fontSize: 14,
    marginBottom: 8,
  },
  periodPromptActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  periodPromptButtonSecondary: {
    flex: 1,
    backgroundColor: "#3a3a3a",
    marginTop: 0,
  },
  periodPromptButtonPrimary: {
    flex: 1,
    backgroundColor: "#2d5a3d",
    marginTop: 0,
  },
  onboardingBox: {
    backgroundColor: "#222",
    padding: 24,
    borderRadius: 16,
    width: "90%",
    maxWidth: 420,
  },
  onboardingTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  onboardingText: {
    color: "#d1d5db",
    fontSize: 14,
    marginBottom: 8,
  },
  nameBox: {
    backgroundColor: "#222",
    padding: 24,
    borderRadius: 16,
    width: "85%",
  },
  nameTitle: {
    color: "white",
    fontSize: 18,
    marginBottom: 12,
  },
  label: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 6,
  },
  subLabel: {
    color: "#ddd",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  helperText: {
    color: "#777",
    fontSize: 12,
    marginBottom: 10,
  },
  nameInput: {
    backgroundColor: "#333",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },
  permissionButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#333",
    borderRadius: 8,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1e1e1e",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    paddingHorizontal: 24,
  },
  cameraUnavailableTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  cameraUnavailableText: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  cameraMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1e1e1e",
    zIndex: 5,
  },
  focusIndicator: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: "transparent",
    zIndex: 25,
  },
  modeToggleButton: {
    position: "absolute",
    bottom: 188,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modeToggleText: {
    color: "white",
    marginLeft: 6,
    fontSize: 13,
  },
  captureInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  captureInnerOcr: {
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
  },
  captureInnerAi: {
    borderColor: "#4f8ef7",
    backgroundColor: "#4f8ef7",
  },
  captureLabel: {
    color: "black",
    fontWeight: "bold",
    fontSize: 14,
  },
  captureButtonAi: {
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  preAnalysisBox: {
    backgroundColor: "#222",
    padding: 24,
    borderRadius: 16,
    width: "90%",
    maxHeight: "85%",
  },
  chipButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#333",
  },
  chipButtonActive: {
    backgroundColor: "#2d5a3d",
  },
  chipText: {
    color: "white",
    fontSize: 13,
  },
});
