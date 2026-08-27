import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WarehouseProduct } from '../admin/admin-inventory-api';
import { colors } from '../theme';

export function WarehouseProductPicker({ products, selectedIds, onSelect }: {
  products: WarehouseProduct[]; selectedIds: string[]; onSelect: (product: WarehouseProduct) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => products.filter((item) =>
    `${item.name} ${item.type}`.toLowerCase().includes(query.trim().toLowerCase()) && !selectedIds.includes(item.id),
  ), [products, query, selectedIds]);
  return <>
    <Pressable onPress={() => setOpen(true)} style={styles.trigger}><Text style={styles.triggerText}>Pilih produk gudang</Text><Text style={styles.chevron}>⌄</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <View style={styles.header}><Text style={styles.title}>Pilih produk</Text><Pressable onPress={() => setOpen(false)}><Text style={styles.close}>Tutup</Text></Pressable></View>
        <TextInput value={query} onChangeText={setQuery} autoFocus placeholder="Cari nama atau tipe produk..." placeholderTextColor="#98A2B3" style={styles.search} />
        <ScrollView keyboardShouldPersistTaps="handled">
          {!filtered.length ? <Text style={styles.empty}>Produk tidak ditemukan.</Text> : filtered.map((item) => <Pressable key={item.id} onPress={() => { onSelect(item); setOpen(false); setQuery(''); }} style={styles.row}><View><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.type}</Text></View><Text style={styles.stock}>{item.stock} tersedia</Text></Pressable>)}
        </ScrollView>
      </View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({ trigger: { height: 47, borderWidth: 1, borderColor: colors.primary, borderRadius: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft, marginTop: 10 }, triggerText: { color: colors.primary, fontWeight: '800' }, chevron: { color: colors.primary, fontSize: 20 }, backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,.55)', justifyContent: 'center', padding: 20 }, modal: { maxHeight: '75%', width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 18, padding: 16 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: colors.ink, fontWeight: '900', fontSize: 18 }, close: { color: colors.primary, fontWeight: '800' }, search: { height: 45, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, marginVertical: 14, color: colors.ink }, row: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, name: { color: colors.ink, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 10, marginTop: 3 }, stock: { color: colors.primary, fontWeight: '700', fontSize: 11 }, empty: { color: colors.muted, textAlign: 'center', padding: 28 } });
