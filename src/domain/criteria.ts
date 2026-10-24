/**
 * 완료 기준 합의와 결과물 확인. 이름이 아니라 "항목"에 의견을 단다.
 * 확정: 대상자 전원이 모든 항목에 동의했거나, 시작 뒤 12시간 동안 반대 의견이 없을 때.
 * 반대 의견(이유 필수)이 하나라도 있으면 확정되지 않는다.
 * 확정 여부는 저장된 응답과 시각만으로 계산한다(예약 작업 없음). 확정된 뒤에는 서비스가 응답을 받지 않으므로,
 * 12시간이 지난 뒤에 남은 응답은 "반대가 있었다가 철회된" 경우뿐이다 → 그 시각에 확정된 것으로 본다.
 */

export const CONFIRM_WINDOW_MS = 12 * 60 * 60 * 1000;
export const MAX_CRITERIA = 8;

export type Answer = { member_id: string; version: number; item: number; ok: boolean; reason: string | null; created_at: string };
export type Objection = { item: number; reasons: string[] };

export type Round =
  | { kind: "confirmed"; at: number; by: "all" | "timeout" }
  | { kind: "open"; autoAt: number; answered: number; required: number }
  | { kind: "objected"; objections: Objection[]; answered: number; required: number };

/** 한 차례(기준 합의 또는 결과물 확인)의 상태 */
export function roundState(input: {
  items: number; version: number; start: number; participants: string[]; answers: Answer[]; now: number;
}): Round {
  const { items, version, start, participants, answers, now } = input;
  const who = new Set(participants);
  const rows = answers.filter((a) => a.version === version && who.has(a.member_id) && a.item < items);
  const required = participants.length;
  const answered = participants.filter((id) => new Set(rows.filter((r) => r.member_id === id).map((r) => r.item)).size >= items).length;

  const byItem = new Map<number, string[]>();
  for (const r of rows) if (!r.ok) byItem.set(r.item, [...(byItem.get(r.item) ?? []), r.reason ?? ""]);
  if (byItem.size) {
    const objections = [...byItem].sort(([a], [b]) => a - b).map(([item, reasons]) => ({ item, reasons }));
    return { kind: "objected", objections, answered, required };
  }

  const autoAt = start + CONFIRM_WINDOW_MS;
  const last = rows.reduce((m, r) => Math.max(m, Date.parse(r.created_at)), -Infinity);
  if (last > autoAt) return { kind: "confirmed", at: last, by: required > 0 && answered === required ? "all" : "timeout" };
  // 확인할 사람이 아무도 없으면(혼자인 팀) "전원 동의"로 치지 않고 12시간을 기다린다. 그사이 들어온 팀원이 확인할 수 있다
  if (required > 0 && answered === required) return { kind: "confirmed", at: Math.max(start, last), by: "all" };
  if (now >= autoAt) return { kind: "confirmed", at: autoAt, by: "timeout" };
  return { kind: "open", autoAt, answered, required };
}

export type SubmissionLike = {
  id: string; uploader_id: string | null; created_at: string; review: "pending" | "pass" | "fail"; review_note: string | null;
};

export type SubmissionState =
  | Round
  | { kind: "waiting" }                       // 기준이 아직 확정되지 않아 확인을 시작하지 않음
  | { kind: "superseded" }                    // 확정되기 전에 새 결과물이 올라옴
  | { kind: "legacy"; pass: boolean; note: string | null }; // 예전 운영자 검수 결과

/**
 * 결과물 하나의 확인 상태. 확인은 max(올린 시각, 기준 확정 시각)부터 시작한다.
 * next: 이 결과물 다음에 올라온 결과물의 시각(있으면). 그 뒤의 시간은 이 결과물에 세지 않는다.
 */
export function submissionState(input: {
  sub: SubmissionLike; criteria: Round; items: number; version: number; members: string[]; checks: Answer[]; now: number; next: number | null;
}): SubmissionState {
  const { sub, criteria, items, version, members, checks, now, next } = input;
  if (sub.review !== "pending") return { kind: "legacy", pass: sub.review === "pass", note: sub.review_note };
  if (criteria.kind !== "confirmed") return next === null ? { kind: "waiting" } : { kind: "superseded" };
  const start = Math.max(Date.parse(sub.created_at), criteria.at);
  const until = next === null ? now : Math.min(now, next);
  const round = roundState({ items, version, start, participants: members.filter((m) => m !== sub.uploader_id), answers: checks, now: until });
  if (next !== null && round.kind === "open") return { kind: "superseded" };
  return round;
}

export function isPassed(s: SubmissionState): boolean {
  return (s.kind === "confirmed") || (s.kind === "legacy" && s.pass);
}

/** 화면에 보일 상태: done 완료 / wait 확인 중 / none 결과물 없음·다시 올려야 함 */
export function statusFromLatest(s: SubmissionState | null): "done" | "wait" | "none" {
  if (!s) return "none";
  if (isPassed(s)) return "done";
  if (s.kind === "objected" || s.kind === "legacy" || s.kind === "superseded") return "none";
  return "wait";
}

/** 폼에서 받은 기준 줄: 앞뒤 공백 제거, 빈 줄 제거 */
export function normalizeCriteria(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter(Boolean);
}

export function criteriaError(items: string[]): string | null {
  if (items.length === 0) return "완료 기준을 한 개 이상 적어 주세요.";
  if (items.length > MAX_CRITERIA) return `완료 기준은 ${MAX_CRITERIA}개까지 적을 수 있습니다.`;
  if (items.some((i) => i.length < 2 || i.length > 100)) return "기준 항목마다 2~100자로, 파일을 보고 판단할 수 있게 적어 주세요.";
  return null;
}

/** 폼의 항목별 응답 → 저장할 형태. 반대인데 이유가 없으면 오류 */
export type ItemAnswer = { item: number; ok: boolean; reason?: string };
export function readAnswers(items: number, get: (key: string) => string): { answers: ItemAnswer[] } | { error: string } {
  const answers: ItemAnswer[] = [];
  for (let i = 0; i < items; i++) {
    const v = get(`v${i}`);
    if (v !== "ok" && v !== "no") return { error: `${i + 1}번 항목에 답해 주세요.` };
    if (v === "ok") { answers.push({ item: i, ok: true }); continue; }
    const reason = get(`r${i}`).trim();
    if (reason.length < 2 || reason.length > 100) return { error: `${i + 1}번 항목의 이유를 2~100자로 적어 주세요.` };
    answers.push({ item: i, ok: false, reason });
  }
  return { answers };
}
