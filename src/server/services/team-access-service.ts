import "server-only";
import { teamByToken, membersOf } from "./team-service";
export async function requireTeamMember(userId: string | null, token: string) {
  if (!userId) throw new Error("로그인이 필요합니다.");
  const team = await teamByToken(token);
  if (!team) throw new Error("팀을 찾을 수 없습니다.");
  const members = await membersOf(team.id);
  const me = members.find(member => member.user_id === userId);
  if (!me) throw new Error("이 팀의 팀원만 할 수 있습니다.");
  return { team, members, me, userId };
}
