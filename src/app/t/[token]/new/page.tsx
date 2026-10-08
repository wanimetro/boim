import Link from "next/link";
import { notFound } from "next/navigation";
import { teamByToken, membersOf } from "@/lib/data";
import { today } from "@/lib/format";
import { NewTaskForm } from "./new-task-form";

export default async function NewTask({ params }: PageProps<"/t/[token]/new">) {
  const { token } = await params;
  const team = await teamByToken(token);
  if (!team) notFound();
  const members = await membersOf(team.id);

  return (
    <main className="wrap">
      <Link className="back" href={`/t/${token}`}>← 팀 보드로</Link>
      <header className="stack-sm">
        <span className="eyebrow">{team.name}</span>
        <h1>업무 등록</h1>
        <p className="muted">업무 하나에 담당 한 명, 중간 마감 하나를 정합니다. 완료 기준은 파일을 보고 “됐다 / 안 됐다”를 가를 수 있게 적어 주세요.</p>
      </header>
      <NewTaskForm token={token} members={members.map((m) => ({ id: m.id, code: m.code }))} minDate={today()} />
    </main>
  );
}
