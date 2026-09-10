import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createDiscount,
  deleteDiscount,
  Discount,
  adminDiscounts,
  updateDiscount,
} from "../discounts/discounts-api";
import { rupiah } from "../data/mock";
import { colors } from "../theme";
import { Session } from "../types";

export function DiscountManagementScreen({ session }: { session: Session }) {
  const [items, setItems] = useState<Discount[]>([]);
  const [editing, setEditing] = useState<Discount | null | undefined>(
    undefined,
  );
  const [name, setName] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const rows = await adminDiscounts(session);
      setItems(rows.map((x) => ({ ...x, id: Number(x.id) })));
    } catch (e) {
      Alert.alert(
        "Diskon gagal dimuat",
        e instanceof Error ? e.message : "Terjadi kesalahan",
      );
    }
  }, [session.accessToken]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = (item: Discount | null) => {
    setEditing(item);
    setName(item?.name ?? "");
    setType(item?.type ?? "percent");
    setValue(item ? String(item.value) : "");
  };
  const save = async () => {
    const amount = Number(value.replace(",", "."));
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0)
      return Alert.alert("Data belum valid", "Isi nama dan nilai diskon.");
    if (type === "percent" && amount > 100)
      return Alert.alert("Diskon tidak valid", "Persentase maksimal 100%.");
    setSaving(true);
    try {
      const input = { name: name.trim(), type, value: amount, isActive: true };
      if (editing) await updateDiscount(session, editing.id, input);
      else await createDiscount(session, input);
      setEditing(undefined);
      await load();
    } catch (e) {
      Alert.alert(
        "Diskon gagal disimpan",
        e instanceof Error ? e.message : "Terjadi kesalahan",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = (item: Discount) =>
    Alert.alert(
      "Hapus diskon?",
      `Diskon ${item.name} tidak akan muncul pada transaksi baru.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () =>
            void deleteDiscount(session, item.id)
              .then(load)
              .catch((e) =>
                Alert.alert(
                  "Gagal menghapus",
                  e instanceof Error ? e.message : "Terjadi kesalahan",
                ),
              ),
        },
      ],
    );
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Diskon transaksi</Text>
          <Text style={styles.caption}>
            Kelola pilihan diskon untuk seluruh Mitra.
          </Text>
        </View>
        <Pressable onPress={() => open(null)} style={styles.add}>
          <Text style={styles.addText}>+ Tambah diskon</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada diskon.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.value}>
                {item.type === "percent"
                  ? `${item.value}%`
                  : rupiah(item.value)}
              </Text>
            </View>
            <Pressable onPress={() => open(item)} style={styles.edit}>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => remove(item)} style={styles.delete}>
              <Text style={styles.deleteText}>Hapus</Text>
            </Pressable>
          </View>
        )}
      />
      <Modal
        visible={editing !== undefined}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(undefined)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit" : "Tambah"} diskon
            </Text>
            <Text style={styles.label}>Nama diskon</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Contoh: Promo pembukaan"
              style={styles.input}
            />
            <Text style={styles.label}>Jenis potongan</Text>
            <View style={styles.types}>
              {(["percent", "fixed"] as const).map((x) => (
                <Pressable
                  key={x}
                  onPress={() => setType(x)}
                  style={[styles.type, type === x && styles.typeActive]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      type === x && styles.typeTextActive,
                    ]}
                  >
                    {x === "percent" ? "Persen (%)" : "Nominal tetap"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>
              {type === "percent" ? "Persentase" : "Nominal rupiah"}
            </Text>
            <TextInput
              value={type === "fixed" && value ? rupiah(Number(value)) : value}
              onChangeText={(x) => setValue(x.replace(/[^0-9.,]/g, ""))}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <View style={styles.actions}>
              <Pressable
                onPress={() => setEditing(undefined)}
                style={styles.cancel}
              >
                <Text>Batal</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => void save()}
                style={styles.save}
              >
                <Text style={styles.saveText}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  caption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  add: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 11,
  },
  addText: { color: "#FFF", fontWeight: "900", fontSize: 11 },
  list: { backgroundColor: colors.surface, borderRadius: 16, padding: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  info: { flex: 1 },
  name: { color: colors.ink, fontWeight: "900" },
  value: { color: colors.primary, fontWeight: "800", marginTop: 4 },
  edit: { backgroundColor: colors.primarySoft, padding: 10, borderRadius: 9 },
  editText: { color: colors.primary, fontWeight: "800" },
  delete: { backgroundColor: "#FFF1F1", padding: 10, borderRadius: 9 },
  deleteText: { color: colors.red, fontWeight: "800" },
  empty: { color: colors.muted, textAlign: "center", padding: 30 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,.55)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.ink,
  },
  types: { flexDirection: "row", gap: 8 },
  type: {
    flex: 1,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    alignItems: "center",
  },
  typeActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  typeText: { color: colors.muted, fontWeight: "700" },
  typeTextActive: { color: colors.primary },
  actions: { flexDirection: "row", gap: 8, marginTop: 18 },
  cancel: {
    flex: 1,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    alignItems: "center",
  },
  save: {
    flex: 2,
    padding: 13,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: { color: "#FFF", fontWeight: "900" },
});
