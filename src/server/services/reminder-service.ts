import "server-only";
import { notificationRepository as repo } from "@/server/repositories/notification-repository";
import { pushClient, type PushPayload } from "@/server/integrations/push";
import { deadlineMs } from "@/domain/time";
import { dueLabel } from "@/lib/format";
export async function sendReminders(origin: string) {
  const now = Date.now();
  const from = new Date(now - 864e5).toISOString().slice(0, 10);
  const to = new Date(now + 864e5).toISOString().slice(0, 10);
  const tasks = await repo.tasks(from, to);
  const appUrl = origin;
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
    const already = await repo.sent(t.id, kind);
    const done = new Set((already ?? []).map((n) => n.endpoint));

    const ownerUser = (t.members as unknown as { user_id: string | null } | null)?.user_id;
    const { data: devices } = ownerUser
      ? { data: await repo.devices(ownerUser) }
      : { data: [] };

    if (!devices?.length) {
      if (!done.has("")) {
        await repo.record({ task_id: t.id, member_id: t.owner_id, kind, status: "no_device" });
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
        await repo.record({ task_id: t.id, member_id: t.owner_id, kind, endpoint: d.endpoint, status: "sent" });
        result.sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        await repo.record({
          task_id: t.id, member_id: t.owner_id, kind, endpoint: d.endpoint, status: "failed",
          error: String(code ?? (e as Error).message).slice(0, 200),
        });
        if (code === 404 || code === 410) await repo.removeDevice(d.id); // 기기에서 알림을 끔
        result.failed++;
      }
    }
  }
  return result;
}
