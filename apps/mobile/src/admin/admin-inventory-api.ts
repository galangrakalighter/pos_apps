import { API_URL } from '../config';
import { Session } from '../types';

export interface PartnerStockSummary {
  id: string; username: string; partnerName: string; region: string | null;
  productCount: number; totalStock: number; stockUpdatedAt: string | null; lastSalesSyncAt: string | null;
  isLocked: boolean; hasActivity: boolean;
}
export interface PartnerProductStock { id: string; name: string; stock: number; price: string; kind: 'bahan_baku' | 'produk_jadi'; category: string; unit?: string | null; imageUrl: string | null; masterId: string | null; updatedAt: string; }
export interface WarehouseRecipe { ingredientId: string; quantity: number; name?: string; unit?: string; }
export interface WarehouseProduct { id: string; name: string; stock: number; type: string; price: string; kind: 'bahan_baku' | 'produk_jadi'; unit: string; recipes: WarehouseRecipe[]; imageUrl: string | null; }

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
export const getAdminWarehouseCatalog = (session: Session) => get<WarehouseProduct[]>('/admin/warehouse', session);

type CreateFinishedProductInput = { warehouseId: string };
type UpdateFinishedProductInput = { stock: number };

async function mutateFinishedProduct(session: Session, mitraId: string, path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const response = await fetch(`${API_URL}/admin/partners/${mitraId}/finished-products${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as PartnerProductStock | { message?: string | string[] } | null;
  if (!response.ok) {
    const detail = payload && 'message' in payload ? payload.message : undefined;
    throw new Error(Array.isArray(detail) ? detail[0] : detail ?? `Produk jadi gagal diproses (${response.status})`);
  }
  return payload;
}

export const createPartnerFinishedProduct = (session: Session, mitraId: string, input: CreateFinishedProductInput) =>
  mutateFinishedProduct(session, mitraId, '', 'POST', input) as Promise<PartnerProductStock>;
export const updatePartnerFinishedProduct = (session: Session, mitraId: string, id: string, input: UpdateFinishedProductInput) =>
  mutateFinishedProduct(session, mitraId, `/${id}`, 'PATCH', input) as Promise<PartnerProductStock>;
export const deletePartnerFinishedProduct = (session: Session, mitraId: string, id: string) =>
  mutateFinishedProduct(session, mitraId, `/${id}`, 'DELETE') as Promise<{ deleted: true; id: string }>;

export async function createWarehouseProduct(session: Session, input: { name: string; type: string; stock: number; price: string; kind: 'bahan_baku' | 'produk_jadi'; unit: string; recipes: WarehouseRecipe[] }) {
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

export const updateWarehouseProduct = (session: Session, id: string, input: { name: string; type: string; stock: number; price: string; kind: 'bahan_baku' | 'produk_jadi'; unit: string; recipes: WarehouseRecipe[] }) =>
  mutateWarehouseProduct(session, `/${id}`, 'PATCH', input) as Promise<WarehouseProduct>;

export const deleteWarehouseProduct = (session: Session, id: string) =>
  mutateWarehouseProduct(session, `/${id}`, 'DELETE') as Promise<{ deleted: true; id: string }>;

export async function uploadWarehouseProductImage(session: Session, id: string, asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
  if (!asset?.uri) throw new Error('File gambar tidak valid; silakan pilih gambar kembali');
  const form = new FormData();
  const mimeExtension: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const uriExtension = asset.uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase();
  const extension = mimeExtension[asset.mimeType ?? ''] ?? (uriExtension && ['jpg', 'jpeg', 'png', 'webp'].includes(uriExtension) ? uriExtension : 'jpg');
  const uploadName = asset.fileName?.trim() || `produk-${id}.${extension}`;
  const mimeType = asset.mimeType || (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg');
  form.append('image', { uri: asset.uri, name: uploadName, type: mimeType } as unknown as Blob);
  const response = await fetch(`${API_URL}/admin/warehouse/${id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` }, body: form });
  const payload = await response.json().catch(() => null) as WarehouseProduct | { message?: string | string[] } | null;
  if (!response.ok) {
    const detail = payload && 'message' in payload ? payload.message : undefined;
    throw new Error(Array.isArray(detail) ? detail[0] : detail || `Upload gambar gagal (${response.status})`);
  }
  return payload && 'id' in payload ? payload as WarehouseProduct : null;
}
