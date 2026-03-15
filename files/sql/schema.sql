-- TraceUp Supabase schema
-- Run in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  security_question TEXT,
  security_answer TEXT,
  department TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Items
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  date_lost DATE NOT NULL,
  time_lost TIME,
  image TEXT,
  color TEXT,
  brand TEXT,
  reward TEXT,
  type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  status TEXT NOT NULL CHECK (status IN ('lost', 'found', 'claimed', 'returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_type ON items (type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items (status);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items (user_id);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);

-- Claims
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_item_id ON claims (item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant_id ON claims (claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims (status);

-- Chat conversations (finder <-> claimer)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  finder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One conversation per (item + claimer)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversations_item_claimer
  ON conversations (item_id, claimer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_finder_id ON conversations (finder_id);
CREATE INDEX IF NOT EXISTS idx_conversations_claimer_id ON conversations (claimer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_item_id ON conversations (item_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);

-- ── RLS for Supabase Realtime / direct client access ─────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.request_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.uid(),
    NULLIF(auth.jwt() ->> 'userId', '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.request_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.request_user_id()
      AND u.role = 'admin'
  );
$$;

DROP POLICY IF EXISTS conversations_select_policy ON conversations;
CREATE POLICY conversations_select_policy
  ON conversations
  FOR SELECT
  USING (
    public.request_is_admin()
    OR public.request_user_id() = finder_id
    OR public.request_user_id() = claimer_id
  );

DROP POLICY IF EXISTS conversations_insert_policy ON conversations;
CREATE POLICY conversations_insert_policy
  ON conversations
  FOR INSERT
  WITH CHECK (
    public.request_is_admin()
    OR public.request_user_id() = finder_id
    OR public.request_user_id() = claimer_id
  );

DROP POLICY IF EXISTS messages_select_policy ON messages;
CREATE POLICY messages_select_policy
  ON messages
  FOR SELECT
  USING (
    public.request_is_admin()
    OR EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.finder_id = public.request_user_id()
          OR c.claimer_id = public.request_user_id()
        )
    )
  );

DROP POLICY IF EXISTS messages_insert_policy ON messages;
CREATE POLICY messages_insert_policy
  ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = public.request_user_id()
    AND (
      public.request_is_admin()
      OR EXISTS (
        SELECT 1
        FROM conversations c
        WHERE c.id = messages.conversation_id
          AND (
            c.finder_id = public.request_user_id()
            OR c.claimer_id = public.request_user_id()
          )
      )
    )
  );

DROP POLICY IF EXISTS messages_update_policy ON messages;
CREATE POLICY messages_update_policy
  ON messages
  FOR UPDATE
  USING (
    public.request_is_admin()
    OR EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.finder_id = public.request_user_id()
          OR c.claimer_id = public.request_user_id()
        )
    )
  )
  WITH CHECK (
    public.request_is_admin()
    OR EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.finder_id = public.request_user_id()
          OR c.claimer_id = public.request_user_id()
        )
    )
  );

-- Ensure tables are included in Supabase Realtime publication.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
