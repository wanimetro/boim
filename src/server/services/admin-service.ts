import "server-only";
import { requireAdmin } from "@/server/integrations/admin-session";
import { adminRepository as repo } from "@/server/repositories/admin-repository";
import { membersOf, tasksOf } from "./team-service";
import type { Team } from "@/domain/task";
import { dateTime, today } from "@/lib/format";
import { firstDeadline, tally, verdict } from "@/lib/metrics";
export async function getAdminDashboard() {
  await requireAdmin();
  const teams = await repo.teams();

  const rows = await Promise.all((teams ?? []).map(async (team: Team & { in_study: boolean; created_at: string }) => {
    const members = await membersOf(team.id);
    const tasks = await tasksOf(team, members);
    const views = await repo.views(team.id);
    const first = firstDeadline(tasks);
    return { team, members, tasks, first, c: tally(first.items), views: views ?? 0 };
  }));

  const now = today();
  const study = rows.filter((r) => r.team.in_study);
  const sum = study.reduce((a, r) => ({ total: a.total + r.c.total, ok: a.ok + r.c["self-before"] }), { total: 0, ok: 0 });
  const rate = sum.total ? sum.ok / sum.total : 0;
  const closed = study.length > 0 && study.every((r) => r.first.due && r.first.due < now);
  const v = verdict(rate, sum.total, closed);

  // 앱 알림 발송 현황
  const userIds = rows.flatMap((r) => r.members.map((m) => m.user_id).filter(Boolean)) as string[];
  const [devices, sent] = await Promise.all([repo.devices(userIds), repo.notifications()]);
  const withDevice = new Set((devices ?? []).map((d) => d.user_id));
  const taskInfo = new Map(rows.flatMap((r) => r.tasks.map((t) => [t.id, { team: r.team.id, t }] as const)));
  const memberCode = new Map(rows.flatMap((r) => r.members.map((m) => [m.id, m.code] as const)));
  const pushStats = rows.map((r) => {
    const mine = (sent ?? []).filter((n) => taskInfo.get(n.task_id)?.team === r.team.id);
    const n = (kind: string, status: string) => mine.filter((x) => x.kind === kind && x.status === status).length;
    return {
      r, on: r.members.filter((m) => m.user_id && withDevice.has(m.user_id)).length,
      s60: n("60", "sent"), s30: n("30", "sent"),
      failed: mine.filter((x) => x.status === "failed").length,
      noDevice: mine.filter((x) => x.status === "no_device").length,
    };
  });
  const recent = (sent ?? []).slice(0, 15);

  // 업무 수정 기록: 판정을 해석할 때 기준·마감이 바뀌었는지 본다
  const edits = await repo.edits();
  const editsOf = (taskId: string) => (edits ?? []).filter((e) => e.task_id === taskId);
  const editLabel = (taskId: string) => {
    const list = editsOf(taskId);
    if (!list.length) return null;
    const keys = new Set(list.flatMap((e) => Object.keys(e.after as object)));
    const names = [keys.has("rule") && "완료 기준", (keys.has("due") || keys.has("due_time")) && "마감", keys.has("owner_id") && "담당", keys.has("title") && "업무 이름"].filter(Boolean);
    return `수정 ${list.length}회 (${names.join(", ")}) · 마지막 ${dateTime(list[0].created_at)}`;
  };

  const queue = rows.flatMap((r) => r.tasks.flatMap((t) =>
    t.submissions.filter((s) => s.review === "pending").map((s) => ({ r, t, s }))));
  queue.sort((a, b) => a.s.created_at.localeCompare(b.s.created_at));
  const signed = await Promise.all(queue.map(async ({ s }) =>
    s.file_path ? await repo.signedUrl(s.file_path) : null));

  return { rows, study, sum, rate, v, pushStats, recent, taskInfo, memberCode, editsOf, editLabel, queue, signed };
}
export async function reviewSubmission(id: string, verdict: string, reason: string) {
  await requireAdmin();
  if (verdict !== "pass" && verdict !== "fail") return;
  await repo.review(id, verdict, verdict === "fail" ? reason.trim().slice(0, 200) || null : null);
}
export async function setStudyInclusion(id: string, included: boolean) { await requireAdmin(); await repo.study(id, included); }
