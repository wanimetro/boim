import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { tasksOf, teamsOfUser } from "@/lib/data";
import { openTeam, canEditTask } from "@/lib/team-access";
import { dday, dueLabel, dateTime, STATUS_LABEL } from "@/lib/format";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "../../not-member";
import { TeamSide } from "../../team-side";
import { UploadForm } from "./upload-form";

export default async function TaskPage({ params }: PageProps<"/t/[token]/task/[seq]">) {
  const { token, seq } = await params;
  const { user, team, members, me } = await openTeam(token, `/t/${token}/task/${seq}`);
  if (!me) return <NotMember nickname={user.nickname} />;
  const [tasks, teams] = await Promise.all([tasksOf(team, members), teamsOfUser(user.id)]);
  const task = tasks.find((t) => t.seq === Number(seq));
  if (!task) notFound();
  const nick = new Map(members.map((m) => [m.id, m.nickname]));
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <AppShell user={user} teams={teams} current={token}
      side={<TeamSide token={token} members={members} me={me} inviteCode={team.invite_code} origin={origin} />}>
      <Link className="back" href={`/t/${token}`}>← 팀 보드로</Link>
      <header className="stack-sm">
        <span className="eyebrow">
          <span className="num">{task.code}</span> · 담당 {task.owner} · 마감{" "}
          <span className="num">{dueLabel(task.due, task.due_time)} ({dday(task.due)})</span>
        </span>
        <h1>{task.title}</h1>
        <div className="title-row" style={{ alignItems: "center" }}>
          <span className={`pill s-${task.status}`}>{STATUS_LABEL[task.status]}</span>
          {canEditTask(me, task) && <Link className="link-btn" href={`/t/${token}/task/${task.seq}/edit`}>업무 수정</Link>}
        </div>
      </header>

      {/* 모바일: 기준 → 올리기 → 기록 / PC: 왼쪽 기준·기록, 오른쪽 올리기 */}
      <div className="split">
        <div className="split-a">
          <section className="panel">
            <h2>완료 기준</h2>
            <p className="rulebox">{task.rule}</p>
            <p className="muted small">이 기준에 맞는 파일이 확인되면 “완료”로 바뀝니다. 말로 “다 했어요”라고 해서는 바뀌지 않습니다.</p>
          </section>

          {task.latest?.review === "fail" && (
            <div className="callout warn-box stack-sm">
              <p>확인 결과 완료 기준에 맞지 않았습니다. 고쳐서 다시 올려 주세요.</p>
              {task.latest.review_note && <p className="small">반려 이유: {task.latest.review_note}</p>}
            </div>
          )}

          {task.status === "done" && (
            <section className="panel">
              <h2>완료됐습니다</h2>
              <p className="muted">고칠 부분이 있으면 새 파일을 올려 주세요. 올리면 다시 “확인 중”으로 바뀝니다.</p>
            </section>
          )}
        </div>

        <div className="split-b">
          <UploadForm token={token} seq={task.seq} isOwner={me.id === task.owner_id} ownerName={task.owner} meName={me.nickname} />
        </div>

        <div className="split-c">
          {task.submissions.length > 0 && (
            <section className="stack-sm">
              <h2>올린 기록</h2>
              <ul className="history">
                {task.submissions.map((s) => (
                  <li key={s.id}>
                    <span className="num">{dateTime(s.created_at)}</span>
                    <span>{nick.get(s.uploader_id ?? "") ?? "?"}</span>
                    <span className="clip">{s.file_name ?? s.link_url}</span>
                    <span className={`pill s-${s.review === "pass" ? "done" : s.review === "pending" ? "wait" : "none"}`}>
                      {s.review === "pass" ? "통과" : s.review === "pending" ? "확인 중" : "반려"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
