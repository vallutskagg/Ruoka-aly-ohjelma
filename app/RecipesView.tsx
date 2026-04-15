import { Ionicons } from "@expo/vector-icons";
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
import CalendarModal from "./CalendarModal";
import { SavedAnalysis, StoredIngredient } from "./Storage/Types";

interface RecipesViewProps {
  visible: boolean;
  onClose: () => void;
  analyses: SavedAnalysis[];
  onUpdateAnalyses: (items: SavedAnalysis[]) => void;
  ingredients: StoredIngredient[];
  onUpdateIngredients: (items: StoredIngredient[]) => void;
}

export default function RecipesView({
  visible,
  onClose,
  analyses,
  onUpdateAnalyses,
  ingredients,
  onUpdateIngredients,
}: RecipesViewProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [pendingItems, setPendingItems] = useState<
    { ingredient: StoredIngredient; grams: number }[]
  >([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTarget, setAddTarget] = useState<StoredIngredient | null>(null);
  const [addGramsText, setAddGramsText] = useState("");
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoredIngredient | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [newRecipeServingsText, setNewRecipeServingsText] = useState("");
  const [showPortionSavedToast, setShowPortionSavedToast] = useState(false);

  const recipes = useMemo(
    () =>
      analyses.filter(
        (a) => a.isRecipe && a.name.toLowerCase().includes(search.toLowerCase())
      ),
    [analyses, search]
  );

  const filteredIngredients = useMemo(
    () =>
      ingredients.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
      ),
    [ingredients, search]
  );

  const MAX_INGREDIENTS_VISIBLE = 3;
  const MAX_RECIPES_VISIBLE = 4;

  const visibleIngredients = useMemo(
    () =>
      search.trim()
        ? filteredIngredients
        : filteredIngredients.slice(0, MAX_INGREDIENTS_VISIBLE),
    [filteredIngredients, search]
  );

  const visibleRecipes = useMemo(
    () =>
      search.trim() ? recipes : recipes.slice(0, MAX_RECIPES_VISIBLE),
    [recipes, search]
  );

  const handleRemoveRecipe = (id: string) => {
    const updated = analyses.map((a) =>
      a.id === id ? { ...a, isRecipe: false } : a
    );
    onUpdateAnalyses(updated);
  };

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedId) || null,
    [recipes, selectedId]
  );

  const handleOpenAddIngredient = (item: StoredIngredient) => {
    setAddTarget(item);
    setAddGramsText("");
    setAddModalVisible(true);
  };

  const handleConfirmAddIngredient = () => {
    if (!addTarget) return;
    const grams = parseFloat(addGramsText.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) return;

    setPendingItems((prev) => {
      const existingIndex = prev.findIndex(
        (p) => p.ingredient.id === addTarget.id
      );
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = { ingredient: addTarget, grams };
        return copy;
      }
      return [...prev, { ingredient: addTarget, grams }];
    });

    setAddModalVisible(false);
    setAddTarget(null);
  };

  const handleRemovePending = (id: string) => {
    setPendingItems((prev) => prev.filter((p) => p.ingredient.id !== id));
  };

  const handleOpenDeleteIngredient = (item: StoredIngredient) => {
    setDeleteTarget(item);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteIngredient = () => {
    if (!deleteTarget) return;
    const ingredientId = deleteTarget.id;
    onUpdateIngredients(ingredients.filter((i) => i.id !== ingredientId));
    setPendingItems((prev) => prev.filter((p) => p.ingredient.id !== ingredientId));
    if (addTarget?.id === ingredientId) {
      setAddModalVisible(false);
      setAddTarget(null);
      setAddGramsText("");
    }
    setDeleteModalVisible(false);
    setDeleteTarget(null);
  };

  const handleCreateRecipe = () => {
    if (pendingItems.length === 0) return;
    setCreateModalVisible(true);
  };

  const handleConfirmCreateRecipe = () => {
    if (pendingItems.length === 0) return;
    const name = newRecipeName.trim();
    if (!name) return;

    const servings = parseInt(newRecipeServingsText, 10);
    const validServings = Number.isFinite(servings) && servings > 0 ? servings : 1;

    let totalCalories = 0;
    let totalCarbs = 0;
    let totalSugar = 0;
    let totalProtein = 0;
    let totalFat = 0;

    const recipeIngredients = pendingItems.map(({ ingredient, grams }) => {
      const factor = grams / 100;
      const calories = (ingredient.calories || 0) * factor;
      const carbs = (ingredient.carbs || 0) * factor;
      const sugar = (ingredient.sugar || 0) * factor;
      const protein = (ingredient.protein || 0) * factor;
      const fat = (ingredient.fat || 0) * factor;

      totalCalories += calories;
      totalCarbs += carbs;
      totalSugar += sugar;
      totalProtein += protein;
      totalFat += fat;

      return {
        name: ingredient.name,
        grams,
        calories,
        carbs,
        sugar,
        protein,
        fat,
      };
    });

    const perServingCalories = totalCalories / validServings;
    const perServingCarbs = totalCarbs / validServings;
    const perServingSugar = totalSugar / validServings;
    const perServingProtein = totalProtein / validServings;
    const perServingFat = totalFat / validServings;

    const newRecipe: SavedAnalysis = {
      id: Date.now().toString(),
      name,
      text: `🟢 Resepti: ${name}`,
      level: "🟢",
      favorite: false,
      usedProfile: false,
      isRecipe: true,
      servings: validServings,
      recipeIngredients,
      products: [
        {
          name,
          calories: perServingCalories,
          carbs: perServingCarbs,
          sugar: perServingSugar,
          protein: perServingProtein,
          fat: perServingFat,
        },
      ],
      totalCalories: perServingCalories,
    };

    onUpdateAnalyses([newRecipe, ...analyses]);

    setPendingItems([]);
    setCreateModalVisible(false);
    setNewRecipeName("");
    setNewRecipeServingsText("4");
  };

  const handleClose = () => {
    setSearch("");
    setSelectedId(null);
    setShowCalendar(false);
    setPendingItems([]);
    setAddModalVisible(false);
    setAddTarget(null);
    setAddGramsText("");
    setDeleteModalVisible(false);
    setDeleteTarget(null);
    setCreateModalVisible(false);
    setNewRecipeName("");
    setNewRecipeServingsText("");
    setShowPortionSavedToast(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={false}
      statusBarTranslucent={false}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.title}>📖 Reseptit</Text>
          <View style={{ width: 24 }} />
        </View>

        <TextInput
          placeholder="Hae reseptiä tai ainesosaa…"
          placeholderTextColor="#777"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />

        <ScrollView>
          <Text style={styles.sectionTitle}>🥪 Tallennetut ainesosat</Text>
          {filteredIngredients.length === 0 && (
            <Text style={styles.emptyText}>
              Ei vielä ainesosia. Tallenna ainesosia OCR-analyysistä.
            </Text>
          )}
          {visibleIngredients.map((ing) => (
            <View key={ing.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{ing.name}</Text>
                <Text style={styles.subText}>
                  {Math.round(ing.calories)} kcal / 100 g
                </Text>
              </View>
              <View style={styles.ingredientActions}>
                <Pressable
                  style={styles.ingredientButton}
                  onPress={() => handleOpenAddIngredient(ing)}
                >
                  <Text style={styles.ingredientButtonText}>➕</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => handleOpenDeleteIngredient(ing)}
                >
                  <Text style={styles.secondaryButtonText}>Poista</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {pendingItems.length > 0 && (
            <View style={styles.pendingBox}>
              <Text style={styles.detailTitle}>Uusi resepti – valitut ainesosat</Text>
              {pendingItems.map(({ ingredient, grams }) => (
                <View key={ingredient.id} style={styles.pendingRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      style={styles.detailText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      • {ingredient.name} – {grams} g
                    </Text>
                  </View>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => handleRemovePending(ingredient.id)}
                  >
                    <Text style={styles.secondaryButtonText}>Poista</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={[styles.primaryButton, { marginTop: 8 }]}
                onPress={handleCreateRecipe}
              >
                <Text style={styles.primaryButtonText}>Luo uusi resepti</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionTitle}>📖 Tallennetut reseptit</Text>
          {recipes.length === 0 && (
            <Text style={styles.emptyText}>
              Ei vielä reseptejä. Luo resepti OCR-analyysin jälkeen.
            </Text>
          )}
          {visibleRecipes.map((r) => (
            <Pressable
              key={r.id}
              style={styles.row}
              onPress={() =>
                setSelectedId((current) => (current === r.id ? null : r.id))
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                {typeof r.totalCalories === "number" && (
                  <Text style={styles.subText}>{Math.round(r.totalCalories)} kcal / annos</Text>
                )}
              </View>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => handleRemoveRecipe(r.id)}
              >
                <Text style={styles.secondaryButtonText}>Poista resepti</Text>
              </Pressable>
            </Pressable>
          ))}
          {selectedRecipe && (
            <View style={styles.detailBox}>
              <Text style={styles.detailTitle}>{selectedRecipe.name}</Text>
              {typeof selectedRecipe.servings === "number" && (
                <Text style={styles.detailText}>
                  Annoksia yhteensä: {selectedRecipe.servings}
                </Text>
              )}
              {selectedRecipe.products && selectedRecipe.products[0] && (
                <>
                  <Text style={styles.detailText}>
                    🔥 {Math.round(selectedRecipe.products[0].calories)} kcal / annos
                  </Text>
                  {typeof selectedRecipe.products[0].carbs === "number" && (
                    <Text style={styles.detailText}>
                      🍞 Hiilarit: {Math.round(selectedRecipe.products[0].carbs)} g
                    </Text>
                  )}
                  {typeof selectedRecipe.products[0].sugar === "number" && (
                    <Text style={styles.detailText}>
                      🍬 Sokerit: {Math.round(selectedRecipe.products[0].sugar)} g
                    </Text>
                  )}
                  {typeof selectedRecipe.products[0].protein === "number" && (
                    <Text style={styles.detailText}>
                      🍗 Proteiini: {Math.round(selectedRecipe.products[0].protein)} g
                    </Text>
                  )}
                  {typeof selectedRecipe.products[0].fat === "number" && (
                    <Text style={styles.detailText}>
                      🥑 Rasva: {Math.round(selectedRecipe.products[0].fat)} g
                    </Text>
                  )}
                </>
              )}

              {selectedRecipe.recipeIngredients &&
                selectedRecipe.recipeIngredients.length > 0 && (
                  <>
                    <Text style={styles.detailSubTitle}>Ainesosat</Text>
                    {selectedRecipe.recipeIngredients.map((ing, i) => (
                      <Text key={i} style={styles.detailText}>
                        • {ing.name} – {ing.grams} g
                      </Text>
                    ))}
                  </>
                )}

              <Pressable
                style={styles.primaryButton}
                onPress={() => setShowCalendar(true)}
              >
                <Text style={styles.primaryButtonText}>📅 Tallenna annos kalenteriin</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <CalendarModal
          visible={showCalendar}
          analysis={
            selectedRecipe && selectedRecipe.products && selectedRecipe.products[0]
              ? {
                  ...selectedRecipe,
                  products: selectedRecipe.products,
                }
              : null
          }
          isImageAnalysis={true}
          onClose={() => setShowCalendar(false)}
          onSaved={() => {
            setShowCalendar(false);
            setShowPortionSavedToast(true);
          }}
        />

        {/* Ainesosan lisäys reseptiin */}
        <Modal
          visible={addModalVisible}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Lisää ainesosa reseptiin</Text>
              {addTarget && (
                <Text style={styles.modalText}>{addTarget.name}</Text>
              )}
              <TextInput
                placeholder="Määrä g / ml (esim. 150)"
                placeholderTextColor="#777"
                value={addGramsText}
                onChangeText={setAddGramsText}
                keyboardType="numeric"
                style={styles.modalInput}
              />
              <View style={styles.modalButtonsRow}>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }]}
                  onPress={handleConfirmAddIngredient}
                >
                  <Text style={styles.primaryButtonText}>Lisää</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, { flex: 1 }]}
                  onPress={() => {
                    setAddModalVisible(false);
                    setAddTarget(null);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Peruuta</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Ainesosan poiston vahvistus */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Poista ainesosa?</Text>
              {deleteTarget && (
                <Text style={styles.modalText}>{deleteTarget.name}</Text>
              )}
              <Text style={styles.modalHint}>
                Ainesosa poistetaan tallennetuista ainesosista.
              </Text>
              <View style={styles.modalButtonsRow}>
                <Pressable
                  style={[styles.secondaryButton, { flex: 1 }]}
                  onPress={handleConfirmDeleteIngredient}
                >
                  <Text style={styles.secondaryButtonText}>Poista</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }]}
                  onPress={() => {
                    setDeleteModalVisible(false);
                    setDeleteTarget(null);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Peruuta</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Uuden reseptin luonti */}
        <Modal
          visible={createModalVisible}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Luo uusi resepti</Text>
              <TextInput
                placeholder="Reseptin nimi"
                placeholderTextColor="#777"
                value={newRecipeName}
                onChangeText={setNewRecipeName}
                style={styles.searchInput}
              />
              <TextInput
                placeholder="Annosmäärä (esim. 4)"
                placeholderTextColor="#777"
                value={newRecipeServingsText}
                onChangeText={setNewRecipeServingsText}
                keyboardType="numeric"
                style={styles.searchInput}
              />
              <View style={styles.modalButtonsRow}>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }]}
                  onPress={handleConfirmCreateRecipe}
                >
                  <Text style={styles.primaryButtonText}>Tallenna resepti</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, { flex: 1 }]}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={styles.secondaryButtonText}>Peruuta</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Annos tallennettu -kuittaus */}
        <Modal transparent visible={showPortionSavedToast} animationType="fade">
          <View style={styles.toastOverlay}>
            <View style={styles.toastBox}>
              <Text style={{ color: "white", marginBottom: 16 }}>
                ✅ Annos tallennettu kalenteriin
              </Text>
              <Pressable
                style={styles.toastActionButton}
                onPress={() => setShowPortionSavedToast(false)}
              >
                <Text style={{ color: "white" }}>OK</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 40,
  },
  backButton: {
    padding: 4,
    marginBottom: 4,
  },
  modalHint: {
    color: "white",
    fontSize: 12,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#2a2a2a",
    color: "white",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  searchInput: {
    backgroundColor: "#333",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#999",
    fontSize: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#333",
    gap: 8,
  },
  name: {
    color: "white",
    fontSize: 16,
  },
  subText: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 2,
  },
  ingredientButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  ingredientActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ingredientButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#2d5a3d",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 12,
  },
  secondaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#552222",
  },
  secondaryButtonText: {
    color: "white",
    fontSize: 12,
  },
  detailBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#222",
    borderRadius: 12,
  },
  detailTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  detailSubTitle: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
  },
  detailText: {
    color: "#e5e5e5",
    fontSize: 14,
    marginBottom: 4,
  },
  pendingBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#222",
    borderRadius: 12,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#2a2a2a",
    padding: 20,
    borderRadius: 12,
    width: "85%",
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    marginBottom: 12,
  },
  modalText: {
    color: "white",
    fontSize: 14,
    marginBottom: 8,
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
  toastActionButton: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 12,
    alignItems: "center",
  },
});


