import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { tasksOf, logView, teamsOfUser, type Task, type Status } from "@/lib/data";
import { openTeam } from "@/lib/team-access";
import { dday, dueLabel, STATUS_LABEL } from "@/lib/format";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "./not-member";
import { NotifyToggle } from "./notify-toggle";
import { TaskCard } from "./task-card";
import { TeamSide } from "./team-side";

export async function generateMetadata({ params }: PageProps<"/t/[token]">): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/t/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "보임", statusBarStyle: "default" },
    robots: { index: false },
  };
}

const COLUMNS: Status[] = ["none", "wait", "done"];

export default async function Board({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const { user, team, members, me } = await openTeam(token, `/t/${token}`);
  if (!me) return <NotMember nickname={user.nickname} />;
  const [tasks, teams] = await Promise.all([tasksOf(team, members), teamsOfUser(user.id)]);
  await logView(team.id, me.id);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const count = { done: 0, wait: 0, none: 0 };
  tasks.forEach((t) => count[t.status]++);
  const next = tasks.find((t) => t.status !== "done");
  const mine = tasks.filter((t) => t.owner_id === me.id && t.status !== "done");
  // PC 칸 안에서는 내 업무가 먼저, 그다음 마감순 (tasks는 이미 마감순)
  const inColumn = (s: Status): Task[] =>
    tasks.filter((t) => t.status === s).sort((a, b) => Number(b.owner_id === me.id) - Number(a.owner_id === me.id));

  return (
    <AppShell user={user} teams={teams} current={token}
      side={<TeamSide token={token} members={members} me={me} inviteCode={team.invite_code} origin={origin} />}>
      <header className="title-row">
        <div className="stack-sm">
          <span className="eyebrow">보임 · 묻지 않아도 보이는 팀플</span>
          <h1>{team.name}</h1>
        </div>
        <div className="action-bar only-desktop"><Link className="btn" href={`/t/${token}/new`}>업무 등록하기</Link></div>
      </header>

      <NotifyToggle token={token} />

      {mine.length > 0 && (
        <p className="callout">
          <b>{me.nickname}</b> 님이 올릴 업무가 <b className="num">{mine.length}</b>개 있습니다.
        </p>
      )}

      <section className="summary" aria-label="상태 요약">
        <div><b>{count.done}</b><span>완료</span></div>
        <div><b>{count.wait}</b><span>확인 중</span></div>
        <div><b>{count.none}</b><span>파일 없음</span></div>
      </section>

      {tasks.length === 0 ? (
        <p className="muted">아직 등록된 업무가 없습니다. 팀원을 초대하고 역할을 나눈 뒤 첫 업무를 등록해 주세요.</p>
      ) : next ? (
        <p className="muted">가장 가까운 남은 마감: <b className="fg">{next.title}</b> · <span className="num">{dueLabel(next.due, next.due_time)} ({dday(next.due)})</span></p>
      ) : (
        <p className="muted">모든 업무가 완료됐습니다.</p>
      )}

      {tasks.length > 0 && (
        <>
          {/* PC: 상태별 세 칸 */}
          <div className="columns only-desktop">
            {COLUMNS.map((s) => {
              const items = inColumn(s);
              return (
                <section key={s} className="column" aria-label={STATUS_LABEL[s]}>
                  <div className="column-head"><span className={`pill s-${s}`}>{STATUS_LABEL[s]}</span><span className="num">{items.length}</span></div>
                  {items.length === 0
                    ? <p className="empty">아직 없습니다</p>
                    : items.map((t) => <TaskCard key={t.id} token={token} task={t} mine={t.owner_id === me.id} />)}
                </section>
              );
            })}
          </div>

          {/* 모바일: 마감순 목록 하나 */}
          <ul className="list only-mobile">
            {tasks.map((t) => <li key={t.id}><TaskCard token={token} task={t} mine={t.owner_id === me.id} /></li>)}
          </ul>
        </>
      )}

      <p className="note">“완료”는 완료 기준에 맞는 파일이 올라와야만 바뀝니다. 올린 파일은 확인을 거쳐 완료로 표시됩니다.</p>

      <div className="action-bar only-mobile"><Link className="btn" href={`/t/${token}/new`}>업무 등록하기</Link></div>
    </AppShell>
  );
}
