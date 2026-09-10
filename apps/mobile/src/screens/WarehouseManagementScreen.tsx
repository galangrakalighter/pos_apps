import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  createWarehouseProduct,
  deleteWarehouseProduct,
  getAdminWarehouseCatalog,
  updateWarehouseProduct,
  uploadWarehouseProductImage,
  WarehouseProduct,
  WarehouseRecipe,
} from "../admin/admin-inventory-api";
import { API_URL } from "../config";
import { colors } from "../theme";
import { Session } from "../types";
import { WarehouseProductPicker } from "../components/WarehouseProductPicker";
import { rupiah } from "../data/mock";

type ProductKind = "bahan_baku" | "produk_jadi";

export function WarehouseManagementScreen({ session }: { session: Session }) {
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [tab, setTab] = useState<ProductKind>("bahan_baku");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [unit, setUnit] = useState("kilogram");
  const [recipes, setRecipes] = useState<WarehouseRecipe[]>([]);
  const [recipeIngredient, setRecipeIngredient] =
    useState<WarehouseProduct | null>(null);
  const [recipeQuantity, setRecipeQuantity] = useState("");
  const [recipeUnit, setRecipeUnit] = useState("kilogram");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const visible = useMemo(
    () => products.filter((item) => item.kind === tab),
    [products, tab],
  );
  const load = () => {
    setLoading(true);
    void getAdminWarehouseCatalog(session)
      .then(setProducts)
      .catch((error) => Alert.alert("Gagal memuat gudang", message(error)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [session.accessToken]);
  const reset = () => {
    setFormVisible(false);
    setEditingId(null);
    setName("");
    setType(tab === "produk_jadi" ? "Produk Jadi" : "");
    setStock("");
    setPrice("");
    setIsAvailable(true);
    setUnit(tab === "bahan_baku" ? "kilogram" : "pcs");
    setRecipes([]);
    setRecipeIngredient(null);
    setRecipeQuantity("");
    setRecipeUnit("kilogram");
    setImage(null);
  };
  const openCreate = () => {
    setEditingId(null);
    setName("");
    setType(tab === "produk_jadi" ? "Produk Jadi" : "");
    setStock("");
    setPrice("");
    setIsAvailable(true);
    setUnit(tab === "bahan_baku" ? "kilogram" : "pcs");
    setRecipes([]);
    setRecipeIngredient(null);
    setRecipeQuantity("");
    setRecipeUnit("kilogram");
    setImage(null);
    setFormVisible(true);
  };
  const switchTab = (kind: ProductKind) => {
    if (editingId) return;
    setEditingId(null);
    setName("");
    setType(kind === "produk_jadi" ? "Produk Jadi" : "");
    setStock("");
    setPrice("");
    setIsAvailable(true);
    setRecipes([]);
    setRecipeIngredient(null);
    setRecipeQuantity("");
    setUnit(kind === "bahan_baku" ? "kilogram" : "pcs");
    setTab(kind);
  };
  const edit = (item: WarehouseProduct) => {
    setTab(item.kind);
    setEditingId(item.id);
    setName(item.name);
    setType(item.type);
    setStock("");
    setPrice(String(Number(item.price)));
    setIsAvailable(item.isAvailable !== false);
    setUnit(item.unit || (item.kind === "bahan_baku" ? "kilogram" : "pcs"));
    setRecipes(item.recipes || []);
    setRecipeIngredient(null);
    setRecipeQuantity("");
    setImage(null);
    setFormVisible(true);
  };
  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (asset?.uri) setImage(asset);
    } catch (error) {
      Alert.alert("Gambar tidak dapat dipilih", message(error));
    }
  };
  const save = async () => {
    if (
      name.trim().length < 2 ||
      type.trim().length < 2 ||
      (tab === "bahan_baku" && !price.trim())
    )
      return Alert.alert(
        "Data belum lengkap",
        tab === "bahan_baku"
          ? "Isi nama, tipe, dan harga jual ke Mitra."
          : "Isi nama dan kategori produk jadi.",
      );
    setSaving(true);
    try {
      const savedName = name.trim();
      const input = {
        name: name.trim(),
        type: type.trim(),
        stock: 0,
        price: tab === "bahan_baku" ? String(Number(price)) : "0",
        kind: tab,
        unit: tab === "bahan_baku" ? unit : "pcs",
        isAvailable: tab === "bahan_baku" ? isAvailable : true,
        recipes:
          tab === "produk_jadi"
            ? recipes.map(
                ({ ingredientId, quantity, unit: recipeItemUnit }) => ({
                  ingredientId,
                  quantity,
                  unit: recipeItemUnit || "pcs",
                }),
              )
            : [],
      };
      const saved = editingId
        ? await updateWarehouseProduct(session, editingId, input)
        : await createWarehouseProduct(session, input);
      const productId = editingId || saved?.id;
      if (!productId) throw new Error("ID produk tidak diterima dari server");
      if (image) {
        try {
          await uploadWarehouseProductImage(session, productId, image);
        } catch (uploadError) {
          try {
            const refreshed = await getAdminWarehouseCatalog(session);
            setProducts(refreshed);
            const refreshedProduct = refreshed.find(
              (item) => item.id === productId,
            );
            if (!refreshedProduct?.imageUrl) {
              reset();
              Alert.alert(
                "Produk tersimpan, gambar belum berhasil",
                `${savedName} sudah diperbarui. Upload gambar gagal: ${message(uploadError)}`,
              );
              return;
            }
          } catch {
            reset();
            Alert.alert(
              "Produk tersimpan, gambar belum berhasil",
              `${savedName} sudah diperbarui. Silakan muat ulang halaman untuk memeriksa gambar.`,
            );
            return;
          }
        }
      }
      const refreshed = await getAdminWarehouseCatalog(session);
      setProducts(refreshed);
      reset();
      Alert.alert("Produk tersimpan", `${savedName} berhasil disimpan.`);
    } catch (error) {
      Alert.alert("Gagal menyimpan produk", message(error));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item: WarehouseProduct) => {
    try {
      await deleteWarehouseProduct(session, item.id);
      setProducts((current) =>
        current.filter((product) => product.id !== item.id),
      );
      if (editingId === item.id) reset();
    } catch (error) {
      Alert.alert("Produk tidak dapat dihapus", message(error));
    }
  };
  const confirmDelete = (item: WarehouseProduct) =>
    Alert.alert(
      "Hapus produk?",
      `${item.name} akan dihapus dari gudang pusat.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => void remove(item),
        },
      ],
    );
  const addRecipe = () => {
    const quantity = Number(recipeQuantity);
    if (!recipeIngredient || !Number.isFinite(quantity) || quantity <= 0)
      return Alert.alert(
        "Resep belum valid",
        "Pilih bahan baku dan isi jumlah kebutuhan.",
      );
    setRecipes((current) => [
      ...current.filter((item) => item.ingredientId !== recipeIngredient.id),
      {
        ingredientId: recipeIngredient.id,
        quantity,
        name: recipeIngredient.name,
        unit: recipeUnit,
      },
    ]);
    setRecipeIngredient(null);
    setRecipeQuantity("");
  };
  const selectRecipeIngredient = (item: WarehouseProduct) => {
    setRecipeIngredient(item);
    setRecipeUnit(item.unit || "pcs");
  };
  const recipeUnits =
    recipeIngredient?.unit === "gram" || recipeIngredient?.unit === "kilogram"
      ? ["gram", "kilogram"]
      : recipeIngredient?.unit === "mililiter" ||
          recipeIngredient?.unit === "liter"
        ? ["mililiter", "liter"]
        : [recipeIngredient?.unit || "pcs"];
  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <Tab
          label="Bahan Baku"
          active={tab === "bahan_baku"}
          onPress={() => switchTab("bahan_baku")}
        />
        <Tab
          label="Produk Jadi"
          active={tab === "produk_jadi"}
          onPress={() => switchTab("produk_jadi")}
        />
      </View>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.listTitle}>
            {tab === "bahan_baku" ? "Daftar bahan baku" : "Daftar produk jadi"}
          </Text>
          <Text style={styles.caption}>{visible.length} produk tersimpan</Text>
        </View>
        <Pressable onPress={openCreate} style={styles.button}>
          <Text style={styles.buttonText}>+ Tambah</Text>
        </Pressable>
      </View>
      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={reset}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.form}>
                <View style={styles.formHeader}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.title}>
                      {editingId ? "Edit" : "Tambah"}{" "}
                      {tab === "bahan_baku" ? "bahan baku" : "produk jadi"}
                    </Text>
                    <Text style={styles.caption}>
                      {tab === "bahan_baku"
                        ? "Harga tampil saat Mitra melakukan procurement."
                        : "Master produk ini dapat dipilih untuk diberikan ke Mitra."}
                    </Text>
                  </View>
                  <Pressable onPress={reset} style={styles.closeModal}>
                    <Text style={styles.closeModalText}>Tutup</Text>
                  </Pressable>
                </View>
                <View style={styles.fields}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Nama produk"
                    placeholderTextColor="#98A2B3"
                    style={[styles.input, styles.grow]}
                  />
                  {tab === "produk_jadi" && (
                    <TextInput
                      value={type}
                      onChangeText={setType}
                      placeholder="Kategori produk jadi"
                      placeholderTextColor="#98A2B3"
                      style={[styles.input, styles.grow]}
                    />
                  )}
                  {tab === "bahan_baku" && (
                    <TextInput
                      value={price ? rupiah(Number(price)) : ""}
                      onChangeText={(value) => setPrice(digits(value))}
                      keyboardType="number-pad"
                      placeholder={`Harga per ${unit}`}
                      placeholderTextColor="#98A2B3"
                      style={[styles.input, styles.priceInput]}
                    />
                  )}
                  <Pressable
                    onPress={() => void pick()}
                    style={styles.imageButton}
                  >
                    <Text style={styles.imageButtonText}>
                      {image ? "Ganti gambar" : "Pilih gambar"}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={saving}
                    onPress={() => void save()}
                    style={[styles.button, saving && { opacity: 0.5 }]}
                  >
                    <Text style={styles.buttonText}>
                      {saving
                        ? "Menyimpan..."
                        : editingId
                          ? "Simpan perubahan"
                          : "Tambah"}
                    </Text>
                  </Pressable>
                </View>
                {tab === "bahan_baku" && (
                  <>
                    <Text style={optionStyles.label}>Kategori bahan baku</Text>
                    <View style={extraStyles.unitRow}>
                      {["Bahan Baku Saus", "Tepung", "Bumbu Tabur"].map(
                        (item) => (
                          <Pressable
                            key={item}
                            onPress={() => setType(item)}
                            style={[
                              extraStyles.unitChip,
                              type === item && extraStyles.unitActive,
                            ]}
                          >
                            <Text
                              style={[
                                extraStyles.unitText,
                                type === item && extraStyles.unitActiveText,
                              ]}
                            >
                              {item}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </View>
                    <Text style={optionStyles.label}>Satuan harga</Text>
                    <View style={extraStyles.unitRow}>
                      {["kilogram", "liter"].map((item) => (
                        <Pressable
                          key={item}
                          onPress={() => setUnit(item)}
                          style={[
                            extraStyles.unitChip,
                            unit === item && extraStyles.unitActive,
                          ]}
                        >
                          <Text
                            style={[
                              extraStyles.unitText,
                              unit === item && extraStyles.unitActiveText,
                            ]}
                          >
                            {item}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={optionStyles.label}>Status ketersediaan</Text>
                    <View style={extraStyles.unitRow}>
                      {[
                        { value: true, label: "Tersedia" },
                        { value: false, label: "Tidak tersedia" },
                      ].map((item) => (
                        <Pressable
                          key={String(item.value)}
                          onPress={() => setIsAvailable(item.value)}
                          style={[
                            extraStyles.unitChip,
                            isAvailable === item.value &&
                              extraStyles.unitActive,
                          ]}
                        >
                          <Text
                            style={[
                              extraStyles.unitText,
                              isAvailable === item.value &&
                                extraStyles.unitActiveText,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                {tab === "produk_jadi" && (
                  <View style={extraStyles.recipeBox}>
                    <Text style={extraStyles.recipeTitle}>
                      Resep untuk 1 produk
                    </Text>
                    <WarehouseProductPicker
                      products={products.filter(
                        (item) => item.kind === "bahan_baku",
                      )}
                      selectedIds={recipes.map((item) => item.ingredientId)}
                      onSelect={selectRecipeIngredient}
                    />
                    {recipeIngredient && (
                      <>
                        <View style={extraStyles.recipeInput}>
                          <Text style={extraStyles.recipeName}>
                            {recipeIngredient.name}
                          </Text>
                          <TextInput
                            value={recipeQuantity}
                            onChangeText={setRecipeQuantity}
                            keyboardType="decimal-pad"
                            placeholder="Jumlah"
                            placeholderTextColor="#98A2B3"
                            style={[styles.input, styles.qty]}
                          />
                          <Pressable
                            onPress={addRecipe}
                            style={extraStyles.recipeAdd}
                          >
                            <Text style={styles.buttonText}>Tambahkan</Text>
                          </Pressable>
                        </View>
                        <View style={extraStyles.unitRow}>
                          {recipeUnits.map((item) => (
                            <Pressable
                              key={item}
                              onPress={() => setRecipeUnit(item)}
                              style={[
                                extraStyles.unitChip,
                                recipeUnit === item && extraStyles.unitActive,
                              ]}
                            >
                              <Text
                                style={[
                                  extraStyles.unitText,
                                  recipeUnit === item &&
                                    extraStyles.unitActiveText,
                                ]}
                              >
                                {item}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </>
                    )}
                    {recipes.map((item) => (
                      <View
                        key={item.ingredientId}
                        style={extraStyles.recipeRow}
                      >
                        <Text style={extraStyles.recipeName}>
                          {item.name || "Bahan baku"}
                        </Text>
                        <Text style={extraStyles.recipeAmount}>
                          {item.quantity} {item.unit}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setRecipes((current) =>
                              current.filter(
                                (recipe) =>
                                  recipe.ingredientId !== item.ingredientId,
                              ),
                            )
                          }
                        >
                          <Text style={styles.removeText}>Hapus</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                {image && (
                  <Image source={{ uri: image.uri }} style={styles.preview} />
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Belum ada {tab === "bahan_baku" ? "bahan baku" : "produk jadi"}.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: imageUri(item.imageUrl) }}
                  style={styles.thumbnail}
                />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>{item.name[0]}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.type}
                  {item.kind === "bahan_baku"
                    ? ` · Rp${Number(item.price).toLocaleString("id-ID")} / ${item.unit}`
                    : ` · ${item.recipes?.length || 0} bahan resep`}
                </Text>
              </View>
              {item.kind === "bahan_baku" && (
                <View
                  style={[
                    styles.availability,
                    item.isAvailable === false && styles.unavailable,
                  ]}
                >
                  <Text
                    style={[
                      styles.availabilityText,
                      item.isAvailable === false && styles.unavailableText,
                    ]}
                  >
                    {item.isAvailable === false ? "Tidak tersedia" : "Tersedia"}
                  </Text>
                </View>
              )}
              <Pressable onPress={() => edit(item)} style={styles.edit}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                style={styles.remove}
              >
                <Text style={styles.removeText}>Hapus</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && styles.activeTab]}
    >
      <Text style={[styles.tabText, active && styles.activeTabText]}>
        {label}
      </Text>
    </Pressable>
  );
}
const digits = (value: string) => value.replace(/[^0-9]/g, "");
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Terjadi kesalahan";
const imageUri = (path: string) =>
  `${API_URL.replace(/\/api\/v1\/?$/, "")}${path}`;
const optionStyles = StyleSheet.create({
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 12,
  },
});
const extraStyles = StyleSheet.create({
  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.canvas,
  },
  unitActive: { backgroundColor: colors.primary },
  unitText: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  unitActiveText: { color: "#FFF" },
  recipeBox: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 14,
    paddingTop: 12,
  },
  recipeTitle: { color: colors.ink, fontWeight: "900", fontSize: 12 },
  recipeInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  recipeName: { flex: 1, color: colors.ink, fontWeight: "700", fontSize: 10 },
  recipeAdd: {
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  recipeAmount: { color: colors.primary, fontWeight: "800", fontSize: 10 },
});
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: 16 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: 13,
    marginBottom: 12,
  },
  tab: { flex: 1, alignItems: "center", padding: 11, borderRadius: 10 },
  activeTab: { backgroundColor: colors.primary },
  tabText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  activeTabText: { color: "#FFF" },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 2,
  },
  listTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,.58)",
    justifyContent: "flex-end",
  },
  modalCard: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "90%",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  modalContent: { padding: 14, paddingBottom: 28 },
  closeModal: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.canvas,
    borderRadius: 9,
  },
  closeModalText: { color: colors.muted, fontWeight: "800", fontSize: 10 },
  form: { backgroundColor: colors.surface, borderRadius: 16, padding: 6 },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  titleWrap: { flex: 1 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  caption: { color: colors.muted, fontSize: 11, marginTop: 4 },
  cancelEdit: {
    padding: 9,
    backgroundColor: colors.orangeSoft,
    borderRadius: 9,
  },
  cancelEditText: { color: colors.orange, fontWeight: "800", fontSize: 10 },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: "#FAFAFA",
  },
  grow: { flexGrow: 1, minWidth: 150 },
  qty: { width: 90 },
  priceInput: { width: 145 },
  imageButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    justifyContent: "center",
  },
  imageButtonText: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  button: {
    minHeight: 44,
    paddingHorizontal: 18,
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: "center",
  },
  buttonText: { color: "#FFF", fontWeight: "800" },
  preview: { width: 90, height: 90, borderRadius: 12, marginTop: 12 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 15,
    marginTop: 14,
    paddingBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  thumbnail: { width: 48, height: 48, borderRadius: 10 },
  placeholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { color: colors.primary, fontWeight: "900", fontSize: 18 },
  info: { flex: 1 },
  name: { color: colors.ink, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  stock: { color: colors.primary, fontWeight: "900" },
  availability: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ECFDF3",
  },
  unavailable: { backgroundColor: "#FFF1F0" },
  availabilityText: { color: colors.green, fontSize: 9, fontWeight: "900" },
  unavailableText: { color: colors.red },
  edit: { padding: 8, backgroundColor: colors.primarySoft, borderRadius: 8 },
  editText: { color: colors.primary, fontWeight: "800", fontSize: 10 },
  remove: { padding: 8, backgroundColor: "#FFF1F0", borderRadius: 8 },
  removeText: { color: colors.red, fontWeight: "800", fontSize: 10 },
  empty: { color: colors.muted, textAlign: "center", padding: 30 },
});
