import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { rupiah } from '../data/mock';
import { getLocalProducts, syncPartnerProducts, updatePartnerProductPrice } from '../products/products-sync';
import { colors } from '../theme';
import { Product, Session } from '../types';

type InventoryTab = 'bahan_baku' | 'produk_jadi';

export function InventoryScreen({ session }: { session: Session }) {
  const [items, setItems] = useState<Product[]>([]);
  const [tab, setTab] = useState<InventoryTab>('bahan_baku');
  const [editing, setEditing] = useState<Product | null>(null);
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const load = async () => { setItems(await getLocalProducts(session.mitraId)); await syncPartnerProducts(session).catch(() => undefined); setItems(await getLocalProducts(session.mitraId)); };
  useEffect(() => { setEditing(null); void load(); }, [session.accessToken, session.mitraId]);
  const visible = useMemo(() => items.filter((item) => item.kind === tab), [items, tab]);
  const openEdit = (item: Product) => { if (item.kind !== 'produk_jadi') return; setEditing(item); setStock(String(item.stock)); setPrice(item.price > 0 ? String(item.price) : ''); };
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
    <View style={styles.notice}><Text style={styles.noticeTitle}>{tab === 'bahan_baku' ? 'Stok bahan baku' : 'Kapasitas produk jadi'}</Text><Text style={styles.noticeText}>{tab === 'bahan_baku' ? 'Bahan baku berasal dari pesanan ke pusat dan hanya dapat dilihat.' : 'Jumlah produk jadi dihitung otomatis dari resep dan stok bahan baku. Mitra mengatur harga jualnya.'}</Text></View>
    <FlatList data={visible} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>{tab === 'bahan_baku' ? 'Belum ada bahan baku.' : 'Pusat belum menambahkan produk jadi.'}</Text>} renderItem={({ item }) => <View style={styles.row}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.art} /> : <View style={[styles.art, { backgroundColor: item.color }]}><Text style={styles.artText}>{item.name[0]}</Text></View>}
      <View style={styles.info}><Text style={styles.name}>{item.name}</Text><Text style={styles.price}>{item.kind === 'produk_jadi' ? (item.price > 0 ? rupiah(item.price) : 'Harga belum diatur') : item.category}</Text></View>
      <View style={styles.stock}><Text style={styles.stockValue}>{item.stock}</Text><Text style={styles.stockLabel}>{item.kind === 'bahan_baku' ? item.unit || 'unit' : 'bisa dibuat'}</Text></View>
      {item.kind === 'produk_jadi' ? <Pressable onPress={() => openEdit(item)} style={styles.edit}><Text style={styles.editText}>Atur harga</Text></Pressable> : <View style={styles.readOnlyBadge}><Text style={styles.readOnlyText}>Hanya lihat</Text></View>}
    </View>} />
    <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}><View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>Atur harga {editing?.name}</Text><Text style={styles.label}>Harga jual Mitra</Text><TextInput value={price} onChangeText={(value) => setPrice(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Contoh: 15000" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.hint}>Kapasitas produksi dihitung otomatis dari bahan baku dan resep pusat.</Text><View style={styles.actions}><Pressable onPress={() => setEditing(null)} style={styles.cancel}><Text style={styles.cancelText}>Batal</Text></Pressable><Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && { opacity: .5 }]}><Text style={styles.saveText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text></Pressable></View></View></View></Modal>
  </View>;
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas, padding: 16 }, tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 13, padding: 4, marginBottom: 12 }, tab: { flex: 1, padding: 11, borderRadius: 10, alignItems: 'center' }, activeTab: { backgroundColor: colors.primary }, tabText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, activeTabText: { color: '#FFF' }, notice: { backgroundColor: colors.primarySoft, padding: 15, borderRadius: 14, marginBottom: 13 }, noticeTitle: { color: colors.primary, fontWeight: '800' }, noticeText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, list: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, art: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, artText: { color: colors.ink, fontSize: 20, fontWeight: '900' }, info: { flex: 1 }, name: { color: colors.ink, fontWeight: '800' }, price: { color: colors.muted, fontSize: 11, marginTop: 3 }, stock: { minWidth: 38, alignItems: 'center' }, stockValue: { color: colors.ink, fontWeight: '900', fontSize: 16 }, stockLabel: { color: colors.muted, fontSize: 9 }, edit: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primarySoft }, editText: { color: colors.primary, fontWeight: '800', fontSize: 9 }, readOnlyBadge: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.canvas }, readOnlyText: { color: colors.muted, fontSize: 9, fontWeight: '700' }, empty: { color: colors.muted, textAlign: 'center', padding: 35 }, backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,.55)', justifyContent: 'center', padding: 20 }, modal: { width: '100%', maxWidth: 450, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 18, padding: 18 }, modalTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, label: { color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 14, marginBottom: 6 }, input: { height: 47, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, color: colors.ink }, hint: { color: colors.muted, fontSize: 10, marginTop: 8 }, actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, cancel: { flex: 1, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: 'center' }, cancelText: { color: colors.ink, fontWeight: '800' }, save: { flex: 2, padding: 13, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center' }, saveText: { color: '#FFF', fontWeight: '800' } });
