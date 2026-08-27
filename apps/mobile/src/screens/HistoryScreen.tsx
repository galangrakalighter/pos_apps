import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { MitraPurchaseHistoryScreen } from './MitraPurchaseHistoryScreen';
import { MitraSalesHistoryScreen } from './MitraSalesHistoryScreen';
import { Session } from '../types';

export function HistoryScreen({ session }: { session: Session }) {
  const [tab, setTab] = useState<'sales' | 'purchases'>('sales');
  return <View style={styles.screen}><View style={styles.tabs}><Pressable onPress={() => setTab('sales')} style={[styles.tab, tab === 'sales' && styles.activeTab]}><Text style={[styles.text, tab === 'sales' && styles.activeText]}>Penjualan Kasir</Text></Pressable><Pressable onPress={() => setTab('purchases')} style={[styles.tab, tab === 'purchases' && styles.activeTab]}><Text style={[styles.text, tab === 'purchases' && styles.activeText]}>Pembelian ke Pusat</Text></Pressable></View>{tab === 'sales' ? <MitraSalesHistoryScreen session={session} /> : <MitraPurchaseHistoryScreen />}</View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas }, tabs: { flexDirection: 'row', paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line }, tab: { paddingVertical: 14, marginRight: 22, borderBottomWidth: 3, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: colors.primary }, text: { color: colors.muted, fontWeight: '700', fontSize: 12 }, activeText: { color: colors.primary } });
