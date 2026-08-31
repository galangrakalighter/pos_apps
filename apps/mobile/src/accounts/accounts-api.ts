import { API_URL } from '../config';
import { saveSession } from '../auth/session';
import { Session } from '../types';

export interface UserProfile {
  id: string; username: string; partnerName: string; region: string | null; isPusat: boolean;
}

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
  const updatedSession = { ...session, name: username, partnerName };
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
