import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getLocalSalesHistory, LocalSale } from '../database/sales.repository';
import { colors } from '../theme';
import { Session } from '../types';

export function MitraSalesHistoryScreen({ session }: { session: Session }) {
  const [histories, setHistories] = useState<LocalSale[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setHistories(await getLocalSalesHistory(session.mitraId)); }
    finally { setLoading(false); }
  }, [session.mitraId]);
  useEffect(() => { void load(); }, [load]);
  const today = new Date().toDateString();
  const summary = useMemo(() => histories.filter((item) => new Date(item.created_at).toDateString() === today).reduce((result, item) => ({ revenue: result.revenue + item.price_cents * item.sold_quantity, items: result.items + item.sold_quantity, rows: result.rows + 1 }), { revenue: 0, items: 0, rows: 0 }), [histories, today]);
  return <FlatList data={histories} keyExtractor={(item) => item.uuid} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} ListHeaderComponent={<View style={styles.summary}><Text style={styles.summaryLabel}>Penjualan hari ini</Text><Text style={styles.summaryValue}>Rp{Math.round(summary.revenue / 100).toLocaleString('id-ID')}</Text><Text style={styles.summarySub}>{summary.items} item · {summary.rows} baris transaksi lokal</Text></View>} ListEmptyComponent={!loading ? <Text style={styles.empty}>Belum ada transaksi penjualan.</Text> : null} renderItem={({ item }) => <View style={styles.row}><View style={styles.info}><Text style={styles.name}>{item.product_name}</Text><Text style={styles.meta}>{new Date(item.created_at).toLocaleString('id-ID')} · {item.sold_quantity} item</Text></View><View style={styles.right}><Text style={styles.amount}>Rp{Math.round(item.price_cents * item.sold_quantity / 100).toLocaleString('id-ID')}</Text><View style={[styles.badge, item.sync_status === 'synced' ? styles.synced : styles.pending]}><Text style={[styles.badgeText, item.sync_status === 'synced' ? styles.syncedText : styles.pendingText]}>{item.sync_status === 'synced' ? 'Synced' : 'Pending Sync'}</Text></View></View></View>} />;
}

const styles = StyleSheet.create({ list: { padding: 16, paddingBottom: 40 }, summary: { backgroundColor: colors.primary, padding: 20, borderRadius: 18, marginBottom: 12 }, summaryLabel: { color: '#FFF0E5', fontSize: 12 }, summaryValue: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 4 }, summarySub: { color: '#FFF0E5', marginTop: 5 }, empty: { color: colors.muted, textAlign: 'center', paddingVertical: 35 }, row: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, info: { flex: 1 }, name: { color: colors.ink, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 10, marginTop: 4 }, right: { alignItems: 'flex-end', gap: 6 }, amount: { color: colors.ink, fontWeight: '900' }, badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }, synced: { backgroundColor: '#E7F6EC' }, pending: { backgroundColor: colors.orangeSoft }, badgeText: { fontSize: 9, fontWeight: '900' }, syncedText: { color: colors.green }, pendingText: { color: colors.orange } });
