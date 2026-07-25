import { supabase } from "@/lib/supabase";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL_SET: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      INSTAGRAM_TOKEN_SET: !!process.env.INSTAGRAM_ACCESS_TOKEN,
      OPENROUTER_KEY_SET: !!process.env.OPENROUTER_API_KEY,
      VERIFY_TOKEN_SET: !!process.env.INSTAGRAM_VERIFY_TOKEN,
    },
  };

  try {
    const { count: convoCount, error: convoErr } = await supabase
      .from("instagram_conversations")
      .select("*", { count: "exact", head: true });

    if (convoErr) {
      diagnostics.conversations = { error: convoErr.message };
    } else {
      diagnostics.conversations = { count: convoCount };
    }
  } catch (e: unknown) {
    diagnostics.conversations = { error: (e as Error).message };
  }

  try {
    const { count: msgCount, error: msgErr } = await supabase
      .from("instagram_messages")
      .select("*", { count: "exact", head: true });

    if (msgErr) {
      diagnostics.messages = { error: msgErr.message };
    } else {
      diagnostics.messages = { count: msgCount };
    }
  } catch (e: unknown) {
    diagnostics.messages = { error: (e as Error).message };
  }

  return Response.json(diagnostics, { status: 200 });
}
