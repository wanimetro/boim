import "server-only";
import { db } from "@/lib/supabase";
function checked<T>(r: { data: T; error: unknown }): T { if (r.error) throw r.error; return r.data; }
export const adminRepository = {
  async teams() { return checked(await db().from("teams").select("id, code, name, token, invite_code, in_study, created_at").order("created_at")); },
  async views(id: string) { const r = await db().from("views").select("id", { count: "exact", head: true }).eq("team_id", id); if (r.error) throw r.error; return r.count; },
  async devices(ids: string[]) { return checked(await db().from("push_subscriptions").select("user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])); },
  async notifications() { return checked(await db().from("notifications").select("task_id, member_id, kind, status, error, sent_at").order("sent_at", { ascending: false }).limit(500)); },
  async edits() { return checked(await db().from("task_edits").select("task_id, after, created_at").order("created_at", { ascending: false })); },
  async study(id: string, included: boolean) { const { error } = await db().from("teams").update({ in_study: included }).eq("id", id); if (error) throw error; },
};
