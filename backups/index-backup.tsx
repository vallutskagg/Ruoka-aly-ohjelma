import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import CalendarModal from "./CalendarModal";
import CalendarView from "./CalendarView";
import { SavedAnalysis } from "./Storage/Types";


/* ================= TYPES ================= */
type HealthLevel = "🟢" | "🟡" | "🔴";
type FilterType = HealthLevel | "ALL" | "FAVORITES";

type UserGoal = "laihdutus" | "ylläpito" | "lihasmassa";

type UserProfile = {
  weight: number | null; // kg
  height: number | null; // cm
  goal: UserGoal | null; // tavoite
  timeframe: number | null; // kuukautta
  targetWeight: number | null; // tavoitepaino (laihdutus)
  targetMuscle: number | null; // tavoite lihasmassa (kg)
  startDate: string | null; // alkamispvm (dd.mm.yyyy)
  endDate: string | null; // päättymispvm (dd.mm.yyyy)
};

/* ================= APP ================= */
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const lastTapRef = useRef<number>(0); // ✅ Double-tap handler

  const [facing, setFacing] = useState<CameraType>("back");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const [filter, setFilter] = useState<FilterType>("ALL");
  const [showFilterBox, setShowFilterBox] = useState(false);
  const [showAnalysisTypeFilterBox, setShowAnalysisTypeFilterBox] = useState(false);
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState<"basic" | "profile" | "all">("all");

  const [pendingSave, setPendingSave] = useState(false);
  const [analysisName, setAnalysisName] = useState("");
  const [search, setSearch] = useState("");

  const [isFromSaved, setIsFromSaved] = useState(false); // ✅ uusi: modalin lähde

  // 📅 CALENDAR STATE
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [analysisProducts, setAnalysisProducts] = useState<
    { name: string; calories: number }[]
  >([]);
  const [analysisCalories, setAnalysisCalories] = useState<number | null>(null);

  // 👤 PROFIILI
  const [showProfile, setShowProfile] = useState(false);
  const [useProfile, setUseProfile] = useState(true); // ✅ Profiili käytössä/poissa
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [timeframe, setTimeframe] = useState<string>("");
  // 🎯 TAVOITTEET
  const [targetWeight, setTargetWeight] = useState<string>("");
  const [targetMuscle, setTargetMuscle] = useState<string>("");
  // 📅 PÄIVÄMÄÄRÄT
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const GOOGLE_VISION_API_KEY = "AIzaSyBCfL2A8y46rTNLY7nPlQcigyDY0kZna3s";
  const BACKEND_URL = "https://food-scan-backend.onrender.com/analyze";

  useEffect(() => {
    loadSavedAnalyses();
    loadProfile();
  }, []);

  /* ================= PROFILE STORAGE ================= */
  const loadProfile = async () => {
    try {
      const data = await AsyncStorage.getItem("userProfile");
      if (data) {
        const profile: UserProfile = JSON.parse(data);
        if (profile.weight) setWeight(profile.weight.toString());
        if (profile.height) setHeight(profile.height.toString());
        if (profile.goal) setGoal(profile.goal);
        if (profile.timeframe) setTimeframe(profile.timeframe.toString());
        if (profile.targetWeight) setTargetWeight(profile.targetWeight.toString());
        if (profile.targetMuscle) setTargetMuscle(profile.targetMuscle.toString());
        if (profile.startDate) setStartDate(profile.startDate);
        if (profile.endDate) setEndDate(profile.endDate);
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
      const profile: UserProfile = {
        weight: parseFloat(weight),
        height: parseFloat(height),
        goal: goal,
        timeframe: timeframe ? parseFloat(timeframe) : null,
        targetWeight: targetWeight ? parseFloat(targetWeight) : null,
        targetMuscle: targetMuscle ? parseFloat(targetMuscle) : null,
        startDate: startDate || null,
        endDate: endDate || null,
      };

      await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
      setShowProfile(false);
    } catch (err) {
      console.error("Profiilin tallentaminen epäonnistui:", err);
    }
  };

  /* ================= STORAGE ================= */
  const loadSavedAnalyses = async () => {
    const data = await AsyncStorage.getItem("analyses");
    if (data) setSavedAnalyses(JSON.parse(data));
  };

  const saveToStorage = async (items: SavedAnalysis[]) => {
    setSavedAnalyses(items);
    await AsyncStorage.setItem("analyses", JSON.stringify(items));
  };

  const getLevelFromText = (text: string): HealthLevel => {
    if (text.includes("🟢")) return "🟢";
    if (text.includes("🟡")) return "🟡";
    return "🔴";
  };

  const toggleFavorite = async (id: string) => {
    const updated = savedAnalyses.map(a =>
      a.id === id ? { ...a, favorite: !a.favorite } : a
    );
    await saveToStorage(updated);
  };

  const deleteOne = async (id: string) => {
    await saveToStorage(savedAnalyses.filter(a => a.id !== id));
  };

  const deleteAll = async () => {
    await saveToStorage([]);
  };

  const filteredAnalyses = savedAnalyses
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    .filter(a => {
      if (filter === "ALL") return true;
      if (filter === "FAVORITES") return a.favorite;
      return a.level === filter;
    });

  const openSavedAnalysis = (item: SavedAnalysis) => {
    setAnalysisText(item.text);
    setIsFromSaved(true); // ❗ näytetään modal vain sulje-napilla
    setShowSaved(false);
  };

  /* ================= PERMISSIONS ================= */
  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ color: "white" }}>Pyydetään kameran lupaa</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={{ color: "white" }}>Myönnä lupa</Text>
        </Pressable>
      </View>
    );
  }

  /* ================= OCR ================= */
  const performOCRAndAnalysis = async (photoUri: string) => {
    try {
      setIsLoading(true);

      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: "base64",
      });

      const ocrResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
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
        }
      );

      const ocrData = await ocrResponse.json();
      const text = ocrData.responses?.[0]?.fullTextAnnotation?.text || "";

      // 📤 Lähetetään OCR-teksti + profiilitiedot (jos käytössä) backendille
      const requestBody: any = { ocrText: text };

      if (useProfile && weight && height) {
        requestBody.profile = {
          weight: parseFloat(weight),
          height: parseFloat(height),
          goal: goal,
          timeframe: timeframe ? parseFloat(timeframe) : null,
          targetWeight: targetWeight ? parseFloat(targetWeight) : null,
          targetMuscle: targetMuscle ? parseFloat(targetMuscle) : null,
          startDate: startDate || null,
          endDate: endDate || null,
        };
      }

      const backendResponse = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const backendData = await backendResponse.json();
      setAnalysisText(backendData.result ?? "Ei analyysiä");
      setAnalysisProducts(backendData.products ?? []);
      setAnalysisCalories(backendData.totalCalories ?? null);
      setIsFromSaved(false); // ✅ modal on uusi analyysi
    } catch {
      setAnalysisText("❌ Analyysi epäonnistui");
      setIsFromSaved(false);
    } finally {
      setIsLoading(false);
    }
  };

  /* ================= UI ================= */
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Tuplaklikkaus havaittu
      setFacing(facing === "back" ? "front" : "back");
    }
    lastTapRef.current = now;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      {/* Tuplaklikkaus kameran näkymään */}
      <Pressable style={{ flex: 1 }} onPress={handleDoubleTap}>
        <CameraView 
          ref={cameraRef} 
          style={{ flex: 1 }} 
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
        />
      </Pressable>

      {/* 📹 Peitä kamera kunnes se on valmis */}
      {!cameraReady && (
        <View style={styles.cameraPlaceholder}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}

      <Pressable style={styles.menuButton} onPress={() => setShowSaved(true)}>
        <Ionicons name="menu" size={28} color="white" />
      </Pressable>

      {/* 👤 Profiili-nappi - oikeassa yläkulmassa */}
      <Pressable style={styles.profileButton} onPress={() => setShowProfile(true)}>
        <Ionicons name="person-circle-outline" size={28} color="white" />
      </Pressable>

      {/* Poistettiin flipButton - käytä tuplaklikkia kameran näkymässä */}

      <Pressable
        style={styles.captureButton}
        onPress={async () => {
          if (!cameraRef.current) return;
          const photo = await cameraRef.current.takePictureAsync();
          await cameraRef.current.pausePreview();
          await performOCRAndAnalysis(photo.uri);
          await cameraRef.current.resumePreview();
        }}
      />

      {/* 🌫️ Loading */}
      {isLoading && (
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.blurContent}>
            <ActivityIndicator size="large" color="white" />
            <Text style={{ color: "white", marginTop: 12 }}>
              Analysoidaan…
            </Text>
          </View>
        </BlurView>
      )}

      {/* 📊 ANALYYSI MODAL */}
      <Modal visible={!!analysisText} animationType="slide">
        <View style={styles.analysisContainer}>
          <ScrollView contentContainerStyle={{ paddingTop: 40, paddingBottom: 40 }}>
            <Text style={styles.analysisTitle}>
              {useProfile && goal === "laihdutus"
                ? "📉 Laihdutus analyysi"
                : useProfile && goal === "ylläpito"
                ? "➡️ Ylläpito analyysi"
                : useProfile && goal === "lihasmassa"
                ? "💪 Lihasmassa analyysi"
                : "📊 Analyysi"}
            </Text>
            <Text style={styles.analysisText}>{analysisText}</Text>
          </ScrollView>

          <Pressable
            style={styles.actionButton}
            onPress={() => {
              setAnalysisText(null);
              setIsFromSaved(false); // reset
            }}
          >
            <Text style={{ color: "white" }}>Sulje</Text>
          </Pressable>

          {/* ❌ Tallenna-nappi vain uusille analyyseille */}
          {!isFromSaved && (
            <>
              <Pressable
                style={styles.actionButton}
                onPress={() => setPendingSave(true)}
              >
                <Text style={{ color: "white" }}>💾 Tallenna</Text>
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={() => setShowCalendar(true)}
              >
                <Text style={{ color: "white" }}>📅 Lisää kalenteriin</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>

      {/* ✏️ NIMEÄ ANALYYSI */}
      <Modal transparent visible={pendingSave} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.nameBox}>
            <Text style={styles.nameTitle}>Nimeä analyysi</Text>

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
                }}
              >
                <Text style={{ color: "white" }}>Peruuta</Text>
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={async () => {
                  if (!analysisName.trim() || !analysisText) return;

                  const newItem: SavedAnalysis = {
                    id: Date.now().toString(),
                    name: analysisName.trim(),
                    text: analysisText,
                    level: getLevelFromText(analysisText),
                    favorite: false,
                    usedProfile: useProfile && weight && height ? true : false,
                    products: analysisProducts,
                    totalCalories: analysisCalories ?? undefined,
                  };

                  await saveToStorage([newItem, ...savedAnalyses]);

                  setPendingSave(false);
                  setAnalysisText(null);
                  setAnalysisName("");
                  setIsFromSaved(false);
                  setShowSavedToast(true);
                }}
              >
                <Text style={{ color: "white" }}>Tallenna</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📁 TALLENNETUT */}
      <Modal visible={showSaved} animationType="slide">
        <View style={styles.analysisContainer}>
          <View style={styles.savedHeader}>
            <Pressable
              style={styles.filterBox}
              onPress={() => setShowAnalysisTypeFilterBox(!showAnalysisTypeFilterBox)}
            >
              <Text style={{ color: "white" }}>
                {analysisTypeFilter === "basic"
                  ? "📊 Perusanalyysit"
                  : analysisTypeFilter === "profile"
                  ? "👤 Profiilinanalyysit"
                  : "Analyysit"} ▾
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
                  ? "⭐ Suosikit"
                  : filter} ▾
              </Text>
            </Pressable>
          </View>

          <TextInput
            placeholder="Hae analyysiä…"
            placeholderTextColor="#777"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          {showAnalysisTypeFilterBox && (
            <View style={styles.filterDropdown}>
              {[
                { key: "all", label: "Analyysit" },
                { key: "basic", label: "📊 Perusanalyysit" },
                { key: "profile", label: "👤 Profiilinanalyysit" },
              ].map(f => (
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
            <View style={styles.filterDropdown}>
              {[
                { key: "ALL", label: "Valitse" },
                { key: "FAVORITES", label: "⭐ Suosikit" },
                { key: "🟢", label: "🟢 Terveellinen" },
                { key: "🟡", label: "🟡 Kohtalainen" },
                { key: "🔴", label: "🔴 Satunnainen" },
              ].map(f => (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    setFilter(f.key as FilterType);
                    setShowFilterBox(false);
                  }}
                >
                  <Text style={styles.filterItem}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <ScrollView>
            {/* 📊 PERUSANALYYSIT */}
            {(analysisTypeFilter === "all" || analysisTypeFilter === "basic") && filteredAnalyses.some(a => !a.usedProfile) && (
              <>
                <Text style={styles.sectionTitle}>📊 Perusanalyysit</Text>
                {filteredAnalyses
                  .filter(a => !a.usedProfile)
                  .map(a => (
                    <View key={a.id} style={styles.savedRow}>
                      <Pressable onPress={() => toggleFavorite(a.id)}>
                        <Text style={styles.star}>{a.favorite ? "⭐" : "☆"}</Text>
                      </Pressable>

                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => openSavedAnalysis(a)}
                      >
                        <Text style={{ color: "white", fontSize: 16 }}>
                          {a.level} {a.name}
                        </Text>
                      </Pressable>

                      <Pressable onPress={() => deleteOne(a.id)}>
                        <Text style={{ color: "#ff5555", fontSize: 18 }}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
              </>
            )}

            {/* 👤 PROFIILINANALYYYSIT */}
            {(analysisTypeFilter === "all" || analysisTypeFilter === "profile") && filteredAnalyses.some(a => a.usedProfile) && (
              <>
                <Text style={styles.sectionTitle}>👤 Profiilinanalyysit</Text>
                {filteredAnalyses
                  .filter(a => a.usedProfile)
                  .map(a => (
                    <View key={a.id} style={styles.savedRow}>
                      <Pressable onPress={() => toggleFavorite(a.id)}>
                        <Text style={styles.star}>{a.favorite ? "⭐" : "☆"}</Text>
                      </Pressable>

                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => openSavedAnalysis(a)}
                      >
                        <Text style={{ color: "white", fontSize: 16 }}>
                          {a.level} {a.name}
                        </Text>
                      </Pressable>

                      <Pressable onPress={() => deleteOne(a.id)}>
                        <Text style={{ color: "#ff5555", fontSize: 18 }}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
              </>
            )}

            {filteredAnalyses.length === 0 && (
              <Text style={{ color: "#999", textAlign: "center", marginTop: 20 }}>
                Ei analyysejä
              </Text>
            )}
          </ScrollView>

          <Pressable style={styles.deleteAllButton} onPress={deleteAll}>
            <Text style={{ color: "white" }}>🗑️ Poista kaikki</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => {
              setShowSaved(false);
              setShowCalendarView(true);
            }}
          >
            <Text style={{ color: "white" }}>📅 Näytä kalenteri</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => setShowSaved(false)}
          >
            <Text style={{ color: "white" }}>Sulje</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ✅ Tallennettu */}
      <Modal transparent visible={showSavedToast} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.toastBox}>
            <Text style={{ color: "white", marginBottom: 16 }}>
              ✅ Analyysi tallennettu
            </Text>
            <Pressable
              style={styles.actionButton}
              onPress={() => setShowSavedToast(false)}
            >
              <Text style={{ color: "white" }}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 👤 PROFIILI MODAL */}
      <Modal transparent visible={showProfile} animationType="slide">
        <View style={styles.toastOverlay}>
          <View style={styles.profileBox}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.profileTitle}>👤 Terveysprofiili</Text>
                {/* 🎛️ TOGGLE - Profiili käyttöön/pois */}
                <Pressable
                  style={[
                    styles.toggleButton,
                    useProfile && styles.toggleButtonActive,
                  ]}
                  onPress={() => setUseProfile(!useProfile)}
                >
                  <Text style={styles.toggleText}>
                    {useProfile ? "🟢 Käytössä" : "⚫ Pois"}
                  </Text>
                </Pressable>
              </View>
              <Text style={{ color: "#999", marginBottom: 20, fontSize: 13 }}>
                {useProfile
                  ? "Analyysi perustuu profiiliisi"
                  : "Profiilin käyttö on pois päältä - normaali analyysi"}
              </Text>

              {/* ⚖️ PAINO - PAKOLLINEN */}
              <Text style={styles.inputLabel}>⚖️ Paino (kg) *</Text>
              <TextInput
                placeholder="esim. 75"
                placeholderTextColor="#777"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                style={styles.profileInput}
              />

              {/* 📏 PITUUS - PAKOLLINEN */}
              <Text style={styles.inputLabel}>📏 Pituus (cm) *</Text>
              <TextInput
                placeholder="esim. 180"
                placeholderTextColor="#777"
                keyboardType="decimal-pad"
                value={height}
                onChangeText={setHeight}
                style={styles.profileInput}
              />

              {/* 🎯 TAVOITE - VALINNAI NEN */}
              <Text style={styles.inputLabel}>🎯 Tavoite</Text>
              <View style={styles.buttonGroup}>
                {["laihdutus", "ylläpito", "lihasmassa"].map((g) => (
                  <Pressable
                    key={g}
                    style={[
                      styles.goalButton,
                      goal === g && styles.goalButtonActive,
                    ]}
                    onPress={() => setGoal(g as UserGoal)}
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

              {/* 🎯 TAVOITEPAINO - NÄYTETÄÄN KUN LAIHDUTUS VALITTU */}
              {goal === "laihdutus" && (
                <>
                  <Text style={styles.inputLabel}>📉 Tavoitepaino (kg)</Text>
                  <TextInput
                    placeholder="esim. 70"
                    placeholderTextColor="#777"
                    keyboardType="decimal-pad"
                    value={targetWeight}
                    onChangeText={setTargetWeight}
                    style={styles.profileInput}
                  />
                </>
              )}

              {/* 💪 TAVOITE LIHASMASSA - NÄYTETÄÄN KUN LIHASMASSA VALITTU */}
              {goal === "lihasmassa" && (
                <>
                  <Text style={styles.inputLabel}>💪 Tavoite lihasmassa (kg)</Text>
                  <TextInput
                    placeholder="esim. 75"
                    placeholderTextColor="#777"
                    keyboardType="decimal-pad"
                    value={targetMuscle}
                    onChangeText={setTargetMuscle}
                    style={styles.profileInput}
                  />
                </>
              )}

              {/* 📅 AIKAJÄNNE - NÄYTETÄÄN KUN LAIHDUTUS TAI LIHASMASSA VALITTU */}
              {(goal === "laihdutus" || goal === "lihasmassa") && (
                <>
                  <Text style={styles.inputLabel}>📅 Aikajänne</Text>
                  <Text style={{ color: "#999", fontSize: 12, marginBottom: 10 }}>
                    Muoto: pp.kk.vvvv (esim. 01.01.2026)
                  </Text>
                  
                  <Text style={styles.inputLabel}>Alkamispäivä</Text>
                  <TextInput
                    placeholder="pp.kk.vvvv"
                    placeholderTextColor="#777"
                    value={startDate}
                    onChangeText={setStartDate}
                    style={styles.profileInput}
                  />

                  <Text style={styles.inputLabel}>Päättymispäivä</Text>
                  <TextInput
                    placeholder="pp.kk.vvvv"
                    placeholderTextColor="#777"
                    value={endDate}
                    onChangeText={setEndDate}
                    style={styles.profileInput}
                  />
                </>
              )}



            </ScrollView>

            {/* NAPIT */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 20 }}>
              <Pressable
                style={styles.profileButtonCancel}
                onPress={() => setShowProfile(false)}
              >
                <Text style={{ color: "white" }}>Peruuta</Text>
              </Pressable>

              <Pressable
                style={styles.profileButtonSave}
                onPress={saveProfile}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>✅ Tallenna</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📅 KALENTERI MODAL */}
      <CalendarModal
        visible={showCalendar}
        analysis={
          analysisText
            ? {
                id: Date.now().toString(),
                name: analysisName || "Nimetön analyysi",
                text: analysisText,
                level: getLevelFromText(analysisText),
                favorite: false,
                usedProfile: useProfile,
                products: analysisProducts,
                totalCalories: analysisCalories ?? undefined,
              }
            : null
        }
        onClose={() => setShowCalendar(false)}
      />

      {/* 📆 KALENTERI NÄKYMÄ */}
      <CalendarView
        visible={showCalendarView}
        onClose={() => setShowCalendarView(false)}
      />
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  captureButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "white",
  },
  flipButton: { position: "absolute", top: 50, right: 20 },
  menuButton: { position: "absolute", top: 50, left: 20 },
  profileButton: { position: "absolute", top: 50, right: 20 },

  blurContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  analysisContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
  },
  analysisTitle: {
    color: "white",
    fontSize: 20,
    marginBottom: 16,
  },
  analysisText: {
    color: "white",
    fontSize: 16,
    lineHeight: 24,
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
  savedTitle: {
    color: "white",
    fontSize: 22,
  },
  sectionTitle: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 12,
    paddingLeft: 4,
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
  },
  filterItem: {
    color: "white",
    padding: 8,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#333",
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
    backgroundColor: "black",
  },
  permissionButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#333",
    borderRadius: 8,
  },

  // 👤 PROFIILI MODAALI STYLES
  profileBox: {
    backgroundColor: "#222",
    padding: 24,
    borderRadius: 16,
    width: "92%",
    maxHeight: "85%",
  },
  profileTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  inputLabel: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  profileInput: {
    backgroundColor: "#333",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
  goalButtonTextActive: {
    color: "#4ade80",
    fontWeight: "bold",
  },
  timeButton: {
    flex: 1,
    marginRight: 8,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#333",
    borderRadius: 8,
    alignItems: "center",
  },
  timeButtonActive: {
    backgroundColor: "#3d5a7a",
    borderWidth: 2,
    borderColor: "#4a8fd9",
  },
  timeButtonText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  timeButtonTextActive: {
    color: "#60a5fa",
    fontWeight: "bold",
  },
  frequencyButton: {
    flex: 1,
    marginRight: 8,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#333",
    borderRadius: 8,
    alignItems: "center",
  },
  frequencyButtonActive: {
    backgroundColor: "#5a3d7a",
    borderWidth: 2,
    borderColor: "#a94fd9",
  },
  frequencyButtonText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  frequencyButtonTextActive: {
    color: "#d946ef",
    fontWeight: "bold",
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  profileButtonCancel: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    backgroundColor: "#333",
    borderRadius: 8,
    alignItems: "center",
  },
  profileButtonSave: {
    flex: 1,
    padding: 12,
    backgroundColor: "#2d5a3d",
    borderRadius: 8,
    alignItems: "center",
  },

  // 🎛️ TOGGLE-NAPPI
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#555",
    borderWidth: 1,
    borderColor: "#777",
  },
  toggleButtonActive: {
    backgroundColor: "#2d5a3d",
    borderColor: "#4a9d6f",
  },
  toggleText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
}); 