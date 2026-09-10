import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { RemoteOrder } from './procurement-api';

const DIRECTORY_KEY = 'pos.invoice.directory.v1';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const safe = (value: string) => value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ') || 'mitra';

async function invoiceDirectory() {
  const stored = await SecureStore.getItemAsync(DIRECTORY_KEY);
  if (stored) return stored;
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) throw new Error('Pilih folder penyimpanan agar invoice dapat diunduh');
  await SecureStore.setItemAsync(DIRECTORY_KEY, permission.directoryUri);
  return permission.directoryUri;
}

export async function downloadOrderInvoice(order: RemoteOrder, partnerName?: string) {
  const rows = order.items.map((item) => `<tr><td>${esc(item.namaBarang)}</td><td>${item.jumlahPesan} ${esc(item.satuan)}</td><td>Rp${Number(item.lineTotal).toLocaleString('id-ID')}</td></tr>`).join('');
  const html = `<html><head><meta name="viewport" content="width=device-width"><style>body{font-family:Arial;padding:28px;color:#182230}h1{color:#E3792F;margin:0}.meta{margin:5px 0;color:#667085}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}.total{text-align:right;font-size:20px;font-weight:700;margin-top:18px}</style></head><body><h1>CHIMINRO</h1><h2>INVOICE PO #${esc(order.id)}</h2><div class="meta">Mitra: ${esc(partnerName || '-')}</div><div class="meta">Tanggal: ${esc(new Date(order.createdAt).toLocaleString('id-ID'))}</div><div class="meta">Pembayaran: ${esc((order.paymentMethod || 'tunai').toUpperCase())}</div><div class="meta">Status: ${esc(order.status.toUpperCase())}</div><table><thead><tr><th>Produk</th><th>Jumlah</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total Rp${Number(order.totalAmount).toLocaleString('id-ID')}</div></body></html>`;
  const generated = await Print.printToFileAsync({ html });
  const filename = `invoice ${safe(partnerName || 'mitra')} ${safe(order.id)}.pdf`;
  if (Platform.OS === 'android') {
    const directory = await invoiceDirectory();
    try {
      const destination = await FileSystem.StorageAccessFramework.createFileAsync(directory, filename, 'application/pdf');
      const base64 = await FileSystem.readAsStringAsync(generated.uri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(destination, base64, { encoding: FileSystem.EncodingType.Base64 });
      Alert.alert('Invoice tersimpan', `${filename} berhasil disimpan.`);
      return destination;
    } catch (error) {
      await SecureStore.deleteItemAsync(DIRECTORY_KEY);
      throw error;
    }
  }
  const destination = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: generated.uri, to: destination });
  Alert.alert('Invoice tersimpan', filename);
  return destination;
}
