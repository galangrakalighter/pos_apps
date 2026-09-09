import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shadow } from '../theme';
import { Session } from '../types';
import { loginOnline } from '../auth/auth-api';
import { Ionicons } from '@expo/vector-icons';

interface Props { onLogin: (session: Session) => void; }

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submit = async () => {
    if (!username.trim() || !password || loading) return;
    setError(''); setLoading(true);
    try { onLogin(await loginOnline(username.trim(), password)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Login gagal'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>P</Text></View><Text style={styles.brandName}>POS Mitra</Text><Text style={styles.tagline}>Jual cepat. Tetap jalan saat offline.</Text></View>
      <View style={styles.card}>
        <Text style={styles.title}>Selamat datang</Text><Text style={styles.subtitle}>Masuk menggunakan akun mitra atau pusat.</Text>
        <Text style={styles.label}>Username</Text>
        <TextInput autoCapitalize="none" value={username} onChangeText={setUsername} placeholder="Masukkan username" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordField}><TextInput value={password} onChangeText={setPassword} placeholder="Masukkan password" placeholderTextColor="#98A2B3" secureTextEntry={!showPassword} style={styles.passwordInput} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.muted} /></Pressable></View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable disabled={loading} onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }, loading && { opacity: 0.55 }]}><Text style={styles.buttonText}>{loading ? 'Memverifikasi...' : 'Masuk ke aplikasi'}</Text></Pressable>
        <Text style={styles.hint}>Login pertama wajib online. Setelah berhasil, sesi dapat digunakan tanpa internet sampai Anda logout.</Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingVertical: 36 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  brandName: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 12 },
  tagline: { color: '#FFF0E5', fontSize: 13, marginTop: 4 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, padding: 24, borderRadius: 22, ...shadow },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  subtitle: { color: colors.muted, marginTop: 5, marginBottom: 20 },
  label: { color: colors.ink, fontWeight: '700', fontSize: 13, marginBottom: 7, marginTop: 10 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, height: 48, color: colors.ink, backgroundColor: '#FAFAFA' },
  passwordField: { height: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#FAFAFA' },
  passwordInput: { flex: 1, height: '100%', paddingLeft: 14, paddingRight: 6, color: colors.ink },
  eyeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  button: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 22 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  hint: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 13 },
  error: { color: colors.red, fontSize: 12, marginTop: 11, fontWeight: '700' },
});
