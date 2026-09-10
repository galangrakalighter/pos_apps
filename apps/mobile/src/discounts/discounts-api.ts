import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import { getDatabase } from '../database/db';
import { Session } from '../types';

export interface Discount { id: number; name: string; type: 'percent' | 'fixed'; value: number; isActive: boolean }
type Input = Omit<Discount, 'id'>;

async function request<T>(session: Session, path = '', init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/discounts${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...init?.headers } });
  const body = await response.json().catch(() => null) as T | { message?: string | string[] } | null;
  if (!response.ok) { const detail = body && typeof body === 'object' && 'message' in body ? body.message : undefined; throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Request diskon gagal (${response.status})`); }
  return body as T;
}

export function adminDiscounts(session: Session) { return request<Array<{ id: string; name: string; type: 'percent' | 'fixed'; value: number; isActive: boolean }>>(session); }
export function createDiscount(session: Session, input: Input) { return request(session, '', { method: 'POST', body: JSON.stringify(input) }); }
export function updateDiscount(session: Session, id: number, input: Input) { return request(session, `/${id}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function deleteDiscount(session: Session, id: number) { return request(session, `/${id}`, { method: 'DELETE' }); }

export async function syncDiscounts(session: Session) {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return;
  const rows = await request<Array<{ id: string; name: string; type: 'percent' | 'fixed'; value: number; isActive: boolean }>>(session);
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE local_discounts SET is_active = 0');
    for (const row of rows) await db.runAsync(
      `INSERT INTO local_discounts(server_id,name,type,value,is_active,updated_at) VALUES(?,?,?,?,1,?)
       ON CONFLICT(server_id) DO UPDATE SET name=excluded.name,type=excluded.type,value=excluded.value,is_active=1,updated_at=excluded.updated_at`,
      Number(row.id), row.name, row.type, row.value, new Date().toISOString(),
    );
  });
}

export async function getLocalDiscounts(): Promise<Discount[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ server_id: number; name: string; type: 'percent' | 'fixed'; value: number; is_active: number }>('SELECT server_id,name,type,value,is_active FROM local_discounts WHERE is_active=1 ORDER BY name');
  return rows.map((row) => ({ id: row.server_id, name: row.name, type: row.type, value: row.value, isActive: Boolean(row.is_active) }));
}
