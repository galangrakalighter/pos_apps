import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { rupiah } from '../data/mock';
import { colors } from '../theme';
import { CartItem, Product } from '../types';

interface Props {
  items: CartItem[];
  onChangeQuantity: (id: number, delta: number) => void;
  onCheckout: () => void;
  onBack?: () => void;
  onClear: () => void;
  onRemoveItem: (id: number) => void;
  rawMaterials: Product[];
  selectedAddons: Record<number, number[]>;
  onToggleAddon: (finishedProductId: number, rawMaterialId: number) => void;
}

export function CartPanel({ items, onChangeQuantity, onCheckout, onBack, onClear, onRemoveItem, rawMaterials, selectedAddons, onToggleAddon }: Props) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <View style={styles.headingActions}>{onBack && <Pressable onPress={onBack} style={styles.continueButton}><Text style={styles.back}>‹ Kembali ke kasir</Text></Pressable>}{items.length > 0 && <Pressable onPress={onClear} style={styles.clearButton}><Text style={styles.clearText}>Batalkan transaksi</Text></Pressable>}</View>
        <View><Text style={styles.title}>Keranjang</Text><Text style={styles.caption}>{items.length} jenis produk</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>＋</Text><Text style={styles.emptyTitle}>Keranjang masih kosong</Text><Text style={styles.emptyText}>Pilih produk untuk memulai transaksi.</Text></View>
        ) : items.map((item) => (
          <View key={item.id} style={styles.itemBlock}><View style={styles.item}>
            <View style={styles.itemInfo}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemPrice}>{rupiah(item.price)}</Text></View><View style={styles.stepper}><Pressable onPress={() => onChangeQuantity(item.id, -1)} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.quantity}>{item.quantity}</Text><Pressable onPress={() => onChangeQuantity(item.id, 1)} style={styles.stepButton}><Text style={styles.stepText}>＋</Text></Pressable><Pressable accessibilityLabel={`Hapus ${item.name}`} onPress={() => onRemoveItem(item.id)} style={styles.removeButton}><Text style={styles.removeText}>×</Text></Pressable></View>
          </View><Text style={styles.addonTitle}>Add-on bahan baku (opsional)</Text><View style={styles.addonOptions}>{rawMaterials.map((material) => { const active = (selectedAddons[item.id] ?? []).includes(material.id); return <Pressable key={material.id} onPress={() => onToggleAddon(item.id, material.id)} style={[styles.addonChip, active && styles.addonChipActive]}><Text style={[styles.addonChipText, active && styles.addonChipTextActive]}>{active ? '✓ ' : '+ '}{material.name}</Text></Pressable>; })}</View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.summary}>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Total pembayaran</Text><Text style={styles.total}>{rupiah(subtotal)}</Text></View>
        <Pressable disabled={!items.length} onPress={onCheckout} style={[styles.payButton, !items.length && styles.payDisabled]}>
          <Text style={styles.payText}>Bayar sekarang</Text><Text style={styles.payAmount}>{rupiah(subtotal)}</Text>
        </Pressable>
        <Text style={styles.offlineNote}>Transaksi aman tersimpan meski sedang offline</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface },
  headingRow: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 10 },
  headingActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  continueButton: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
  clearButton: { backgroundColor: '#FFF1F0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
  clearText: { color: colors.red, fontSize: 10, fontWeight: '900' },
  back: { color: colors.primary, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  caption: { color: colors.muted, fontSize: 12, marginTop: 2 },
  list: { padding: 16, gap: 2, flexGrow: 1 },
  empty: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.primarySoft, color: colors.primary, fontSize: 27 },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 14 },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 5 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 8 },
  itemBlock: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemInfo: { flex: 1 },
  itemName: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  itemPrice: { color: colors.muted, marginTop: 3, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepButton: { width: 29, height: 29, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.primary, fontSize: 17, fontWeight: '700' },
  quantity: { color: colors.ink, minWidth: 18, textAlign: 'center', fontWeight: '800' },
  removeButton: { width: 29, height: 29, borderRadius: 8, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.red, fontSize: 20, fontWeight: '800', lineHeight: 21 },
  addonTitle: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 8 },
  addonOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  addonChip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  addonChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  addonChipText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  addonChipTextActive: { color: colors.primary, fontWeight: '900' },
  summary: { padding: 18, borderTopWidth: 1, borderTopColor: colors.line },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  totalLabel: { color: colors.muted, fontSize: 13 },
  total: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  payButton: { backgroundColor: colors.primary, borderRadius: 13, padding: 15, flexDirection: 'row', justifyContent: 'space-between' },
  payDisabled: { opacity: 0.38 },
  payText: { color: '#FFFFFF', fontWeight: '800' },
  payAmount: { color: '#FFFFFF', fontWeight: '800' },
  offlineNote: { color: colors.muted, textAlign: 'center', fontSize: 10, marginTop: 9 },
});
