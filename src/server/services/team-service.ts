import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { teamRepository as repo } from "@/server/repositories/team-repository";

import { statusOf, type Team, type Member, type Submission, type Task } from "@/domain/task";
import { submissionCheckers, submissionState, type Answer } from "@/domain/criteria";
export type { Status, Review, Team, Member, Submission, Task } from "@/domain/task";
export { statusOf } from "@/domain/task";



export async function teamByToken(token: string): Promise<Team | null> {
  if (!/^[0-9a-f]{24}$/.test(token)) return null;
  const data = await repo.byToken(token);
  return data;
}

export async function teamByInvite(code: string): Promise<Team | null> {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(c)) return null;
  const data = await repo.byInvite(c);
  return data;
}

export async function membersOf(teamId: string): Promise<Member[]> {
  const data = await repo.members(teamId);
  const ids = (data ?? []).map((m) => m.user_id).filter(Boolean) as string[];
  const profiles = await repo.profiles(ids);
  const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
  return (data ?? []).map((m) => ({ ...m, nickname: (m.user_id && nick.get(m.user_id)) || m.code }));
}

export async function tasksOf(team: Team, members: Member[]): Promise<Task[]> {
  const data = await repo.tasks(team.id);
  const byId = new Map(members.map((m) => [m.id, m]));
  const now = Date.now();
  const memberIds = members.map((m) => m.id);
  type RawSubmission = Omit<Submission, "state" | "checks" | "checkers"> & { submission_checks: Answer[] | null };
  return (data ?? []).map((t) => {
    const criteria = (t.criteria as string[] | null) ?? [t.rule];
    const version = Number(t.criteria_version ?? 1);
    // 지금 기준을 정한 시각 (등록하거나 기준을 고친 시각). 그보다 앞서 올린 결과물은 이 시각부터 다시 확인한다
    const criteriaAt = Date.parse(String(t.criteria_proposed_at));
    // 완료 기준이 바뀐 기록만 골라 최근 것부터 (예전 한 줄 기준 rule 수정도 포함)
    type Edit = { before: Record<string, unknown>; after: Record<string, unknown>; created_at: string };
    const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);
    const criteria_edits = ((t.task_edits as Edit[] | null) ?? [])
      .filter((e) => "criteria" in e.after || "rule" in e.after)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((e) => ({ at: e.created_at, before: asList(e.before.criteria ?? e.before.rule), after: asList(e.after.criteria ?? e.after.rule) }));
    const asc = [...((t.submissions as RawSubmission[] | null) ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const subs: Submission[] = asc.map((s, i) => {
      const checks = (s.submission_checks ?? []).filter((c) => c.version === version);
      const next = asc[i + 1] ? Date.parse(asc[i + 1].created_at) : null;
      const { submission_checks: _drop, ...rest } = s;
      void _drop;
      const checkers = submissionCheckers(memberIds, s.uploader_id, t.owner_id);
      return { ...rest, checks, checkers, state: submissionState({ sub: s, criteriaAt, items: criteria.length, version, checkers, checks, now, next }) };
    }).reverse();
    const latest = subs[0] ?? null;
    const o = byId.get(t.owner_id);
    return {
      id: t.id, seq: t.seq, code: `${team.code}-${t.seq}`, title: t.title, owner_id: t.owner_id, created_by: t.created_by,
      owner: o?.nickname ?? "?", owner_code: o?.code ?? "?",
      due: t.due, due_time: String(t.due_time).slice(0, 5), rule: t.rule,
      criteria, criteria_version: version, criteria_edits,
      status: statusOf(latest), latest, submissions: subs,
    };
  });
}

/** 로그인한 사람이 속한 팀들 */
export async function teamsOfUser(userId: string): Promise<(Team & { is_leader: boolean })[]> {
  const data = await repo.ofUser(userId);
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

export async function createTeam(userId: string, rawName: string): Promise<Team> {
  const name = rawName.trim();
  if (!userId || !name || name.length > 40) throw new Error("팀 이름을 40자 안으로 적어 주세요.");
  for (let i = 0; i < 5; i++) {
    try { return await repo.create(userId, name, randomBytes(12).toString("hex"), newInviteCode()); }
    catch (error) { if ((error as { code?: string }).code !== "23505") throw error; }
  }
  throw new Error("팀을 만들지 못했습니다.");
}
export async function joinTeam(team: Team, userId: string): Promise<void> {
  if (!userId) throw new Error("로그인이 필요합니다.");
  await repo.join(team.id, userId, team.invite_code);
}
export async function logView(teamId: string, memberId: string | null) { await repo.logView(teamId, memberId); }
