import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props { title: string; pendingSync: number; onLogout?: () => void; }

export function AppHeader({ title, pendingSync, onLogout }: Props) {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))), []);

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>POS MITRA</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.statusGroup}>
        <View style={[styles.pill, online ? styles.onlinePill : styles.offlinePill]}>
          <View style={[styles.dot, { backgroundColor: online ? colors.green : colors.orange }]} />
          <Text style={styles.pillText}>{online ? 'Online' : 'Offline — tetap bisa jualan'}</Text>
        </View>
        {pendingSync > 0 && <Text style={styles.sync}>{pendingSync} transaksi belum disinkron</Text>}
        {onLogout && <Pressable onPress={onLogout}><Text style={styles.logout}>Logout</Text></Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 76, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  statusGroup: { alignItems: 'flex-end', gap: 4, flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  onlinePill: { backgroundColor: colors.primarySoft },
  offlinePill: { backgroundColor: colors.orangeSoft },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  sync: { color: colors.orange, fontSize: 11, fontWeight: '700' },
  logout: { color: colors.red, fontSize: 11, fontWeight: '800', marginTop: 2 },
});
