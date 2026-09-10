import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { MitraSalesHistoryScreen } from './MitraSalesHistoryScreen';
import { Session } from '../types';

export function HistoryScreen({ session }: { session: Session }) {
  return <View style={styles.screen}><MitraSalesHistoryScreen session={session} /></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas } });
