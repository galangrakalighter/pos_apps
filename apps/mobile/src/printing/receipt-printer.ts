import { PermissionsAndroid, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';

export interface ReceiptLine { name: string; quantity: number; priceCents: number; addons?: string[]; }
export interface ReceiptData {
  id: string; merchantName: string; cashierName: string; createdAt: string; paymentMethod: string;
  items: ReceiptLine[]; totalCents: number; amountPaidCents: number; changeCents: number;
  discountName?: string | null; discountAmountCents?: number; note?: string | null;
}

const PRINTER_ADDRESS_KEY = 'pos_direct_printer_address';
// Sebagian printer 58 mm generik menggunakan area efektif lebih sempit dari
// 384 dot. Lebar 28 karakter mencegah printer membungkus kolom secara acak.
const PAPER_COLUMNS = 28;
let connectedPrinter: BluetoothDevice | null = null;

const money = (cents: number) => `Rp${Math.round(cents / 100).toLocaleString('id-ID')}`;
// Pertahankan CR/LF karena keduanya merupakan kontrol pindah baris printer.
const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\r\n]/g, ' ');
const fit = (value: string, width: number) => plain(value).slice(0, width);
const columns = (left: string, right: string) => {
  const safeRight = fit(right, PAPER_COLUMNS - 1);
  const safeLeft = fit(left, Math.max(1, PAPER_COLUMNS - safeRight.length - 1));
  return `${safeLeft}${' '.repeat(Math.max(1, PAPER_COLUMNS - safeLeft.length - safeRight.length))}${safeRight}\n`;
};

async function requestBluetoothPermission() {
  if (Platform.OS !== 'android') throw new Error('Cetak Bluetooth langsung hanya tersedia di Android');
  if (Number(Platform.Version) < 31) return;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, {
    title: 'Izin printer Bluetooth',
    message: 'POS Mitra membutuhkan akses ke printer Bluetooth yang sudah dipasangkan.',
    buttonPositive: 'Izinkan', buttonNegative: 'Batal',
  });
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Izin koneksi Bluetooth belum diberikan');
}

async function resolvePrinter(): Promise<BluetoothDevice> {
  await requestBluetoothPermission();
  const { default: bluetooth } = await import('react-native-bluetooth-classic');
  if (!await bluetooth.isBluetoothAvailable()) throw new Error('Perangkat ini tidak mendukung Bluetooth');
  if (!await bluetooth.isBluetoothEnabled() && !await bluetooth.requestBluetoothEnabled()) throw new Error('Aktifkan Bluetooth untuk mencetak struk');
  if (connectedPrinter && await connectedPrinter.isConnected().catch(() => false)) return connectedPrinter;

  const paired = await bluetooth.getBondedDevices();
  const savedAddress = await SecureStore.getItemAsync(PRINTER_ADDRESS_KEY);
  const printer = paired.find((device) => device.address === savedAddress)
    ?? paired.find((device) => /iware|inner\s*printer/i.test(device.name || ''))
    ?? paired.find((device) => /printer|pos|thermal/i.test(device.name || ''));
  if (!printer) throw new Error('Printer iWare belum dipasangkan. Pasangkan printer melalui pengaturan Bluetooth Android terlebih dahulu.');

  if (!await printer.isConnected().catch(() => false)) {
    const options = { connectorType: 'rfcomm', connectionType: 'delimited', charset: 'ISO-8859-1' };
    const connected = await printer.connect({ ...options, secureSocket: false }).catch(() => false)
      || await printer.connect({ ...options, secureSocket: true }).catch(() => false);
    if (!connected) throw new Error(`Tidak dapat terhubung ke ${printer.name || 'printer'}`);
  }
  connectedPrinter = printer;
  await SecureStore.setItemAsync(PRINTER_ADDRESS_KEY, printer.address);
  return printer;
}

function receiptBytes(receipt: ReceiptData) {
  const subtotal = receipt.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const parts: Buffer[] = [];
  const command = (...bytes: number[]) => parts.push(Buffer.from(bytes));
  // Printer thermal iWare membutuhkan CRLF. Jika hanya LF, teks berikutnya
  // tetap dicetak pada baris yang sama dan susunan struk menjadi bertabrakan.
  const text = (value: string) => parts.push(Buffer.from(plain(value).replace(/\r?\n/g, '\r\n'), 'latin1'));

  command(0x1b, 0x40); command(0x1b, 0x32); command(0x1b, 0x4d, 0x00);
  command(0x1b, 0x61, 0x01);
  command(0x1b, 0x21, 0x30); text('CHIMINRO\n'); command(0x1b, 0x21, 0x00);
  command(0x1b, 0x61, 0x00);
  text(`${'='.repeat(PAPER_COLUMNS)}\n`);
  text(columns('No. Struk', receipt.id.slice(0, 8).toUpperCase()));
  text(columns('Tanggal', new Date(receipt.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })));
  text(columns('Metode', receipt.paymentMethod));
  text(`${'-'.repeat(PAPER_COLUMNS)}\n`);
  for (const item of receipt.items) {
    command(0x1b, 0x45, 0x01); text(`${fit(item.name, PAPER_COLUMNS)}\n`); command(0x1b, 0x45, 0x00);
    text(columns(`${item.quantity} x ${money(item.priceCents)}`, money(item.quantity * item.priceCents)));
  }
  text(`${'-'.repeat(PAPER_COLUMNS)}\n`); text(columns('Subtotal', money(subtotal)));
  if (receipt.discountAmountCents) text(columns(`Diskon${receipt.discountName ? ` ${receipt.discountName}` : ''}`, `- ${money(receipt.discountAmountCents)}`));
  command(0x1b, 0x45, 0x01); text(columns('TOTAL', money(receipt.totalCents))); command(0x1b, 0x45, 0x00);
  text(columns('Dibayar', money(receipt.amountPaidCents))); text(columns('Kembali', money(receipt.changeCents)));
  if (receipt.note && receipt.note !== 'Transaksi POS') text(`Catatan: ${fit(receipt.note, PAPER_COLUMNS - 9)}\n`);
  text(`${'='.repeat(PAPER_COLUMNS)}\n`); command(0x1b, 0x61, 0x01); command(0x1b, 0x45, 0x01); text('Terima kasih\n');
  command(0x1b, 0x45, 0x00); text('Simpan struk sebagai bukti.\n\n\n'); command(0x1d, 0x56, 0x00);
  return Buffer.concat(parts);
}

export async function printReceipt(receipt: ReceiptData) {
  const printer = await resolvePrinter();
  if (!await printer.write(receiptBytes(receipt))) throw new Error('Printer menolak data struk');
}
