import type { Metadata } from "next";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/admin";
import { db, BUCKET } from "@/lib/supabase";
import { membersOf, tasksOf, type Team } from "@/lib/data";
import { dateTime, dueLabel, md, today } from "@/lib/format";
import { firstDeadline, tally, verdict } from "@/lib/metrics";
import { LoginForm, TeamForm } from "./forms";
import { review } from "./actions";

export const metadata: Metadata = { title: "보임 운영", robots: { index: false } };

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function Admin() {
  if (!(await isAdmin())) {
    return (
      <main className="wrap">
        <h1>보임 운영</h1>
        <LoginForm />
      </main>
    );
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { data: teams } = await db().from("teams").select("id, code, name, token").order("code");

  const rows = await Promise.all((teams ?? []).map(async (team: Team) => {
    const members = await membersOf(team.id);
    const tasks = await tasksOf(team, members);
    const { count: views } = await db().from("views").select("id", { count: "exact", head: true }).eq("team_id", team.id);
    const first = firstDeadline(tasks);
    return { team, members, tasks, first, c: tally(first.items), views: views ?? 0 };
  }));

  const now = today();
  const sum = rows.reduce((a, r) => ({ total: a.total + r.c.total, ok: a.ok + r.c["self-before"] }), { total: 0, ok: 0 });
  const rate = sum.total ? sum.ok / sum.total : 0;
  const closed = rows.length > 0 && rows.every((r) => r.first.due && r.first.due < now);
  const v = verdict(rate, sum.total, closed);

  // 앱 알림 발송 현황
  const memberIds = rows.flatMap((r) => r.members.map((m) => m.id));
  const [{ data: devices }, { data: sent }] = await Promise.all([
    db().from("push_subscriptions").select("member_id").in("member_id", memberIds.length ? memberIds : [""]),
    db().from("notifications").select("task_id, member_id, kind, status, error, sent_at").order("sent_at", { ascending: false }).limit(500),
  ]);
  const withDevice = new Set((devices ?? []).map((d) => d.member_id));
  const taskInfo = new Map(rows.flatMap((r) => r.tasks.map((t) => [t.id, { team: r.team.id, t }] as const)));
  const memberCode = new Map(rows.flatMap((r) => r.members.map((m) => [m.id, m.code] as const)));
  const pushStats = rows.map((r) => {
    const mine = (sent ?? []).filter((n) => taskInfo.get(n.task_id)?.team === r.team.id);
    const n = (kind: string, status: string) => mine.filter((x) => x.kind === kind && x.status === status).length;
    return {
      r, on: r.members.filter((m) => withDevice.has(m.id)).length,
      s60: n("60", "sent"), s30: n("30", "sent"),
      failed: mine.filter((x) => x.status === "failed").length,
      noDevice: mine.filter((x) => x.status === "no_device").length,
    };
  });
  const recent = (sent ?? []).slice(0, 15);

  const queue = rows.flatMap((r) => r.tasks.flatMap((t) =>
    t.submissions.filter((s) => s.review === "pending").map((s) => ({ r, t, s }))));
  queue.sort((a, b) => a.s.created_at.localeCompare(b.s.created_at));
  const signed = await Promise.all(queue.map(async ({ s }) =>
    s.file_path ? (await db().storage.from(BUCKET).createSignedUrl(s.file_path, 3600)).data?.signedUrl ?? null : null));

  return (
    <main className="wrap wide">
      <header className="stack-sm">
        <span className="eyebrow">보임 운영 · 오즈의 마법사</span>
        <h1>판정과 검수</h1>
      </header>

      <section className="panel">
        <h2>본인 첨부율 (판정)</h2>
        <p className="big num">{pct(rate)} <span className={`pill ${v.cls}`}>{v.label}</span></p>
        <p className="muted small">
          첫 중간 마감 항목 {sum.total}개 중, 마감 24시간 전까지 담당 본인이 올려 통과한 항목 {sum.ok}개.
          60% 이상 개발 착수 · 30% 미만 설계 전환. 모든 팀의 첫 중간 마감이 지나야 판정이 확정됩니다.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>팀</th><th>첫 마감</th><th>항목</th><th>24시간 전 본인</th><th>24시간 안 본인</th><th>대신</th><th>마감 후</th><th>없음</th><th>비율</th><th>열람</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id}>
                  <td>{r.team.code}</td><td className="num">{r.first.due ? md(r.first.due) : "–"}</td>
                  <td className="num">{r.c.total}</td><td className="num">{r.c["self-before"]}</td>
                  <td className="num">{r.c["self-after"]}</td><td className="num">{r.c.proxy}</td>
                  <td className="num">{r.c.late}</td><td className="num">{r.c.none}</td>
                  <td className="num">{r.c.total ? pct(r.c["self-before"] / r.c.total) : "–"}</td>
                  <td className="num">{r.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">검수 대기 중인 결과물은 통과해야 셉니다. 남은 검수를 먼저 끝내 주세요.</p>
      </section>

      <section className="panel">
        <h2>앱 알림 발송</h2>
        <p className="muted small">마감 1시간 전·30분 전에 아직 아무것도 올리지 않은 담당자에게 자동으로 갑니다. “알림 안 켬”은 담당자가 이 기기에서 알림을 켜지 않아 보내지 못한 건수입니다.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>팀</th><th>알림 켠 사람</th><th>1시간 전</th><th>30분 전</th><th>실패</th><th>알림 안 켬</th></tr></thead>
            <tbody>
              {pushStats.map((p) => (
                <tr key={p.r.team.id}>
                  <td>{p.r.team.code}</td><td className="num">{p.on}/{p.r.members.length}</td>
                  <td className="num">{p.s60}</td><td className="num">{p.s30}</td>
                  <td className="num">{p.failed}</td><td className="num">{p.noDevice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recent.length > 0 && (
          <ul className="history">
            {recent.map((n, i) => {
              const info = taskInfo.get(n.task_id);
              return (
                <li key={i}>
                  <span className="num">{dateTime(n.sent_at)}</span>
                  <span className="num">{info?.t.code ?? "?"} · {memberCode.get(n.member_id) ?? "?"}</span>
                  <span>{n.kind === "60" ? "1시간 전" : "30분 전"}{n.error ? ` · ${n.error}` : ""}</span>
                  <span className={`pill ${n.status === "sent" ? "s-done" : n.status === "failed" ? "s-none" : "s-wait"}`}>
                    {n.status === "sent" ? "보냄" : n.status === "failed" ? "실패" : "알림 안 켬"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="stack">
        <h2>검수 대기 {queue.length}건</h2>
        <p className="muted small">완료 기준(파일이 열리는지, 정한 분량을 채웠는지)만 봅니다. 내용의 질은 판단하지 않습니다.</p>
        {queue.length === 0 && <p className="muted">확인할 결과물이 없습니다.</p>}
        {queue.map(({ r, t, s }, i) => {
          const uploader = r.members.find((m) => m.id === s.uploader_id)?.code ?? "?";
          const self = s.uploader_id === t.owner_id;
          return (
            <article key={s.id} className="panel">
              <span className="eyebrow"><span className="num">{t.code}</span> · 마감 {dueLabel(t.due, t.due_time)} · 올림 {dateTime(s.created_at)}</span>
              <h3>{t.title}</h3>
              <p className="rulebox">{t.rule}</p>
              <p className="small">
                담당 <b className="num">{t.owner}</b> · 올린 사람 <b className="num">{uploader}</b>{" "}
                <span className={`pill ${self ? "s-done" : "s-wait"}`}>{self ? "본인" : "대신"}</span>
              </p>
              <p className="small clip">
                {signed[i] && <a href={signed[i]!} target="_blank" rel="noopener">{s.file_name ?? "파일 열기"}</a>}
                {s.link_url && <a href={s.link_url} target="_blank" rel="noopener noreferrer">{s.link_url}</a>}
              </p>
              {s.note && <p className="muted small">메모: {s.note}</p>}
              <form action={review} className="review-row">
                <input type="hidden" name="id" value={s.id} />
                <button className="btn" name="verdict" value="pass">기준 충족 · 통과</button>
                <label className="sr-only" htmlFor={`reason-${s.id}`}>반려 이유</label>
                <input id={`reason-${s.id}`} name="reason" placeholder="반려 이유 (담당자에게 보임)" />
                <button className="btn ghost" name="verdict" value="fail">반려</button>
              </form>
            </article>
          );
        })}
      </section>

      <section className="stack">
        <h2>팀과 링크</h2>
        {rows.map((r) => (
          <div key={r.team.id} className="panel">
            <h3>{r.team.name}</h3>
            <p className="small">팀원 {r.members.map((m) => m.code + (m.is_leader ? "(팀장)" : "")).join(", ")}</p>
            <code className="copy">{`${origin}/t/${r.team.token}`}</code>
          </div>
        ))}
        <TeamForm />
      </section>
    </main>
  );
}
