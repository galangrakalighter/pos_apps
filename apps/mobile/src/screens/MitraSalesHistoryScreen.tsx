import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  editPendingTransaction,
  getLocalSalesHistory,
  LocalSale,
  PaymentMethod,
} from "../database/sales.repository";
import { rupiah } from "../data/mock";
import { colors } from "../theme";
import { Session } from "../types";
import {
  Discount,
  getLocalDiscounts,
  syncDiscounts,
} from "../discounts/discounts-api";
import { printReceipt } from "../printing/receipt-printer";
import { syncHistory } from "../sync/history-sync";

interface SaleTransaction {
  id: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  totalCents: number;
  amountPaidCents: number;
  changeCents: number;
  note: string | null;
  status: "pending" | "synced";
  items: LocalSale[];
  rawMaterialAddons: Array<{ productId: number; name: string }>;
  discountName: string | null;
  discountAmountCents: number;
}

type SyncFilter = "all" | "pending" | "synced";
type PaymentFilter = "all" | PaymentMethod;

export function MitraSalesHistoryScreen({ session }: { session: Session }) {
  const [histories, setHistories] = useState<LocalSale[]>([]);
  const [selected, setSelected] = useState<SaleTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [syncFilter, setSyncFilter] = useState<SyncFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [editing, setEditing] = useState<SaleTransaction | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      await syncHistory({
        userId: session.mitraId,
        accessToken: session.accessToken,
      }).catch(() => undefined);
      await syncDiscounts(session).catch(() => undefined);
      setDiscounts(await getLocalDiscounts());
      setHistories(await getLocalSalesHistory(session.mitraId));
    } finally {
      setLoading(false);
    }
  }, [session.accessToken, session.mitraId]);
  useEffect(() => {
    void load();
  }, [load]);

  const allTransactions = useMemo(
    () => groupTransactions(histories),
    [histories],
  );
  const transactions = useMemo(() => {
    return allTransactions.filter((item) => {
      const transactionDate = localDateKey(item.createdAt);
      const matchesPeriod =
        (!dateFrom || transactionDate >= dateFrom) &&
        (!dateTo || transactionDate <= dateTo);
      const matchesSync = syncFilter === "all" || item.status === syncFilter;
      const matchesPayment =
        paymentFilter === "all" || item.paymentMethod === paymentFilter;
      return matchesPeriod && matchesSync && matchesPayment;
    });
  }, [allTransactions, dateFrom, dateTo, paymentFilter, syncFilter]);
  const summary = {
    revenue: transactions.reduce((sum, item) => sum + item.totalCents, 0),
    items: transactions.reduce(
      (sum, transaction) =>
        sum +
        transaction.items.reduce(
          (count, item) => count + item.sold_quantity,
          0,
        ),
      0,
    ),
    transactions: transactions.length,
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Penjualan sesuai filter</Text>
              <Text style={styles.summaryValue}>
                {rupiah(summary.revenue / 100)}
              </Text>
              <Text style={styles.summarySub}>
                {summary.transactions} transaksi · {summary.items} item terjual
              </Text>
            </View>
            <View style={styles.filters}>
              <Text style={styles.filterTitle}>Filter transaksi</Text>
              <Text style={styles.filterLabel}>Rentang tanggal</Text>
              <View style={styles.dateRange}>
                <View style={styles.dateField}>
                  <Text style={styles.dateCaption}>Dari</Text>
                  <TextInput
                    value={dateFrom}
                    onChangeText={setDateFrom}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    style={styles.dateInput}
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.dateCaption}>Hingga</Text>
                  <TextInput
                    value={dateTo}
                    onChangeText={setDateTo}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    style={styles.dateInput}
                  />
                </View>
                {(dateFrom || dateTo) && (
                  <Pressable
                    onPress={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    style={styles.clearDates}
                  >
                    <Text style={styles.clearDatesText}>Hapus</Text>
                  </Pressable>
                )}
              </View>
              <FilterRow
                label="Sinkronisasi"
                value={syncFilter}
                onChange={(value) => setSyncFilter(value as SyncFilter)}
                options={[
                  ["all", "Semua"],
                  ["pending", "Pending"],
                  ["synced", "Synced"],
                ]}
              />
              <FilterRow
                label="Pembayaran"
                value={paymentFilter}
                onChange={(value) => setPaymentFilter(value as PaymentFilter)}
                options={[
                  ["all", "Semua"],
                  ["tunai", "Tunai"],
                  ["qris", "QRIS"],
                ]}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {allTransactions.length
                ? "Tidak ada transaksi yang sesuai dengan filter."
                : "Belum ada transaksi penjualan."}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.transactionId}>
                Transaksi #{item.id.slice(0, 8).toUpperCase()}
              </Text>
              <Text style={styles.meta}>
                {new Date(item.createdAt).toLocaleString("id-ID")}
              </Text>
              <Text style={styles.meta}>
                {item.items.length} jenis ·{" "}
                {item.items.reduce((sum, line) => sum + line.sold_quantity, 0)}{" "}
                item · {paymentLabel(item.paymentMethod)}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>{rupiah(item.totalCents / 100)}</Text>
              <View
                style={[
                  styles.badge,
                  item.status === "synced" ? styles.synced : styles.pending,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    item.status === "synced"
                      ? styles.syncedText
                      : styles.pendingText,
                  ]}
                >
                  {item.status === "synced" ? "Synced" : "Pending Sync"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {item.status === "pending" && (
                  <Pressable
                    onPress={() => setEditing(item)}
                    style={styles.detailButton}
                  >
                    <Text style={styles.detailText}>Edit</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setSelected(item)}
                  style={styles.detailButton}
                >
                  <Text style={styles.detailText}>Detail</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
      <TransactionDetail
        transaction={selected}
        session={session}
        onClose={() => setSelected(null)}
      />
      <EditTransaction
        transaction={editing}
        discounts={discounts}
        ownerId={session.mitraId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    </View>
  );
}

function EditTransaction({
  transaction,
  discounts,
  ownerId,
  onClose,
  onSaved,
}: {
  transaction: SaleTransaction | null;
  discounts: Discount[];
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [discountId, setDiscountId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (transaction) {
      setQuantities(
        Object.fromEntries(
          transaction.items.map((x) => [x.product_id, x.sold_quantity]),
        ),
      );
      setDiscountId(transaction.items[0].discount_id);
    }
  }, [transaction]);
  if (!transaction) return null;
  const change = (id: number, delta: number) =>
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] ?? 0) + delta),
    }));
  const save = async () => {
    setSaving(true);
    try {
      await editPendingTransaction(
        ownerId,
        transaction.id,
        quantities,
        discounts.find((x) => x.id === discountId) ?? null,
      );
      onSaved();
    } catch (e) {
      Alert.alert(
        "Transaksi gagal diedit",
        e instanceof Error ? e.message : "Terjadi kesalahan",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={detailStyles.backdrop}>
        <View style={detailStyles.modal}>
          <View style={detailStyles.header}>
            <Text style={detailStyles.title}>Edit transaksi</Text>
            <Pressable onPress={onClose}>
              <Text style={detailStyles.close}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={detailStyles.content}>
            <Text style={detailStyles.section}>Jumlah produk</Text>
            {transaction.items.map((item) => (
              <View key={item.uuid} style={detailStyles.item}>
                <View style={detailStyles.itemInfo}>
                  <Text style={detailStyles.itemName}>{item.product_name}</Text>
                  <Text style={detailStyles.itemMeta}>
                    {rupiah(item.price_cents / 100)} · jumlah 0 akan menghapus
                    item
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Pressable
                    onPress={() => change(item.product_id, -1)}
                    style={styles.detailButton}
                  >
                    <Text style={styles.detailText}>−</Text>
                  </Pressable>
                  <Text style={{ fontWeight: "900" }}>
                    {quantities[item.product_id] ?? 0}
                  </Text>
                  <Pressable
                    onPress={() => change(item.product_id, 1)}
                    style={styles.detailButton}
                  >
                    <Text style={styles.detailText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={detailStyles.section}>Diskon</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 7 }}>
              <Pressable
                onPress={() => setDiscountId(null)}
                style={[
                  styles.filterChip,
                  discountId === null && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    discountId === null && styles.filterChipTextActive,
                  ]}
                >
                  Tanpa diskon
                </Text>
              </Pressable>
              {discounts.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setDiscountId(item.id)}
                  style={[
                    styles.filterChip,
                    discountId === item.id && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      discountId === item.id && styles.filterChipTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8, padding: 18 }}>
            <Pressable
              onPress={onClose}
              style={[
                detailStyles.done,
                { flex: 1, margin: 0, backgroundColor: colors.canvas },
              ]}
            >
              <Text style={{ color: colors.ink, fontWeight: "900" }}>
                Batal
              </Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={() => void save()}
              style={[detailStyles.done, { flex: 2, margin: 0 }]}
            >
              <Text style={detailStyles.doneText}>
                {saving ? "Menyimpan..." : "Simpan perubahan"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterOptions}
      >
        {options.map(([id, text]) => (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            style={[styles.filterChip, value === id && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                value === id && styles.filterChipTextActive,
              ]}
            >
              {text}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function groupTransactions(rows: LocalSale[]): SaleTransaction[] {
  const grouped = new Map<string, LocalSale[]>();
  for (const row of rows)
    grouped.set(row.transaction_uuid, [
      ...(grouped.get(row.transaction_uuid) ?? []),
      row,
    ]);
  return [...grouped.entries()]
    .map(([id, items]) => ({
      id,
      createdAt: items[0].created_at,
      paymentMethod: items[0].payment_method || "tunai",
      totalCents:
        items[0].transaction_total_cents ||
        items.reduce(
          (sum, item) => sum + item.price_cents * item.sold_quantity,
          0,
        ),
      amountPaidCents:
        items[0].amount_paid_cents ||
        items.reduce(
          (sum, item) => sum + item.price_cents * item.sold_quantity,
          0,
        ),
      changeCents: items[0].change_cents || 0,
      note: items[0].note,
      status: (items.every((item) => item.sync_status === "synced")
        ? "synced"
        : "pending") as "synced" | "pending",
      items,
      rawMaterialAddons: parseRawMaterialAddons(items[0].raw_material_addons),
      discountName: items[0].discount_name,
      discountAmountCents: items[0].discount_amount_cents || 0,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function parseRawMaterialAddons(
  value: string,
): Array<{ productId: number; name: string }> {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is { productId: number; name: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { productId?: unknown }).productId === "number" &&
        typeof (item as { name?: unknown }).name === "string",
    );
  } catch {
    return [];
  }
}

function TransactionDetail({
  transaction,
  session,
  onClose,
}: {
  transaction: SaleTransaction | null;
  session: Session;
  onClose: () => void;
}) {
  if (!transaction) return null;
  const print = () =>
    void printReceipt({
      id: transaction.id,
      merchantName: session.partnerName || "POS Mitra",
      cashierName: session.name,
      createdAt: transaction.createdAt,
      paymentMethod: paymentLabel(transaction.paymentMethod),
      items: transaction.items.map((item) => ({
        name: item.product_name,
        quantity: item.sold_quantity,
        priceCents: item.price_cents,
        addons: parseRawMaterialAddons(item.raw_material_addons).map(
          (addon) => addon.name,
        ),
      })),
      totalCents: transaction.totalCents,
      amountPaidCents: transaction.amountPaidCents,
      changeCents: transaction.changeCents,
      discountName: transaction.discountName,
      discountAmountCents: transaction.discountAmountCents,
      note: transaction.note,
    }).catch((error) =>
      Alert.alert(
        "Struk gagal dicetak",
        error instanceof Error ? error.message : "RawBT tidak dapat dibuka",
      ),
    );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={detailStyles.backdrop}>
        <View style={detailStyles.modal}>
          <View style={detailStyles.header}>
            <View>
              <Text style={detailStyles.title}>Detail transaksi</Text>
              <Text style={detailStyles.id}>
                #{transaction.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={detailStyles.close}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={detailStyles.content}>
            <View style={detailStyles.dateBox}>
              <Text style={detailStyles.dateLabel}>Waktu transaksi</Text>
              <Text style={detailStyles.dateValue}>
                {new Date(transaction.createdAt).toLocaleString("id-ID")}
              </Text>
            </View>
            <Text style={detailStyles.section}>Produk dibeli</Text>
            {transaction.items.map((item) => {
              const addons = parseRawMaterialAddons(item.raw_material_addons);
              return (
                <View key={item.uuid} style={detailStyles.item}>
                  <View style={detailStyles.itemInfo}>
                    <Text style={detailStyles.itemName}>
                      {item.product_name}
                    </Text>
                    <Text style={detailStyles.itemMeta}>
                      {item.sold_quantity} × {rupiah(item.price_cents / 100)}
                    </Text>
                    {addons.length > 0 && (
                      <Text style={detailStyles.itemMeta}>
                        Taburan: {addons.map((addon) => addon.name).join(", ")}
                      </Text>
                    )}
                  </View>
                  <Text style={detailStyles.itemTotal}>
                    {rupiah((item.price_cents * item.sold_quantity) / 100)}
                  </Text>
                </View>
              );
            })}
            {transaction.discountName && (
              <View style={detailStyles.addonBox}>
                <Text style={detailStyles.addonLabel}>Diskon digunakan</Text>
                <DetailRow
                  label={transaction.discountName}
                  value={`- ${rupiah(transaction.discountAmountCents / 100)}`}
                  strong
                />
              </View>
            )}
            <View style={detailStyles.payment}>
              <DetailRow
                label="Total belanja"
                value={rupiah(transaction.totalCents / 100)}
                strong
              />
              <DetailRow
                label="Metode pembayaran"
                value={paymentLabel(transaction.paymentMethod)}
              />
              <DetailRow
                label="Uang dibayar"
                value={rupiah(transaction.amountPaidCents / 100)}
              />
              <DetailRow
                label="Kembalian"
                value={rupiah(transaction.changeCents / 100)}
                strong
              />
            </View>
            {transaction.note && transaction.note !== "Transaksi POS" && (
              <View style={detailStyles.note}>
                <Text style={detailStyles.noteLabel}>Catatan</Text>
                <Text style={detailStyles.noteText}>{transaction.note}</Text>
              </View>
            )}
            <View
              style={[
                detailStyles.syncBox,
                transaction.status === "synced"
                  ? detailStyles.syncDone
                  : detailStyles.syncPending,
              ]}
            >
              <Text
                style={[
                  detailStyles.syncText,
                  transaction.status === "synced"
                    ? styles.syncedText
                    : styles.pendingText,
                ]}
              >
                {transaction.status === "synced"
                  ? "Transaksi sudah tersinkron ke pusat"
                  : "Transaksi masih menunggu sinkronisasi"}
              </Text>
            </View>
          </ScrollView>
          <View style={detailStyles.footerActions}>
            <Pressable onPress={onClose} style={detailStyles.closeButton}>
              <Text style={detailStyles.closeButtonText}>Tutup</Text>
            </Pressable>
            <Pressable onPress={print} style={detailStyles.printButton}>
              <Text style={detailStyles.doneText}>Cetak struk</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={detailStyles.detailRow}>
      <Text style={[detailStyles.detailLabel, strong && detailStyles.strong]}>
        {label}
      </Text>
      <Text style={[detailStyles.detailValue, strong && detailStyles.strong]}>
        {value}
      </Text>
    </View>
  );
}

function localDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const paymentLabel = (method: PaymentMethod) =>
  ({
    tunai: "Tunai",
    qris: "QRIS",
    transfer: "Transfer",
    debit: "Kartu Debit",
  })[method] || "Tunai";

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },
  summary: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: 18,
    marginBottom: 12,
  },
  summaryLabel: { color: "#FFF0E5", fontSize: 12 },
  summaryValue: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  summarySub: { color: "#FFF0E5", marginTop: 5 },
  filters: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
  },
  filterTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3,
  },
  filterRow: { marginTop: 10 },
  filterLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateRange: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  dateField: { flexGrow: 1, flexBasis: 125 },
  dateCaption: { color: colors.muted, fontSize: 10, marginBottom: 4 },
  dateInput: {
    color: colors.ink,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12,
  },
  clearDates: {
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  clearDatesText: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  filterOptions: { gap: 7 },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterChipText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  filterChipTextActive: { color: colors.primary, fontWeight: "900" },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 35 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  info: { flex: 1 },
  transactionId: { color: colors.ink, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  right: { alignItems: "flex-end", gap: 6 },
  amount: { color: colors.ink, fontWeight: "900" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  synced: { backgroundColor: "#E7F6EC" },
  pending: { backgroundColor: colors.orangeSoft },
  badgeText: { fontSize: 9, fontWeight: "900" },
  syncedText: { color: colors.green },
  pendingText: { color: colors.orange },
  detailButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  detailText: { color: colors.primary, fontSize: 10, fontWeight: "900" },
});
const detailStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,.58)",
    justifyContent: "center",
    padding: 18,
  },
  modal: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "90%",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  id: { color: colors.primary, fontSize: 10, fontWeight: "800", marginTop: 3 },
  close: { color: colors.muted, fontSize: 30, padding: 5 },
  content: { padding: 18 },
  dateBox: { backgroundColor: colors.canvas, borderRadius: 12, padding: 12 },
  dateLabel: { color: colors.muted, fontSize: 10 },
  dateValue: { color: colors.ink, fontWeight: "800", marginTop: 3 },
  section: {
    color: colors.ink,
    fontWeight: "900",
    marginTop: 18,
    marginBottom: 7,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemInfo: { flex: 1 },
  itemName: { color: colors.ink, fontWeight: "800" },
  itemMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  itemTotal: { color: colors.ink, fontWeight: "800" },
  addonBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 11,
    padding: 12,
    marginTop: 14,
  },
  addonLabel: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  addonList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  addonChip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addonText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  payment: {
    marginTop: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 6,
  },
  detailLabel: { color: colors.muted },
  detailValue: { color: colors.ink, fontWeight: "700" },
  strong: { fontWeight: "900", fontSize: 15, color: colors.ink },
  note: {
    backgroundColor: colors.canvas,
    borderRadius: 11,
    padding: 12,
    marginTop: 14,
  },
  noteLabel: { color: colors.muted, fontSize: 10 },
  noteText: { color: colors.ink, marginTop: 4 },
  syncBox: {
    padding: 11,
    borderRadius: 10,
    marginTop: 14,
    alignItems: "center",
  },
  syncDone: { backgroundColor: "#E7F6EC" },
  syncPending: { backgroundColor: colors.orangeSoft },
  syncText: { fontWeight: "800", fontSize: 10 },
  done: {
    backgroundColor: colors.primary,
    margin: 18,
    marginTop: 0,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  doneText: { color: "#FFF", fontWeight: "900" },
  footerActions: { flexDirection: "row", gap: 8, padding: 18, paddingTop: 0 },
  closeButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    alignItems: "center",
  },
  closeButtonText: { color: colors.ink, fontWeight: "900" },
  printButton: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
});
