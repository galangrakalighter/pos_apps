-- Development data only. AuthService upgrades these plaintext passwords to
-- bcrypt hashes on their first successful login.
BEGIN;

INSERT INTO users (id, username, password, wilayah, nama_mitra, "isPusat") VALUES
  ('11111111-1111-4111-8111-111111111111', 'pusat.admin', 'admin123', 'Nasional', 'Gudang Pusat', TRUE),
  ('22222222-2222-4222-8222-222222222222', 'mitra.demo', 'mitra123', 'Jakarta', 'Mitra Sudirman', FALSE)
ON CONFLICT (username) DO NOTHING;

-- Produk dan stok tidak diberi seed agar instalasi baru dimulai dari keadaan kosong.

COMMIT;
