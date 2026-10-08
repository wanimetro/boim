import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { teamByInvite, joinTeam } from "@/lib/data";

/**
 * 초대 링크.
 * - 로그인돼 있으면 바로 팀원으로 넣고 팀 보드로 보낸다.
 * - 아니면 로그인/가입 화면으로 보내고, 끝나면 이 주소로 돌아와 참여된다.
 */
export default async function Join({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const team = await teamByInvite(code);
  if (!team) {
    return (
      <main className="wrap">
        <h1>초대 코드를 찾을 수 없습니다</h1>
        <p className="muted">코드가 바뀌었거나 잘못 복사됐을 수 있습니다. 팀장에게 새 초대 링크를 받아 주세요.</p>
        <Link className="btn ghost" href="/">처음으로</Link>
      </main>
    );
  }
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${team.invite_code}`)}`);
  await joinTeam(team, user.id);
  redirect(`/t/${team.token}`);
}
