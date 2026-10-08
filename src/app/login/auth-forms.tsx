"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, signInWith, type AuthState } from "../auth-actions";

const LABEL = { kakao: "카카오로 계속하기", google: "구글로 계속하기" } as const;

export function AuthForms({ next, providers, defaultMode }: {
  next: string; providers: ("kakao" | "google")[]; defaultMode: "signin" | "signup";
}) {
  const [mode, setMode] = useState(defaultMode);
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "signin" ? inState : upState;
  const pending = mode === "signin" ? inPending : upPending;

  return (
    <section className="stack">
      {providers.length > 0 && (
        <div className="stack-sm">
          {providers.map((p) => (
            <form key={p} action={signInWith.bind(null, p, next)}>
              <button className={`btn social ${p}`} type="submit">{LABEL[p]}</button>
            </form>
          ))}
          <p className="divider"><span>또는 이메일로</span></p>
        </div>
      )}

      <div className="seg" role="tablist" aria-label="로그인 또는 가입">
        <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => setMode("signin")}>로그인</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")}>처음이에요 (가입)</button>
      </div>

      <form className="panel" action={mode === "signin" ? inAction : upAction} key={mode}>
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <label className="field">
            <span>팀원에게 보일 이름 (닉네임)</span>
            <input id="nickname" name="nickname" required maxLength={20} autoComplete="nickname" placeholder="예: 은서" />
          </label>
        )}
        <label className="field">
          <span>이메일</span>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.email} />
        </label>
        <label className="field">
          <span>비밀번호{mode === "signup" ? " (8자 이상)" : ""}</span>
          <input id="password" name="password" type="password" required minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </label>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "잠시만요…" : mode === "signin" ? "로그인" : "가입하고 시작하기"}
        </button>
      </form>
    </section>
  );
}
