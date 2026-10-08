"use client";

import { useActionState } from "react";
import { login, type AdminState } from "./actions";

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
