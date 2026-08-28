import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getIncomingOrders, OrderStatus, RemoteOrder, updateOrderStatus } from '../procurement/procurement-api';
import { colors } from '../theme';
import { Session } from '../types';

const nextStatus: Record<OrderStatus, OrderStatus | null> = { pending: 'diterima', diterima: 'dikirim', dikirim: 'selesai', selesai: null };
const statusColors: Record<OrderStatus, string> = { pending: colors.orange, diterima: colors.blue, dikirim: '#7A5AF8', selesai: colors.green };

export function AdminOrderManagementScreen({ session }: { session: Session }) {
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try { setOrders(await getIncomingOrders(session)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Pesanan masuk gagal dimuat'); }
    finally { if (!quiet) setLoading(false); }
  }, [session]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 8000);
    return () => clearInterval(timer);
  }, [load]);
  const advance = async (order: RemoteOrder) => {
    const status = nextStatus[order.status];
    if (!status) return;
    setUpdatingId(order.id);
    try {
      const updated = await updateOrderStatus(session, order.id, status);
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      Alert.alert('Status gagal diperbarui', reason instanceof Error ? reason.message : 'Terjadi kesalahan');
      await load(true);
    }
    finally { setUpdatingId(null); }
  };
  const pending = orders.filter((order) => order.status === 'pending').length;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
    <View style={styles.intro}><View style={styles.introText}><Text style={styles.heading}>Incoming orders</Text><Text style={styles.subheading}>Proses berurutan: pending → diterima → dikirim → selesai.</Text></View><Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>Muat ulang</Text></Pressable><View style={styles.count}><Text style={styles.countText}>{pending} baru</Text></View></View>
    {loading && orders.length === 0 ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : error ? <View style={styles.emptyCard}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Coba lagi</Text></Pressable></View> : orders.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Belum ada pesanan masuk</Text><Text style={styles.emptyText}>Pesanan Mitra akan muncul di halaman ini.</Text></View> : orders.map((order) => {
      const next = nextStatus[order.status];
      return <View key={order.id} style={styles.card}><View style={styles.cardHead}><View><Text style={styles.orderId}>PO #{order.id}</Text><Text style={styles.partnerName}>Mitra {order.requesterUsername ?? 'tidak dikenal'}</Text><Text style={styles.meta}>{new Date(order.createdAt).toLocaleString('id-ID')}</Text></View><View style={[styles.badge, { backgroundColor: `${statusColors[order.status]}18` }]}><Text style={[styles.badgeText, { color: statusColors[order.status] }]}>{order.status}</Text></View></View><View style={styles.lines}>{order.items.map((item) => <View key={item.id} style={styles.line}><Text style={styles.itemName}>{item.namaBarang}</Text><Text style={styles.itemValue}>{item.jumlahPesan} {item.satuan || 'pcs'} · Rp{Number(item.lineTotal).toLocaleString('id-ID')}</Text></View>)}</View><View style={styles.footer}><Text style={styles.total}>Total Rp{Number(order.totalAmount).toLocaleString('id-ID')}</Text>{next && <Pressable disabled={updatingId === order.id} onPress={() => void advance(order)} style={[styles.action, updatingId === order.id && { opacity: 0.5 }]}><Text style={styles.actionText}>{updatingId === order.id ? 'Memproses...' : `Ubah ke ${next}`}</Text></Pressable>}</View></View>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 16, paddingBottom: 40 }, intro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, introText: { flex: 1 }, heading: { color: colors.ink, fontSize: 19, fontWeight: '900' }, subheading: { color: colors.muted, fontSize: 11, marginTop: 3 }, refresh: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 }, refreshText: { color: colors.primary, fontWeight: '800', fontSize: 10 }, count: { backgroundColor: colors.orangeSoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 }, countText: { color: colors.orange, fontWeight: '800', fontSize: 11 }, loader: { marginTop: 40 }, emptyCard: { backgroundColor: colors.surface, borderRadius: 16, alignItems: 'center', padding: 38, marginTop: 15 }, emptyTitle: { color: colors.ink, fontWeight: '800' }, emptyText: { color: colors.muted, fontSize: 11, marginTop: 5 }, error: { color: colors.orange, textAlign: 'center', fontWeight: '700' }, retry: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, marginTop: 12 }, retryText: { color: '#FFFFFF', fontWeight: '800' }, card: { backgroundColor: colors.surface, borderRadius: 16, padding: 15, marginTop: 14 }, cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, orderId: { color: colors.ink, fontWeight: '900', fontSize: 15 }, partnerName: { color: colors.primary, fontWeight: '800', fontSize: 12, marginTop: 4 }, meta: { color: colors.muted, fontSize: 10, marginTop: 3 }, badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 }, badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'capitalize' }, lines: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 9, marginVertical: 12 }, line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }, itemName: { color: colors.ink, fontWeight: '700', flex: 1 }, itemValue: { color: colors.muted, fontSize: 11 }, footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, total: { color: colors.ink, fontWeight: '900' }, action: { backgroundColor: colors.primary, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10 }, actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 } });
