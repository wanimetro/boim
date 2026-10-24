import "server-only";
import { readAnswers } from "@/domain/criteria";
import { criteriaRepository as repo } from "@/server/repositories/criteria-repository";
import { requireTeamMember } from "./team-access-service";
import { tasksOf } from "./team-service";

export type AnswerResult = { ok: true } | { error: string };
const SAVE_FAILED = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const STALE = "그사이 기준이 바뀌었거나 새 결과물이 올라왔습니다. 화면을 새로 고쳐 다시 확인해 주세요.";

async function load(userId: string | null, token: string, seq: number) {
  const { team, members, me } = await requireTeamMember(userId, token);
  const task = (await tasksOf(team, members)).find((t) => t.seq === seq);
  if (!task) throw new Error("업무를 찾을 수 없습니다.");
  return { me, task };
}

/** 기준 합의: 등록한 사람을 뺀 팀원이, 기준이 확정되기 전에만 */
export async function voteCriteriaForUser(userId: string | null, token: string, seq: number, version: number, get: (key: string) => string): Promise<AnswerResult> {
  const { me, task } = await load(userId, token, seq);
  if (task.created_by === me.id) return { error: "기준을 등록한 사람은 동의 대상이 아닙니다." };
  if (task.criteria_version !== version) return { error: STALE };
  if (task.agreement.kind === "confirmed") return { error: "기준이 이미 확정됐습니다." };
  const read = readAnswers(task.criteria.length, get);
  if ("error" in read) return read;
  try { await repo.saveVotes(task.id, me.id, version, read.answers); return { ok: true }; }
  catch (e) { return { error: (e as { code?: string }).code === "40001" ? STALE : SAVE_FAILED }; }
}

/** 결과물 확인: 올린 사람을 뺀 팀원이, 가장 최근 결과물에, 기준 확정 뒤 확인이 끝나기 전에만 */
export async function checkSubmissionForUser(userId: string | null, token: string, seq: number, submissionId: string, version: number, get: (key: string) => string): Promise<AnswerResult> {
  const { me, task } = await load(userId, token, seq);
  const sub = task.latest;
  if (!sub || sub.id !== submissionId || task.criteria_version !== version) return { error: STALE };
  if (sub.uploader_id === me.id) return { error: "직접 올린 결과물은 다른 팀원이 확인합니다." };
  if (sub.state.kind === "waiting") return { error: "완료 기준이 확정된 뒤에 확인할 수 있습니다." };
  if (sub.state.kind !== "open" && sub.state.kind !== "objected") return { error: "이 결과물은 확인이 끝났습니다." };
  const read = readAnswers(task.criteria.length, get);
  if ("error" in read) return read;
  try { await repo.saveChecks(sub.id, me.id, version, read.answers); return { ok: true }; }
  catch (e) { return { error: (e as { code?: string }).code === "40001" ? STALE : SAVE_FAILED }; }
}
