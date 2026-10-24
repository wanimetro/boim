import "server-only";
import { db } from "@/lib/supabase";
import type { Team } from "@/domain/task";
const cols = "id, code, name, token, invite_code";
function checked<T>(r: { data: T; error: unknown }): T { if (r.error) throw r.error; return r.data; }
export const teamRepository = {
  async byToken(token: string) { return checked(await db().from("teams").select(cols).eq("token", token).maybeSingle()) as Team | null; },
  async byInvite(code: string) { return checked(await db().from("teams").select(cols).eq("invite_code", code).maybeSingle()) as Team | null; },
  async members(id: string) { return checked(await db().from("members").select("id, code, is_leader, user_id").eq("team_id", id).order("code")) ?? []; },
  async profiles(ids: string[]) { return ids.length ? checked(await db().from("profiles").select("id, nickname").in("id", ids)) ?? [] : []; },
  async tasks(id: string) { return checked(await db().from("tasks").select("id, seq, title, owner_id, created_by, due, due_time, rule, criteria, criteria_version, criteria_proposed_at, criteria_votes(member_id, version, item, ok, reason, created_at), submissions(id, uploader_id, file_path, file_name, link_url, note, review, review_note, created_at, submission_checks(member_id, version, item, ok, reason, created_at))").eq("team_id", id).order("due").order("due_time").order("seq")) ?? []; },
  async ofUser(id: string) { return checked(await db().from("members").select(`is_leader, teams(${cols})`).eq("user_id", id)) ?? []; },
  async create(userId: string, name: string, token: string, code: string) {
    return checked(await db().rpc("create_team_with_leader", { p_user_id: userId, p_name: name, p_token: token, p_invite_code: code })) as Team;
  },
  async join(teamId: string, userId: string, inviteCode: string | null) {
    checked(await db().rpc("join_team_atomic", { p_team_id: teamId, p_user_id: userId, p_invite_code: inviteCode }));
  },
  async logView(teamId: string, memberId: string | null) { checked(await db().from("views").insert({ team_id: teamId, member_id: memberId })); },
  async regenerate(id: string, code: string) { checked(await db().from("teams").update({ invite_code: code }).eq("id", id)); },
};
