import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ProductCard } from '../components/ProductCard';
import { colors } from '../theme';
import { Product, Session } from '../types';
import { createProcurementOrder, getMyOrders, RemoteOrder } from '../procurement/procurement-api';
import { getWarehouseCatalog } from '../admin/admin-inventory-api';
import { API_URL } from '../config';

type Tab = 'catalog' | 'status';
const statusColors = { pending: colors.orange, diterima: colors.blue, dikirim: '#7A5AF8', selesai: colors.green };
const unitOptions = (unit?: string | null) => unit === 'gram' || unit === 'kilogram' ? ['gram', 'kilogram'] : unit === 'mililiter' || unit === 'liter' ? ['mililiter', 'liter'] : [unit || 'pcs'];
const convertUnit = (quantity: number, from: string, to: string) => {
  if (from === to) return quantity;
  if (from === 'kilogram' && to === 'gram') return quantity * 1000;
  if (from === 'gram' && to === 'kilogram') return quantity / 1000;
  if (from === 'liter' && to === 'mililiter') return quantity * 1000;
  if (from === 'mililiter' && to === 'liter') return quantity / 1000;
  return quantity;
};
const displayQuantity = (value: number) => String(Number(value.toFixed(3)));

export function OrderScreen({ isTablet, session }: { isTablet: boolean; session: Session }) {
  const [tab, setTab] = useState<Tab>('catalog');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [units, setUnits] = useState<Record<number, string>>({});
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
    setCatalogLoading(true); setCatalogError(null);
    try {
      const items = await getWarehouseCatalog(session);
      setCatalog(items.map((item, index) => ({ id: Number(item.id), name: item.name, category: item.type, kind: 'bahan_baku' as const, unit: item.unit, stock: item.stock, price: Number(item.price), imageUrl: item.imageUrl ? `${API_URL.replace(/\/api\/v1\/?$/, '')}${item.imageUrl}` : null, color: ['#FFE0DA', '#FDE6D2', '#F5F0C9', '#DCEEE9'][index % 4] })));
    } catch (error) { setCatalogError(error instanceof Error ? error.message : 'Katalog gagal dimuat'); }
    finally { setCatalogLoading(false); }
  }, [session]);
  useEffect(() => { if (online) void loadCatalog(); else setCatalogLoading(false); }, [online, loadCatalog]);

  const loadOrders = useCallback(async () => {
    if (!online) return;
    setOrdersLoading(true); setOrdersError(null);
    try { setOrders(await getMyOrders(session)); } catch (error) { setOrdersError(error instanceof Error ? error.message : 'Status pesanan gagal dimuat'); } finally { setOrdersLoading(false); }
  }, [online, session]);
  useEffect(() => { if (!online) return; void loadOrders(); const timer = setInterval(() => void loadOrders(), 10000); return () => clearInterval(timer); }, [online, loadOrders]);

  const lines = useMemo(() => catalog.flatMap((product) => {
    const quantity = Number(quantities[product.id]);
    return Number.isFinite(quantity) && quantity > 0 ? [{ product, quantity, unit: units[product.id] || product.unit || 'pcs' }] : [];
  }), [catalog, quantities, units]);
  const estimatedTotal = lines.reduce((sum, line) => sum + line.product.price * convertUnit(line.quantity, line.unit, line.product.unit || 'pcs'), 0);

  const selectProduct = (product: Product) => {
    if (!online) return Alert.alert('Koneksi internet diperlukan', 'Untuk memesan ke pusat dibutuhkan akses internet.');
    setQuantities((current) => ({ ...current, [product.id]: current[product.id] || '1' }));
    setUnits((current) => ({ ...current, [product.id]: current[product.id] || product.unit || 'pcs' }));
  };
  const clampQuantity = (product: Product, requestedUnit = units[product.id] || product.unit || 'pcs') => {
    const requested = Number(quantities[product.id]);
    if (!Number.isFinite(requested) || requested <= 0) return;
    const maximum = convertUnit(product.stock, product.unit || 'pcs', requestedUnit);
    if (requested <= maximum) return;
    setQuantities((current) => ({ ...current, [product.id]: displayQuantity(maximum) }));
    Alert.alert('Jumlah melebihi stok', `Stok maksimum ${product.name} adalah ${displayQuantity(maximum)} ${requestedUnit}. Jumlah pesanan otomatis disesuaikan.`);
  };
  const changeUnit = (product: Product, unit: string) => {
    setUnits((current) => ({ ...current, [product.id]: unit }));
    const requested = Number(quantities[product.id]);
    if (!Number.isFinite(requested) || requested <= 0) return;
    const maximum = convertUnit(product.stock, product.unit || 'pcs', unit);
    if (requested > maximum) {
      setQuantities((current) => ({ ...current, [product.id]: displayQuantity(maximum) }));
      Alert.alert('Jumlah melebihi stok', `Stok maksimum ${product.name} adalah ${displayQuantity(maximum)} ${unit}. Jumlah pesanan otomatis disesuaikan.`);
    }
  };
  const submit = async () => {
    if (!online) return Alert.alert('Koneksi internet diperlukan', 'Untuk memesan ke pusat dibutuhkan akses internet.');
    if (!lines.length) return Alert.alert('Pesanan kosong', 'Isi jumlah bahan baku yang ingin dipesan.');
    const exceeded = lines.filter((line) => convertUnit(line.quantity, line.unit, line.product.unit || 'pcs') > line.product.stock);
    if (exceeded.length) {
      setQuantities((current) => {
        const next = { ...current };
        for (const line of exceeded) next[line.product.id] = displayQuantity(convertUnit(line.product.stock, line.product.unit || 'pcs', line.unit));
        return next;
      });
      const first = exceeded[0];
      const maximum = displayQuantity(convertUnit(first.product.stock, first.product.unit || 'pcs', first.unit));
      return Alert.alert('Jumlah melebihi stok', `Stok maksimum ${first.product.name} adalah ${maximum} ${first.unit}. Jumlah pesanan otomatis disesuaikan.`);
    }
    setSubmitting(true);
    try {
      await createProcurementOrder(session, lines.map((line) => ({ warehouseId: line.product.id, quantity: line.quantity, unit: line.unit })));
      await loadOrders();
      Alert.alert('Purchase order dibuat', `${lines.length} jenis bahan baku senilai Rp${estimatedTotal.toLocaleString('id-ID')} dikirim ke pusat.`);
      setQuantities({}); setUnits({}); setTab('status');
    } catch (error) { Alert.alert('Pemesanan gagal', error instanceof Error ? error.message : 'Terjadi kesalahan'); } finally { setSubmitting(false); }
  };

  return <View style={styles.screen}>
    <View style={styles.tabs}><Pressable onPress={() => setTab('catalog')} style={[styles.tab, tab === 'catalog' && styles.activeTab]}><Text style={[styles.tabText, tab === 'catalog' && styles.activeTabText]}>Pesan ke Pusat</Text></Pressable><Pressable onPress={() => setTab('status')} style={[styles.tab, tab === 'status' && styles.activeTab]}><Text style={[styles.tabText, tab === 'status' && styles.activeTabText]}>Status Pesanan Saya</Text></Pressable></View>
    {!online && <View style={styles.offline}><Text style={styles.offlineText}>Offline — pemesanan dinonaktifkan</Text></View>}
    {tab === 'catalog' ? <View style={styles.catalogWrap}>
      <View style={styles.orderIntro}><View><Text style={styles.introTitle}>Bahan Baku Pusat</Text><Text style={styles.introText}>Masukkan berat atau volume sesuai kebutuhan.</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{lines.length} jenis</Text></View></View>
      {catalogLoading ? <ActivityIndicator color={colors.primary} /> : catalogError ? <ErrorCard message={catalogError} online={online} retry={loadCatalog} /> : <FlatList data={catalog} key={isTablet ? 'tablet-order' : 'phone-order'} numColumns={isTablet ? 4 : 2} keyExtractor={(item) => String(item.id)} columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={styles.empty}>Belum ada bahan baku di gudang pusat.</Text>} renderItem={({ item }) => <View style={styles.productWrap}>
        <ProductCard product={item} onAdd={selectProduct} compact showPrice />
        <TextInput keyboardType="decimal-pad" value={quantities[item.id] ?? ''} onChangeText={(value) => { setQuantities((current) => ({ ...current, [item.id]: value.replace(',', '.') })); setUnits((current) => ({ ...current, [item.id]: current[item.id] || item.unit || 'pcs' })); }} onEndEditing={() => clampQuantity(item)} placeholder="Jumlah" placeholderTextColor="#98A2B3" style={styles.quantityInput} />
        <View style={styles.unitRow}>{unitOptions(item.unit).map((unit) => <Pressable key={unit} onPress={() => changeUnit(item, unit)} style={[styles.unitChip, (units[item.id] || item.unit) === unit && styles.unitActive]}><Text style={[styles.unitText, (units[item.id] || item.unit) === unit && styles.unitActiveText]}>{unit}</Text></Pressable>)}</View>
        {Number(quantities[item.id]) > 0 && <Text style={styles.quantity}>Dipesan: {quantities[item.id]} {units[item.id] || item.unit}</Text>}
      </View>} />}
      {lines.length > 0 && <Pressable disabled={submitting} onPress={() => void submit()} style={[styles.submit, (!online || submitting) && { opacity: 0.45 }]}><Text style={styles.submitText}>{submitting ? 'Mengirim...' : `Buat Purchase Order · Rp${estimatedTotal.toLocaleString('id-ID')}`}</Text></Pressable>}
    </View> : ordersLoading && orders.length === 0 ? <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} /> : ordersError ? <ErrorCard message={ordersError} online={online} retry={loadOrders} /> : <FlatList data={orders} keyExtractor={(item) => item.id} contentContainerStyle={styles.orderList} refreshing={ordersLoading} onRefresh={() => void loadOrders()} ListEmptyComponent={<Text style={styles.empty}>Belum ada pesanan ke pusat.</Text>} renderItem={({ item }) => <View style={styles.orderRow}><View style={styles.orderInfo}><Text style={styles.orderId}>PO #{item.id}</Text><Text style={styles.orderMeta}>{new Date(item.createdAt).toLocaleString('id-ID')}</Text>{item.items.map((line) => <Text key={line.id} style={styles.orderMeta}>{line.namaBarang}: {line.jumlahPesan} {line.satuan || 'pcs'}</Text>)}<Text style={styles.orderMeta}>Rp{Number(item.totalAmount).toLocaleString('id-ID')}</Text></View><View style={[styles.status, { backgroundColor: `${statusColors[item.status]}18` }]}><View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} /><Text style={[styles.statusText, { color: statusColors[item.status] }]}>{item.status}</Text></View></View>} />}
  </View>;
}

