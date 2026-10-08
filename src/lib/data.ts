import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { db } from "./supabase";

export type Status = "done" | "wait" | "none";
export type Review = "pending" | "pass" | "fail";

export type Team = { id: string; code: string; name: string; token: string; invite_code: string | null };
/** code(U01)는 측정용, nickname은 팀 화면용 */
export type Member = { id: string; code: string; is_leader: boolean; user_id: string | null; nickname: string };
export type Submission = {
  id: string; uploader_id: string | null; file_path: string | null; file_name: string | null;
  link_url: string | null; note: string | null; review: Review; review_note: string | null; created_at: string;
};
export type Task = {
  id: string; seq: number; code: string; title: string; owner_id: string;
  owner: string; owner_code: string;
  due: string; due_time: string; rule: string; status: Status; latest: Submission | null; submissions: Submission[];
};

const TEAM_COLS = "id, code, name, token, invite_code";

export function statusOf(latest: Submission | null): Status {
  if (!latest) return "none";
  if (latest.review === "pass") return "done";
  if (latest.review === "pending") return "wait";
  return "none"; // 반려되면 다시 올려야 한다
}

export async function teamByToken(token: string): Promise<Team | null> {
  if (!/^[0-9a-f]{24}$/.test(token)) return null;
  const { data } = await db().from("teams").select(TEAM_COLS).eq("token", token).maybeSingle();
  return data;
}

export async function teamByInvite(code: string): Promise<Team | null> {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(c)) return null;
  const { data } = await db().from("teams").select(TEAM_COLS).eq("invite_code", c).maybeSingle();
  return data;
}

export async function membersOf(teamId: string): Promise<Member[]> {
  const { data } = await db().from("members").select("id, code, is_leader, user_id").eq("team_id", teamId).order("code");
  const ids = (data ?? []).map((m) => m.user_id).filter(Boolean) as string[];
  const { data: profiles } = ids.length
    ? await db().from("profiles").select("id, nickname").in("id", ids)
    : { data: [] as { id: string; nickname: string }[] };
  const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
  return (data ?? []).map((m) => ({ ...m, nickname: (m.user_id && nick.get(m.user_id)) || m.code }));
}

export async function tasksOf(team: Team, members: Member[]): Promise<Task[]> {
  const { data } = await db()
    .from("tasks")
    .select("id, seq, title, owner_id, due, due_time, rule, submissions(id, uploader_id, file_path, file_name, link_url, note, review, review_note, created_at)")
    .eq("team_id", team.id)
    .order("due")
    .order("due_time")
    .order("seq");
  const byId = new Map(members.map((m) => [m.id, m]));
  return (data ?? []).map((t) => {
    const subs = [...((t.submissions as Submission[]) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = subs[0] ?? null;
    const o = byId.get(t.owner_id);
    return {
      id: t.id, seq: t.seq, code: `${team.code}-${t.seq}`, title: t.title, owner_id: t.owner_id,
      owner: o?.nickname ?? "?", owner_code: o?.code ?? "?",
      due: t.due, due_time: String(t.due_time).slice(0, 5), rule: t.rule, status: statusOf(latest), latest, submissions: subs,
    };
  });
}

/** 로그인한 사람이 속한 팀들 */
export async function teamsOfUser(userId: string): Promise<(Team & { is_leader: boolean })[]> {
  const { data } = await db().from("members").select(`is_leader, teams(${TEAM_COLS})`).eq("user_id", userId);
  return (data ?? []).flatMap((m) => {
    const t = m.teams as unknown as Team | null;
    return t ? [{ ...t, is_leader: m.is_leader }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** 헷갈리는 글자(0 O 1 I L)를 뺀 8자리 초대 코드 */
export function newInviteCode(): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => abc[randomInt(abc.length)]).join("");
}

export async function createTeam(userId: string, name: string): Promise<Team> {
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db().from("teams")
      .insert({ name, token: randomBytes(12).toString("hex"), invite_code: newInviteCode(), created_by: userId })
      .select(TEAM_COLS).single();
    if (data) {
      await db().from("members").insert({ team_id: data.id, user_id: userId, code: "U01", is_leader: true });
      return data;
    }
    if (error?.code !== "23505") throw new Error(error?.message);
  }
  throw new Error("팀을 만들지 못했습니다.");
}

/** 팀에 참여한다. 이미 팀원이면 그대로 둔다. 번호는 U02, U03 … 순서로 붙는다. */
export async function joinTeam(team: Team, userId: string): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await db().from("members").select("id").eq("team_id", team.id).eq("user_id", userId).maybeSingle();
    if (existing) return;
    const { data: codes } = await db().from("members").select("code").eq("team_id", team.id);
    const max = Math.max(0, ...(codes ?? []).map((c) => Number(c.code.replace(/\D/g, "")) || 0));
    const { error } = await db().from("members").insert({ team_id: team.id, user_id: userId, code: `U${String(max + 1).padStart(2, "0")}` });
    if (!error) return;
    if (error.code !== "23505") throw new Error(error.message); // 동시에 참여해 번호가 겹치면 다시 시도
  }
  throw new Error("팀에 참여하지 못했습니다.");
}

export async function logView(teamId: string, memberId: string | null) {
  await db().from("views").insert({ team_id: teamId, member_id: memberId });
}
