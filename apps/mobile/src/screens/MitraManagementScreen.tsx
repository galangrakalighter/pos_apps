import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminDeletePartner, adminSetPartnerLock, adminUpdatePartner } from '../accounts/accounts-api';
import { PartnerStockSummary } from '../admin/admin-inventory-api';
import { PartnerStockMonitoring } from '../components/PartnerStockMonitoring';
import { colors } from '../theme';
import { Session } from '../types';
import { AdminPartnerAccountsScreen } from './AdminPartnerAccountsScreen';

export function MitraManagementScreen({ session }: { session: Session }) {
  const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<PartnerStockSummary | null>(null);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false); const [refreshKey, setRefreshKey] = useState(0);
  const refreshed = () => setRefreshKey((value) => value + 1);
  const beginEdit = (partner: PartnerStockSummary) => { setEditing(partner); setUsername(partner.username); setPassword(''); };
  const closeEdit = () => { setEditing(null); setUsername(''); setPassword(''); };
  const saveEdit = async () => {
    if (!editing || username.trim().length < 3) return Alert.alert('Username belum valid', 'Username minimal 3 karakter.');
    if (password && password.length < 8) return Alert.alert('Password belum valid', 'Password baru minimal 8 karakter.');
    setSaving(true);
    try { await adminUpdatePartner(session, editing.id, { username: username.trim(), password: password || undefined }); closeEdit(); refreshed(); Alert.alert('Akun diperbarui', 'Username dan password Mitra berhasil disimpan.'); }
    catch (error) { Alert.alert('Gagal memperbarui akun', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setSaving(false); }
  };
  const askDelete = (partner: PartnerStockSummary) => Alert.alert('Hapus akun Mitra?', partner.isLocked ? `Akun ${partner.username} berstatus Locked. Seluruh produk, stok, penjualan, pesanan, dan distribusinya akan dihapus permanen.` : `Akun ${partner.username} belum memiliki transaksi. Akun dan stoknya akan dihapus permanen.`, [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus permanen', style: 'destructive', onPress: () => void remove(partner) }]);
  const remove = async (partner: PartnerStockSummary) => { try { await adminDeletePartner(session, partner.id); refreshed(); Alert.alert('Akun dihapus', `${partner.username} berhasil dihapus.`); } catch (error) { Alert.alert('Akun tidak dapat dihapus', error instanceof Error ? error.message : 'Terjadi kesalahan'); } };
  const toggleLock = (partner: PartnerStockSummary) => {
    const locked = !partner.isLocked;
    Alert.alert(locked ? 'Lock akun Mitra?' : 'Aktifkan kembali akun?', locked ? `Akun ${partner.username} tidak dapat menggunakan API dan dapat dihapus bersama seluruh datanya.` : `Akun ${partner.username} akan dapat digunakan kembali dan penghapusan paksa dinonaktifkan.`, [{ text: 'Batal', style: 'cancel' }, { text: locked ? 'Lock akun' : 'Unlock akun', style: locked ? 'destructive' : 'default', onPress: async () => { try { await adminSetPartnerLock(session, partner.id, locked); refreshed(); } catch (error) { Alert.alert('Status gagal diubah', error instanceof Error ? error.message : 'Terjadi kesalahan'); } } }]);
  };
  return <View style={styles.screen}>
    <View style={styles.header}><View><Text style={styles.title}>Seluruh Mitra</Text><Text style={styles.subtitle}>Kelola akun dan sisa stok toko.</Text></View><Pressable onPress={() => setAdding(true)} style={styles.addButton}><Text style={styles.addText}>＋ Tambah Mitra</Text></Pressable></View>
    <View style={styles.list}><PartnerStockMonitoring session={session} refreshKey={refreshKey} onEdit={beginEdit} onDelete={askDelete} onToggleLock={toggleLock} /></View>
    <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}><SafeAreaView style={styles.modalScreen}><ModalHeader title="Tambah Mitra & Stok Awal" onClose={() => setAdding(false)} /><AdminPartnerAccountsScreen session={session} onCreated={() => { setAdding(false); refreshed(); }} /></SafeAreaView></Modal>
    <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={closeEdit}><View style={styles.backdrop}><View style={styles.editModal}><Text style={styles.editTitle}>Edit akun Mitra</Text><Text style={styles.label}>Username</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" style={styles.input} /><Text style={styles.label}>Password baru</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Kosongkan jika tidak diubah" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.hint}>Data lain, termasuk stok dan nama Mitra, tidak ikut berubah.</Text><View style={styles.actions}><Pressable onPress={closeEdit} style={styles.cancel}><Text style={styles.cancelText}>Batal</Text></Pressable><Pressable disabled={saving} onPress={() => void saveEdit()} style={[styles.save, saving && { opacity: .5 }]}><Text style={styles.saveText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text></Pressable></View></View></View></Modal>
  </View>;
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>Batal</Text></Pressable></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas, padding: 16 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: colors.ink, fontSize: 20, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 }, addButton: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 11 }, addText: { color: '#FFF', fontWeight: '800', fontSize: 11 }, list: { flex: 1 }, modalScreen: { flex: 1, backgroundColor: colors.canvas }, modalHeader: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, close: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.orangeSoft, borderRadius: 9 }, closeText: { color: colors.orange, fontWeight: '800', fontSize: 11 }, backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,.55)', justifyContent: 'center', padding: 20 }, editModal: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 18, padding: 18 }, editTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginBottom: 8 }, label: { color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 11, marginBottom: 6 }, input: { height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, color: colors.ink }, hint: { color: colors.muted, fontSize: 10, marginTop: 10 }, actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, cancel: { flex: 1, padding: 13, borderRadius: 11, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }, cancelText: { color: colors.ink, fontWeight: '800' }, save: { flex: 2, padding: 13, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center' }, saveText: { color: '#FFF', fontWeight: '800' } });
