// app/hooks/useProfile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { STORAGE_KEYS } from "../constants";
import {
  AgeRange,
  Gender,
  TrainingIntensity,
  UserGoal,
  UserProfile,
} from "../types";

// Muuntaa merkkijonopäivän muodosta pp.kk.vvvv Date-olioksi
const parseFinnishDate = (value: string): Date | null => {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [dayStr, monthStr, yearStr] = parts;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (!day || !month || !year) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

// Laskee aikajänteen kuukausina kahden päivämäärän välillä.
// Palauttaa null, jos päivät puuttuvat tai ovat virheellisiä / samat / väärässä järjestyksessä.
const calculateTimeframeFromDates = (
  startDateStr: string,
  endDateStr: string
): number | null => {
  const start = parseFinnishDate(startDateStr);
  const end = parseFinnishDate(endDateStr);
  if (!start || !end) return null;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;

  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const months = diffDays / 30; // kuukausiksi muunnettuna, voi olla desimaalinen
  return months > 0 ? months : null;
};

export const useProfile = () => {
  const [showProfile, setShowProfile] = useState(false);
  const [useProfile, setUseProfile] = useState(true);
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [timeframe, setTimeframe] = useState<string>("");
  const [targetWeight, setTargetWeight] = useState<string>("");
  const [targetMuscle, setTargetMuscle] = useState<string>("");
  const [currentWeight, setCurrentWeight] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [trainingSessionsPerWeek, setTrainingSessionsPerWeek] = useState<string>("");
  const [trainingIntensity, setTrainingIntensity] = useState<TrainingIntensity | null>(null);

  const normalizeGoal = (value: unknown): UserGoal | null => {
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

  const loadProfile = async () => {
    try {
      // Lataa useProfile-tila
      const useProfileData = await AsyncStorage.getItem(STORAGE_KEYS.USE_PROFILE);
      if (useProfileData !== null) {
        setUseProfile(JSON.parse(useProfileData));
      }

      // Lataa profiilin tiedot
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (data) {
        const profile: UserProfile = JSON.parse(data);
        const normalizedGoal = normalizeGoal(profile.goal);
        if (profile.weight) setWeight(profile.weight.toString());
        if (profile.height) setHeight(profile.height.toString());
        if (normalizedGoal) setGoal(normalizedGoal);
        if (profile.timeframe) setTimeframe(profile.timeframe.toString());
        if (profile.targetWeight) setTargetWeight(profile.targetWeight.toString());
        if (profile.targetMuscle) setTargetMuscle(profile.targetMuscle.toString());
        if (profile.currentWeight) setCurrentWeight(profile.currentWeight.toString());
        if (profile.startDate) setStartDate(profile.startDate);
        if (profile.endDate) setEndDate(profile.endDate);
        if (profile.gender) setGender(profile.gender);
        if (profile.ageRange) setAgeRange(profile.ageRange);
        if (profile.trainingSessionsPerWeek != null) {
          setTrainingSessionsPerWeek(profile.trainingSessionsPerWeek.toString());
        }
        if (profile.trainingIntensity) setTrainingIntensity(profile.trainingIntensity);
      }
    } catch (err) {
      console.error("Profiilin lataaminen epäonnistui:", err);
    }
  };

  const saveProfile = async () => {
    if (!weight || !height) {
      alert("⚠️ Paino ja pituus ovat pakollisia!");
      return;
    }

    try {
      // Johda timeframe automaattisesti aloitus- ja päättymispäivästä, jos molemmat annettu
      const derivedTimeframe =
        startDate && endDate
          ? calculateTimeframeFromDates(startDate, endDate)
          : null;

      const profile: UserProfile = {
        weight: parseFloat(weight.replace(",", ".")),
        height: parseFloat(height.replace(",", ".")),
        goal: goal,
        timeframe:
          derivedTimeframe !== null
            ? derivedTimeframe
            : timeframe
            ? parseFloat(timeframe.replace(",", "."))
            : null,
        targetWeight: targetWeight ? parseFloat(targetWeight.replace(",", ".")) : null,
        targetMuscle: targetMuscle ? parseFloat(targetMuscle.replace(",", ".")) : null,
        currentWeight: currentWeight ? parseFloat(currentWeight.replace(",", ".")) : null,
        startDate: startDate || null,
        endDate: endDate || null,
        gender: gender || null,
        ageRange: ageRange || null,
        trainingSessionsPerWeek: trainingSessionsPerWeek
          ? parseFloat(trainingSessionsPerWeek.replace(",", "."))
          : null,
        trainingIntensity: trainingIntensity || null,
      };

      const existingProfileFirstSetAt = await AsyncStorage.getItem(
        STORAGE_KEYS.PROFILE_FIRST_SET_AT
      );
      if (!existingProfileFirstSetAt) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.PROFILE_FIRST_SET_AT,
          Date.now().toString()
        );
      }

      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      setShowProfile(false);
    } catch (err) {
      console.error("Profiilin tallentaminen epäonnistui:", err);
    }
  };

  const toggleUseProfile = async (value: boolean) => {
    try {
      setUseProfile(value);
      await AsyncStorage.setItem(STORAGE_KEYS.USE_PROFILE, JSON.stringify(value));
    } catch (err) {
      console.error("UseProfile-tilan tallentaminen epäonnistui:", err);
    }
  };

  const derivedTimeframe =
    startDate && endDate
      ? calculateTimeframeFromDates(startDate, endDate)
      : null;

  const getProfileData = () => {
    if (!useProfile || !weight || !height) return null;

    return {
      weight: parseFloat(weight.replace(",", ".")),
      height: parseFloat(height.replace(",", ".")),
      goal: goal,
      timeframe:
        derivedTimeframe !== null
          ? derivedTimeframe
          : timeframe
          ? parseFloat(timeframe.replace(",", "."))
          : null,
      targetWeight: targetWeight ? parseFloat(targetWeight.replace(",", ".")) : null,
      targetMuscle: targetMuscle ? parseFloat(targetMuscle.replace(",", ".")) : null,
      currentWeight: currentWeight ? parseFloat(currentWeight.replace(",", ".")) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      gender: gender || null,
      ageRange: ageRange || null,
      trainingSessionsPerWeek: trainingSessionsPerWeek
        ? parseFloat(trainingSessionsPerWeek.replace(",", "."))
        : null,
      trainingIntensity: trainingIntensity || null,
    };
  };

  return {
    showProfile,
    setShowProfile,
    useProfile,
    setUseProfile,
    toggleUseProfile,
    weight,
    setWeight,
    height,
    setHeight,
    goal,
    setGoal,
    timeframe,
    setTimeframe,
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
    loadProfile,
    saveProfile,
    getProfileData,
    derivedTimeframe,
  };
};
