import { API_URL } from '../config';
import { saveSession } from '../auth/session';
import { Session } from '../types';

export interface UserProfile {
  id: string; username: string; partnerName: string; region: string | null; isPusat: boolean; profileImageUrl?: string | null;
}

export const profileImageUri = (path?: string | null) => path
  ? (path.startsWith('http://') || path.startsWith('https://') ? path : `${API_URL.replace(/\/api\/v1\/?$/, '')}${path}`)
  : null;

async function request<T>(path: string, session: Session, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new Error(message ?? `Request gagal (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getOwnProfile(session: Session) {
  return request<UserProfile>('/profile', session);
}

export async function updateOwnProfile(
  session: Session,
  changes: { username: string; partnerName: string; region: string; currentPassword?: string; newPassword?: string },
) {
  const profile = await request<UserProfile>('/profile', session, { method: 'PATCH', body: JSON.stringify(changes) });
  const username = profile.username?.trim() || session.name || 'akun';
  const partnerName = profile.partnerName?.trim() || username;
  const updatedSession = { ...session, name: username, partnerName, profileImageUrl: profile.profileImageUrl ?? session.profileImageUrl ?? null };
  await saveSession(updatedSession);
  return { profile, session: updatedSession };
}

export async function uploadOwnProfileImage(session: Session, asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
  if (!asset.uri) throw new Error('File foto profil tidak valid');
  const form = new FormData();
  const extension = asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg';
  form.append('image', { uri: asset.uri, name: asset.fileName?.trim() || `profil.${extension}`, type: asset.mimeType || 'image/jpeg' } as unknown as Blob);
  const response = await fetch(`${API_URL}/profile/image`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` }, body: form,
  });
  const payload = await response.json().catch(() => null) as UserProfile | [UserProfile[], number] | UserProfile[] | { message?: string | string[] } | null;
  if (!response.ok) {
    const detail = payload && !Array.isArray(payload) && 'message' in payload ? payload.message : undefined;
    throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Upload foto gagal (${response.status})`);
  }
  // Tetap kompatibel dengan API lama yang mungkin mengirim hasil mentah
  // UPDATE ... RETURNING sebagai [rows, rowCount].
  const profile = Array.isArray(payload)
    ? (Array.isArray(payload[0]) ? payload[0][0] : payload[0])
    : payload;
  if (!profile || !('id' in profile)) throw new Error('Respons foto profil tidak valid');
  const updatedSession = { ...session, profileImageUrl: profile.profileImageUrl ?? null };
  await saveSession(updatedSession);
  return { profile, session: updatedSession };
}

export interface InitialStockInput {
  warehouseId: number; quantity: number; unit: string;
}

export function onboardPartnerWithStock(session: Session, username: string, password: string, items: InitialStockInput[]) {
  return request<{ partner: UserProfile; distributionId: string | null; centralRevenue: string }>(
    '/admin/partners/onboard-with-stock', session,
    { method: 'POST', body: JSON.stringify({ username, password, items: items.map((item) => ({ ...item, warehouseId: String(item.warehouseId) })) }) },
  );
}

export function adminUpdatePartner(session: Session, id: string, changes: { username?: string; password?: string }) {
  return request<UserProfile>(`/admin/partners/${id}/account`, session, { method: 'PATCH', body: JSON.stringify(changes) });
}

export function adminDeletePartner(session: Session, id: string) {
  return request<{ deleted: true; id: string; forced: boolean }>(`/admin/partners/${id}`, session, { method: 'DELETE' });
}

export function adminSetPartnerLock(session: Session, id: string, locked: boolean) {
  return request<{ id: string; isLocked: boolean }>(`/admin/partners/${id}/lock`, session, { method: 'PATCH', body: JSON.stringify({ locked }) });
}
