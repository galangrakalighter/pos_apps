import { API_URL } from '../config';
import { Session } from '../types';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export interface PartnerStockSummary {
  id: string; username: string; partnerName: string; region: string | null;
  productCount: number; totalStock: number; stockUpdatedAt: string | null; lastSalesSyncAt: string | null;
  isLocked: boolean; hasActivity: boolean;
}
export interface PartnerProductStock { id: string; name: string; stock: number; price: string; updatedAt: string; }
export interface WarehouseProduct { id: string; name: string; stock: number; type: string; price: string; imageUrl: string | null; }

async function get<T>(path: string, session: Session): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const detail = payload?.message;
    const message = Array.isArray(detail) ? detail[0] : detail;
    if (response.status === 401) throw new Error('Sesi akun tidak valid. Silakan logout lalu login kembali saat online.');
    throw new Error(message ?? `Data stok gagal dimuat (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const getPartnersStockSummary = (session: Session) => get<PartnerStockSummary[]>('/admin/partners', session);
export const getPartnerStock = (session: Session, mitraId: string) => get<{ partner: PartnerStockSummary; products: PartnerProductStock[]; snapshotAt: string }>(`/admin/partners/${mitraId}/stock`, session);
export const getWarehouseCatalog = (session: Session) => get<WarehouseProduct[]>('/warehouse', session);

export async function createWarehouseProduct(session: Session, input: { name: string; type: string; stock: number; price: string }) {
  const response = await fetch(`${API_URL}/admin/warehouse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null) as WarehouseProduct | { message?: string | string[] } | null;
  if (!response.ok) {
    const message = body && 'message' in body ? body.message : undefined;
    throw new Error(Array.isArray(message) ? message[0] : message ?? `Produk gagal ditambahkan (${response.status})`);
  }
  return body as WarehouseProduct;
}

async function mutateWarehouseProduct(session: Session, path: string, method: 'PATCH' | 'DELETE', body?: unknown) {
  const response = await fetch(`${API_URL}/admin/warehouse${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as WarehouseProduct | { message?: string | string[] } | null;
  if (!response.ok) {
    const message = payload && 'message' in payload ? payload.message : undefined;
    throw new Error(Array.isArray(message) ? message[0] : message ?? `Perubahan produk gagal (${response.status})`);
  }
  return payload;
}

export const updateWarehouseProduct = (session: Session, id: string, input: { name: string; type: string; stock: number; price: string }) =>
  mutateWarehouseProduct(session, `/${id}`, 'PATCH', input) as Promise<WarehouseProduct>;

export const deleteWarehouseProduct = (session: Session, id: string) =>
  mutateWarehouseProduct(session, `/${id}`, 'DELETE') as Promise<{ deleted: true; id: string }>;

export async function uploadWarehouseProductImage(session: Session, id: string, asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
  if (!asset?.uri) throw new Error('File gambar tidak valid; silakan pilih gambar kembali');
  const form = new FormData();
  const file = new File(asset.uri);
  form.append('image', file);
  const response = await expoFetch(`${API_URL}/admin/warehouse/${id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` }, body: form });
  const payload = await response.json().catch(() => null) as WarehouseProduct | { message?: string | string[] } | null;
  if (!response.ok) {
    const detail = payload && 'message' in payload ? payload.message : undefined;
    throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Upload gambar gagal (${response.status})`);
  }
  if (!payload || !('id' in payload)) throw new Error('Respons upload gambar dari server tidak valid');
  return payload as WarehouseProduct;
}
