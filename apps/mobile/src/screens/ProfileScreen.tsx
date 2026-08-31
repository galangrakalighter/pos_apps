import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getOwnProfile, updateOwnProfile } from '../accounts/accounts-api';
import { colors } from '../theme';
import { Session } from '../types';

type Values = { username: string; partnerName: string; region: string };

export function ProfileScreen({ session, onSessionUpdated, onLogout }: { session: Session; onSessionUpdated: (session: Session) => void; onLogout: () => void }) {
  const safeUsername = session.name?.trim() || 'akun';
  const safePartnerName = session.partnerName?.trim() || safeUsername;
  const initial = { username: safeUsername, partnerName: safePartnerName, region: '' };
  const [values, setValues] = useState<Values>(initial);
  const [snapshot, setSnapshot] = useState<Values>(initial);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const change = (field: keyof Values, value: string) => setValues((current) => ({ ...current, [field]: value }));

  useEffect(() => { void getOwnProfile(session).then((profile) => { const username = profile.username?.trim() || safeUsername; const loaded = { username, partnerName: profile.partnerName?.trim() || username, region: profile.region ?? '' }; setValues(loaded); setSnapshot(loaded); }).catch((error) => Alert.alert('Profil tidak dapat dimuat', error instanceof Error ? error.message : 'Terjadi kesalahan')); }, [session.accessToken]);
  const cancel = () => { setValues(snapshot); setCurrentPassword(''); setNewPassword(''); setEditing(false); };
  const save = async () => {
    if (!values.username.trim() || !values.partnerName.trim()) return Alert.alert('Data belum lengkap', 'Username dan nama mitra wajib diisi.');
    if (newPassword && newPassword.length < 8) return Alert.alert('Password terlalu pendek', 'Password baru minimal 8 karakter.');
    setSaving(true);
    try {
      const result = await updateOwnProfile(session, { username: values.username.trim(), partnerName: values.partnerName.trim(), region: values.region.trim(), currentPassword: currentPassword || undefined, newPassword: newPassword || undefined });
      const username = result.profile.username?.trim() || values.username.trim() || safeUsername;
      const updated = { username, partnerName: result.profile.partnerName?.trim() || values.partnerName.trim() || username, region: result.profile.region ?? '' };
      setValues(updated); setSnapshot(updated); setCurrentPassword(''); setNewPassword(''); setEditing(false); onSessionUpdated(result.session);
      Alert.alert('Profil tersimpan', 'Perubahan akun berhasil disimpan ke pusat.');
    } catch (error) { Alert.alert('Gagal menyimpan', error instanceof Error ? error.message : 'Terjadi kesalahan'); }
    finally { setSaving(false); }
  };
  const confirmLogout = () => Alert.alert('Keluar dari aplikasi?', 'Anda harus terhubung ke internet untuk login kembali.', [{ text: 'Batal', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: onLogout }]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{(values.partnerName || safePartnerName).slice(0, 1).toUpperCase()}</Text></View><View style={styles.identityCopy}><Text style={styles.identityName}>{values.partnerName || safePartnerName}</Text><Text style={styles.identityMeta}>{session.role === 'pusat' ? 'Admin pusat' : 'Akun mitra'} · {(session.id || '').slice(0, 8)}</Text></View>{!editing && <Pressable onPress={() => setEditing(true)} style={styles.editButton}><Text style={styles.editText}>Edit Profil</Text></Pressable>}</View>
    <View style={styles.card}><Text style={styles.sectionTitle}>Informasi akun</Text><Field label="Username" value={values.username} onChange={(value) => change('username', value)} editable={editing} autoCapitalize="none" /><Field label="Nama mitra" value={values.partnerName} onChange={(value) => change('partnerName', value)} editable={editing} /><Field label="Wilayah" value={values.region} onChange={(value) => change('region', value)} editable={editing} placeholder="Belum dilengkapi" /><Field label="Password" value={editing ? currentPassword : '••••••••'} onChange={setCurrentPassword} editable={editing} secure placeholder="Password saat ini" /></View>
    {editing && <View style={styles.card}><Text style={styles.sectionTitle}>Password baru</Text><Text style={styles.helper}>Kosongkan jika tidak ingin mengganti password.</Text><Field label="Password baru" value={newPassword} onChange={setNewPassword} editable secure placeholder="Minimal 8 karakter" /></View>}
    {editing ? <View style={styles.actions}><Pressable disabled={saving} onPress={cancel} style={styles.cancel}><Text style={styles.cancelText}>Batal</Text></Pressable><Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && { opacity: 0.5 }]}><Text style={styles.saveText}>{saving ? 'Menyimpan...' : 'Simpan perubahan'}</Text></Pressable></View> : <Pressable accessibilityRole="button" onPress={confirmLogout} style={styles.logoutButton}><Text style={styles.logoutText}>Logout</Text><Text style={styles.logoutHint}>Keluar dari akun di perangkat ini</Text></Pressable>}
  </ScrollView>;
}

function Field({ label, value, onChange, placeholder, secure, autoCapitalize, editable }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; secure?: boolean; autoCapitalize?: 'none'; editable: boolean }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput editable={editable} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#98A2B3" secureTextEntry={secure} autoCapitalize={autoCapitalize} style={[styles.input, !editable && styles.readOnly]} /></View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 16, maxWidth: 650, width: '100%', alignSelf: 'center', paddingBottom: 40 }, identity: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 14 }, identityCopy: { flex: 1 }, avatar: { width: 54, height: 54, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFF', fontSize: 23, fontWeight: '900' }, identityName: { color: colors.ink, fontSize: 19, fontWeight: '900' }, identityMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, editButton: { backgroundColor: colors.primarySoft, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 }, editText: { color: colors.primary, fontWeight: '800', fontSize: 11 }, card: { backgroundColor: colors.surface, borderRadius: 16, padding: 17, marginBottom: 11 }, sectionTitle: { color: colors.ink, fontWeight: '900', fontSize: 16, marginBottom: 8 }, helper: { color: colors.muted, fontSize: 10, marginBottom: 5 }, field: { marginTop: 11 }, label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 6 }, input: { height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 13, color: colors.ink, backgroundColor: '#FAFAFA' }, readOnly: { backgroundColor: colors.canvas, color: colors.muted }, actions: { flexDirection: 'row', gap: 9 }, cancel: { flex: 1, padding: 15, borderRadius: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, cancelText: { color: colors.ink, fontWeight: '800' }, save: { flex: 2, backgroundColor: colors.primary, padding: 15, borderRadius: 13, alignItems: 'center' }, saveText: { color: '#FFF', fontWeight: '800' }, logoutButton: { minHeight: 62, borderWidth: 1, borderColor: colors.red, backgroundColor: '#FFF5F5', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, logoutText: { color: colors.red, fontWeight: '900', fontSize: 15 }, logoutHint: { color: colors.muted, fontSize: 10, marginTop: 3 } });
