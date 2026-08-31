import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getLocalSalesHistory, LocalSale, PaymentMethod } from '../database/sales.repository';
import { rupiah } from '../data/mock';
import { colors } from '../theme';
import { Session } from '../types';

interface SaleTransaction {
  id: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  totalCents: number;
  amountPaidCents: number;
  changeCents: number;
  note: string | null;
  status: 'pending' | 'synced';
  items: LocalSale[];
}

export function MitraSalesHistoryScreen({ session }: { session: Session }) {
  const [histories, setHistories] = useState<LocalSale[]>([]);
  const [selected, setSelected] = useState<SaleTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setHistories(await getLocalSalesHistory(session.mitraId)); }
    finally { setLoading(false); }
  }, [session.mitraId]);
  useEffect(() => { void load(); }, [load]);

  const transactions = useMemo(() => groupTransactions(histories), [histories]);
  const today = new Date().toDateString();
  const todayTransactions = transactions.filter((item) => new Date(item.createdAt).toDateString() === today);
  const summary = {
    revenue: todayTransactions.reduce((sum, item) => sum + item.totalCents, 0),
    items: todayTransactions.reduce((sum, transaction) => sum + transaction.items.reduce((count, item) => count + item.sold_quantity, 0), 0),
    transactions: todayTransactions.length,
  };

  return <View style={styles.screen}>
    <FlatList data={transactions} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} ListHeaderComponent={<View style={styles.summary}><Text style={styles.summaryLabel}>Penjualan hari ini</Text><Text style={styles.summaryValue}>{rupiah(summary.revenue / 100)}</Text><Text style={styles.summarySub}>{summary.transactions} transaksi · {summary.items} item terjual</Text></View>} ListEmptyComponent={!loading ? <Text style={styles.empty}>Belum ada transaksi penjualan.</Text> : null} renderItem={({ item }) => <View style={styles.row}>
      <View style={styles.info}><Text style={styles.transactionId}>Transaksi #{item.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.meta}>{new Date(item.createdAt).toLocaleString('id-ID')}</Text><Text style={styles.meta}>{item.items.length} jenis · {item.items.reduce((sum, line) => sum + line.sold_quantity, 0)} item · {paymentLabel(item.paymentMethod)}</Text></View>
      <View style={styles.right}><Text style={styles.amount}>{rupiah(item.totalCents / 100)}</Text><View style={[styles.badge, item.status === 'synced' ? styles.synced : styles.pending]}><Text style={[styles.badgeText, item.status === 'synced' ? styles.syncedText : styles.pendingText]}>{item.status === 'synced' ? 'Synced' : 'Pending Sync'}</Text></View><Pressable onPress={() => setSelected(item)} style={styles.detailButton}><Text style={styles.detailText}>Detail</Text></Pressable></View>
    </View>} />
    <TransactionDetail transaction={selected} onClose={() => setSelected(null)} />
  </View>;
}

