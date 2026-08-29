CREATE TABLE IF NOT EXISTS transactions (
  id             BIGSERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL,
  merchant_id    TEXT NOT NULL,
  provider_id    TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  country        TEXT NOT NULL,
  issuer_bank    TEXT NOT NULL,
  amount_usd     NUMERIC(10,2) NOT NULL,
  approved       BOOLEAN NOT NULL,
  decline_code   TEXT,
  latency_ms     INT NOT NULL,
  source         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_slice
  ON transactions (created_at DESC, provider_id, country, merchant_id, payment_method);

CREATE TABLE IF NOT EXISTS baseline_profile (
  merchant_id TEXT,
  provider_id TEXT,
  payment_method TEXT,
  country TEXT,
  hour_utc SMALLINT,
  day_type TEXT,
  attempts INT NOT NULL,
  approved INT NOT NULL,
  avg_amount_usd NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (merchant_id, provider_id, payment_method, country, hour_utc, day_type)
);

CREATE TABLE IF NOT EXISTS incidents (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  preset_id TEXT,
  filters JSONB NOT NULL,
  approval_multiplier NUMERIC NOT NULL,
  dominant_decline_code TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  mitigated_at TIMESTAMPTZ
);
