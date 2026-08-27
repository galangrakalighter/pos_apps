import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { initializeDatabase } from './database/db';
import { startHistorySync } from './sync/history-sync';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    void initializeDatabase().then(() => {
      // Replace with the authenticated session from secure storage.
      stopSync = startHistorySync({ userId: '00000000-0000-0000-0000-000000000000' });
      setReady(true);
    });
    return () => stopSync?.();
  }, []);

  return <Text>{ready ? 'POS ready' : 'Preparing local database…'}</Text>;
}
