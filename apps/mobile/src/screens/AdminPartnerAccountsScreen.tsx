import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { onboardPartnerWithStock } from '../accounts/accounts-api';
import { getWarehouseCatalog, WarehouseProduct } from '../admin/admin-inventory-api';
import { WarehouseProductPicker } from '../components/WarehouseProductPicker';
import { colors } from '../theme';
import { Session } from '../types';

export function AdminPartnerAccountsScreen({ session, onCreated }: { session: Session; onCreated?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [catalog, setCatalog] = useState<WarehouseProduct[]>([]);
  const [selected, setSelected] = useState<WarehouseProduct[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (username.trim().length < 3 || password.length < 8) return Alert.alert('Data belum valid', 'Username minimal 3 karakter dan password minimal 8 karakter.');
    const items = selected.filter((item) => Number(quantities[item.id]) > 0).map((item) => ({ warehouseId: Number(item.id), quantity: Number(quantities[item.id]), unit: units[item.id] || item.unit }));
    setSaving(true);
    try {
      const result = await onboardPartnerWithStock(session, username.trim(), password, items);
      setUsername(''); setPassword(''); setQuantities({}); setUnits({}); setSelected([]);
      const message = result.distributionId
        ? `${result.partner.username} menerima stok awal. Omzet pusat: Rp${Number(result.centralRevenue).toLocaleString('id-ID')}`
        : `${result.partner.username} berhasil dibuat tanpa stok awal.`;
      Alert.alert('Mitra berhasil dibuat', message, [{ text: 'Selesai', onPress: onCreated }]);
    } catch (error) { Alert.alert('Gagal membuat Mitra', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setSaving(false); }
  };
  useEffect(() => { setCatalogLoading(true); void getWarehouseCatalog(session).then(setCatalog).catch((error) => Alert.alert('Katalog gagal dimuat', error instanceof Error ? error.message : 'Terjadi kesalahan')).finally(() => setCatalogLoading(false)); }, [session.accessToken]);
  const unitOptions = (item: WarehouseProduct) => item.unit === 'gram' || item.unit === 'kilogram' ? ['gram', 'kilogram'] : item.unit === 'mililiter' || item.unit === 'liter' ? ['mililiter', 'liter'] : [item.unit];
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.intro}><Text style={styles.heading}>Akun & bahan baku awal opsional</Text><Text style={styles.description}>Bahan baku dapat diberikan dengan satuan yang berbeda dan akan dikonversi otomatis ke satuan Gudang Pusat.</Text></View><View style={styles.card}><Text style={styles.section}>Kredensial Mitra</Text><Text style={styles.label}>Username</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="contoh: mitra.kemang" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.label}>Password awal</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Minimal 8 karakter" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.section}>Bahan baku awal (opsional)</Text>{catalogLoading ? <ActivityIndicator color={colors.primary} /> : <WarehouseProductPicker products={catalog} selectedIds={selected.map((item) => item.id)} onSelect={(item) => { setSelected((current) => [...current, item]); setUnits((current) => ({ ...current, [item.id]: item.unit })); }} />}{selected.map((item) => <View key={item.id} style={styles.stockBlock}><View style={styles.stockRow}><View style={styles.itemInfo}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.available}>{item.type} · tersedia {item.stock} {item.unit}</Text></View><TextInput keyboardType="decimal-pad" value={quantities[item.id] ?? ''} onChangeText={(value) => setQuantities((current) => ({ ...current, [item.id]: value.replace(',', '.') }))} placeholder="Jumlah" placeholderTextColor="#98A2B3" style={[styles.input, styles.qty]} /><Pressable onPress={() => { setSelected((current) => current.filter((product) => product.id !== item.id)); setQuantities((current) => { const next = { ...current }; delete next[item.id]; return next; }); setUnits((current) => { const next = { ...current }; delete next[item.id]; return next; }); }}><Text style={styles.remove}>×</Text></Pressable></View><View style={styles.unitRow}>{unitOptions(item).map((option) => <Pressable key={option} onPress={() => setUnits((current) => ({ ...current, [item.id]: option }))} style={[styles.unitChip, (units[item.id] || item.unit) === option && styles.unitActive]}><Text style={[styles.unitText, (units[item.id] || item.unit) === option && styles.unitActiveText]}>{option}</Text></Pressable>)}</View></View>)}<View style={styles.note}><Text style={styles.noteText}>Contoh: stok pusat 1 kilogram dan diberikan 200 gram, maka stok pusat otomatis menjadi 0,8 kilogram.</Text></View><Pressable disabled={saving} onPress={() => void create()} style={[styles.button, saving && { opacity: 0.5 }]}><Text style={styles.buttonText}>{saving ? 'Memproses...' : 'Buat akun Mitra'}</Text></Pressable></View></ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, maxWidth: 700, width: '100%', alignSelf: 'center', paddingBottom: 50 },
  intro: { marginBottom: 15 },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  card: { backgroundColor: colors.surface, borderRadius: 17, padding: 18 },
  section: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 10, marginBottom: 3 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  input: { height: 47, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 13, color: colors.ink, backgroundColor: '#FAFAFA' },
  stockBlock: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 11 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemInfo: { flex: 1 },
  itemName: { color: colors.ink, fontWeight: '800' },
  available: { color: colors.muted, fontSize: 10, marginTop: 3 },
  qty: { width: 85 },
  remove: { color: colors.orange, fontSize: 25, padding: 5 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  unitChip: { borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  unitActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  unitText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  unitActiveText: { color: colors.primary },
  note: { backgroundColor: colors.primarySoft, padding: 11, borderRadius: 10, marginTop: 15 },
  noteText: { color: colors.primary, fontSize: 10, lineHeight: 15 },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
});
