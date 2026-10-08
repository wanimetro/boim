import Link from "next/link";
import { openTeam } from "@/lib/team-access";
import { today } from "@/lib/format";
import { NotMember } from "../not-member";
import { NewTaskForm } from "./new-task-form";

export default async function NewTask({ params }: PageProps<"/t/[token]/new">) {
  const { token } = await params;
  const { user, team, members, me } = await openTeam(token, `/t/${token}/new`);
  if (!me) return <NotMember nickname={user.nickname} />;

  return (
    <main className="wrap">
      <Link className="back" href={`/t/${token}`}>← 팀 보드로</Link>
      <header className="stack-sm">
        <span className="eyebrow">{team.name}</span>
        <h1>업무 등록</h1>
        <p className="muted">업무 하나에 담당 한 명, 중간 마감 하나를 정합니다. 완료 기준은 파일을 보고 “됐다 / 안 됐다”를 가를 수 있게 적어 주세요.</p>
      </header>
      {members.length < 2 && (
        <p className="callout warn-box small">아직 팀원이 나뿐입니다. 보드 아래 “팀원 초대”로 팀원을 먼저 부르면 담당을 고를 수 있습니다.</p>
      )}
      <NewTaskForm token={token} members={members.map((m) => ({ id: m.id, name: m.nickname }))} minDate={today()} />
    </main>
  );
}
