export type UserRole = 'mitra' | 'pusat';
export type ScreenName = 'pos' | 'history' | 'inventory' | 'orders' | 'profile' | 'adminSales' | 'adminOrders' | 'adminAccounts' | 'adminDiscounts';

export interface Product {
  id: number;
  name: string;
  category: string;
  stock: number;
  price: number;
  color: string;
  imageUrl?: string | null;
  kind: 'bahan_baku' | 'produk_jadi';
  unit?: string | null;
  recipeComplete?: boolean;
  isAvailable?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Session {
  id: string;
  mitraId: string;
  name: string;
  partnerName: string;
  role: UserRole;
  accessToken: string;
  centralSupplierId: string | null;
  profileImageUrl?: string | null;
}

export interface SaleHistory {
  id: string;
  time: string;
  items: number;
  total: number;
  status: 'synced' | 'pending';
}

export interface PurchaseOrder {
  id: string;
  date: string;
  totalItems: number;
  status: 'pending' | 'diterima' | 'dikirim' | 'selesai';
}
