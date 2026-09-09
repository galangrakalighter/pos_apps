import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { rupiah } from '../data/mock';
import { ensureLocalPartnerProducts, getLocalProducts, refreshPartnerProducts, updatePartnerProductPrice } from '../products/products-sync';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { Product, Session } from '../types';
import { adjustLocalStock } from '../database/stock-adjustments.repository';

type InventoryTab = 'bahan_baku' | 'produk_jadi';

export function InventoryScreen({ session, refreshKey = 0, onRefreshed }: { session: Session; refreshKey?: number; onRefreshed?: () => void }) {
  const [items, setItems] = useState<Product[]>([]);
  const [tab, setTab] = useState<InventoryTab>('bahan_baku');
  const [editing, setEditing] = useState<Product | null>(null);
  const [price, setPrice] = useState('');
  const [reducing, setReducing] = useState<Product | null>(null);
  const [rawAmount, setRawAmount] = useState('');
  const [rawUnit, setRawUnit] = useState('gram');
  const [saving, setSaving] = useState(false);
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    await ensureLocalPartnerProducts(session).catch(() => undefined);
    setItems(await getLocalProducts(session.mitraId));
  };
  useEffect(() => { setEditing(null); void load(); }, [session.accessToken, session.mitraId, refreshKey]);
  const refresh = async () => {
    setRefreshing(true);
    try { await refreshPartnerProducts(session); await load(); onRefreshed?.(); }
    catch (error) { Alert.alert('Stok gagal diperbarui', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setRefreshing(false); }
  };
  const visible = useMemo(() => items.filter((item) => item.kind === tab), [items, tab]);
  const openEdit = (item: Product) => { if (item.kind !== 'produk_jadi') return; setEditing(item); setPrice(item.price > 0 ? String(item.price) : ''); };
  const unitsFor = (unit?: string | null) => {
    const normalized = (unit || 'unit').toLowerCase();
    if (normalized === 'gram' || normalized === 'kilogram' || normalized === 'kg' || normalized === 'g') return ['gram', 'kilogram'];
    if (normalized === 'mililiter' || normalized === 'ml' || normalized === 'liter') return ['mililiter', 'liter'];
    return [unit || 'unit'];
  };
  const toStoredUnit = (amount: number, inputUnit: string, storedUnit?: string | null) => {
    const input = inputUnit.toLowerCase();
    const stored = (storedUnit || 'unit').toLowerCase();
    const grams = input === 'kilogram' || input === 'kg' ? amount * 1000 : amount;
    if (stored === 'kilogram' || stored === 'kg') return grams / 1000;
    const milliliters = input === 'liter' ? amount * 1000 : amount;
    if (stored === 'liter') return milliliters / 1000;
    return input === 'gram' || input === 'g' || input === 'kilogram' || input === 'kg' ? grams : milliliters;
  };
  const openReduce = (item: Product) => {
    const unit = unitsFor(item.unit)[0];
    setReducing(item); setRawAmount(''); setRawUnit(unit);
  };
  const reduceRaw = async () => {
    if (!reducing) return;
    const amount = Number(rawAmount.replace(',', '.'));
    const normalized = toStoredUnit(amount, rawUnit, reducing.unit);
    if (!Number.isFinite(normalized) || normalized <= 0) return Alert.alert('Jumlah belum valid', 'Masukkan jumlah yang ingin dikurangi.');
    if (normalized > reducing.stock) return Alert.alert('Stok tidak cukup', `Maksimal yang dapat dikurangi ${reducing.stock} ${reducing.unit || 'unit'}.`);
    setSaving(true);
    try { await adjustLocalStock(session.mitraId, reducing.id, -normalized); await load(); setReducing(null); }
    catch (error) { Alert.alert('Stok gagal dikurangi', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setSaving(false); }
  };
  const adjustFinished = async (item: Product, delta: number) => {
    if (delta < 0 && item.stock <= 0) return;
    setAdjustingId(item.id);
    try { await adjustLocalStock(session.mitraId, item.id, delta); await load(); }
    catch (error) { Alert.alert('Stok gagal diubah', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setAdjustingId(null); }
  };
  const save = async () => {
    const sellingPrice = Number(price);
    if (!editing) return;
    if (!price || !Number.isFinite(sellingPrice) || sellingPrice < 0) return Alert.alert('Harga belum valid', 'Masukkan harga jual produk.');
    setSaving(true);
    try { await updatePartnerProductPrice(session, editing.id, sellingPrice); setItems((current) => current.map((item) => item.id === editing.id ? { ...item, price: sellingPrice } : item)); setEditing(null); Alert.alert('Harga diperbarui', 'Harga jual produk jadi berhasil disimpan.'); }
    catch (error) { Alert.alert('Produk gagal disimpan', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setSaving(false); }
  };
  return <View style={styles.screen}>
    <View style={styles.tabs}><Tab label="Bahan Baku" active={tab === 'bahan_baku'} onPress={() => setTab('bahan_baku')} /><Tab label="Produk Jadi" active={tab === 'produk_jadi'} onPress={() => setTab('produk_jadi')} /></View>
    <View style={styles.notice}><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{tab === 'bahan_baku' ? 'Stok bahan baku' : 'Stok produk jadi'}</Text><Text style={styles.noticeText}>{tab === 'bahan_baku' ? 'Mitra dapat mengurangi pemakaian bahan baku. Penambahan hanya berasal dari pesanan ke pusat.' : 'Jumlah produk jadi diatur manual. Resep tetap tersedia sebagai informasi produksi.'}</Text></View><Pressable disabled={refreshing} onPress={() => void refresh()} style={styles.refreshButton}><MaterialCommunityIcons name="refresh" size={18} color={colors.primary} /><Text style={styles.refreshText}>{refreshing ? 'Memuat' : 'Refresh'}</Text></Pressable></View>
    <FlatList data={visible} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} refreshing={refreshing} onRefresh={() => void refresh()} ListEmptyComponent={<Text style={styles.empty}>{tab === 'bahan_baku' ? 'Belum ada bahan baku.' : 'Pusat belum menambahkan produk jadi.'}</Text>} renderItem={({ item }) => <View style={styles.row}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.art} /> : <View style={[styles.art, { backgroundColor: item.color }]}><Text style={styles.artText}>{item.name[0]}</Text></View>}
      <View style={styles.info}><Text style={styles.name}>{item.name}</Text><Text style={styles.price}>{item.kind === 'produk_jadi' ? (item.price > 0 ? rupiah(item.price) : 'Harga belum diatur') : item.category}</Text></View>
      <View style={styles.stock}><Text style={styles.stockValue}>{Number(item.stock.toFixed(3))}</Text><Text style={styles.stockLabel}>{item.kind === 'bahan_baku' ? item.unit || 'unit' : 'pcs'}</Text></View>
      {item.kind === 'produk_jadi' ? <View style={styles.finishedActions}><View style={styles.stepper}><Pressable disabled={adjustingId === item.id || item.stock <= 0} onPress={() => void adjustFinished(item, -1)} style={styles.stepButton}><MaterialCommunityIcons name="minus" size={17} color={colors.primary} /></Pressable><Pressable disabled={adjustingId === item.id} onPress={() => void adjustFinished(item, 1)} style={styles.stepButton}><MaterialCommunityIcons name="plus" size={17} color={colors.primary} /></Pressable></View><Pressable onPress={() => openEdit(item)} style={styles.edit}><MaterialCommunityIcons name="pencil-outline" size={15} color={colors.primary} /></Pressable></View> : <Pressable onPress={() => openReduce(item)} style={styles.reduce}><Text style={styles.reduceText}>Kurangi</Text></Pressable>}
    </View>} />
    <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}><View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>Atur harga {editing?.name}</Text><Text style={styles.label}>Harga jual Mitra</Text><TextInput value={price} onChangeText={(value) => setPrice(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Contoh: 15000" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.hint}>Harga ini digunakan pada transaksi kasir.</Text><View style={styles.actions}><Pressable onPress={() => setEditing(null)} style={styles.cancel}><Text style={styles.cancelText}>Batal</Text></Pressable><Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && { opacity: .5 }]}><Text style={styles.saveText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text></Pressable></View></View></View></Modal>
    <Modal visible={Boolean(reducing)} transparent animationType="fade" onRequestClose={() => setReducing(null)}><View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>Kurangi {reducing?.name}</Text><Text style={styles.label}>Jumlah yang digunakan</Text><TextInput value={rawAmount} onChangeText={(value) => setRawAmount(value.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" placeholder="Contoh: 200" placeholderTextColor="#98A2B3" style={styles.input} /><View style={styles.unitOptions}>{unitsFor(reducing?.unit).map((unit) => <Pressable key={unit} onPress={() => setRawUnit(unit)} style={[styles.unitOption, rawUnit === unit && styles.unitOptionActive]}><Text style={[styles.unitOptionText, rawUnit === unit && styles.unitOptionTextActive]}>{unit}</Text></Pressable>)}</View><Text style={styles.hint}>Stok tersedia: {reducing ? Number(reducing.stock.toFixed(3)) : 0} {reducing?.unit || 'unit'}. Stok bahan baku tidak dapat ditambah manual.</Text><View style={styles.actions}><Pressable onPress={() => setReducing(null)} style={styles.cancel}><Text style={styles.cancelText}>Batal</Text></Pressable><Pressable disabled={saving} onPress={() => void reduceRaw()} style={[styles.save, saving && { opacity: .5 }]}><Text style={styles.saveText}>{saving ? 'Menyimpan...' : 'Kurangi stok'}</Text></Pressable></View></View></View></Modal>
  </View>;
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas, padding: 16 }, tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 13, padding: 4, marginBottom: 12 }, tab: { flex: 1, padding: 11, borderRadius: 10, alignItems: 'center' }, activeTab: { backgroundColor: colors.primary }, tabText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, activeTabText: { color: '#FFF' }, notice: { backgroundColor: colors.primarySoft, padding: 15, borderRadius: 14, marginBottom: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, noticeCopy: { flex: 1 }, noticeTitle: { color: colors.primary, fontWeight: '800' }, noticeText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, refreshButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 10, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 5 }, refreshText: { color: colors.primary, fontWeight: '800', fontSize: 10 }, list: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, art: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, artText: { color: colors.ink, fontSize: 20, fontWeight: '900' }, info: { flex: 1 }, name: { color: colors.ink, fontWeight: '800' }, price: { color: colors.muted, fontSize: 11, marginTop: 3 }, stock: { minWidth: 40, alignItems: 'center' }, stockValue: { color: colors.ink, fontWeight: '900', fontSize: 16 }, stockLabel: { color: colors.muted, fontSize: 9 }, finishedActions: { alignItems: 'flex-end', gap: 6 }, stepper: { flexDirection: 'row', gap: 5 }, stepButton: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, edit: { width: 65, height: 28, borderRadius: 8, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }, reduce: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.primarySoft }, reduceText: { color: colors.primary, fontWeight: '800', fontSize: 10 }, empty: { color: colors.muted, textAlign: 'center', padding: 35 }, backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,.55)', justifyContent: 'center', padding: 20 }, modal: { width: '100%', maxWidth: 450, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 18, padding: 18 }, modalTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, label: { color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 14, marginBottom: 6 }, input: { height: 47, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, color: colors.ink }, unitOptions: { flexDirection: 'row', gap: 8, marginTop: 10 }, unitOption: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, alignItems: 'center' }, unitOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, unitOptionText: { color: colors.muted, fontWeight: '700', textTransform: 'capitalize' }, unitOptionTextActive: { color: colors.primary }, hint: { color: colors.muted, fontSize: 10, marginTop: 8 }, actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, cancel: { flex: 1, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: 'center' }, cancelText: { color: colors.ink, fontWeight: '800' }, save: { flex: 2, padding: 13, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center' }, saveText: { color: '#FFF', fontWeight: '800' } });
