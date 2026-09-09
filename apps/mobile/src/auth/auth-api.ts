import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { saveSession } from './session';
import { Session } from '../types';

interface LoginResponse {
  accessToken: string;
  user: { id: string; mitraId: string; username: string; partnerName: string; isPusat: boolean; centralSupplierId: string | null; profileImageUrl?: string | null };
}

export async function loginOnline(username: string, password: string): Promise<Session> {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw new Error('Wajib terhubung internet untuk login pertama kali');
  }
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Login gagal. Periksa username dan password.');
  }
  const payload = await response.json() as LoginResponse;
  const session: Session = {
    id: payload.user.id, mitraId: payload.user.mitraId, name: payload.user.username,
    partnerName: payload.user.partnerName, role: payload.user.isPusat ? 'pusat' : 'mitra',
    accessToken: payload.accessToken, centralSupplierId: payload.user.centralSupplierId, profileImageUrl: payload.user.profileImageUrl ?? null,
  };
  await saveSession(session);
  return session;
}
