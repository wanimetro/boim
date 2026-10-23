import "server-only";
import { db } from "@/lib/supabase";
function checked<T>(r: { data: T; error: unknown }): T { if (r.error) throw r.error; return r.data; }
export type NotificationRecord = { task_id: string; member_id: string; kind: string; endpoint?: string; status: string; error?: string };
export const notificationRepository = {
  async save(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    const { error } = await db().from("push_subscriptions").upsert({ user_id: userId, endpoint: sub.endpoint, ...sub.keys }, { onConflict: "endpoint" }); if (error) throw error;
  },
  async remove(userId: string, endpoint: string) { const { error } = await db().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId); if (error) throw error; },
  async tasks(from: string, to: string) { return checked(await db().from("tasks").select("id, seq, title, due, due_time, owner_id, members!tasks_owner_id_fkey(user_id), teams(code, token), submissions(review, created_at)").gte("due", from).lte("due", to)); },
  async sent(taskId: string, kind: string) { return checked(await db().from("notifications").select("endpoint").eq("task_id", taskId).eq("kind", kind)); },
  async devices(userId: string) { return checked(await db().from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId)); },
  async record(input: NotificationRecord) { const { error } = await db().from("notifications").insert(input); if (error) throw error; },
  async removeDevice(id: string) { const { error } = await db().from("push_subscriptions").delete().eq("id", id); if (error) throw error; },
};
