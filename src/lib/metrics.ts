import type { Task } from "@/domain/task";
import { deadlineMs } from "@/domain/time";
import { isPassed } from "@/domain/criteria";

const DAY = 24 * 60 * 60 * 1000;

export type Outcome = "self-before" | "self-after" | "proxy" | "late" | "none";

/**
 * 워크북 3쪽 판정선:
 * 첫 중간 마감 대상 항목 전체 중, 마감 24시간 전까지 담당자 본인이 기준에 맞는 파일을 올린 항목의 비율.
 * 24시간 안에 올린 항목(앱 알림이 가는 구간 포함)은 따로 세고 판정에는 넣지 않는다.
 */
export function outcomeOf(t: Task): Outcome {
  const deadline = deadlineMs(t.due, t.due_time);
  const passed = t.submissions.filter((s) => isPassed(s.state))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const self = passed.find((s) => s.uploader_id === t.owner_id);
  if (self) {
    const at = Date.parse(self.created_at);
    if (at > deadline) return "late";
    return at <= deadline - DAY ? "self-before" : "self-after";
  }
  return passed.length ? "proxy" : "none";
}

export function firstDeadline(tasks: Task[]): { due: string | null; items: Task[] } {
  const due = tasks.map((t) => t.due).sort()[0] ?? null;
  return { due, items: due ? tasks.filter((t) => t.due === due) : [] };
}

export function tally(items: Task[]) {
  const c = { total: items.length, "self-before": 0, "self-after": 0, proxy: 0, late: 0, none: 0 };
  items.forEach((t) => c[outcomeOf(t)]++);
  return c;
}

export function verdict(rate: number, total: number, closed: boolean) {
  if (total === 0 || !closed) return { label: "대기", cls: "s-wait" };
  if (rate >= 0.6) return { label: "개발 착수", cls: "s-done" };
  if (rate < 0.3) return { label: "설계 전환", cls: "s-none" };
  return { label: "보류", cls: "s-wait" };
}
