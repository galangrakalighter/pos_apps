import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from './src/components/AppHeader';
import { AppNavigation } from './src/components/AppNavigation';
import { AdminOrderManagementScreen } from './src/screens/AdminOrderManagementScreen';
import { OverviewSalesMonitoringScreen } from './src/screens/OverviewSalesMonitoringScreen';
import { MitraManagementScreen } from './src/screens/MitraManagementScreen';
import { initializeDatabase } from './src/database/db';
import { countPendingSales } from './src/database/sales.repository';
import { clearSession, loadSession } from './src/auth/session';
import { startTargetedSync } from './src/sync/targeted-sync';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OrderScreen } from './src/screens/OrderScreen';
import { PosScreen } from './src/screens/PosScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { WarehouseManagementScreen } from './src/screens/WarehouseManagementScreen';
import { colors } from './src/theme';
import { ScreenName, Session } from './src/types';
import { useImmersiveNavigation } from './src/system/useImmersiveNavigation';

const titles: Record<ScreenName, string> = { pos: 'Kasir', history: 'Riwayat bisnis', inventory: 'Produk & stok', orders: 'Procurement', profile: 'Profil akun', adminSales: 'Monitoring penjualan', adminOrders: 'Fulfillment pesanan', adminAccounts: 'Manajemen akun mitra' };

export default function App() {
  useImmersiveNavigation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<ScreenName>('pos');
  const [pendingSync, setPendingSync] = useState(0);
  useEffect(() => {
    void initializeDatabase().then(async () => {
      const stored = await loadSession();
      if (stored) {
        setPendingSync(stored.role === 'mitra' ? await countPendingSales(stored.mitraId) : 0);
        setSession(stored);
        setScreen(stored.role === 'pusat' ? 'adminSales' : 'pos');
      }
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!session || session.role === 'pusat') return;
    return startTargetedSync(session, () => { void countPendingSales(session.mitraId).then(setPendingSync); });
  }, [session]);
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  const handleLogin = (nextSession: Session) => {
    setSession(nextSession);
    setScreen(nextSession.role === 'pusat' ? 'adminSales' : 'pos');
  };
  if (!session) return <LoginScreen onLogin={handleLogin} />;
  const refreshPending = () => { if (session.role === 'mitra') void countPendingSales(session.mitraId).then(setPendingSync); };
  const transactionSaved = () => {
    refreshPending();
  };
  const logout = () => { void clearSession().then(() => { setSession(null); setScreen('pos'); }); };
  const content = screen === 'pos' ? <PosScreen isTablet={isTablet} session={session} onTransactionSaved={transactionSaved} /> : screen === 'history' ? <HistoryScreen session={session} /> : screen === 'inventory' ? (session.role === 'pusat' ? <WarehouseManagementScreen session={session} /> : <InventoryScreen session={session} />) : screen === 'orders' ? <OrderScreen isTablet={isTablet} session={session} /> : screen === 'profile' ? <ProfileScreen session={session} onSessionUpdated={setSession} onLogout={logout} /> : screen === 'adminSales' ? <OverviewSalesMonitoringScreen isTablet={isTablet} session={session} /> : screen === 'adminOrders' ? <AdminOrderManagementScreen session={session} /> : <MitraManagementScreen session={session} />;
  return <SafeAreaProvider><SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.shell}>{isTablet && <AppNavigation active={screen} onChange={setScreen} isTablet session={session} onLogout={logout} />}<View style={styles.main}><AppHeader title={titles[screen]} pendingSync={pendingSync} />{content}{!isTablet && <AppNavigation active={screen} onChange={setScreen} isTablet={false} session={session} onLogout={logout} />}</View></View></SafeAreaView></SafeAreaProvider>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.surface }, shell: { flex: 1, flexDirection: 'row' }, main: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas } });
