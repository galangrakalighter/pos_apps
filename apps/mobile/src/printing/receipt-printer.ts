import * as Print from 'expo-print';

export interface ReceiptLine {
  name: string;
  quantity: number;
  priceCents: number;
  addons?: string[];
}

export interface ReceiptData {
  id: string;
  merchantName: string;
  cashierName: string;
  createdAt: string;
  paymentMethod: string;
  items: ReceiptLine[];
  totalCents: number;
  amountPaidCents: number;
  changeCents: number;
  discountName?: string | null;
  discountAmountCents?: number;
  note?: string | null;
}

const money = (cents: number) => `Rp${Math.round(cents / 100).toLocaleString('id-ID')}`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character] ?? character));

export async function printReceipt(receipt: ReceiptData) {
  const subtotal = receipt.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const rows = receipt.items.map((item) => `
    <div class="item-name">${escapeHtml(item.name)}</div>
    <div class="row"><span>${item.quantity} x ${money(item.priceCents)}</span><span>${money(item.quantity * item.priceCents)}</span></div>
    ${item.addons?.length ? `<div class="small">Add-on: ${item.addons.map(escapeHtml).join(', ')}</div>` : ''}
  `).join('');
  const discount = receipt.discountAmountCents
    ? `<div class="row"><span>Diskon${receipt.discountName ? ` ${escapeHtml(receipt.discountName)}` : ''}</span><span>- ${money(receipt.discountAmountCents)}</span></div>`
    : '';
  const note = receipt.note && receipt.note !== 'Transaksi POS'
    ? `<div class="note">Catatan: ${escapeHtml(receipt.note)}</div>`
    : '';

  await Print.printAsync({ html: `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: 58mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 52mm; margin: 0 auto; padding: 3mm 1mm 7mm; font-family: monospace; color: #000; font-size: 10px; }
    h1 { margin: 0; text-align: center; font-size: 17px; }
    .center { text-align: center; }
    .small { font-size: 9px; }
    .rule { border-top: 1px dashed #000; margin: 7px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
    .item-name, .strong { font-weight: 700; }
    .total { font-size: 13px; font-weight: 700; }
    .note { margin-top: 7px; font-size: 9px; }
  </style></head><body>
    <h1>${escapeHtml(receipt.merchantName || 'POS MITRA')}</h1>
    <div class="center small">BUKTI PEMBAYARAN</div><div class="rule"></div>
    <div class="row"><span>No.</span><span>${escapeHtml(receipt.id.slice(0, 8).toUpperCase())}</span></div>
    <div class="row"><span>Tanggal</span><span>${escapeHtml(new Date(receipt.createdAt).toLocaleString('id-ID'))}</span></div>
    <div class="row"><span>Kasir</span><span>${escapeHtml(receipt.cashierName)}</span></div>
    <div class="row"><span>Metode</span><span>${escapeHtml(receipt.paymentMethod)}</span></div>
    <div class="rule"></div>${rows}<div class="rule"></div>
    <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>${discount}
    <div class="row total"><span>TOTAL</span><span>${money(receipt.totalCents)}</span></div>
    <div class="row"><span>Dibayar</span><span>${money(receipt.amountPaidCents)}</span></div>
    <div class="row strong"><span>Kembali</span><span>${money(receipt.changeCents)}</span></div>
    ${note}<div class="rule"></div><div class="center strong">Terima kasih</div>
  </body></html>` });
}