function ErrorCard({ message, online, retry }: { message: string; online: boolean; retry: () => void | Promise<void> }) {
  return <View style={styles.errorCard}><Text style={styles.errorText}>{message}</Text>{online && <Pressable onPress={() => void retry()} style={styles.retryButton}><Text style={styles.retryText}>Coba lagi</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, tabs: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, tab: { paddingVertical: 15, marginRight: 22, borderBottomWidth: 3, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: colors.primary }, tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 }, activeTabText: { color: colors.primary },
  offline: { backgroundColor: colors.orangeSoft, padding: 9, alignItems: 'center' }, offlineText: { color: colors.orange, fontSize: 11, fontWeight: '800' }, catalogWrap: { flex: 1 }, orderIntro: { margin: 16, marginBottom: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, introTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, introText: { color: colors.muted, fontSize: 11, marginTop: 3 }, countBadge: { backgroundColor: colors.primarySoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 }, countText: { color: colors.primary, fontWeight: '800', fontSize: 11 },
  grid: { padding: 16, paddingBottom: 110 }, gridRow: { gap: 12, marginBottom: 12 }, productWrap: { flex: 1, maxWidth: 230 }, quantityInput: { height: 40, marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 11, backgroundColor: colors.surface, color: colors.ink }, unitRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 6 }, unitChip: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surface }, unitActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, unitText: { color: colors.muted, fontSize: 9, fontWeight: '700' }, unitActiveText: { color: colors.primary }, quantity: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', padding: 30 }, submit: { position: 'absolute', bottom: 14, left: 16, right: 16, backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' }, submitText: { color: '#FFFFFF', fontWeight: '800' }, errorCard: { margin: 16, padding: 18, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center' }, errorText: { color: colors.orange, textAlign: 'center', fontWeight: '700' }, retryButton: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 }, retryText: { color: '#FFFFFF', fontWeight: '800' },
  orderList: { margin: 16, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14 }, orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, orderInfo: { flex: 1 }, orderId: { color: colors.ink, fontWeight: '900' }, orderMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, status: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignItems: 'center' }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusText: { fontWeight: '800', fontSize: 11, textTransform: 'capitalize' },
});
