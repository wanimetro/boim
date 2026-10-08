import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/supabase";
import { pushClient, type PushPayload } from "@/lib/push";
import { deadlineMs, dueLabel } from "@/lib/format";

/**
 * Supabase pg_cron이 5분마다 부른다.
 * 마감 1시간 전·30분 전 구간에 들어온 업무 중 담당자가 아직 아무것도 올리지 않은 업무에 알림을 보낸다.
 * 이미 "확인 중"이거나 "완료"인 업무, 반려 뒤 다시 올린 업무에는 보내지 않는다.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return new Response("unauthorized", { status: 401 });
  }

  const now = Date.now();
  const from = new Date(now - 864e5).toISOString().slice(0, 10);
  const to = new Date(now + 864e5).toISOString().slice(0, 10);
  const { data: tasks, error } = await db()
    .from("tasks")
    .select("id, seq, title, due, due_time, owner_id, teams(code, token), submissions(review, created_at)")
    .gte("due", from).lte("due", to);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const result = { checked: tasks?.length ?? 0, sent: 0, failed: 0, no_device: 0 };

  for (const t of tasks ?? []) {
    const deadline = deadlineMs(t.due, String(t.due_time));
    const left = deadline - now;
    if (left <= 0 || left > 60 * 60e3) continue;
    const kind = left <= 30 * 60e3 ? "30" : "60";

    const subs = (t.submissions ?? []) as { review: string }[];
    const latestPendingOrPass = subs.some((s) => s.review === "pending" || s.review === "pass");
    if (latestPendingOrPass) continue;

    const team = t.teams as unknown as { code: string; token: string };
    const { data: already } = await db().from("notifications").select("endpoint")
      .eq("task_id", t.id).eq("kind", kind);
    const done = new Set((already ?? []).map((n) => n.endpoint));

    const { data: devices } = await db().from("push_subscriptions")
      .select("id, endpoint, p256dh, auth").eq("member_id", t.owner_id);

    if (!devices?.length) {
      if (!done.has("")) {
        await db().from("notifications").insert({ task_id: t.id, member_id: t.owner_id, kind, status: "no_device" });
        result.no_device++;
      }
      continue;
    }

    const payload: PushPayload = {
      title: kind === "60" ? "마감 1시간 전이에요" : "마감 30분 전이에요",
      body: `${team.code}-${t.seq} ${t.title} · ${dueLabel(t.due, String(t.due_time))} 마감. 결과물을 올려야 “완료”로 바뀝니다.`,
      url: `${appUrl}/t/${team.token}/task/${t.seq}`,
      tag: `${t.id}-${kind}`,
    };

    for (const d of devices) {
      if (done.has(d.endpoint)) continue;
      try {
        await pushClient().sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          JSON.stringify(payload), { TTL: 30 * 60, urgency: "high" },
        );
        await db().from("notifications").insert({ task_id: t.id, member_id: t.owner_id, kind, endpoint: d.endpoint, status: "sent" });
        result.sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        await db().from("notifications").insert({
          task_id: t.id, member_id: t.owner_id, kind, endpoint: d.endpoint, status: "failed",
          error: String(code ?? (e as Error).message).slice(0, 200),
        });
        if (code === 404 || code === 410) await db().from("push_subscriptions").delete().eq("id", d.id); // 기기에서 알림을 끔
        result.failed++;
      }
    }
  }
  return Response.json(result);
}
