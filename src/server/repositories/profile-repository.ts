import "server-only";
import { db } from "@/lib/supabase";
export const profileRepository = {
  async nickname(id: string) {
    const { data, error } = await db().from("profiles").select("nickname").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async save(id: string, nickname: string) {
    const { error } = await db().from("profiles").upsert({ id, nickname });
    if (error) throw error;
  },
};
