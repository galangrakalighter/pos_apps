BEGIN;

CREATE TABLE IF NOT EXISTS partner_sync_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitra_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_sync_active
  ON partner_sync_requests (mitra_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_partner_sync_mitra_status
  ON partner_sync_requests (mitra_id, status, requested_at);

COMMIT;
