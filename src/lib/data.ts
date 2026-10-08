import "server-only";
import { cookies } from "next/headers";
import { db } from "./supabase";

export type Status = "done" | "wait" | "none";
export type Review = "pending" | "pass" | "fail";

export type Team = { id: string; code: string; name: string; token: string };
export type Member = { id: string; code: string; is_leader: boolean };
export type Submission = {
  id: string; uploader_id: string | null; file_path: string | null; file_name: string | null;
  link_url: string | null; note: string | null; review: Review; review_note: string | null; created_at: string;
};
export type Task = {
  id: string; seq: number; code: string; title: string; owner_id: string; owner: string;
  due: string; rule: string; reminded_at: string | null; status: Status; latest: Submission | null; submissions: Submission[];
};

export function statusOf(latest: Submission | null): Status {
  if (!latest) return "none";
  if (latest.review === "pass") return "done";
  if (latest.review === "pending") return "wait";
  return "none"; // 반려되면 다시 올려야 한다
}

export async function teamByToken(token: string): Promise<Team | null> {
  if (!/^[0-9a-f]{24}$/.test(token)) return null;
  const { data } = await db().from("teams").select("id, code, name, token").eq("token", token).maybeSingle();
  return data;
}

export async function membersOf(teamId: string): Promise<Member[]> {
  const { data } = await db().from("members").select("id, code, is_leader").eq("team_id", teamId).order("code");
  return data ?? [];
}

export async function tasksOf(team: Team, members: Member[]): Promise<Task[]> {
  const { data } = await db()
    .from("tasks")
    .select("id, seq, title, owner_id, due, rule, reminded_at, submissions(id, uploader_id, file_path, file_name, link_url, note, review, review_note, created_at)")
    .eq("team_id", team.id)
    .order("due")
    .order("seq");
  const name = new Map(members.map((m) => [m.id, m.code]));
  return (data ?? []).map((t) => {
    const subs = [...((t.submissions as Submission[]) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = subs[0] ?? null;
    return {
      id: t.id, seq: t.seq, code: `${team.code}-${t.seq}`, title: t.title, owner_id: t.owner_id,
      owner: name.get(t.owner_id) ?? "?", due: t.due, rule: t.rule, reminded_at: t.reminded_at, status: statusOf(latest), latest, submissions: subs,
    };
  });
}

/** 이 기기에서 고른 "나" (팀마다 따로). 로그인 대신 쓰는 식별자다. */
const meCookie = (teamId: string) => `boim_me_${teamId.slice(0, 8)}`;

export async function currentMember(team: Team, members: Member[]): Promise<Member | null> {
  const id = (await cookies()).get(meCookie(team.id))?.value;
  return members.find((m) => m.id === id) ?? null;
}

export async function setCurrentMember(team: Team, memberId: string) {
  (await cookies()).set(meCookie(team.id), memberId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90, path: `/t/${team.token}`,
  });
}

export async function logView(teamId: string, memberId: string | null) {
  await db().from("views").insert({ team_id: teamId, member_id: memberId });
}
