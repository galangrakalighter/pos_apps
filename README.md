# POS Mitra — Offline-first POS & B2B Procurement

Aplikasi POS mobile untuk mitra dan pusat dengan transaksi offline-first,
procurement B2B, gudang, stok per mitra, produk jadi, diskon, QRIS, invoice,
printer Bluetooth, dan notifikasi order real-time.

## Struktur project

```text
pos_apps/
├── apps/api/                 NestJS REST API + Socket.IO
├── apps/mobile/              React Native Expo mobile app
├── database/migrations/      SQL migration PostgreSQL (001–027)
├── docs/ARCHITECTURE.md      Arsitektur dan keputusan teknis
├── Dockerfile                Image production API
└── docker-compose.yml        Deployment API
```

## Arsitektur

```text
Expo mobile
  ├─ SecureStore  session persisten
  ├─ SQLite        katalog, stok, transaksi, keranjang offline
  ├─ NetInfo       deteksi koneksi dan pemicu sync
  ├─ REST          login, order, profil, sync
  └─ Socket.IO     event order baru/perubahan status

NestJS API → PostgreSQL/Supabase
  ├─ auth, users, products, warehouse, history, orders
  ├─ discounts, recipes, partner sync
  └─ upload gambar
```

SQLite menjadi sumber kebenaran POS saat offline. PostgreSQL adalah sumber data
bersama untuk akun, katalog pusat, stok pusat, order, dan history yang sudah
diterima server. Procurement selalu membutuhkan internet.

## Fitur akun Mitra

- Login pertama wajib online; password diverifikasi server dan di-hash bcrypt.
- JWT dan profil disimpan di SecureStore. Sesi tidak otomatis kedaluwarsa.
- Aplikasi tetap dapat dibuka offline selama pengguna belum logout.
- Kasir hanya menjual produk jadi milik mitra.
- Harga jual produk jadi dapat diatur mitra.
- Keranjang POS tetap tersimpan saat berpindah halaman.
- Pembayaran POS: tunai atau QRIS; diskon pusat dapat digunakan.
- Stok produk jadi berkurang lokal saat transaksi dibuat, termasuk offline.
- Transaksi diberi UUID dan dikirim batch secara idempotent ketika online.
- Taburan tersedia pada semua produk jadi, tetapi pilihannya hanya bahan baku
  kategori `Bumbu Tabur`; taburan hanya informasi dan tidak mengurangi stok.
- QRIS mitra dapat diganti dari profil dan disimpan lokal.
- Riwayat transaksi menampilkan detail pembayaran, diskon, taburan, status sync,
  edit transaksi pending, filter tanggal mulai/akhir, dan cetak ulang.
- Procurement hanya menampilkan bahan baku pusat yang tersedia. Mitra memilih
  item, memasukkan kilogram/liter di keranjang, memilih tunai/QRIS, lalu mengunci
  pesanan. Pesanan pending dapat diedit sebelum difinalisasi.
- Setelah pusat menyelesaikan order, stok bahan baku bertambah di mitra.
- Invoice tersimpan ke perangkat sebagai `invoice <nama mitra> <id>.pdf`.

## Fitur akun Pusat

- Monitoring omset global dengan filter mitra dan tanggal.
- Manajemen mitra: daftar, detail stok, tambah/edit/hapus, lock akun, dan stok awal
  opsional. Pembuatan akun tanpa stok juga didukung.
- Gudang pusat: CRUD bahan baku, harga per kg/liter, satuan, kategori, status
  tersedia/tidak tersedia, dan gambar.
- Produk jadi: CRUD produk jadi per mitra, gambar, stok, harga, dan resep opsional.
- Order masuk: detail item, invoice, metode bayar, status, dan fulfillment stok.
- Diskon: CRUD nama, tipe persentase atau nominal tetap, dan nilai.
- QRIS pusat untuk ditampilkan setelah mitra membuat order.
- Sinkronisasi terarah satu mitra dan notifikasi order real-time.

## Status order dan race condition stok

```text
pending → diterima → dikirim → selesai
```

Mitra harus menekan **Pesanan sudah fix** sebelum pusat menerima order. Saat order
menjadi `selesai`, pengurangan stok gudang dan penambahan stok mitra dilakukan
dalam transaksi database yang sama. Baris dikunci `FOR UPDATE` dan update memakai
`stock >= quantity`, sehingga stok tidak minus ketika beberapa order bersamaan.

