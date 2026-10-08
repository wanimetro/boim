import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** 서버 전용 클라이언트. service role 키는 브라우저로 절대 나가지 않는다. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경 변수가 없습니다.");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const BUCKET = "submissions";
