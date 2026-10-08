"use client";

import { useActionState } from "react";
import { createTask, type FormState } from "../actions";

export function NewTaskForm({ token, members, minDate }: {
  token: string; members: { id: string; name: string }[]; minDate: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTask.bind(null, token), {});
  return (
    <form className="panel" action={action}>
      <label className="field">
        <span>업무</span>
        <input id="title" name="title" required maxLength={80} placeholder="예: 경쟁사 사례 3개 조사" />
      </label>
      <label className="field">
        <span>담당</span>
        <select id="owner" name="owner" required defaultValue="">
          <option value="" disabled>담당 고르기</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>중간 마감 날짜</span>
          <input id="due" name="due" type="date" required min={minDate} />
        </label>
        <label className="field">
          <span>시각</span>
          <input id="due_time" name="due_time" type="time" defaultValue="23:59" required />
        </label>
      </div>
      <p className="muted small">마감 1시간 전·30분 전에 아직 올리지 않은 담당자에게 앱 알림이 갑니다.</p>
      <label className="field">
        <span>완료 기준</span>
        <textarea id="rule" name="rule" required rows={3} maxLength={200}
          placeholder="예: 사례마다 출처 링크와 3줄 요약이 있는 문서 1개" />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "저장하는 중…" : "등록하기"}</button>
    </form>
  );
}
