import { API_URL } from '../config';
import { Session } from '../types';

export type PartnerSalesRow = { mitraId: string; partnerName: string; transactionCount: number; itemsSold: number; revenue: string };
export type TopProductRow = { productId: string; productName: string; itemsSold: number; revenue: string };
export type CentralPartnerRevenue = { mitraId: string; partnerName: string; revenue: string; orderCount: number; distributionCount: number };
export type AdminSalesSummary = {
  byPartner: PartnerSalesRow[]; topProducts: TopProductRow[];
  centralRevenue: { totalRevenue: string; procurementRevenue: string; initialStockRevenue: string; orderCount: number; distributionCount: number; byPartner: CentralPartnerRevenue[] };
};

export async function getAdminSalesSummary(session: Session, filter: { mitraId?: string; from?: string; to?: string }) {
  const query = new URLSearchParams(Object.entries(filter).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
  const response = await fetch(`${API_URL}/admin/sales/summary?${query}`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  if (!response.ok) throw new Error(`Monitoring omzet gagal dimuat (${response.status})`);
  return response.json() as Promise<AdminSalesSummary>;
}