## Database

Jalankan migration SQL berurutan. API tidak memiliki script TypeORM
`migration:run`; file SQL adalah migration resmi project.

```text
database/migrations/001_initial.sql
database/migrations/002_development_seed.sql       # opsional, development saja
database/migrations/003_partner_stock_distributions.sql
...
database/migrations/027_order_finalization.sql
```

Untuk database baru jalankan seluruh file numerik satu kali:

```bash
psql "$DATABASE_URL" -f database/migrations/001_initial.sql
# lanjutkan file 002/003/.../027 secara berurutan
```

`002_development_seed.sql` menambahkan data contoh dan tidak boleh dijalankan pada
database production yang ingin dimulai kosong. Jangan aktifkan TypeORM
`synchronize` di production.

## Environment

Salin `apps/api/.env.example` menjadi `apps/api/.env`.

PostgreSQL lokal:

```env
DATABASE_URL=postgresql://postgres:ADMIN@127.0.0.1:5432/pos_apps
DATABASE_SSL=false
PORT=3000
JWT_SECRET=ganti-dengan-random-secret-minimal-32-karakter
```

Supabase pooler:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres
DATABASE_SSL=true
PORT=3000
JWT_SECRET=ganti-dengan-random-secret-minimal-32-karakter
```

Environment mobile berada di `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://api-pos-apps.lightermediagroup.com/api/v1
```

Mobile harus memakai URL API publik/HTTPS, bukan URL PostgreSQL atau `localhost`.
Restart Metro atau buat APK baru setelah mengubah `.env`.

## Menjalankan API

```bash
cd apps/api
npm ci
npm run start:dev
```

API berjalan pada `http://localhost:3000/api/v1`. Script lain:

```bash
npm run build       # compile ke dist
npm start           # jalankan dist/main.js
npm test            # Jest
```

Pada HP fisik, `localhost` adalah HP itu sendiri. Gunakan IP LAN komputer atau
URL publik/ngrok.

## Menjalankan mobile Expo

```bash
cd apps/mobile
npm ci
npx expo start
```

Script tersedia: `npm run start`, `npm run start:safe`, `npm run android`,
dan `npm run ios`. Project menggunakan Expo SDK 54; Expo Go SDK 57 tidak
kompatibel. Fitur native Bluetooth printer dan date picker sebaiknya diuji melalui
development build/APK.

## Membuat APK

Pastikan profile `preview` di `apps/mobile/eas.json` memakai `buildType: apk`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

```bash
cd apps/mobile
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

Dengan token server:

```bash
export EXPO_TOKEN="token-eas"
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

`Availability` di EAS adalah masa berlaku link/artifact unduh, bukan masa berlaku
APK yang sudah terpasang. Simpan APK ke storage sendiri sebelum link habis.

## Deployment API dengan Docker

```bash
git pull
docker compose build --no-cache api
docker compose up -d api
docker compose logs -f api
```

Compose memakai container `pos_app_container`, port host `3000`, `.env` API,
volume `pos_app_uploads` untuk gambar, dan health check `/api/v1/health`.
Gunakan reverse proxy HTTPS untuk domain API publik.

## Endpoint API

Semua endpoint selain login dan health memakai header:
`Authorization: Bearer <JWT>`. Prefix lengkap adalah `/api/v1`.

### Auth, profil, dan akun

```text
POST   /auth/login
GET    /profile
PATCH  /profile
POST   /profile/image
GET    /profile/images/:filename
POST   /admin/partners/onboard-with-stock
PATCH  /admin/partners/:id/account
PATCH  /admin/partners/:id/lock
DELETE /admin/partners/:id
```

### Warehouse, katalog, dan stok

```text
GET/POST/PATCH/DELETE /warehouse[/:id]
POST   /warehouse/:id/image
GET    /admin/partners
GET    /admin/partners/:mitraId/stock
POST   /admin/partners/:mitraId/finished-products
PATCH  /admin/partners/:mitraId/finished-products/:productId
DELETE /admin/partners/:mitraId/finished-products/:productId
GET    /products/mine
PATCH  /products/:id/price
PATCH  /products/:id/finished-stock
POST   /products/stock-adjustments/sync
```

### POS, omset, dan procurement

```text
POST   /history/sync
GET    /history/mine
GET    /admin/sales/summary
POST   /orders
GET    /orders/mine
GET    /orders/incoming
PATCH  /orders/:id
PATCH  /orders/:id/finalize
PATCH  /orders/:id/status
```

