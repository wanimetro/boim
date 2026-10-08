"use client";

import { useActionState } from "react";
import { createTask, type FormState } from "../actions";

export function NewTaskForm({ token, members, minDate }: {
  token: string; members: { id: string; code: string }[]; minDate: string;
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
          <option value="" disabled>담당 번호 고르기</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
        </select>
      </label>
      <label className="field">
        <span>중간 마감</span>
        <input id="due" name="due" type="date" required min={minDate} />
      </label>
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
