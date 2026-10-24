import type { SubmissionState } from "@/domain/criteria";

type Pill = { label: string; cls: "s-done" | "s-wait" | "s-none" };

/** 결과물 하나의 확인 상태 배지 */
export function submissionPill(s: SubmissionState): Pill {
  switch (s.kind) {
    case "confirmed": return { label: "완료", cls: "s-done" };
    case "open": return { label: "팀원 확인 중", cls: "s-wait" };
    case "objected": return { label: "미충족 의견", cls: "s-none" };
    case "superseded": return { label: "새로 올림", cls: "s-wait" };
    case "legacy": return s.pass ? { label: "통과", cls: "s-done" } : { label: "반려", cls: "s-none" };
  }
}

export function confirmedBy(by: "all" | "timeout"): string {
  return by === "all" ? "팀원 전원이 모든 항목을 충족으로 확인했습니다." : "12시간 동안 미충족 의견이 없어 완료됐습니다.";
}
