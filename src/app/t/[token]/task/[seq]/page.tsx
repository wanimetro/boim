import Link from "next/link";
import { notFound } from "next/navigation";
import { teamByToken, membersOf, tasksOf, currentMember } from "@/lib/data";
import { dday, dueLabel, dateTime, STATUS_LABEL } from "@/lib/format";
import { MePicker } from "../../me-picker";
import { UploadForm } from "./upload-form";

export default async function TaskPage({ params }: PageProps<"/t/[token]/task/[seq]">) {
  const { token, seq } = await params;
  const team = await teamByToken(token);
  if (!team) notFound();
  const members = await membersOf(team.id);
  const [tasks, me] = await Promise.all([tasksOf(team, members), currentMember(team, members)]);
  const task = tasks.find((t) => t.seq === Number(seq));
  if (!task) notFound();
  const code = new Map(members.map((m) => [m.id, m.code]));
  const back = `/t/${token}/task/${task.seq}`;

  return (
    <main className="wrap">
      <Link className="back" href={`/t/${token}`}>← 팀 보드로</Link>
      <header className="stack-sm">
        <span className="eyebrow">
          <span className="num">{task.code}</span> · 담당 <span className="num">{task.owner}</span> · 마감{" "}
          <span className="num">{dueLabel(task.due, task.due_time)} ({dday(task.due)})</span>
        </span>
        <h1>{task.title}</h1>
        <span className={`pill s-${task.status} self-start`}>{STATUS_LABEL[task.status]}</span>
      </header>

      <section className="panel">
        <h2>완료 기준</h2>
        <p className="rulebox">{task.rule}</p>
        <p className="muted small">이 기준에 맞는 파일이 확인되면 “완료”로 바뀝니다. 말로 “다 했어요”라고 하면 바뀌지 않습니다.</p>
      </section>

      {task.latest?.review === "fail" && (
        <p className="callout warn-box">
          확인 결과 기준에 맞지 않았습니다{task.latest.review_note ? `: ${task.latest.review_note}` : "."} 고쳐서 다시 올려 주세요.
        </p>
      )}

      {task.status === "done" ? (
        <section className="panel">
          <h2>완료됐습니다</h2>
          <p className="muted">고칠 부분이 있으면 새 파일을 올려도 됩니다. 다시 확인 중으로 바뀝니다.</p>
        </section>
      ) : null}

      {me ? (
        <UploadForm token={token} seq={task.seq} isOwner={me.id === task.owner_id} ownerCode={task.owner} meCode={me.code} />
      ) : (
        <MePicker token={token} members={members} me={null} back={back} />
      )}

      {task.submissions.length > 0 && (
        <section className="stack-sm">
          <h2>올린 기록</h2>
          <ul className="history">
            {task.submissions.map((s) => (
              <li key={s.id}>
                <span className="num">{dateTime(s.created_at)}</span>
                <span>{code.get(s.uploader_id ?? "") ?? "?"}</span>
                <span className="clip">{s.file_name ?? s.link_url}</span>
                <span className={`pill s-${s.review === "pass" ? "done" : s.review === "pending" ? "wait" : "none"}`}>
                  {s.review === "pass" ? "통과" : s.review === "pending" ? "확인 중" : "반려"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
