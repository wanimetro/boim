import type { Round, SubmissionState } from "@/domain/criteria";

type Pill = { label: string; cls: "s-done" | "s-wait" | "s-none" };

/** 기준 합의 상태 배지 */
export function agreementPill(a: Round): Pill {
  if (a.kind === "confirmed") return { label: "기준 확정", cls: "s-done" };
  if (a.kind === "objected") return { label: "기준 수정 의견", cls: "s-none" };
  return { label: "기준 합의 중", cls: "s-wait" };
}

/** 결과물 하나의 확인 상태 배지 */
export function submissionPill(s: SubmissionState): Pill {
  switch (s.kind) {
    case "confirmed": return { label: "완료", cls: "s-done" };
    case "open": return { label: "팀원 확인 중", cls: "s-wait" };
    case "waiting": return { label: "기준 확정 대기", cls: "s-wait" };
    case "objected": return { label: "미충족 의견", cls: "s-none" };
    case "superseded": return { label: "새로 올림", cls: "s-wait" };
    case "legacy": return s.pass ? { label: "통과", cls: "s-done" } : { label: "반려", cls: "s-none" };
  }
}

export function confirmedBy(by: "all" | "timeout", who: "기준" | "결과물"): string {
  if (by === "all") return who === "기준" ? "팀원 전원이 동의해 확정됐습니다." : "팀원 전원이 모든 항목을 충족으로 확인했습니다.";
  return who === "기준" ? "12시간 동안 수정 의견이 없어 확정됐습니다." : "12시간 동안 미충족 의견이 없어 완료됐습니다.";
}
