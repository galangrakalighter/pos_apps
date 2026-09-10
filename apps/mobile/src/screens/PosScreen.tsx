import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CartPanel } from '../components/CartPanel';
import { ProductCard } from '../components/ProductCard';
import { PaymentMethod, recordTransaction } from '../database/sales.repository';
import { rupiah } from '../data/mock';
import { ensureLocalPartnerProducts, getLocalProducts } from '../products/products-sync';
import { colors } from '../theme';
import { CartItem, Product, Session } from '../types';
import { getLocalQrisImage } from '../payments/local-qris';
import { Discount, getLocalDiscounts, syncDiscounts } from '../discounts/discounts-api';
import { printReceipt } from '../printing/receipt-printer';

export function PosScreen({ isTablet, session, refreshKey = 0, onTransactionSaved }: { isTablet: boolean; session: Session; refreshKey?: number; onTransactionSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<number, number[]>>({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua');
  const [showCart, setShowCart] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paying, setPaying] = useState(false);
  const [qrisImageUri, setQrisImageUri] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  useEffect(() => {
    setCart([]);
    setSelectedAddons({});
    const load = async () => {
      await ensureLocalPartnerProducts(session).catch(() => undefined);
      setProducts(await getLocalProducts(session.mitraId, 'produk_jadi'));
      setRawMaterials(await getLocalProducts(session.mitraId, 'bahan_baku'));
      setQrisImageUri(await getLocalQrisImage(session.mitraId));
      await syncDiscounts(session).catch(() => undefined);
      setDiscounts(await getLocalDiscounts());
    };
    void load();
  }, [session.accessToken, session.mitraId, refreshKey]);

  const categories = useMemo(() => ['Semua', ...Array.from(new Set(products.map((item) => item.category)))], [products]);
  const filtered = useMemo(() => products.filter((item) => (category === 'Semua' || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase())), [products, category, query]);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const add = (product: Product) => setCart((current) => {
    const found = current.find((item) => item.id === product.id);
    return found ? current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, item.stock) } : item) : [...current, { ...product, quantity: 1 }];
  });
  const changeQuantity = (id: number, delta: number) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(item.stock, item.quantity + delta) } : item).filter((item) => item.quantity > 0));
  const toggleAddon = (finishedProductId: number, rawMaterialId: number) => setSelectedAddons((current) => {
    const selected = current[finishedProductId] ?? [];
    return { ...current, [finishedProductId]: selected.includes(rawMaterialId) ? selected.filter((id) => id !== rawMaterialId) : [...selected, rawMaterialId] };
  });
  const removeItem = (id: number) => { setCart((current) => current.filter((item) => item.id !== id)); setSelectedAddons((current) => { const next = { ...current }; delete next[id]; return next; }); };
  const clearCart = () => Alert.alert('Batalkan transaksi?', 'Seluruh produk di keranjang akan dihapus.', [{ text: 'Kembali', style: 'cancel' }, { text: 'Hapus semua', style: 'destructive', onPress: () => { setCart([]); setSelectedAddons({}); setShowCart(false); } }]);
  const checkout = async (method: PaymentMethod, amountPaid: number, note: string, discount: Discount | null) => {
    setPaying(true);
    try {
      const purchasedItems = cart.map((item) => ({ name: item.name, quantity: item.quantity, priceCents: Math.round(item.price * 100), addons: rawMaterials.filter((raw) => (selectedAddons[item.id] ?? []).includes(raw.id)).map((raw) => raw.name) }));
      const result = await recordTransaction(
        session.mitraId,
        cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        {
          method, amountPaidCents: Math.round(amountPaid * 100), note: note.trim() || undefined,
          rawMaterialAddonsByProduct: Object.fromEntries(cart.map((item) => [item.id, rawMaterials.filter((raw) => (selectedAddons[item.id] ?? []).includes(raw.id)).map((raw) => ({ productId: raw.id, name: raw.name }))])),
          discount,
        },
      );
      setProducts(await getLocalProducts(session.mitraId, 'produk_jadi'));
      setCart([]); setSelectedAddons({}); setShowCart(false); setPaymentVisible(false); onTransactionSaved();
      const receipt = {
        id: result.transactionUuid,
        merchantName: session.partnerName || 'POS Mitra',
        cashierName: session.name,
        createdAt: new Date().toISOString(),
        paymentMethod: paymentLabel(method),
        items: purchasedItems,
        totalCents: result.totalCents,
        amountPaidCents: method === 'tunai' ? Math.round(amountPaid * 100) : result.totalCents,
        changeCents: result.changeCents,
        discountName: discount?.name,
        discountAmountCents: discount ? Math.max(0, purchasedItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0) - result.totalCents) : 0,
        note: note.trim() || null,
      };
      Alert.alert('Pembayaran berhasil', `Total ${rupiah(result.totalCents / 100)}\nMetode ${paymentLabel(method)}${method === 'tunai' ? `\nKembalian ${rupiah(result.changeCents / 100)}` : ''}`, [
        { text: 'Nanti', style: 'cancel' },
        { text: 'Cetak struk', onPress: () => void printReceipt(receipt).catch((error) => Alert.alert('Struk gagal dicetak', error instanceof Error ? error.message : 'RawBT tidak dapat dibuka')) },
      ]);
    } catch (error) { Alert.alert('Transaksi gagal', error instanceof Error ? error.message : 'Tidak dapat menyimpan transaksi'); }
    finally { setPaying(false); }
  };

  const cartPanel = <CartPanel items={cart} rawMaterials={rawMaterials} selectedAddons={selectedAddons} onToggleAddon={toggleAddon} onChangeQuantity={changeQuantity} onRemoveItem={removeItem} onClear={clearCart} onCheckout={() => setPaymentVisible(true)} onBack={() => setShowCart(false)} />;
  return <View style={styles.screen}>
    {!isTablet && showCart ? cartPanel : <>
      <View style={styles.catalog}>
        <View style={styles.toolbar}><TextInput value={query} onChangeText={setQuery} placeholder="Cari produk..." placeholderTextColor="#98A2B3" style={styles.search} /></View>
        <View style={styles.categories}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.activeChip]}><Text style={[styles.chipText, category === item && styles.activeChipText]}>{item}</Text></Pressable>)}</View>
        <FlatList data={filtered} key={isTablet ? 'tablet' : 'phone'} keyExtractor={(item) => String(item.id)} numColumns={isTablet ? 3 : 2} columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={styles.empty}>Belum ada produk. Hubungkan internet untuk menyinkronkan stok dari pusat.</Text>} renderItem={({ item }) => <ProductCard product={item} onAdd={add} compact={!isTablet} />} />
        {!isTablet && <Pressable disabled={!cart.length} onPress={() => setShowCart(true)} style={[styles.floatingCart, !cart.length && { opacity: .5 }]}><Text style={styles.floatingText}>Keranjang · {itemCount} item · {rupiah(total)}</Text></Pressable>}
      </View>
      {isTablet && <View style={styles.cartColumn}>{cartPanel}</View>}
    </>}
    <PaymentModal visible={paymentVisible} subtotal={total} discounts={discounts} qrisImageUri={qrisImageUri} saving={paying} onClose={() => !paying && setPaymentVisible(false)} onConfirm={checkout} />
  </View>;
}

