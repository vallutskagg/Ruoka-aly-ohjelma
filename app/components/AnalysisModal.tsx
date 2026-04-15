// app/components/AnalysisModal.tsx
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserGoal } from "../types";

type Props = {
  visible: boolean;
  analysisText: string;
  isFromSaved: boolean;
  useProfile: boolean;
  goal: UserGoal | null;
  addedToCalendar?: boolean;
  addedToIngredients?: boolean;
  onClose: () => void;
  onSave: () => void;
  canSaveIngredients?: boolean;
  onSaveIngredients?: () => void;
  onAddToCalendar: () => void;
  onBack?: () => void;
};

export default function AnalysisModal({
  visible,
  analysisText,
  isFromSaved,
  useProfile,
  goal,
  addedToCalendar = false,
  addedToIngredients = false,
  onClose,
  onSave,
  canSaveIngredients = false,
  onSaveIngredients,
  onAddToCalendar,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const getTitle = () => {
    if (useProfile && goal === "laihdutus") return "📉 Laihdutus analyysi";
    if (useProfile && goal === "yll\u00E4pito") return "➡️ Ylläpito analyysi";
    if (useProfile && goal === "lihasmassa") return "💪 Lihasmassa analyysi";
    return "📊 Analyysi";
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={false}
      navigationBarTranslucent={false}
    >
      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(16, insets.bottom + 10) },
        ]}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: 40,
            paddingBottom: Math.max(40, insets.bottom + 20),
          }}
        >
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.text}>{analysisText}</Text>
        </ScrollView>

        {isFromSaved ? (
          <Pressable style={styles.button} onPress={onBack || onClose}>
            <Text style={{ color: "white" }}>← Takaisin</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.button} onPress={onClose}>
              <Text style={{ color: "white" }}>📷 Kameraan</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={onSave}>
              <Text style={{ color: "white" }}>💾 Tallenna analyyseihin</Text>
            </Pressable>
            {!isFromSaved && canSaveIngredients && onSaveIngredients && (
              <Pressable
                style={[styles.button, addedToIngredients && styles.buttonSuccess]}
                onPress={onSaveIngredients}
              >
                <Text style={{ color: "white" }}>
                  {addedToIngredients ? "✅ Lisätty ainesosiin" : "🥪 Lisää ainesosiin"}
                </Text>
              </Pressable>
            )}
          </>
        )}

        <Pressable
          style={[styles.button, addedToCalendar && styles.buttonSuccess]}
          onPress={onAddToCalendar}
        >
          <Text style={{ color: "white" }}>
            {addedToCalendar ? "✅ Lisätty kalenteriin" : "📅 Lisää kalenteriin"}
          </Text>
        </Pressable>

        {isFromSaved && canSaveIngredients && onSaveIngredients && (
          <Pressable
            style={[styles.button, addedToIngredients && styles.buttonSuccess]}
            onPress={onSaveIngredients}
          >
            <Text style={{ color: "white" }}>
              {addedToIngredients ? "✅ Lisätty ainesosiin" : "🥪 Lisää ainesosiin"}
            </Text>
          </Pressable>
        )}
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
  text: {
    color: "white",
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 12,
    alignItems: "center",
  },
  buttonSuccess: {
    backgroundColor: "#2d5a3d",
  },
});
