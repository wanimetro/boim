import Link from "next/link";
import { headers } from "next/headers";
import { openTeam } from "@/lib/team-access";
import { teamsOfUser } from "@/lib/data";
import { today } from "@/lib/format";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "../not-member";
import { TeamSide } from "../team-side";
import { NewTaskForm } from "./new-task-form";

export default async function NewTask({ params }: PageProps<"/t/[token]/new">) {
  const { token } = await params;
  const { user, team, members, me } = await openTeam(token, `/t/${token}/new`);
  if (!me) return <NotMember nickname={user.nickname} />;
  const teams = await teamsOfUser(user.id);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <AppShell user={user} teams={teams} current={token}
      side={<TeamSide token={token} members={members} me={me} inviteCode={team.invite_code} origin={origin} />}>
      <div className="narrow">
        <Link className="back" href={`/t/${token}`}>← 팀 보드로</Link>
        <header className="stack-sm">
          <span className="eyebrow">{team.name}</span>
          <h1>업무 등록</h1>
          <p className="muted">업무 하나에 담당 한 명과 중간 마감 하나를 정합니다. 완료 기준은 파일만 보고도 됐는지 안 됐는지 가를 수 있게 적어 주세요.</p>
        </header>
        {members.length < 2 && (
          <p className="callout warn-box small">아직 팀에 혼자 있습니다. “팀원 초대”에서 팀원을 먼저 부르면 담당을 고를 수 있습니다.</p>
        )}
        <NewTaskForm token={token} members={members.map((m) => ({ id: m.id, name: m.nickname }))} minDate={today()} />
      </div>
    </AppShell>
  );
}
