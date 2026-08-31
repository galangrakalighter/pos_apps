import * as SecureStore from 'expo-secure-store';
import { Session } from '../types';

const SESSION_KEY = 'pos.auth.session.v1';

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<Session>;
    if (!stored.id || !stored.accessToken || !stored.role) { await clearSession(); return null; }
    const name = typeof stored.name === 'string' && stored.name.trim() ? stored.name : 'akun';
    return {
      id: stored.id,
      mitraId: stored.mitraId || stored.id,
      name,
      partnerName: typeof stored.partnerName === 'string' && stored.partnerName.trim() ? stored.partnerName : name,
      role: stored.role,
      accessToken: stored.accessToken,
      centralSupplierId: stored.centralSupplierId ?? null,
    };
  } catch { await clearSession(); return null; }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
