-- Fundi core schema. Money is stored in whole Malawi Kwacha (MWK) as integers.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL UNIQUE,              -- E.164, e.g. +265991234567
  name         text,
  roles        text[] NOT NULL DEFAULT '{customer}',
  language     text NOT NULL DEFAULT 'ny' CHECK (language IN ('ny','en','tum')),
  pin_hash     text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id           bigserial PRIMARY KEY,
  phone        text NOT NULL,
  code_hash    text NOT NULL,
  attempts     int NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Named places for people without GPS (district -> area). Coordinates are approximate centres.
CREATE TABLE places (
  id           serial PRIMARY KEY,
  district     text NOT NULL,
  name         text NOT NULL,
  kind         text NOT NULL DEFAULT 'area' CHECK (kind IN ('city','town','area','trading_centre')),
  geog         geography(Point, 4326) NOT NULL,
  UNIQUE (district, name)
);

CREATE TABLE categories (
  id           serial PRIMARY KEY,
  parent_id    int REFERENCES categories(id),
  slug         text NOT NULL UNIQUE,
  name_en      text NOT NULL,
  name_ny      text NOT NULL,
  name_tum     text,
  icon         text NOT NULL,
  pricing_unit text NOT NULL DEFAULT 'per_job',
  sort         int NOT NULL DEFAULT 100,
  active       boolean NOT NULL DEFAULT true
);

CREATE TABLE files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  mime         text NOT NULL,
  size_bytes   int NOT NULL,
  path         text NOT NULL,
  private      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name       text NOT NULL,
  bio                text,
  years_experience   int,
  avatar_file_id     uuid REFERENCES files(id),
  verification_level text NOT NULL DEFAULT 'basic' CHECK (verification_level IN ('basic','id_verified','trusted')),
  badges             text[] NOT NULL DEFAULT '{}',
  rating_sum         int NOT NULL DEFAULT 0,
  rating_count       int NOT NULL DEFAULT 0,
  jobs_completed     int NOT NULL DEFAULT 0,
  payout_msisdn      text NOT NULL,
  payout_operator    text NOT NULL CHECK (payout_operator IN ('airtel','tnm')),
  available_today    boolean NOT NULL DEFAULT true,
  home_visits        boolean NOT NULL DEFAULT true,
  work_hours         text,
  service_radius_km  int NOT NULL DEFAULT 15 CHECK (service_radius_km BETWEEN 1 AND 100),
  location           geography(Point, 4326) NOT NULL,
  district           text NOT NULL,
  area               text NOT NULL,
  landmark           text,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','suspended')),
  onboarded_by       uuid REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_profiles_location_idx ON provider_profiles USING gist (location);

CREATE TABLE provider_trades (
  provider_id  uuid NOT NULL REFERENCES provider_profiles(user_id) ON DELETE CASCADE,
  category_id  int  NOT NULL REFERENCES categories(id),
  PRIMARY KEY (provider_id, category_id)
);
CREATE INDEX provider_trades_category_idx ON provider_trades (category_id);

CREATE TABLE listings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  uuid NOT NULL REFERENCES provider_profiles(user_id) ON DELETE CASCADE,
  category_id  int  NOT NULL REFERENCES categories(id),
  title        text NOT NULL,
  description  text,
  price_type   text NOT NULL CHECK (price_type IN ('fixed','from','quote')),
  price_mwk    int CHECK (price_mwk IS NULL OR price_mwk > 0),
  photo_ids    uuid[] NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','live','rejected','paused')),
  reject_reason text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (price_type = 'quote' OR price_mwk IS NOT NULL)
);
CREATE INDEX listings_provider_idx ON listings (provider_id);

