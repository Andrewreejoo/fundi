-- Galimoto: buy and rent cars already in Malawi. Money is whole Malawi Kwacha (MWK) as integers.
-- Replaces the earlier services-marketplace schema (drops its tables if a database still has them).
DROP TABLE IF EXISTS
  audit_logs, sms_outbox, notifications, disputes, reviews, ledger_entries, payments, booking_events, bookings,
  verification_requests, listings, provider_trades, provider_profiles, files, categories, places,
  refresh_tokens, otp_codes, users CASCADE;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL UNIQUE,              -- E.164, e.g. +265991234567
  name         text,
  roles        text[] NOT NULL DEFAULT '{customer}',
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

CREATE TABLE places (
  id           serial PRIMARY KEY,
  district     text NOT NULL,
  name         text NOT NULL,
  kind         text NOT NULL DEFAULT 'area',
  geog         geography(Point, 4326) NOT NULL,
  UNIQUE (district, name)
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

CREATE TABLE makes (
  id      serial PRIMARY KEY,
  slug    text NOT NULL UNIQUE,
  name    text NOT NULL,
  sort    int NOT NULL DEFAULT 100
);

CREATE TABLE models (
  id        serial PRIMARY KEY,
  make_id   int NOT NULL REFERENCES makes(id),
  slug      text NOT NULL,
  name      text NOT NULL,
  body_type text NOT NULL,
  UNIQUE (make_id, slug)
);

-- A seller is a car yard (dealer) or a private person. Rental owners are sellers too.
CREATE TABLE sellers (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('dealer','private')),
  name             text NOT NULL,
  about            text,
  district         text NOT NULL,
  area             text NOT NULL,
  address          text,
  location         geography(Point, 4326) NOT NULL,
  payout_msisdn    text NOT NULL,
  payout_operator  text NOT NULL CHECK (payout_operator IN ('airtel','tnm')),
  whatsapp         boolean NOT NULL DEFAULT true,
  verified         boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE vehicle_stock_seq START 10001;

-- One table for both purposes. Sale fields or rent fields are required depending on purpose.
CREATE TABLE vehicles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_no         text NOT NULL UNIQUE DEFAULT ('GM' || nextval('vehicle_stock_seq')),
  seller_id        uuid NOT NULL REFERENCES sellers(user_id) ON DELETE CASCADE,
  purpose          text NOT NULL CHECK (purpose IN ('sale','rent')),
  make_id          int NOT NULL REFERENCES makes(id),
  model_id         int NOT NULL REFERENCES models(id),
  variant          text,                                 -- e.g. "20X 4WD"
  year             int NOT NULL CHECK (year BETWEEN 1970 AND 2100),
  body_type        text NOT NULL CHECK (body_type IN ('sedan','hatchback','suv','pickup','van','minibus','wagon','truck','coupe','bus')),
  transmission     text NOT NULL CHECK (transmission IN ('automatic','manual')),
  fuel             text NOT NULL CHECK (fuel IN ('petrol','diesel','hybrid','electric')),
  drive            text NOT NULL DEFAULT '2wd' CHECK (drive IN ('2wd','4wd')),
  steering         text NOT NULL DEFAULT 'right' CHECK (steering IN ('right','left')),
  engine_cc        int CHECK (engine_cc BETWEEN 300 AND 10000),
  mileage_km       int CHECK (mileage_km >= 0),
  color            text,
  seats            int CHECK (seats BETWEEN 1 AND 70),
  doors            int CHECK (doors BETWEEN 1 AND 6),
  condition        text NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent','good','fair','needs_work')),
  plate            text,                                 -- Malawi registration, e.g. BZ 21851 (optional to show)
  registered       boolean NOT NULL DEFAULT true,        -- registered in Malawi
  duty_paid        boolean NOT NULL DEFAULT true,        -- MRA duty cleared (local stock)
  cof_expiry       date,                                 -- certificate of fitness
  features         text[] NOT NULL DEFAULT '{}',
  description      text,
  photo_ids        uuid[] NOT NULL DEFAULT '{}',
  -- sale
  price_mwk        bigint CHECK (price_mwk IS NULL OR price_mwk > 0),
  previous_price_mwk bigint,                             -- set when the price goes down ("Price down" badge)
  negotiable       boolean NOT NULL DEFAULT true,
  -- rent
  daily_rate_mwk   bigint CHECK (daily_rate_mwk IS NULL OR daily_rate_mwk > 0),
  driver_rate_mwk  bigint CHECK (driver_rate_mwk IS NULL OR driver_rate_mwk >= 0),  -- extra per day with driver; NULL = no driver offered
  self_drive       boolean NOT NULL DEFAULT true,
  min_days         int NOT NULL DEFAULT 1 CHECK (min_days BETWEEN 1 AND 60),
  -- place and state
  district         text NOT NULL,
  area             text NOT NULL,
  location         geography(Point, 4326) NOT NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','live','reserved','sold','paused','rejected')),
  reject_reason    text,
  featured         boolean NOT NULL DEFAULT false,
  views            int NOT NULL DEFAULT 0,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (purpose <> 'sale' OR price_mwk IS NOT NULL),
  CHECK (purpose <> 'rent' OR daily_rate_mwk IS NOT NULL),
  CHECK (purpose <> 'rent' OR self_drive OR driver_rate_mwk IS NOT NULL)
);
CREATE INDEX vehicles_search_idx ON vehicles (purpose, status, make_id, model_id);
CREATE INDEX vehicles_price_idx ON vehicles (purpose, status, price_mwk);
CREATE INDEX vehicles_seller_idx ON vehicles (seller_id);
CREATE INDEX vehicles_location_idx ON vehicles USING gist (location);

