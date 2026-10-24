import "server-only";
import { requireTeamMember } from "@/server/services/team-access-service";
import { notFound } from "next/navigation";
import { currentUser, requireUser } from "./auth";
import { teamByToken, membersOf } from "@/server/services/team-service";
import { deadlineMs } from "@/domain/time";

/** 화면용: 로그인 안 했으면 로그인으로, 팀이 없으면 404. 팀원이 아니면 me = null */
export async function openTeam(token: string, path: string) {
  const user = await requireUser(path);
  const team = await teamByToken(token);
  if (!team) notFound();
  const members = await membersOf(team.id);
  const me = members.find((m) => m.user_id === user.id) ?? null;
  return { user, team, members, me };
}

/** 업무를 고칠 수 있는가: 팀장이거나 등록한 사람이고, 지금 마감 전 (서버 액션에서 다시 확인한다) */
export function canEditTask(me: { id: string; is_leader: boolean }, task: { created_by: string | null; due: string; due_time: string }) {
  return (me.is_leader || task.created_by === me.id) && deadlineMs(task.due, task.due_time) > Date.now();
}

/** 완료 기준만 고칠 수 있는가: 위 조건이거나, 이 업무의 담당자이고 마감 전 (받은 기준 의견을 반영하려고) */
export function canEditCriteria(me: { id: string; is_leader: boolean }, task: { created_by: string | null; owner_id: string; due: string; due_time: string }) {
  return (me.is_leader || task.created_by === me.id || task.owner_id === me.id) && deadlineMs(task.due, task.due_time) > Date.now();
}

/** 서버 액션용: 로그인한 팀원만 통과 */
export async function memberOnly(token: string) {
  const user = await currentUser();
  const context = await requireTeamMember(user?.id ?? null, token);
  return { ...context, user: user! };
}
