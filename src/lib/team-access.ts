import "server-only";
import { notFound } from "next/navigation";
import { currentUser, requireUser } from "./auth";
import { teamByToken, membersOf } from "./data";

/** 화면용: 로그인 안 했으면 로그인으로, 팀이 없으면 404. 팀원이 아니면 me = null */
export async function openTeam(token: string, path: string) {
  const user = await requireUser(path);
  const team = await teamByToken(token);
  if (!team) notFound();
  const members = await membersOf(team.id);
  const me = members.find((m) => m.user_id === user.id) ?? null;
  return { user, team, members, me };
}

/** 서버 액션용: 로그인한 팀원만 통과 */
export async function memberOnly(token: string) {
  const user = await currentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const team = await teamByToken(token);
  if (!team) throw new Error("팀을 찾을 수 없습니다.");
  const members = await membersOf(team.id);
  const me = members.find((m) => m.user_id === user.id);
  if (!me) throw new Error("이 팀의 팀원만 할 수 있습니다.");
  return { user, team, members, me };
}
