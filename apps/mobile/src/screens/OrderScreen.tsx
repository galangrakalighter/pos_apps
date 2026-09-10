import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ProductCard } from '../components/ProductCard';
import { colors } from '../theme';
import { Product, Session } from '../types';
import { createProcurementOrder, getMyOrders, RemoteOrder } from '../procurement/procurement-api';
import { getWarehouseCatalog } from '../admin/admin-inventory-api';
import { API_URL } from '../config';
import { subscribeOrderRealtime } from '../realtime/order-realtime';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CentralPaymentSettings, getCentralPayment, profileImageUri } from '../accounts/accounts-api';

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
  const [cartVisible, setCartVisible] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<RemoteOrder | null>(null);
  const [centralPayment, setCentralPayment] = useState<CentralPaymentSettings | null>(null);

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
  useEffect(() => subscribeOrderRealtime((event) => {
    if (event.type === 'status') void loadOrders();
  }), [loadOrders]);

  const lines = useMemo(() => catalog.flatMap((product) => {
    const quantity = Number(quantities[product.id]);
    return Number.isFinite(quantity) && quantity > 0 ? [{ product, quantity, unit: product.unit === 'liter' ? 'liter' : 'kilogram' }] : [];
  }), [catalog, quantities, units]);
  const estimatedTotal = lines.reduce((sum, line) => sum + line.product.price * convertUnit(line.quantity, line.unit, line.product.unit || 'pcs'), 0);

  const selectProduct = (product: Product) => {
    if (!online) return Alert.alert('Koneksi internet diperlukan', 'Untuk memesan ke pusat dibutuhkan akses internet.');
    setQuantities((current) => current[product.id] !== undefined ? current : ({ ...current, [product.id]: '1' }));
    setUnits((current) => ({ ...current, [product.id]: product.unit === 'liter' ? 'liter' : 'kilogram' }));
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
  const removeSelection = (productId: number) => {
    setQuantities((current) => { const next = { ...current }; delete next[productId]; return next; });
    setUnits((current) => { const next = { ...current }; delete next[productId]; return next; });
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
      const created = await createProcurementOrder(session, lines.map((line) => ({ warehouseId: line.product.id, quantity: line.quantity, unit: line.unit })));
      const payment = await getCentralPayment(session).catch(() => ({ qrisImageUrl: null, whatsappNumber: null }));
      setCompletedOrder(created); setCentralPayment(payment); setCartVisible(false);
      await loadOrders();
      setQuantities({}); setUnits({}); setTab('status');
    } catch (error) { Alert.alert('Pemesanan gagal', error instanceof Error ? error.message : 'Terjadi kesalahan'); } finally { setSubmitting(false); }
  };

  const sendWhatsapp = async () => {
    if (!completedOrder || !centralPayment?.whatsappNumber) return Alert.alert('Nomor WhatsApp belum tersedia', 'Pusat belum mengatur nomor WhatsApp.');
    const details = completedOrder.items.map((item) => `- ${item.namaBarang}: ${item.jumlahPesan} ${item.satuan}`).join('\n');
    const message = `Halo Pusat, saya sudah membuat pesanan PO #${completedOrder.id}.\n${details}\nTotal: Rp${Number(completedOrder.totalAmount).toLocaleString('id-ID')}\nMohon konfirmasi pembayarannya.`;
    await Linking.openURL(`https://wa.me/${centralPayment.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`);
  };

  return <View style={styles.screen}>
    <View style={styles.tabs}><Pressable onPress={() => setTab('catalog')} style={[styles.tab, tab === 'catalog' && styles.activeTab]}><Text style={[styles.tabText, tab === 'catalog' && styles.activeTabText]}>Pesan ke Pusat</Text></Pressable><Pressable onPress={() => setTab('status')} style={[styles.tab, tab === 'status' && styles.activeTab]}><Text style={[styles.tabText, tab === 'status' && styles.activeTabText]}>Status Pesanan Saya</Text></Pressable></View>
    {!online && <View style={styles.offline}><Text style={styles.offlineText}>Offline — pemesanan dinonaktifkan</Text></View>}
    {tab === 'catalog' ? <View style={styles.catalogWrap}>
      <View style={styles.orderIntro}><View><Text style={styles.introTitle}>Bahan Baku Pusat</Text><Text style={styles.introText}>Masukkan berat atau volume sesuai kebutuhan.</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{lines.length} jenis</Text></View></View>
      {catalogLoading ? <ActivityIndicator color={colors.primary} /> : catalogError ? <ErrorCard message={catalogError} online={online} retry={loadCatalog} /> : <FlatList data={catalog} key={isTablet ? 'tablet-order' : 'phone-order'} numColumns={isTablet ? 4 : 2} keyExtractor={(item) => String(item.id)} columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={styles.empty}>Belum ada bahan baku di gudang pusat.</Text>} renderItem={({ item }) => <View style={styles.productWrap}>
        <ProductCard product={item} onAdd={selectProduct} compact showPrice />
        {quantities[item.id] !== undefined && <View style={styles.selectedBadge}><MaterialCommunityIcons name="check-circle" size={15} color={colors.primary} /><Text style={styles.selectedText}>Masuk keranjang</Text></View>}
      </View>} />}
      {lines.length > 0 && <Pressable disabled={submitting} onPress={() => setCartVisible(true)} style={[styles.submit, !online && { opacity: 0.45 }]}><Text style={styles.submitText}>{`Lihat Keranjang · ${lines.length} produk`}</Text></Pressable>}
    </View> : ordersLoading && orders.length === 0 ? <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} /> : ordersError ? <ErrorCard message={ordersError} online={online} retry={loadOrders} /> : <FlatList data={orders} keyExtractor={(item) => item.id} contentContainerStyle={styles.orderList} refreshing={ordersLoading} onRefresh={() => void loadOrders()} ListEmptyComponent={<Text style={styles.empty}>Belum ada pesanan ke pusat.</Text>} renderItem={({ item }) => <View style={styles.orderRow}><View style={styles.orderInfo}><Text style={styles.orderId}>PO #{item.id}</Text><Text style={styles.orderMeta}>{new Date(item.createdAt).toLocaleString('id-ID')}</Text>{item.items.map((line) => <Text key={line.id} style={styles.orderMeta}>{line.namaBarang}: {line.jumlahPesan} {line.satuan || 'pcs'}</Text>)}<Text style={styles.orderMeta}>Rp{Number(item.totalAmount).toLocaleString('id-ID')}</Text></View><View style={[styles.status, { backgroundColor: `${statusColors[item.status]}18` }]}><View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} /><Text style={[styles.statusText, { color: statusColors[item.status] }]}>{item.status}</Text></View></View>} />}
    <Modal visible={cartVisible} transparent animationType="slide" onRequestClose={() => setCartVisible(false)}><View style={styles.modalBackdrop}><View style={styles.cartModal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Keranjang Pesanan</Text><Pressable onPress={() => setCartVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.ink} /></Pressable></View><ScrollView contentContainerStyle={styles.cartContent}>{lines.map(({ product, unit }) => <View key={product.id} style={styles.cartRow}><View style={styles.cartInfo}><Text style={styles.cartName}>{product.name}</Text><Text style={styles.cartMeta}>Rp{product.price.toLocaleString('id-ID')} / {unit} · stok {displayQuantity(product.stock)} {unit}</Text></View><TextInput keyboardType="decimal-pad" value={quantities[product.id]} onChangeText={(value) => setQuantities((current) => ({ ...current, [product.id]: value.replace(',', '.') }))} onEndEditing={() => clampQuantity(product, unit)} style={styles.cartInput} /><Text style={styles.cartUnit}>{unit}</Text><Pressable onPress={() => removeSelection(product.id)}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.red} /></Pressable></View>)}</ScrollView><View style={styles.cartFooter}><View style={styles.totalRow}><Text style={styles.totalLabel}>Total pesanan</Text><Text style={styles.totalValue}>Rp{estimatedTotal.toLocaleString('id-ID')}</Text></View><Pressable disabled={submitting} onPress={() => void submit()} style={[styles.checkout, submitting && { opacity: .5 }]}><Text style={styles.submitText}>{submitting ? 'Mengirim...' : 'Buat Purchase Order'}</Text></Pressable></View></View></View></Modal>
    <Modal visible={Boolean(completedOrder)} transparent animationType="fade" onRequestClose={() => setCompletedOrder(null)}><View style={styles.modalBackdrop}><View style={styles.paymentModal}><Text style={styles.modalTitle}>Pesanan berhasil dibuat</Text><Text style={styles.paymentHint}>Scan QRIS pusat untuk melakukan pembayaran. Konfirmasi pembayaran dilakukan melalui WhatsApp.</Text>{centralPayment?.qrisImageUrl ? <Image source={{ uri: profileImageUri(centralPayment.qrisImageUrl) || undefined }} resizeMode="contain" style={styles.centralQris} /> : <View style={styles.qrisEmpty}><MaterialCommunityIcons name="qrcode" size={48} color={colors.muted} /><Text style={styles.cartMeta}>Pusat belum memasang QRIS</Text></View>}<Text style={styles.paymentTotal}>Rp{Number(completedOrder?.totalAmount || 0).toLocaleString('id-ID')}</Text><Pressable onPress={() => void sendWhatsapp()} style={styles.whatsapp}><MaterialCommunityIcons name="whatsapp" size={20} color="#FFF" /><Text style={styles.submitText}>Konfirmasi lewat WhatsApp</Text></Pressable><Pressable onPress={() => setCompletedOrder(null)} style={styles.closePayment}><Text style={styles.closePaymentText}>Tutup</Text></Pressable></View></View></Modal>
  </View>;
}