### Diskon, pembayaran, dan sinkronisasi terarah

```text
GET/POST        /discounts
PATCH/DELETE    /discounts/:id
GET/PATCH       /central-payment
POST            /central-payment/qris
POST            /sync-requests/partners/:mitraId
GET             /sync-requests/:id
POST            /sync-requests/claim
PATCH           /sync-requests/:id/finish
```

`POST /history/sync` memakai UUID unik dan `ON CONFLICT DO NOTHING`, sehingga
retry tidak menggandakan penjualan. `GET /history/mine` memulihkan history server
setelah aplikasi di-install ulang.

## Offline-first dan pemulihan data

1. `initializeDatabase()` membuat SQLite, tabel katalog, history, dan index.
2. `recordSale()` memakai transaksi SQLite untuk mengurangi stok lokal dan menulis
   history `pending` secara atomik.
3. NetInfo memicu sync ketika online kembali; mutex mencegah sync tumpang tindih.
4. API mengembalikan `acknowledgedUuids`; hanya UUID yang diakui ditandai `synced`.
5. Saat mitra membuka riwayat dan online, server history dipulihkan ke SQLite.

Transaksi pending yang belum pernah terkirim ke server tidak dapat dipulihkan setelah
aplikasi dihapus karena hanya ada di SQLite perangkat lama. Procurement diblokir saat
offline dan menampilkan pesan bahwa koneksi diperlukan.

## Socket.IO

Namespace adalah `/orders` pada origin API, bukan `/api/v1/orders`:

```ts
const socket = io(`${API_ORIGIN}/orders`, {
  auth: { token: accessToken },
  transports: ['websocket', 'polling'],
});
socket.on('orders:new', order => refreshOrders(order));
socket.on('orders:status-changed', order => refreshOrders(order));
```

`orders:new` dikirim ke pusat, sedangkan `orders:status-changed` dikirim ke
mitra pemesan. Untuk beberapa replica API, gunakan transactional outbox dan Redis adapter.

## Printer, perangkat, dan asset

Printer harus dipasangkan dari pengaturan Bluetooth Android. Aplikasi mencari printer
tersimpan, nama yang mengandung `iware`, atau nama umum `printer`/ `thermal`.
Izin Nearby devices/Bluetooth diminta pada Android 12+. Struk dikirim langsung
ESC/POS dengan lebar efektif 28 kolom untuk thermal 58 mm; RawBT hanya alat pengujian.

Android dikonfigurasi sticky immersive navigation dan gesture swipe. Keyboard mode
`resize` digunakan agar form tidak tertutup keyboard. Logo/adaptive icon ada di
`apps/mobile/assets`; warna brand utama `#E3792F`.

## Troubleshooting

### Network request failed

Periksa `EXPO_PUBLIC_API_URL`, DNS/domain, HTTPS, reverse proxy, dan port API.
Restart Expo setelah mengubah `.env`.

### Cannot POST /api/v1/...

Server belum memakai source terbaru. Jalankan `git pull`, rebuild image, lalu
`docker compose up -d api`.

### Expo Go incompatible SDK

Gunakan Expo Go SDK 54 atau build APK/development build. SDK 57 tidak kompatibel.

### APK tidak terpasang

Periksa versi Android, arsitektur perangkat, izin instalasi sumber tidak dikenal,
dan konflik signature dengan APK lama.

### Error Supabase ENOTFOUND atau SSL

Pastikan format host, username pooler, password, port, dan `DATABASE_SSL=true`
benar. `ENOTFOUND` biasanya URL salah; self-signed certificate membutuhkan
perbaikan konfigurasi SSL/certificate chain.

## Production checklist

- Ganti `JWT_SECRET`; jangan commit `.env` atau `EXPO_TOKEN`.
- Jangan jalankan seed development pada production.
- Gunakan TLS, backup PostgreSQL, dan uji restore.
- Batasi MIME/ukuran upload dan simpan volume upload persisten.
- Tambahkan JWT guard untuk Socket.IO room.
- Jangan gunakan TypeORM `synchronize` di production.
- Tambahkan timeout, exponential backoff, audit log, metrics, dan tracing.
- Uji retry sync serta concurrent order/status transition sebelum go-live.

Dokumentasi arsitektur detail tersedia di [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

