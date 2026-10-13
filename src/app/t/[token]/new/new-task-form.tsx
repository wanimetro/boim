"use client";

import { useActionState } from "react";
import type { FormState } from "../actions";

export type TaskDefaults = { title: string; owner_id: string; due: string; due_time: string; rule: string };

/** 업무 등록·수정 공통 폼 */
export function TaskForm({ action, members, minDate, defaults, submitLabel }: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  members: { id: string; name: string }[]; minDate: string; defaults?: TaskDefaults; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form className="panel" action={formAction}>
      <label className="field">
        <span>업무</span>
        <input id="title" name="title" required maxLength={80} defaultValue={defaults?.title} placeholder="예: 경쟁사 사례 3개 조사" />
      </label>
      <label className="field">
        <span>담당</span>
        <select id="owner" name="owner" required defaultValue={defaults?.owner_id ?? ""}>
          <option value="" disabled>담당 고르기</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>중간 마감 날짜</span>
          <input id="due" name="due" type="date" required min={minDate} defaultValue={defaults?.due} />
        </label>
        <label className="field">
          <span>시각</span>
          <input id="due_time" name="due_time" type="time" defaultValue={defaults?.due_time ?? "23:59"} required />
        </label>
      </div>
      <p className="muted small">마감 1시간 전·30분 전에 아직 올리지 않은 담당자에게 앱 알림이 갑니다.</p>
      <label className="field">
        <span>완료 기준</span>
        <textarea id="rule" name="rule" required rows={3} maxLength={200} defaultValue={defaults?.rule}
          placeholder="예: 사례마다 출처 링크와 3줄 요약이 있는 문서 1개" />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "저장하는 중…" : submitLabel}</button>
    </form>
  );
}