function ErrorCard({ message, online, retry }: { message: string; online: boolean; retry: () => void | Promise<void> }) {
  return <View style={styles.errorCard}><Text style={styles.errorText}>{message}</Text>{online && <Pressable onPress={() => void retry()} style={styles.retryButton}><Text style={styles.retryText}>Coba lagi</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, tabs: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, tab: { paddingVertical: 15, marginRight: 22, borderBottomWidth: 3, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: colors.primary }, tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 }, activeTabText: { color: colors.primary },
  offline: { backgroundColor: colors.orangeSoft, padding: 9, alignItems: 'center' }, offlineText: { color: colors.orange, fontSize: 11, fontWeight: '800' }, catalogWrap: { flex: 1 }, orderIntro: { margin: 16, marginBottom: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, introTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, introText: { color: colors.muted, fontSize: 11, marginTop: 3 }, countBadge: { backgroundColor: colors.primarySoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 }, countText: { color: colors.primary, fontWeight: '800', fontSize: 11 },
  grid: { padding: 16, paddingBottom: 110 }, gridRow: { gap: 12, marginBottom: 12 }, productWrap: { flex: 1, maxWidth: 230 }, quantityPanel: { marginTop: 8, padding: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface }, quantityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, quantityTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' }, removeSelection: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.canvas }, quantityInput: { height: 40, marginTop: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 11, backgroundColor: '#FAFAFA', color: colors.ink }, unitRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 6 }, unitChip: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surface }, unitActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, unitText: { color: colors.muted, fontSize: 9, fontWeight: '700' }, unitActiveText: { color: colors.primary }, quantity: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', padding: 30 }, submit: { position: 'absolute', bottom: 14, left: 16, right: 16, backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' }, submitText: { color: '#FFFFFF', fontWeight: '800' }, errorCard: { margin: 16, padding: 18, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center' }, errorText: { color: colors.orange, textAlign: 'center', fontWeight: '700' }, retryButton: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 }, retryText: { color: '#FFFFFF', fontWeight: '800' },
  orderList: { margin: 16, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14 }, orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, orderInfo: { flex: 1 }, orderId: { color: colors.ink, fontWeight: '900' }, orderMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, status: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignItems: 'center' }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusText: { fontWeight: '800', fontSize: 11, textTransform: 'capitalize' },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 7, backgroundColor: colors.primarySoft, borderRadius: 9, marginTop: 6 }, selectedText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,.6)', justifyContent: 'flex-end' }, cartModal: { width: '100%', maxWidth: 620, maxHeight: '85%', alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.line }, modalTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, cartContent: { padding: 16 }, cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, cartInfo: { flex: 1 }, cartName: { color: colors.ink, fontWeight: '900' }, cartMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, cartInput: { width: 78, height: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 9, color: colors.ink }, cartUnit: { color: colors.ink, fontWeight: '800', fontSize: 10 }, cartFooter: { padding: 18, borderTopWidth: 1, borderTopColor: colors.line }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, totalLabel: { color: colors.muted }, totalValue: { color: colors.ink, fontSize: 20, fontWeight: '900' }, checkout: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 13 }, paymentModal: { width: '92%', maxWidth: 470, alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto', backgroundColor: colors.surface, borderRadius: 20, padding: 20, alignItems: 'center' }, paymentHint: { color: colors.muted, textAlign: 'center', lineHeight: 17, fontSize: 11, marginTop: 7 }, centralQris: { width: 235, height: 235, marginVertical: 14, backgroundColor: '#FFF', borderRadius: 10 }, qrisEmpty: { width: 235, height: 180, marginVertical: 14, backgroundColor: colors.canvas, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, paymentTotal: { color: colors.ink, fontSize: 24, fontWeight: '900', marginBottom: 13 }, whatsapp: { width: '100%', backgroundColor: '#25D366', padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, closePayment: { padding: 12 }, closePaymentText: { color: colors.muted, fontWeight: '800' },
});
