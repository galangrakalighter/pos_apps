import { Product, PurchaseOrder, SaleHistory } from '../types';

export const products: Product[] = [];

export const warehouseProducts: Product[] = [];

export const histories: SaleHistory[] = [];

export const purchaseOrders: PurchaseOrder[] = [];

export const rupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
