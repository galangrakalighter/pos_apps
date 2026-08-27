import { FlatList, StyleSheet, Text, View } from 'react-native';
import { purchaseOrders } from '../data/mock';
import { colors } from '../theme';

const statusColor = { pending: colors.orange, diterima: colors.blue, dikirim: '#7A5AF8', selesai: colors.green };

export function MitraPurchaseHistoryScreen() {
  return <FlatList data={purchaseOrders} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.card}><View><Text style={styles.id}>{item.id}</Text><Text style={styles.meta}>{item.date} · {item.totalItems} item</Text></View><View style={[styles.badge, { backgroundColor: `${statusColor[item.status]}18` }]}><View style={[styles.dot, { backgroundColor: statusColor[item.status] }]} /><Text style={[styles.status, { color: statusColor[item.status] }]}>{item.status}</Text></View></View>} ListEmptyComponent={<Text style={styles.empty}>Belum ada pesanan ke pusat.</Text>} />;
}

const styles = StyleSheet.create({ list: { padding: 16, gap: 9 }, card: { backgroundColor: colors.surface, padding: 16, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, id: { color: colors.ink, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 11, marginTop: 4 }, badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, dot: { width: 6, height: 6, borderRadius: 3 }, status: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' }, empty: { color: colors.muted, textAlign: 'center', marginTop: 80 } });