CREATE TABLE verification_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid NOT NULL REFERENCES provider_profiles(user_id) ON DELETE CASCADE,
  id_file_id    uuid REFERENCES files(id) ON DELETE SET NULL,
  selfie_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason        text,
  reviewer_id   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  purged_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text NOT NULL UNIQUE,
  customer_id      uuid NOT NULL REFERENCES users(id),
  provider_id      uuid NOT NULL REFERENCES provider_profiles(user_id),
  listing_id       uuid REFERENCES listings(id),
  category_id      int NOT NULL REFERENCES categories(id),
  type             text NOT NULL CHECK (type IN ('instant','quote')),
  status           text NOT NULL CHECK (status IN ('requested','quoted','accepted','paid','in_progress','completed','confirmed','disputed','cancelled','expired','refunded')),
  description      text,
  photo_ids        uuid[] NOT NULL DEFAULT '{}',
  scheduled_for    date,
  time_slot        text CHECK (time_slot IN ('morning','afternoon','evening')),
  landmark         text,
  location         geography(Point, 4326),
  price_mwk        int,
  quote_note       text,
  escrow           boolean NOT NULL DEFAULT true,
  protection_fee_mwk int NOT NULL DEFAULT 0,
  commission_mwk   int NOT NULL DEFAULT 0,
  expires_at       timestamptz,
  auto_confirm_at  timestamptz,
  completed_at     timestamptz,
  confirmed_at     timestamptz,
  cancel_reason    text,
  channel          text NOT NULL DEFAULT 'app' CHECK (channel IN ('app','web','ussd','agent')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_customer_idx ON bookings (customer_id, created_at DESC);
CREATE INDEX bookings_provider_idx ON bookings (provider_id, created_at DESC);
CREATE INDEX bookings_timers_idx ON bookings (status, expires_at);
CREATE INDEX bookings_autoconfirm_idx ON bookings (status, auto_confirm_at);

CREATE TABLE booking_events (
  id           bigserial PRIMARY KEY,
  booking_id   uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  actor_id     uuid REFERENCES users(id),
  note         text,
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, at);

CREATE TABLE payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL REFERENCES bookings(id),
  direction      text NOT NULL CHECK (direction IN ('collect','payout','refund')),
  operator       text NOT NULL CHECK (operator IN ('airtel','tnm')),
  msisdn         text NOT NULL,
  amount_mwk     int NOT NULL CHECK (amount_mwk > 0),
  charge_id      text NOT NULL UNIQUE,            -- our idempotency key sent to the aggregator
  provider_ref   text,                            -- aggregator ref_id / trans_id
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  failure_reason text,
  attempts       int NOT NULL DEFAULT 1,
  raw            jsonb,
  next_check_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_booking_idx ON payments (booking_id);
CREATE INDEX payments_pending_idx ON payments (status, next_check_at);

-- Double-entry ledger: every transaction's rows sum to zero. Positive = debit, negative = credit.
-- Accounts: cash (money held at the aggregator), escrow (owed to someone, job not settled),
-- provider_payable, customer_refundable, fee_revenue.
CREATE TABLE ledger_entries (
  id           bigserial PRIMARY KEY,
  txn_id       uuid NOT NULL,
  booking_id   uuid REFERENCES bookings(id),
  account      text NOT NULL CHECK (account IN ('cash','escrow','provider_payable','customer_refundable','fee_revenue')),
  amount_mwk   bigint NOT NULL CHECK (amount_mwk <> 0),
  memo         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_txn_idx ON ledger_entries (txn_id);
CREATE INDEX ledger_entries_booking_idx ON ledger_entries (booking_id);

CREATE TABLE reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL UNIQUE REFERENCES bookings(id),
  provider_id    uuid NOT NULL REFERENCES provider_profiles(user_id),
  customer_id    uuid NOT NULL REFERENCES users(id),
  rating         int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text           text,
  provider_reply text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_provider_idx ON reviews (provider_id, created_at DESC);

CREATE TABLE disputes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL UNIQUE REFERENCES bookings(id),
  opened_by      uuid NOT NULL REFERENCES users(id),
  reason         text NOT NULL,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution     text CHECK (resolution IN ('release','refund','split')),
  provider_share_percent int CHECK (provider_share_percent BETWEEN 0 AND 100),
  admin_note     text,
  resolved_by    uuid REFERENCES users(id),
  resolved_at    timestamptz,
  sla_due_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  booking_id   uuid REFERENCES bookings(id) ON DELETE CASCADE,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE sms_outbox (
  id           bigserial PRIMARY KEY,
  to_phone     text NOT NULL,
  body         text NOT NULL,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','logged')),
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);

CREATE TABLE audit_logs (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES users(id),
  action       text NOT NULL,
  entity       text NOT NULL,
  entity_id    text NOT NULL,
  data         jsonb,
  at           timestamptz NOT NULL DEFAULT now()
);
