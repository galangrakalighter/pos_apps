import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ProductCard } from '../components/ProductCard';
import { colors } from '../theme';
import { Product, Session } from '../types';
import { createProcurementOrder, getMyOrders, RemoteOrder } from '../procurement/procurement-api';
import { getWarehouseCatalog } from '../admin/admin-inventory-api';
import { API_URL } from '../config';

type Tab = 'catalog' | 'status';
const statusColors = { pending: colors.orange, diterima: colors.blue, dikirim: '#7A5AF8', selesai: colors.green };

export function OrderScreen({ isTablet, session }: { isTablet: boolean; session: Session }) {
  const [tab, setTab] = useState<Tab>('catalog');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [online, setOnline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  useEffect(() => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false)), []);
  useEffect(() => { void NetInfo.fetch().then((state) => { if (!state.isConnected || state.isInternetReachable === false) Alert.alert('Koneksi internet diperlukan', 'Untuk memesan ke pusat dibutuhkan akses internet.'); }); }, []);
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const items = await getWarehouseCatalog(session);
      setCatalog(items.map((item, index) => ({ id: Number(item.id), name: item.name, category: item.type, stock: item.stock, price: Number(item.price), imageUrl: item.imageUrl ? `${API_URL.replace(/\/api\/v1\/?$/, '')}${item.imageUrl}` : null, color: ['#FFE0DA', '#FDE6D2', '#F5F0C9', '#DCEEE9'][index % 4] })));
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Katalog gagal dimuat');
    } finally { setCatalogLoading(false); }
  }, [session]);
  useEffect(() => {
    if (online) void loadCatalog();
    else setCatalogLoading(false);
  }, [online, loadCatalog]);
  const loadOrders = useCallback(async () => {
    if (!online) return;
    setOrdersLoading(true); setOrdersError(null);
    try { setOrders(await getMyOrders(session)); }
    catch (error) { setOrdersError(error instanceof Error ? error.message : 'Status pesanan gagal dimuat'); }
    finally { setOrdersLoading(false); }
  }, [online, session]);
  useEffect(() => {
    if (!online) return;
    void loadOrders();
    const timer = setInterval(() => void loadOrders(), 10000);
    return () => clearInterval(timer);
  }, [online, loadOrders]);
  const total = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const estimatedTotal = catalog.reduce((sum, product) => sum + product.price * (quantities[product.id] ?? 0), 0);
  const add = (product: Product) => {
    if (!online) return Alert.alert('Koneksi internet diperlukan', 'Untuk memesan ke pusat dibutuhkan akses internet.');
    setQuantities((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
  };
  const submit = async () => {
    if (!online) return Alert.alert('Koneksi internet diperlukan', 'Untuk memesan ke pusat dibutuhkan akses internet.');
    setSubmitting(true);
    try {
      await createProcurementOrder(session, Object.entries(quantities).map(([warehouseId, quantity]) => ({ warehouseId: Number(warehouseId), quantity })));
      await loadOrders();
      Alert.alert('Purchase order dibuat', `${total} barang senilai Rp${estimatedTotal.toLocaleString('id-ID')} dikirim ke pusat.`); setQuantities({}); setTab('status');
    } catch (error) { Alert.alert('Pemesanan gagal', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setSubmitting(false); }
  };
  return <View style={styles.screen}><View style={styles.tabs}><Pressable onPress={() => setTab('catalog')} style={[styles.tab, tab === 'catalog' && styles.activeTab]}><Text style={[styles.tabText, tab === 'catalog' && styles.activeTabText]}>Pesan ke Pusat</Text></Pressable><Pressable onPress={() => setTab('status')} style={[styles.tab, tab === 'status' && styles.activeTab]}><Text style={[styles.tabText, tab === 'status' && styles.activeTabText]}>Status Pesanan Saya</Text></Pressable></View>{!online && <View style={styles.offline}><Text style={styles.offlineText}>Offline — pemesanan dinonaktifkan</Text></View>}{tab === 'catalog' ? <View style={styles.catalogWrap}><View style={styles.orderIntro}><View><Text style={styles.introTitle}>Stok Gudang Pusat</Text><Text style={styles.introText}>Katalog selalu mengikuti produk yang ditambahkan pusat.</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{total} item</Text></View></View>{catalogLoading ? <ActivityIndicator color={colors.primary} /> : catalogError ? <View style={styles.errorCard}><Text style={styles.errorText}>{catalogError}</Text>{online && <Pressable onPress={() => void loadCatalog()} style={styles.retryButton}><Text style={styles.retryText}>Coba lagi</Text></Pressable>}</View> : <FlatList data={catalog} key={isTablet ? 'tablet-order' : 'phone-order'} numColumns={isTablet ? 4 : 2} keyExtractor={(item) => String(item.id)} columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={styles.empty}>Belum ada produk yang tersedia di gudang pusat.</Text>} renderItem={({ item }) => <View style={styles.productWrap}><ProductCard product={item} onAdd={add} compact showPrice /><Text style={styles.quantity}>Dipesan: {quantities[item.id] ?? 0}</Text></View>} />}{total > 0 && <Pressable disabled={submitting} onPress={() => void submit()} style={[styles.submit, (!online || submitting) && { opacity: 0.45 }]}><Text style={styles.submitText}>{submitting ? 'Mengirim...' : `Buat Purchase Order · ${total} item`}</Text></Pressable>}</View> : ordersLoading && orders.length === 0 ? <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} /> : ordersError ? <View style={styles.errorCard}><Text style={styles.errorText}>{ordersError}</Text>{online && <Pressable onPress={() => void loadOrders()} style={styles.retryButton}><Text style={styles.retryText}>Coba lagi</Text></Pressable>}</View> : <FlatList data={orders} keyExtractor={(item) => item.id} contentContainerStyle={styles.orderList} refreshing={ordersLoading} onRefresh={() => void loadOrders()} ListEmptyComponent={<Text style={styles.empty}>Belum ada pesanan ke pusat.</Text>} renderItem={({ item }) => <View style={styles.orderRow}><View><Text style={styles.orderId}>PO #{item.id}</Text><Text style={styles.orderMeta}>{new Date(item.createdAt).toLocaleString('id-ID')} · {item.items.reduce((sum, line) => sum + line.jumlahPesan, 0)} item</Text><Text style={styles.orderMeta}>Rp{Number(item.totalAmount).toLocaleString('id-ID')}</Text></View><View style={[styles.status, { backgroundColor: `${statusColors[item.status]}18` }]}><View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} /><Text style={[styles.statusText, { color: statusColors[item.status] }]}>{item.status}</Text></View></View>} />}</View>;
}

const styles = StyleSheet.create({
  offline: { backgroundColor: colors.orangeSoft, padding: 9, alignItems: 'center' },
  offlineText: { color: colors.orange, fontSize: 11, fontWeight: '800' },
  errorCard: { margin: 16, padding: 18, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center' },
  errorText: { color: colors.orange, textAlign: 'center', fontWeight: '700' },
  retryButton: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  screen: { flex: 1, backgroundColor: colors.canvas }, tabs: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, tab: { paddingVertical: 15, marginRight: 22, borderBottomWidth: 3, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: colors.primary }, tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 }, activeTabText: { color: colors.primary }, catalogWrap: { flex: 1 }, orderIntro: { margin: 16, marginBottom: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, introTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, introText: { color: colors.muted, fontSize: 11, marginTop: 3 }, countBadge: { backgroundColor: colors.primarySoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 }, countText: { color: colors.primary, fontWeight: '800', fontSize: 11 }, grid: { padding: 16, paddingBottom: 90 }, gridRow: { gap: 12, marginBottom: 12 }, productWrap: { flex: 1, maxWidth: 230 }, quantity: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 5, textAlign: 'center' }, empty: { color: colors.muted, textAlign: 'center', padding: 30 }, submit: { position: 'absolute', bottom: 14, left: 16, right: 16, backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' }, submitText: { color: '#FFFFFF', fontWeight: '800' }, orderList: { margin: 16, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14 }, orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, orderId: { color: colors.ink, fontWeight: '900' }, orderMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, status: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignItems: 'center' }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusText: { fontWeight: '800', fontSize: 11, textTransform: 'capitalize' },
});
