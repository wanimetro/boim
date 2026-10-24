import Link from "next/link";
import { notFound } from "next/navigation";
import { tasksOf, teamsOfUser } from "@/lib/data";
import { openTeam, canEditTask } from "@/lib/team-access";
import { today } from "@/lib/format";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "../../../not-member";
import { TaskForm } from "../../../new/new-task-form";
import { updateTask } from "../../../actions";

export default async function EditTask({ params }: PageProps<"/t/[token]/task/[seq]/edit">) {
  const { token, seq } = await params;
  const { user, team, members, me } = await openTeam(token, `/t/${token}/task/${seq}/edit`);
  if (!me) return <NotMember nickname={user.nickname} />;
  const [tasks, teams] = await Promise.all([tasksOf(team, members), teamsOfUser(user.id)]);
  const task = tasks.find((t) => t.seq === Number(seq));
  if (!task) notFound();
  const editable = canEditTask(me, task);

  return (
    <AppShell user={user} teams={teams} current={token} memberCount={members.length}>
      <div className="narrow">
        <Link className="back" href={`/t/${token}/task/${task.seq}`}>← 업무로 돌아가기</Link>
        <header className="stack-sm">
          <span className="eyebrow"><span className="num">{task.code}</span> · {team.name}</span>
          <h1>업무 수정</h1>
        </header>
        {editable ? (
          <>
            <p className="muted">마감 전까지 팀장이나 이 업무를 등록한 사람이 고칠 수 있습니다. 고친 내용은 기록으로 남습니다.</p>
            <TaskForm
              action={updateTask.bind(null, token, task.seq)}
              members={members.map((m) => ({ id: m.id, name: m.nickname }))}
              minDate={today()}
              defaults={{ title: task.title, owner_id: task.owner_id, due: task.due, due_time: task.due_time, criteria: task.criteria }}
              criteriaLocked={task.submissions.length > 0 || !me.is_leader}
              criteriaNote={task.submissions.length > 0
                ? "결과물이 이미 올라와서 완료 기준은 바꿀 수 없습니다. 업무 이름·담당·마감만 고칠 수 있어요."
                : !me.is_leader
                  ? "완료 기준은 팀장만 고칠 수 있어요. 오타나 빠진 항목이 있으면 팀장에게 알려 주세요."
                  : "완료 기준은 팀이 함께 정한 약속이에요. 결과물이 올라오면 더는 바꿀 수 없고, 고치면 팀원에게 “기준 수정됨”과 바뀐 내용이 보입니다."}
              submitLabel="고친 내용 저장"
            />
          </>
        ) : (
          <p className="callout warn-box">
            {canEditTask({ ...me, is_leader: true }, task)
              ? "이 업무는 팀장이나 등록한 사람만 고칠 수 있습니다."
              : "마감이 지난 업무는 고칠 수 없습니다."}
          </p>
        )}
      </div>
    </AppShell>
  );
}
