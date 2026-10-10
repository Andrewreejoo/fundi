-- Admin-approved sign-up: people ask for access with a name, number and PIN; an admin approves.
-- Lets the site work while SMS sign-in codes are unavailable.
CREATE TABLE access_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,                       -- E.164
  name        text NOT NULL,
  pin_hash    text NOT NULL,                       -- copied to the user when approved
  note        text,
  id_file_id     uuid REFERENCES files(id) ON DELETE SET NULL,   -- photo of national ID (private)
  selfie_file_id uuid REFERENCES files(id) ON DELETE SET NULL,   -- selfie (private)
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason      text,                                -- why it was rejected
  decided_by  uuid REFERENCES users(id),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX access_requests_one_pending ON access_requests (phone) WHERE status = 'pending';
CREATE INDEX access_requests_status ON access_requests (status, created_at DESC);

-- PIN sign-in lockout: 4-digit PINs can be guessed, so wrong tries are counted.
ALTER TABLE users
  ADD COLUMN pin_failures     int NOT NULL DEFAULT 0,
  ADD COLUMN pin_locked_until timestamptz;
