import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { ScreenName, Session } from '../types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const partnerItems: Array<{ id: ScreenName; label: string; icon: IconName }> = [
  { id: 'pos', label: 'Kasir', icon: 'point-of-sale' }, { id: 'history', label: 'Riwayat', icon: 'receipt-text-clock-outline' }, { id: 'inventory', label: 'Stok', icon: 'package-variant-closed' }, { id: 'orders', label: 'Pesanan', icon: 'truck-delivery-outline' }, { id: 'profile', label: 'Profil', icon: 'account-circle-outline' },
];
const adminItems: Array<{ id: ScreenName; label: string; icon: IconName }> = [
  { id: 'adminSales', label: 'Monitoring', icon: 'chart-box-outline' }, { id: 'adminOrders', label: 'Order Masuk', icon: 'inbox-arrow-down-outline' }, { id: 'adminAccounts', label: 'Manajemen Mitra', icon: 'store-cog-outline' }, { id: 'inventory', label: 'Gudang', icon: 'warehouse' }, { id: 'profile', label: 'Profil', icon: 'account-circle-outline' },
];

export function AppNavigation({ active, onChange, isTablet, session, onLogout }: { active: ScreenName; onChange: (screen: ScreenName) => void; isTablet: boolean; session: Session; onLogout: () => void }) {
  const items = session.role === 'pusat' ? adminItems : partnerItems;
  if (!isTablet) return <View style={styles.bottom}>{items.map((item) => <Pressable key={item.id} onPress={() => onChange(item.id)} style={styles.bottomItem}><MaterialCommunityIcons name={item.icon} size={21} color={active === item.id ? colors.primary : colors.muted} /><Text style={[styles.bottomLabel, active === item.id && styles.activeText]}>{item.label}</Text></Pressable>)}</View>;
  return <View style={styles.sidebar}><View style={styles.logo}><MaterialCommunityIcons name="point-of-sale" size={23} color={colors.primary} /></View><View style={styles.partner}><Text style={styles.partnerName}>{session.partnerName}</Text><Text style={styles.role}>{session.role === 'pusat' ? 'Admin pusat' : 'Mitra aktif'}</Text></View><View style={styles.menu}>{items.map((item) => <Pressable key={item.id} onPress={() => onChange(item.id)} style={[styles.menuItem, active === item.id && styles.activeMenu]}><MaterialCommunityIcons name={item.icon} size={21} color={active === item.id ? '#FFFFFF' : '#FFE0C9'} /><Text style={[styles.menuLabel, active === item.id && styles.activeMenuText]}>{item.label}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  sidebar: { width: 210, backgroundColor: colors.primary, padding: 18 }, logo: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, logoText: { color: colors.primary, fontWeight: '900', fontSize: 21 }, partner: { marginTop: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.22)' }, partnerName: { color: '#FFFFFF', fontWeight: '800' }, role: { color: '#FFE0C9', fontSize: 11, marginTop: 3 }, menu: { marginTop: 18, gap: 7, flex: 1 }, menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 11 }, activeMenu: { backgroundColor: 'rgba(255,255,255,0.18)' }, menuIcon: { color: '#FFE0C9', fontSize: 20, width: 23, textAlign: 'center' }, menuLabel: { color: '#FFF3EA', fontWeight: '700' }, activeMenuText: { color: '#FFFFFF' }, logout: { padding: 12 }, logoutText: { color: '#FFF3EA', fontWeight: '700' }, bottom: { height: 68, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, bottomItem: { alignItems: 'center', gap: 3, minWidth: 58 }, bottomIcon: { color: colors.muted, fontSize: 19 }, bottomLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' }, activeText: { color: colors.primary },
});