function groupTransactions(rows: LocalSale[]): SaleTransaction[] {
  const grouped = new Map<string, LocalSale[]>();
  for (const row of rows) grouped.set(row.transaction_uuid, [...(grouped.get(row.transaction_uuid) ?? []), row]);
  return [...grouped.entries()].map(([id, items]) => ({
    id,
    createdAt: items[0].created_at,
    paymentMethod: items[0].payment_method || 'tunai',
    totalCents: items[0].transaction_total_cents || items.reduce((sum, item) => sum + item.price_cents * item.sold_quantity, 0),
    amountPaidCents: items[0].amount_paid_cents || items.reduce((sum, item) => sum + item.price_cents * item.sold_quantity, 0),
    changeCents: items[0].change_cents || 0,
    note: items[0].note,
    status: (items.every((item) => item.sync_status === 'synced') ? 'synced' : 'pending') as 'synced' | 'pending',
    items,
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function TransactionDetail({ transaction, onClose }: { transaction: SaleTransaction | null; onClose: () => void }) {
  if (!transaction) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={detailStyles.backdrop}><View style={detailStyles.modal}>
    <View style={detailStyles.header}><View><Text style={detailStyles.title}>Detail transaksi</Text><Text style={detailStyles.id}>#{transaction.id.slice(0, 8).toUpperCase()}</Text></View><Pressable onPress={onClose}><Text style={detailStyles.close}>×</Text></Pressable></View>
    <ScrollView contentContainerStyle={detailStyles.content}>
      <View style={detailStyles.dateBox}><Text style={detailStyles.dateLabel}>Waktu transaksi</Text><Text style={detailStyles.dateValue}>{new Date(transaction.createdAt).toLocaleString('id-ID')}</Text></View>
      <Text style={detailStyles.section}>Produk dibeli</Text>
      {transaction.items.map((item) => <View key={item.uuid} style={detailStyles.item}><View style={detailStyles.itemInfo}><Text style={detailStyles.itemName}>{item.product_name}</Text><Text style={detailStyles.itemMeta}>{item.sold_quantity} × {rupiah(item.price_cents / 100)}</Text></View><Text style={detailStyles.itemTotal}>{rupiah(item.price_cents * item.sold_quantity / 100)}</Text></View>)}
      <View style={detailStyles.payment}><DetailRow label="Total belanja" value={rupiah(transaction.totalCents / 100)} strong /><DetailRow label="Metode pembayaran" value={paymentLabel(transaction.paymentMethod)} /><DetailRow label="Uang dibayar" value={rupiah(transaction.amountPaidCents / 100)} /><DetailRow label="Kembalian" value={rupiah(transaction.changeCents / 100)} strong /></View>
      {transaction.note && transaction.note !== 'Transaksi POS' && <View style={detailStyles.note}><Text style={detailStyles.noteLabel}>Catatan</Text><Text style={detailStyles.noteText}>{transaction.note}</Text></View>}
      <View style={[detailStyles.syncBox, transaction.status === 'synced' ? detailStyles.syncDone : detailStyles.syncPending]}><Text style={[detailStyles.syncText, transaction.status === 'synced' ? styles.syncedText : styles.pendingText]}>{transaction.status === 'synced' ? 'Transaksi sudah tersinkron ke pusat' : 'Transaksi masih menunggu sinkronisasi'}</Text></View>
    </ScrollView>
    <Pressable onPress={onClose} style={detailStyles.done}><Text style={detailStyles.doneText}>Tutup</Text></Pressable>
  </View></View></Modal>;
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <View style={detailStyles.detailRow}><Text style={[detailStyles.detailLabel, strong && detailStyles.strong]}>{label}</Text><Text style={[detailStyles.detailValue, strong && detailStyles.strong]}>{value}</Text></View>; }
const paymentLabel = (method: PaymentMethod) => ({ tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Kartu Debit' })[method] || 'Tunai';

const styles = StyleSheet.create({ screen: { flex: 1 }, list: { padding: 16, paddingBottom: 40 }, summary: { backgroundColor: colors.primary, padding: 20, borderRadius: 18, marginBottom: 12 }, summaryLabel: { color: '#FFF0E5', fontSize: 12 }, summaryValue: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 4 }, summarySub: { color: '#FFF0E5', marginTop: 5 }, empty: { color: colors.muted, textAlign: 'center', paddingVertical: 35 }, row: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, info: { flex: 1 }, transactionId: { color: colors.ink, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 10, marginTop: 4 }, right: { alignItems: 'flex-end', gap: 6 }, amount: { color: colors.ink, fontWeight: '900' }, badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }, synced: { backgroundColor: '#E7F6EC' }, pending: { backgroundColor: colors.orangeSoft }, badgeText: { fontSize: 9, fontWeight: '900' }, syncedText: { color: colors.green }, pendingText: { color: colors.orange }, detailButton: { backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 }, detailText: { color: colors.primary, fontSize: 10, fontWeight: '900' } });
const detailStyles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,.58)', justifyContent: 'center', padding: 18 }, modal: { width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.line }, title: { color: colors.ink, fontSize: 19, fontWeight: '900' }, id: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 3 }, close: { color: colors.muted, fontSize: 30, padding: 5 }, content: { padding: 18 }, dateBox: { backgroundColor: colors.canvas, borderRadius: 12, padding: 12 }, dateLabel: { color: colors.muted, fontSize: 10 }, dateValue: { color: colors.ink, fontWeight: '800', marginTop: 3 }, section: { color: colors.ink, fontWeight: '900', marginTop: 18, marginBottom: 7 }, item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }, itemInfo: { flex: 1 }, itemName: { color: colors.ink, fontWeight: '800' }, itemMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, itemTotal: { color: colors.ink, fontWeight: '800' }, payment: { marginTop: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 8 }, detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 }, detailLabel: { color: colors.muted }, detailValue: { color: colors.ink, fontWeight: '700' }, strong: { fontWeight: '900', fontSize: 15, color: colors.ink }, note: { backgroundColor: colors.canvas, borderRadius: 11, padding: 12, marginTop: 14 }, noteLabel: { color: colors.muted, fontSize: 10 }, noteText: { color: colors.ink, marginTop: 4 }, syncBox: { padding: 11, borderRadius: 10, marginTop: 14, alignItems: 'center' }, syncDone: { backgroundColor: '#E7F6EC' }, syncPending: { backgroundColor: colors.orangeSoft }, syncText: { fontWeight: '800', fontSize: 10 }, done: { backgroundColor: colors.primary, margin: 18, marginTop: 0, padding: 14, borderRadius: 12, alignItems: 'center' }, doneText: { color: '#FFF', fontWeight: '900' } });
