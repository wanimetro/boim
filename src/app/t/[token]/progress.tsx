import type { Task } from "@/lib/data";

/** 업무 하나가 어디까지 왔는가: 올림 → 팀원 확인 → 완료 */
export type Step = { uploaded: boolean; check: "idle" | "open" | "objected" | "done"; label: string; tone: "done" | "wait" | "none" | "idle" };

export function stepOf(t: Task): Step {
  const s = t.latest?.state;
  if (!t.latest || !s) return { uploaded: false, check: "idle", label: "아직 안 올림", tone: "idle" };
  if (t.status === "done") return { uploaded: true, check: "done", label: "완료", tone: "done" };
  if (s.kind === "objected") return { uploaded: true, check: "objected", label: `미충족 ${s.objections.length}`, tone: "none" };
  if (s.kind === "open") return { uploaded: true, check: "open", label: s.required ? `확인 ${s.answered}/${s.required}` : "확인 대기", tone: "wait" };
  return { uploaded: true, check: "objected", label: "다시 올려 주세요", tone: "none" };
}

/** 점 세 개짜리 작은 진행 표시. 색만이 아니라 글자로도 상태를 적는다 */
export function StepDots({ step }: { step: Step }) {
  const mid = step.check === "done" ? "done" : step.check === "objected" ? "none" : step.check === "open" ? "wait" : "idle";
  return (
    <span className="steps" aria-label={`진행: ${step.label}`}>
      <span className={`dot ${step.uploaded ? "done" : "idle"}`} aria-hidden="true" />
      <span className={`bar ${step.uploaded ? "done" : ""}`} aria-hidden="true" />
      <span className={`dot ${mid}`} aria-hidden="true" />
      <span className={`bar ${step.check === "done" ? "done" : ""}`} aria-hidden="true" />
      <span className={`dot ${step.check === "done" ? "final" : "idle"}`} aria-hidden="true" />
      <span className={`steps-label t-${step.tone}`}>{step.label}</span>
    </span>
  );
}

export function CheckIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function CrossIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