CREATE TABLE favorites (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id  uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vehicle_id)
);

-- Buyer <-> seller message thread about one vehicle (BE FORWARD-style "inquiry").
CREATE TABLE inquiries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  buyer_id         uuid NOT NULL REFERENCES users(id),
  seller_id        uuid NOT NULL REFERENCES users(id),
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, buyer_id)
);
CREATE TABLE inquiry_messages (
  id           bigserial PRIMARY KEY,
  inquiry_id   uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES users(id),
  body         text NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiry_messages_idx ON inquiry_messages (inquiry_id, created_at);

-- An order is either a sale reservation (refundable deposit) or a rental (dates, paid up front).
CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text NOT NULL UNIQUE,
  kind             text NOT NULL CHECK (kind IN ('reservation','rental')),
  vehicle_id       uuid NOT NULL REFERENCES vehicles(id),
  buyer_id         uuid NOT NULL REFERENCES users(id),
  seller_id        uuid NOT NULL REFERENCES sellers(user_id),
  status           text NOT NULL CHECK (status IN ('pending_payment','reserved','confirmed','handed_over','returned','completed','cancelled','expired','refunded','disputed')),
  price_mwk        bigint NOT NULL,          -- car price (reservation) or rental total
  amount_mwk       bigint NOT NULL,          -- what the buyer pays through the site (deposit or rental total)
  fee_mwk          bigint NOT NULL DEFAULT 0,-- platform fee taken from the seller's payout
  start_date       date,
  end_date         date,                     -- return date (exclusive end of the rented days)
  days             int,
  with_driver      boolean NOT NULL DEFAULT false,
  daily_rate_mwk   bigint,
  driver_rate_mwk  bigint,
  note             text,
  expires_at       timestamptz,              -- payment window, then reservation hold
  auto_complete_at timestamptz,
  completed_at     timestamptz,
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'rental' OR (start_date IS NOT NULL AND end_date > start_date))
);
CREATE INDEX orders_buyer_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller_idx ON orders (seller_id, created_at DESC);
CREATE INDEX orders_timers_idx ON orders (status, expires_at);
-- Only one live reservation per car.
CREATE UNIQUE INDEX orders_one_reservation ON orders (vehicle_id)
  WHERE kind = 'reservation' AND status IN ('pending_payment','reserved','handed_over','disputed');
-- No double booking: the database refuses overlapping rentals of the same car.
ALTER TABLE orders ADD CONSTRAINT orders_no_overlap EXCLUDE USING gist (
  vehicle_id WITH =, daterange(start_date, end_date, '[)') WITH &&
) WHERE (kind = 'rental' AND status IN ('pending_payment','confirmed','handed_over','returned','disputed'));

CREATE TABLE order_events (
  id           bigserial PRIMARY KEY,
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  actor_id     uuid REFERENCES users(id),
  note         text,
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_idx ON order_events (order_id, at);

CREATE TABLE payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id),
  direction      text NOT NULL CHECK (direction IN ('collect','payout','refund')),
  operator       text NOT NULL CHECK (operator IN ('airtel','tnm')),
  msisdn         text NOT NULL,
  amount_mwk     bigint NOT NULL CHECK (amount_mwk > 0),
  charge_id      text NOT NULL UNIQUE,
  provider_ref   text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  failure_reason text,
  attempts       int NOT NULL DEFAULT 1,
  raw            jsonb,
  next_check_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments (order_id);
CREATE INDEX payments_pending_idx ON payments (status, next_check_at);

-- Double-entry ledger: each posting sums to zero.
CREATE TABLE ledger_entries (
  id           bigserial PRIMARY KEY,
  txn_id       uuid NOT NULL,
  order_id     uuid REFERENCES orders(id),
  account      text NOT NULL CHECK (account IN ('cash','escrow','seller_payable','buyer_refundable','fee_revenue')),
  amount_mwk   bigint NOT NULL CHECK (amount_mwk <> 0),
  memo         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_txn_idx ON ledger_entries (txn_id);

CREATE TABLE disputes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL UNIQUE REFERENCES orders(id),
  opened_by      uuid NOT NULL REFERENCES users(id),
  reason         text NOT NULL,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution     text CHECK (resolution IN ('release','refund','split')),
  seller_share_percent int CHECK (seller_share_percent BETWEEN 0 AND 100),
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
  link         text,
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
