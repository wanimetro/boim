"use client";

import { useActionState } from "react";
import { login, createTeam, type AdminState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(login, {});
  return (
    <form className="panel" action={action}>
      <label className="field">
        <span>운영 비밀번호</span>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>들어가기</button>
    </form>
  );
}

export function TeamForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createTeam, {});
  return (
    <form className="panel" action={action}>
      <h3>테스트 팀 추가</h3>
      <label className="field"><span>팀 코드</span><input id="team-code" name="code" placeholder="T1" required /></label>
      <label className="field"><span>팀 이름</span><input id="team-name" name="name" placeholder="T1 · 마케팅원론 팀 발표" required /></label>
      <label className="field"><span>팀원 번호 (쉼표로 구분, 실명 금지)</span><input id="team-members" name="members" placeholder="U01, U02, U03, U04" required /></label>
      <label className="field"><span>팀장 번호</span><input id="team-leader" name="leader" placeholder="U01" /></label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && <p className="ok">{state.ok}</p>}
      <button className="btn" disabled={pending}>팀 만들기</button>
    </form>
  );
}
