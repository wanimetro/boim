import Link from "next/link";
import type { Task } from "@/lib/data";
import { dday, dueLabel, STATUS_LABEL } from "@/lib/format";

export function TaskCard({ token, task, mine }: { token: string; task: Task; mine: boolean }) {
  const redo = task.latest?.state.kind === "objected" || (task.latest?.state.kind === "legacy" && !task.latest.state.pass);
  return (
    <Link className={`task${mine ? " is-mine" : ""}`} href={`/t/${token}/task/${task.seq}`}>
      <span className="title">{task.title}</span>
      <span className={`pill s-${task.status}`}>{STATUS_LABEL[task.status]}</span>
      <span className="rule">완료 기준 {task.criteria.length}개: {task.criteria.join(" · ")}</span>
      <span className="meta">
        <span>담당 <b>{task.owner}</b></span>
        <span className="num">{dueLabel(task.due, task.due_time)} · {dday(task.due)}</span>
        {task.criteria_edits.length > 0 && <span className="pill s-wait">기준 수정됨</span>}
        {redo && <span className="warn">다시 올려 주세요</span>}
      </span>
    </Link>
  );
}
