-- Instagram AI Agent — Supabase Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- ─────────────────────────────────────────────
-- 1. Conversations table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instagram_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igsid           TEXT NOT NULL,
  name            TEXT,
  username        TEXT,
  profile_pic     TEXT,
  follower_count  BIGINT,
  is_user_follow_business  BOOLEAN,
  is_business_follow_user  BOOLEAN,
  mode            TEXT NOT NULL DEFAULT 'agent' CHECK (mode IN ('agent', 'human')),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_igsid ON public.instagram_conversations (igsid);

-- ─────────────────────────────────────────────
-- 2. Messages table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instagram_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.instagram_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  instagram_msg_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.instagram_messages (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_instagram_msg_id ON public.instagram_messages (instagram_msg_id) WHERE instagram_msg_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. Enable Realtime (safe to re-run)
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'instagram_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'instagram_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_messages;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 4. Row Level Security (safe to re-run)
-- ─────────────────────────────────────────────
ALTER TABLE IF NOT EXISTS public.instagram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF NOT EXISTS public.instagram_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on conversations" ON public.instagram_conversations;
DROP POLICY IF EXISTS "Allow all on messages" ON public.instagram_messages;

CREATE POLICY "Allow all on conversations" ON public.instagram_conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on messages" ON public.instagram_messages
  FOR ALL USING (true) WITH CHECK (true);
