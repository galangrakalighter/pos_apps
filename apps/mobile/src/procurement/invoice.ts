import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RemoteOrder } from './procurement-api';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export async function downloadOrderInvoice(order: RemoteOrder, partnerName?: string) {
  const rows = order.items.map((item) => `<tr><td>${esc(item.namaBarang)}</td><td>${item.jumlahPesan} ${esc(item.satuan)}</td><td>Rp${Number(item.lineTotal).toLocaleString('id-ID')}</td></tr>`).join('');
  const html = `<html><head><meta name="viewport" content="width=device-width"><style>body{font-family:Arial;padding:28px;color:#182230}h1{color:#E3792F;margin:0}.meta{margin:5px 0;color:#667085}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}.total{text-align:right;font-size:20px;font-weight:700;margin-top:18px}</style></head><body><h1>CHIMINRO</h1><h2>INVOICE PO #${esc(order.id)}</h2><div class="meta">Mitra: ${esc(partnerName || '-')}</div><div class="meta">Tanggal: ${esc(new Date(order.createdAt).toLocaleString('id-ID'))}</div><div class="meta">Pembayaran: ${esc((order.paymentMethod || 'tunai').toUpperCase())}</div><div class="meta">Status: ${esc(order.status.toUpperCase())}</div><table><thead><tr><th>Produk</th><th>Jumlah</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total Rp${Number(order.totalAmount).toLocaleString('id-ID')}</div></body></html>`;
  const file = await Print.printToFileAsync({ html });
  if (!await Sharing.isAvailableAsync()) throw new Error('Penyimpanan invoice tidak tersedia pada perangkat ini');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `Simpan Invoice PO ${order.id}`, UTI: 'com.adobe.pdf' });
}
