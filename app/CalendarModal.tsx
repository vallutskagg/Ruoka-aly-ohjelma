// app/CalendarModal.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SavedAnalysis } from "./Storage/Types";
import { addAnalysisToDate } from "./Storage/calendarStorage";
import { BACKEND_URL } from "./constants";

type Props = {
  visible: boolean;
  analysis: SavedAnalysis | null;
  onClose: () => void;
  onSaved?: () => void;
  allowManualEntry?: boolean;
  preselectedDate?: string | null;
};

type PortionMultiplier = 0.5 | 0.7 | 1 | 1.2 | 1.4;

const AI_MULTIPLIER_OPTIONS: Array<{ value: PortionMultiplier; label: string }> = [
  { value: 0.5, label: "Pieni" },
  { value: 0.7, label: "Keskipieni" },
  { value: 1, label: "Normaali" },
  { value: 1.2, label: "Keskisuuri" },
  { value: 1.4, label: "Suuri" },
];
const AI_ESTIMATE_TIMEOUT_MS = 60_000;

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
  const [showAiEstimateModal, setShowAiEstimateModal] = useState(false);
  const [aiEstimateName, setAiEstimateName] = useState("");
  const [aiEstimateDetails, setAiEstimateDetails] = useState("");
  const [aiEstimateMultiplier, setAiEstimateMultiplier] = useState<PortionMultiplier>(1);
  const [isEstimatingAi, setIsEstimatingAi] = useState(false);
  const [aiEstimateError, setAiEstimateError] = useState("");
  const aiMultiplierScrollRef = useRef<ScrollView | null>(null);
  const hasCenteredAiMultiplierRef = useRef(false);
  const [aiMultiplierViewportWidth, setAiMultiplierViewportWidth] = useState(0);
  const [aiMultiplierContentWidth, setAiMultiplierContentWidth] = useState(0);
  const [normalMultiplierChipLayout, setNormalMultiplierChipLayout] = useState<{
    x: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (showAiEstimateModal) {
      hasCenteredAiMultiplierRef.current = false;
    }
  }, [showAiEstimateModal]);

  useEffect(() => {
    if (!showAiEstimateModal) return;
    if (hasCenteredAiMultiplierRef.current) return;
    if (!normalMultiplierChipLayout || aiMultiplierViewportWidth <= 0) return;

    const rawTargetX =
      normalMultiplierChipLayout.x +
      normalMultiplierChipLayout.width / 2 -
      aiMultiplierViewportWidth / 2;
    const maxOffset = Math.max(aiMultiplierContentWidth - aiMultiplierViewportWidth, 0);
    const targetX = Math.max(0, Math.min(rawTargetX, maxOffset));

    requestAnimationFrame(() => {
      aiMultiplierScrollRef.current?.scrollTo({ x: targetX, animated: false });
    });
    hasCenteredAiMultiplierRef.current = true;
  }, [
    showAiEstimateModal,
    normalMultiplierChipLayout,
    aiMultiplierViewportWidth,
    aiMultiplierContentWidth,
  ]);

  const resetForm = () => {
    setSelectedDate(null);
    setAmount("");
    setManualName("");
    setManualCalories("");
    setShowAiEstimateModal(false);
    setAiEstimateName("");
    setAiEstimateDetails("");
    setAiEstimateMultiplier(1);
    setIsEstimatingAi(false);
    setAiEstimateError("");
  };

  const parseCalorieNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const parsePositiveCalories = (value: unknown): number | null => {
    const parsed = parseCalorieNumber(value);
    return parsed !== null && parsed > 0 ? parsed : null;
  };

  const extractCaloriesFromText = (text: unknown): number | null => {
    if (typeof text !== "string") return null;
    const normalized = text.replace(",", ".");

    const rangeMatch = normalized.match(/(\d{2,4})\s*[-–]\s*(\d{2,4})\s*kcal/i);
    if (rangeMatch) {
      const low = Number(rangeMatch[1]);
      const high = Number(rangeMatch[2]);
      if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0) {
        return Math.round((low + high) / 2);
      }
    }

    const kcalMatch = normalized.match(/(\d{2,4}(?:\.\d+)?)\s*kcal/i);
    if (kcalMatch) {
      const parsed = Number(kcalMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return null;
  };

  const getUserFriendlyAiEstimateError = (error: unknown): string => {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage.toLowerCase();

    if (
      (error instanceof Error && error.name === "AbortError") ||
      message.includes("abort") ||
      message.includes("timeout") ||
      message.includes("aikakatka")
    ) {
      return `Arvio kesti liian kauan (yli ${Math.round(
        AI_ESTIMATE_TIMEOUT_MS / 1000
      )} s). Yritä uudelleen.`;
    }

    const backendStatusMatch = rawMessage.match(/backend\s+(\d{3})/i);
    const backendStatus = backendStatusMatch ? Number(backendStatusMatch[1]) : null;

    if (
      message.includes("network request failed") ||
      message.includes("failed to fetch") ||
      message.includes("verkkoyhteys")
    ) {
      return "Yhteys palvelimeen epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.";
    }

    if (backendStatus === 429 || message.includes("rate limit")) {
      return "Palvelu on hetkellisesti ruuhkainen. Odota hetki ja yritä uudelleen.";
    }

    if (backendStatus !== null && backendStatus >= 500) {
      return "Palvelussa on hetkellinen häiriö. Yritä hetken päästä uudelleen.";
    }

    if (backendStatus === 400 || backendStatus === 422) {
      return "AI ei saanut tarpeeksi tietoa luotettavaan arvioon. Lisää annoskoko tai tarkempi kuvaus.";
    }

    if (
      message.includes("ai ei palauttanut kaloriarviota") ||
      message.includes("unable to estimate calories reliably")
    ) {
      return "AI ei saanut tarpeeksi tietoa luotettavaan arvioon. Lisää annoskoko tai tarkempi kuvaus.";
    }

    return "AI-arvio epäonnistui. Yritä uudelleen.";
  };

  const handleNormalMultiplierChipLayout = (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setNormalMultiplierChipLayout({ x, width });
  };

  const estimateManualCaloriesWithAi = async () => {
    const name = aiEstimateName.trim();
    const details = aiEstimateDetails.trim();
    const targetPortionMultiplier = aiEstimateMultiplier;
    const basePortionMultiplier: PortionMultiplier = 1;

    if (!name) {
      setAiEstimateError("Kirjoita tuotteen nimi.");
      return;
    }

    setAiEstimateError("");
    setIsEstimatingAi(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_ESTIMATE_TIMEOUT_MS);

    try {
      const promptLines = [
        `Tuote: ${name}`,
        `Valittu annoskerroin: ${targetPortionMultiplier}x`,
        "Arvioi ensin normiannoksen (1.0x) kalorit.",
        "Tunnista yleiset ruokalajit avainsanoista ja kirjoitusasuista (esim. pizza/pitsa, burger/hampurilainen).",
        "Jos syote on yleinen ruoka ilman brndia, arvioi realistinen yhden annoksen kalorimaara.",
        ...(details ? [`Lisatiedot: ${details}`] : []),
        "Palauta tarkka tuotteen nimi ja normiannoksen totalCalories.",
      ];

      type BackendRequestError = Error & { status?: number };

      const parseResponsePayload = (responseText: string) => {
        let payload: any = {};
        try {
          payload = responseText ? JSON.parse(responseText) : {};
        } catch {
          payload = {};
        }
        return payload;
      };

      const requestAnalyze = async (
        requestBody: Record<string, unknown>,
        attemptLabel: string
      ) => {
        const response = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        const responseText = await response.text();
        const payload = parseResponsePayload(responseText);

        if (!response.ok) {
          const rawError =
            (typeof payload?.error === "string" && payload.error.trim()) ||
            (typeof payload?.details === "string" && payload.details.trim()) ||
            responseText.slice(0, 260) ||
            "Tuntematon virhe";
          const backendError = new Error(
            `${attemptLabel}: Backend ${response.status}: ${rawError}`
          ) as BackendRequestError;
          backendError.status = response.status;
          throw backendError;
        }

        return payload;
      };

      const requestBodyBase: Record<string, unknown> = {
        mode: "text_estimate",
        ocrText: promptLines.join("\n"),
        mealAdjustments: {
          portionMultiplier: basePortionMultiplier,
          oilAdded: false,
          servingContext: "home",
          adjustmentPercent: 0,
          ...(details ? { mealDescription: details } : {}),
        },
        mealDescription: ["normiannos 1.0x", details]
          .filter((part) => part.length > 0)
          .join(". "),
        instructions: `
Arvioi tuotteen annoksen kalorit pelkan tekstin perusteella.
Palauta vain JSON:
{
  "name": string,
  "totalCalories": number,
  "note": string
}
Tunnistusohje:
- Tunnista myos yleiset ruoan nimet ja synonyymit: pizza/pitsa, hampurilainen/burger, pasta, salaatti, riisi, kana.
- Jos syote on yleinen ruokalaji ilman tarkkaa tuotebrndia, anna silti realistinen yhden annoksen arvio.
- Ala pyydä lisaa tietoa, vaan arvioi parhaalla oletuksella.
Annosohje:
- Palauta ANNOSKALORIT (ei per 100 g), normiannos 1.0x.
- Jos grammoja ei ole annettu, kayta tyypillista annoskokoa.
- Esimerkki: pizza -> kayta tyypillinen yhden palan annos tai pieni ravintola-annos.
Laatuohje:
- totalCalories on aina positiivinen luku (>0).
- note-kenttaan lyhyt perustelu kaytetysta oletuksesta.
Ei markdownia.
        `.trim(),
        data: {
          name,
          portionMultiplier: basePortionMultiplier,
          targetPortionMultiplier,
          details,
        },
      };

      const shouldUseImageFallback = (error: unknown) => {
        if (!(error instanceof Error)) return true;
        const status = (error as BackendRequestError).status;
        const message = error.message.toLowerCase();

        if (
          message.includes("imagebase64") ||
          message.includes("image is required") ||
          message.includes("kuva puuttuu") ||
          message.includes("kuva on pakollinen")
        ) {
          return true;
        }

        if (typeof status !== "number") return true;
        return status >= 500;
      };

      const isReliableEstimate422 = (error: unknown) => {
        if (!(error instanceof Error)) return false;
        const status = (error as BackendRequestError).status;
        if (status !== 422) return false;

        const message = error.message.toLowerCase();
        return (
          message.includes("unable to estimate calories reliably") ||
          message.includes("not enough detail for a reliable calorie estimate") ||
          message.includes("epävarma")
        );
      };

      // 1) Yritä ensin tekstipohjaisella moodilla (ei kuvan analysointia).
      let payload: any;
      try {
        payload = await requestAnalyze(requestBodyBase, "Tekstimoodi");
      } catch (primaryError) {
        if (isReliableEstimate422(primaryError)) {
          const strengthenedPromptLines = [
            ...promptLines,
            "Jos yksityiskohtia puuttuu, kayta tuotteen tavanomaista yhden annoksen oletusta.",
            "Palauta paras arvio annokselle eika ravintoarvoa per 100 g.",
            "Vastaa aina JSON:lla ja totalCalories > 0.",
          ];

          payload = await requestAnalyze(
            {
              ...requestBodyBase,
              ocrText: strengthenedPromptLines.join("\n"),
                instructions: `
Arvioi tuotteen ANNOSKALORIT tekstin perusteella.
Jos tarkat tiedot puuttuvat, kayta realistista yhden annoksen oletusta.
Palauta normiannoksen (1.0x) kalorit, ala skaalaa muulla annoskertoimella.
Palauta vain JSON:
{
  "name": string,
  "totalCalories": number,
  "note": string
}
Saannot:
- totalCalories on positiivinen kokonaisluku (>0)
- anna paras arvio, vaikka epävarmuutta on
- tunnista yleiset ruokalajit avainsanoista (esim. pizza/pitsa)
- jos tietoa puuttuu, kayta tyypillista annoskokoa ja anna silti arvio
- note-kenttaan lyhyt oletus (esim. annoskoko)
- ei markdownia
                `.trim(),
            },
            `Tekstimoodi varmistus (${primaryError instanceof Error ? primaryError.message : "422 low confidence"})`
          );
        } else if (!shouldUseImageFallback(primaryError)) {
          throw primaryError;
        } else {
          // 2) Fallback: backendissa voi olla imageBase64-vaatimus.
          const PLACEHOLDER_IMAGE_BASE64 =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+8ZkAAAAASUVORK5CYII=";
          payload = await requestAnalyze(
            {
              ...requestBodyBase,
              imageBase64: PLACEHOLDER_IMAGE_BASE64,
            },
            `Kuvafallback (${primaryError instanceof Error ? primaryError.message : "Tekstimoodi epäonnistui"})`
          );
        }
      }

      const estimatedName =
        (typeof payload?.name === "string" && payload.name.trim()) ||
        (typeof payload?.suggestedName === "string" && payload.suggestedName.trim()) ||
        (Array.isArray(payload?.products) &&
        payload.products[0] &&
        typeof payload.products[0].name === "string" &&
        payload.products[0].name.trim()
          ? payload.products[0].name.trim()
          : "") ||
        name;

      let estimatedCalories =
        parsePositiveCalories(payload?.totalCalories) ??
        parsePositiveCalories(payload?.products?.[0]?.calories) ??
        extractCaloriesFromText(payload?.result);

      if (estimatedCalories === null) {
        throw new Error(
          "AI ei palauttanut kaloriarviota. Lisaa lisatietoihin annoskoko (g), valmistustapa tai tarkempi tuote."
        );
      }

      setManualName(estimatedName);
      const scaledCalories = Math.max(
        0,
        Math.round(estimatedCalories * targetPortionMultiplier)
      );
      setManualCalories(scaledCalories.toString());
      setShowAiEstimateModal(false);
      setAiEstimateError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tuntematon virhe";
      console.error("[FoodScan] Manual AI estimate failed:", message);
      setAiEstimateError(getUserFriendlyAiEstimateError(error));
    } finally {
      clearTimeout(timeoutId);
      setIsEstimatingAi(false);
    }
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

        {(selectedDate || preselectedDate) && allowManualEntry && !analysis && (
          <Pressable
            style={[styles.closeButton, styles.aiEstimateButton]}
            onPress={() => {
              setAiEstimateError("");
              setShowAiEstimateModal(true);
            }}
          >
            <Text style={styles.aiEstimateCtaText}>Arvio AI:n avulla</Text>
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

      <Modal
        visible={showAiEstimateModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={false}
      >
        <View style={styles.aiModalBackdrop}>
          <View style={styles.aiModalCard}>
            <Text style={styles.aiModalTitle}>Arvio AI:n avulla</Text>

            <Text style={styles.inputLabel}>Tuotteen nimi</Text>
            <TextInput
              placeholder="Esim. Kanasalaatti"
              placeholderTextColor="#777"
              value={aiEstimateName}
              onChangeText={setAiEstimateName}
              style={styles.input}
              editable={!isEstimatingAi}
            />

            <Text style={styles.inputLabel}>Annoskerroin</Text>
            <ScrollView
              ref={aiMultiplierScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.aiMultiplierRow}
              contentContainerStyle={styles.aiMultiplierRowContent}
              onLayout={(event) =>
                setAiMultiplierViewportWidth(event.nativeEvent.layout.width)
              }
              onContentSizeChange={(width) => setAiMultiplierContentWidth(width)}
            >
              {AI_MULTIPLIER_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.aiMultiplierChip,
                    aiEstimateMultiplier === option.value && styles.aiMultiplierChipActive,
                  ]}
                  onPress={() => setAiEstimateMultiplier(option.value)}
                  disabled={isEstimatingAi}
                  onLayout={
                    option.value === 1 ? handleNormalMultiplierChipLayout : undefined
                  }
                >
                  <Text style={styles.aiMultiplierChipText}>
                    {option.label} ({option.value.toFixed(1)}×)
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Lisätiedot (valinnainen)</Text>
            <TextInput
              placeholder="Esim. sisältää kastiketta ja pähkinöitä"
              placeholderTextColor="#777"
              value={aiEstimateDetails}
              onChangeText={setAiEstimateDetails}
              style={styles.input}
              editable={!isEstimatingAi}
              multiline
              maxLength={180}
            />

            {aiEstimateError ? (
              <Text style={styles.aiErrorText}>{aiEstimateError}</Text>
            ) : null}

            <Pressable
              style={[styles.closeButton, styles.aiEstimateRunButton]}
              onPress={estimateManualCaloriesWithAi}
              disabled={isEstimatingAi}
            >
              <Text style={styles.aiEstimateButtonText}>
                {isEstimatingAi ? "Arvioidaan..." : "Arvioi"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.closeButton}
              onPress={() => {
                if (isEstimatingAi) return;
                setShowAiEstimateModal(false);
              }}
            >
              <Text style={{ color: "white" }}>Sulje</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  aiEstimateButton: {
    backgroundColor: "#1e3a8a",
    borderColor: "#2563eb",
    borderWidth: 1,
  },
  aiEstimateButtonText: {
    color: "white",
    fontWeight: "700",
  },
  aiEstimateCtaText: {
    color: "#e2e8f0",
    fontWeight: "700",
  },
  aiModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  aiModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1f1f1f",
    borderRadius: 14,
    padding: 18,
  },
  aiModalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  aiMultiplierRow: {
    marginBottom: 12,
  },
  aiMultiplierRowContent: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  aiMultiplierChip: {
    backgroundColor: "#2a2a2a",
    borderColor: "#3f3f46",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  aiMultiplierChipActive: {
    backgroundColor: "#1e3a8a",
    borderColor: "#60a5fa",
  },
  aiMultiplierChipText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
  aiEstimateRunButton: {
    backgroundColor: "#2d5a3d",
  },
  aiErrorText: {
    color: "#fca5a5",
    marginTop: 4,
    marginBottom: 2,
  },
});
