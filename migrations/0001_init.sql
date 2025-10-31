-- PostgreSQL initial schema for futures positions
-- Requires: pgcrypto or uuid-ossp for UUIDs; we will use gen_random_uuid() from pgcrypto

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum-like constraints via CHECKs (keeps portability within PG)

CREATE TABLE IF NOT EXISTS positions (
  position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  side VARCHAR(5) NOT NULL CHECK (side IN ('LONG','SHORT')),
  leverage INT NOT NULL CHECK (leverage >= 1),
  size_contracts NUMERIC(38, 10) NOT NULL CHECK (size_contracts > 0),
  entry_price NUMERIC(38, 10) NOT NULL CHECK (entry_price > 0),
  stop_loss_price NUMERIC(38, 10),
  take_profit_price NUMERIC(38, 10),
  liquidation_price NUMERIC(38, 10) NOT NULL CHECK (liquidation_price > 0),
  close_price NUMERIC(38, 10),
  pnl NUMERIC(38, 10),
  close_reason VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Maintain updated_at automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_positions_set_updated_at ON positions;
CREATE TRIGGER trg_positions_set_updated_at
BEFORE UPDATE ON positions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_positions_symbol_status ON positions (symbol, status);

-- History table for audit trail
CREATE TABLE IF NOT EXISTS position_history (
  history_id BIGSERIAL PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES positions(position_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(20) NOT NULL, -- 'OPEN','UPDATE_SL','UPDATE_TP','CLOSE','LIQUIDATION'
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_position_history_position_ts ON position_history (position_id, timestamp DESC);
