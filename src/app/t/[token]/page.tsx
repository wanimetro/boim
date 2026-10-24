import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { tasksOf, logView, teamsOfUser, type Task } from "@/lib/data";
import { openTeam } from "@/lib/team-access";
import { dateTime, dday, dueLabel } from "@/lib/format";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "./not-member";
import { NotifyToggle } from "./notify-toggle";
import { TeamSide } from "./team-side";
import { CheckIcon, StepDots, stepOf } from "./progress";

export async function generateMetadata({ params }: PageProps<"/t/[token]">): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/t/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "보임", statusBarStyle: "default" },
    robots: { index: false },
  };
}

const NEWS_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** 내가 맡거나 올린 업무 중 최근 3일 안에 완료된 것 */
function recentlyDone(tasks: Task[], meId: string): Task[] {
  const now = Date.now();
  return tasks.filter((t) => {
    const s = t.latest?.state;
    return s?.kind === "confirmed" && (t.owner_id === meId || t.latest?.uploader_id === meId) && now - s.at < NEWS_WINDOW_MS;
  });
}

function todayLabel() {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" }).format(new Date());
}

export default async function Board({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const onlyMine = (await searchParams).mine === "1";
  const { user, team, members, me } = await openTeam(token, `/t/${token}`);
  if (!me) return <NotMember nickname={user.nickname} />;
  const [tasks, teams] = await Promise.all([tasksOf(team, members), teamsOfUser(user.id)]);
  await logView(team.id, me.id);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const nick = new Map(members.map((m) => [m.id, m.nickname]));

  // 지금 할 일 — 내가 움직여야 하는 것만 모은다
  // 1) 받은 피드백: 내가 맡은 업무에 미충족 의견
  const feedback = tasks.filter((t) => t.owner_id === me.id && t.latest?.state.kind === "objected");
  // 2) 확인 요청: 남이 올린 결과물을 내가 아직 확인하지 않음 (내가 맡은 업무는 제외)
  const toCheck = tasks.filter((t) =>
    t.latest && t.latest.state.kind === "open" && t.latest.checkers.includes(me.id) && !t.latest.checks.some((c) => c.member_id === me.id));
  // 3) 올릴 차례: 내가 맡았는데 아직 아무것도 안 올림
  const toUpload = tasks.filter((t) => t.owner_id === me.id && !t.latest);
  // 새 소식: 내가 맡거나 올린 업무가 최근 완료됨
  const news = recentlyDone(tasks, me.id);
  const todo = feedback.length + toCheck.length + toUpload.length;

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const perMember = members.map((m) => {
    const mineAll = tasks.filter((t) => t.owner_id === m.id);
    return { m, done: mineAll.filter((t) => t.status === "done").length, total: mineAll.length };
  });
  const upcoming = tasks.filter((t) => t.status !== "done").slice(0, 3);
  const rows = onlyMine ? tasks.filter((t) => t.owner_id === me.id) : tasks;
  // 끝난 업무는 아래로, 나머지는 마감순 (tasks는 이미 마감순)
  const sorted = [...rows].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));

  return (
    <AppShell user={user} teams={teams} current={token}
      side={
        <>
          <section className="panel team-progress" aria-label="팀 진행">
            <h2>팀 진행</h2>
            <p className="big-num"><span className="num">{pct}%</span><span className="muted small">{tasks.length}개 중 {done}개 완료</span></p>
            <span className="meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            <ul className="member-progress">
              {perMember.map(({ m, done: d, total }) => (
                <li key={m.id}>
                  <span className="avatar" aria-hidden="true">{m.nickname.slice(0, 1)}</span>
                  <span className="clip">{m.nickname}{m.id === me.id ? " (나)" : ""}{m.is_leader && <span className="muted small"> 팀장</span>}</span>
                  <span className="num">{d}/{total}</span>
                </li>
              ))}
            </ul>
          </section>
          {upcoming.length > 0 && (
            <section className="panel" aria-label="다가오는 마감">
              <h2>다가오는 마감</h2>
              <ul className="upcoming">
                {upcoming.map((t) => (
                  <li key={t.id}><b className={`num${dday(t.due).startsWith("D-") && Number(dday(t.due).slice(2)) <= 2 ? " warn" : ""}`}>{dday(t.due)}</b>
                    <Link href={`/t/${token}/task/${t.seq}`} className="clip">{t.title}</Link></li>
                ))}
              </ul>
            </section>
          )}
          <TeamSide token={token} members={members} me={me} inviteCode={team.invite_code} origin={origin} />
        </>
      }>
      <header className="board-head">
        <div className="stack-sm">
          <span className="muted small">{todayLabel()} · {team.name}</span>
          <h1 className="greeting">
            {todo > 0
              ? <>{me.nickname} 님, 지금 할 일이 <mark>{todo}개</mark> 있어요</>
              : <>{me.nickname} 님, 지금은 할 일이 없어요</>}
          </h1>
        </div>
        <Link className="btn small-btn only-desktop" href={`/t/${token}/new`}>+ 업무 등록</Link>
      </header>

      {(todo > 0 || news.length > 0) && (
        <section className="todo-grid" aria-label="지금 할 일">
          {feedback.map((t) => {
            const o = t.latest?.state.kind === "objected" ? t.latest.state.objections : [];
            return (
              <article key={`f-${t.id}`} className="todo-card is-feedback">
                <span className="pill s-none">받은 피드백 · 내 업무</span>
                <h2>{t.title}</h2>
                <p className="muted small">{o.map((x) => `${x.item + 1}번`).join(", ")} 항목이 미충족이에요</p>
                {o[0]?.reasons[0] && <p className="quote">“{o[0].reasons[0]}”</p>}
                <Link className="btn dark" href={`/t/${token}/task/${t.seq}#now`}>고쳐서 다시 올리기</Link>
              </article>
            );
          })}
          {toCheck.map((t) => {
            const s = t.latest!.state;
            const answered = s.kind === "open" ? s.answered : 0, required = s.kind === "open" ? s.required : 0;
            return (
              <article key={`c-${t.id}`} className="todo-card">
                <span className="pill s-wait">확인 요청 · 내가 볼 차례</span>
                <h2>{t.title}</h2>
                <p className="muted small">{nick.get(t.latest!.uploader_id ?? "") ?? "?"} 님이 올렸어요 · 기준 {t.criteria.length}개</p>
                <div className="mini-meter"><span className="meter" aria-hidden="true"><span style={{ width: `${required ? (answered / required) * 100 : 0}%` }} /></span><span className="small muted num">팀원 확인 {answered}/{required}</span></div>
                <Link className="btn" href={`/t/${token}/task/${t.seq}#now`}>항목 확인하기</Link>
              </article>
            );
          })}
          {toUpload.map((t) => (
            <article key={`u-${t.id}`} className="todo-card">
              <span className="pill s-idle">올릴 차례 · 내 업무</span>
              <h2>{t.title}</h2>
              <p className="muted small">마감 <span className="num">{dueLabel(t.due, t.due_time)} · {dday(t.due)}</span> · 기준 {t.criteria.length}개</p>
              <Link className="btn ghost" href={`/t/${token}/task/${t.seq}#now`}>결과물 올리기</Link>
            </article>
          ))}
          {news.map((t) => {
            const s = t.latest!.state;
            const byAll = s.kind === "confirmed" && s.by === "all";
            return (
              <article key={`n-${t.id}`} className="todo-card is-news">
                <span className="pill s-lime">새 소식 · 완료</span>
                <h2>{t.title}</h2>
                <p className="small">{byAll ? "팀원 모두가 기준을 확인해서 완료로 넘어갔어요." : "12시간 동안 미충족 의견이 없어 완료됐어요."}</p>
                <p className="news-foot">
                  <span className="check-badge" aria-hidden="true"><CheckIcon size={13} color="#24400a" /></span>
                  <span className="small num">{s.kind === "confirmed" ? dateTime(new Date(s.at).toISOString()) : ""}</span>
                  <Link href={`/t/${token}/task/${t.seq}`}>보기</Link>
                </p>
              </article>
            );
          })}
        </section>
      )}

      <NotifyToggle token={token} />

      <section className="stack" aria-label="전체 업무">
        <div className="title-row" style={{ alignItems: "center" }}>
          <h2>전체 업무</h2>
          <nav className="chips" aria-label="보기">
            <Link href={`/t/${token}`} aria-current={!onlyMine ? "page" : undefined}>전체</Link>
            <Link href={`/t/${token}?mine=1`} aria-current={onlyMine ? "page" : undefined}>내 업무만</Link>
          </nav>
        </div>
        {sorted.length === 0 ? (
          <p className="muted">{onlyMine ? "내가 맡은 업무가 없습니다." : "아직 등록된 업무가 없습니다. 팀원을 초대하고 역할을 나눈 뒤 첫 업무를 등록해 주세요."}</p>
        ) : (
          <div className="task-table" role="table" aria-label="업무 목록">
            <div className="tt-head" role="row">
              <span role="columnheader">마감</span><span role="columnheader">업무</span><span role="columnheader">담당</span><span role="columnheader">올림 → 팀원 확인 → 완료</span>
            </div>
            {sorted.map((t: Task) => {
              const step = stepOf(t);
              const d = dday(t.due);
              return (
                <Link key={t.id} role="row" className={`tt-row${t.status === "done" ? " is-done" : ""}${t.owner_id === me.id ? " is-mine" : ""}`} href={`/t/${token}/task/${t.seq}`}>
                  <span role="cell" className="num tt-due"><b className={d.startsWith("D-") && Number(d.slice(2)) <= 2 && t.status !== "done" ? "warn" : undefined}>{t.status === "done" ? "" : d}</b> {dueLabel(t.due, t.due_time)}</span>
                  <span role="cell" className="tt-title">
                    <span className="clip">{t.title}</span>
                    {t.criteria_edits.length > 0 && <span className="pill s-wait">기준 수정됨</span>}
                  </span>
                  <span role="cell" className="tt-owner">{t.owner}{t.owner_id === me.id && <span className="muted small"> 나</span>}</span>
                  <span role="cell"><StepDots step={step} /></span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <p className="note">“완료”는 결과물이 올라와야만 바뀝니다. 팀원이 완료 기준을 항목마다 확인하고, 전원이 충족으로 확인하거나 12시간 동안 미충족 의견이 없으면 완료됩니다. 누가 어떤 의견을 냈는지는 보이지 않습니다.</p>

      <div className="action-bar only-mobile"><Link className="btn" href={`/t/${token}/new`}>+ 업무 등록</Link></div>
    </AppShell>
  );
}