function PaymentModal({ visible, subtotal, discounts, qrisImageUri, saving, onClose, onConfirm }: { visible: boolean; subtotal: number; discounts: Discount[]; qrisImageUri: string | null; saving: boolean; onClose: () => void; onConfirm: (method: PaymentMethod, amountPaid: number, note: string, discount: Discount | null) => void }) {
  const [method, setMethod] = useState<PaymentMethod>('tunai');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [discountId, setDiscountId] = useState<number | null>(null);
  useEffect(() => { if (visible) { setMethod('tunai'); setAmount(''); setNote(''); setDiscountId(null); } }, [visible]);
  const discount = discounts.find((item) => item.id === discountId) ?? null;
  const discountAmount = discount ? Math.min(subtotal, discount.type === 'percent' ? Math.round(subtotal * discount.value) / 100 : discount.value) : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const paid = method === 'tunai' ? Number(amount || 0) : total;
  const change = Math.max(0, paid - total);
  const insufficient = method === 'tunai' && paid < total;
  const qrisUnavailable = method === 'qris' && !qrisImageUri;
  const confirm = () => {
    if (insufficient) return Alert.alert('Pembayaran kurang', `Masih kurang ${rupiah(total - paid)}.`);
    if (qrisUnavailable) return Alert.alert('QRIS belum tersedia', 'Konfigurasikan QRIS merchant resmi terlebih dahulu.');
    onConfirm(method, paid, note, discount);
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={paymentStyles.backdrop}>
      <View style={paymentStyles.sheet}><ScrollView keyboardShouldPersistTaps="handled">
        <View style={paymentStyles.header}><View><Text style={paymentStyles.title}>Pembayaran</Text><Text style={paymentStyles.caption}>Periksa total sebelum menyimpan transaksi</Text></View><Pressable onPress={onClose}><Text style={paymentStyles.close}>×</Text></Pressable></View>
        <View style={paymentStyles.totalBox}><Text style={paymentStyles.totalLabel}>Total yang harus dibayar</Text><Text style={paymentStyles.totalValue}>{rupiah(total)}</Text></View>
        <Text style={paymentStyles.label}>Diskon (opsional)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={paymentStyles.methods}><Pressable onPress={() => setDiscountId(null)} style={[paymentStyles.method, discountId === null && paymentStyles.methodActive]}><Text style={[paymentStyles.methodText, discountId === null && paymentStyles.methodTextActive]}>Tanpa diskon</Text></Pressable>{discounts.map((item) => <Pressable key={item.id} onPress={() => setDiscountId(item.id)} style={[paymentStyles.method, discountId === item.id && paymentStyles.methodActive]}><Text style={[paymentStyles.methodText, discountId === item.id && paymentStyles.methodTextActive]}>{item.name} · {item.type === 'percent' ? `${item.value}%` : rupiah(item.value)}</Text></Pressable>)}</ScrollView>
        <Text style={paymentStyles.label}>Metode pembayaran</Text>
        <View style={paymentStyles.methods}>{(['tunai', 'qris'] as PaymentMethod[]).map((item) => <Pressable key={item} onPress={() => setMethod(item)} style={[paymentStyles.method, method === item && paymentStyles.methodActive]}><Text style={[paymentStyles.methodText, method === item && paymentStyles.methodTextActive]}>{paymentLabel(item)}</Text></Pressable>)}</View>
        {method === 'tunai' && <><Text style={paymentStyles.label}>Uang diterima</Text><TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Masukkan nominal pembayaran" placeholderTextColor="#98A2B3" style={paymentStyles.input} /><View style={paymentStyles.quickRow}><Pressable onPress={() => setAmount(String(total))} style={paymentStyles.quick}><Text style={paymentStyles.quickText}>Uang pas</Text></Pressable>{[20000, 50000, 100000].filter((value) => value >= total).slice(0, 2).map((value) => <Pressable key={value} onPress={() => setAmount(String(value))} style={paymentStyles.quick}><Text style={paymentStyles.quickText}>{rupiah(value)}</Text></Pressable>)}</View></>}
        {method === 'qris' && <View style={paymentStyles.qrisBox}>{qrisImageUri ? <Image key={qrisImageUri} source={{ uri: qrisImageUri }} resizeMode="contain" style={paymentStyles.qrisImage} /> : <View style={paymentStyles.qrisMissing}><Text style={paymentStyles.qrisMissingTitle}>QRIS Mitra belum dipasang</Text><Text style={paymentStyles.qrisMissingText}>Buka halaman Profil untuk memilih gambar QRIS terlebih dahulu.</Text></View>}<Text style={paymentStyles.qrisAmount}>Total transaksi: {rupiah(total)}</Text><Text style={paymentStyles.qrisHint}>QRIS gambar bersifat statis. Pelanggan memasukkan nominal sesuai total, lalu kasir memastikan pembayaran diterima.</Text></View>}
        <View style={paymentStyles.breakdown}><Summary label="Subtotal" value={rupiah(subtotal)} />{discount && <Summary label={`Diskon ${discount.name}`} value={`- ${rupiah(discountAmount)}`} />}<Summary label="Total" value={rupiah(total)} strong /><Summary label="Dibayar" value={rupiah(paid)} />{method === 'tunai' && <Summary label={insufficient ? 'Kekurangan' : 'Kembalian'} value={rupiah(insufficient ? total - paid : change)} warning={insufficient} strong />}</View>
        <Text style={paymentStyles.label}>Catatan transaksi (opsional)</Text><TextInput value={note} onChangeText={setNote} placeholder="Contoh: pelanggan member" placeholderTextColor="#98A2B3" style={paymentStyles.input} />
        <Pressable disabled={saving || insufficient || qrisUnavailable} onPress={confirm} style={[paymentStyles.confirm, (saving || insufficient || qrisUnavailable) && { opacity: .45 }]}><Text style={paymentStyles.confirmText}>{saving ? 'Menyimpan...' : `Konfirmasi ${paymentLabel(method)}`}</Text></Pressable>
        <Text style={paymentStyles.offline}>Pembayaran tetap dapat disimpan tanpa internet.</Text>
      </ScrollView></View>
    </KeyboardAvoidingView>
  </Modal>;
}

function Summary({ label, value, warning, strong }: { label: string; value: string; warning?: boolean; strong?: boolean }) { return <View style={paymentStyles.summaryRow}><Text style={[paymentStyles.summaryLabel, strong && { fontWeight: '900' }]}>{label}</Text><Text style={[paymentStyles.summaryValue, strong && { fontSize: 17 }, warning && { color: colors.red }]}>{value}</Text></View>; }
const paymentLabel = (method: PaymentMethod) => ({ tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Kartu Debit' })[method];

const styles = StyleSheet.create({ screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.canvas }, catalog: { flex: 1 }, cartColumn: { width: '35%', minWidth: 320, maxWidth: 430, borderLeftWidth: 1, borderLeftColor: colors.line }, toolbar: { paddingHorizontal: 16, paddingTop: 15 }, search: { height: 44, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, color: colors.ink }, categories: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' }, chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, activeChip: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.muted, fontWeight: '700', fontSize: 12 }, activeChipText: { color: '#FFF' }, grid: { paddingHorizontal: 16, paddingBottom: 90 }, gridRow: { gap: 12, marginBottom: 12 }, empty: { color: colors.muted, textAlign: 'center', padding: 30 }, floatingCart: { position: 'absolute', left: 16, right: 16, bottom: 14, backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center' }, floatingText: { color: '#FFF', fontWeight: '800' } });
const paymentStyles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,.55)' }, sheet: { maxHeight: '92%', width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: colors.ink, fontSize: 22, fontWeight: '900' }, caption: { color: colors.muted, fontSize: 11, marginTop: 3 }, close: { color: colors.muted, fontSize: 30, padding: 7 }, totalBox: { backgroundColor: colors.primarySoft, borderRadius: 16, padding: 17, marginTop: 15 }, totalLabel: { color: colors.primary, fontSize: 11, fontWeight: '700' }, totalValue: { color: colors.primary, fontSize: 29, fontWeight: '900', marginTop: 4 }, label: { color: colors.ink, fontWeight: '800', fontSize: 12, marginTop: 16, marginBottom: 7 }, methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, method: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 }, methodActive: { backgroundColor: colors.primary, borderColor: colors.primary }, methodText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, methodTextActive: { color: '#FFF' }, input: { height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 13, color: colors.ink, backgroundColor: '#FAFAFA' }, quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, quick: { backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 }, quickText: { color: colors.primary, fontSize: 10, fontWeight: '800' }, qrisBox: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: 14, padding: 14, marginTop: 14 }, qrisImage: { width: 220, height: 220, borderRadius: 10, backgroundColor: '#FFF' }, qrisMissing: { minHeight: 150, width: '100%', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 20 }, qrisMissingTitle: { color: colors.ink, fontWeight: '900', textAlign: 'center' }, qrisMissingText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 6 }, qrisAmount: { color: colors.ink, fontWeight: '900', fontSize: 16, marginTop: 10 }, qrisHint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 4 }, breakdown: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 10, marginTop: 16 }, summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }, summaryLabel: { color: colors.muted }, summaryValue: { color: colors.ink, fontWeight: '800' }, confirm: { backgroundColor: colors.primary, borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 18 }, confirmText: { color: '#FFF', fontWeight: '900' }, offline: { color: colors.muted, textAlign: 'center', fontSize: 10, marginTop: 9, marginBottom: 10 } });
