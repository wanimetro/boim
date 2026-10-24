"use client";

import { useActionState, useState } from "react";
import type { FormState } from "../../actions";

type Prefill = { item: number; ok: boolean; reason: string | null }[];

/**
 * 항목마다 "맞다/아니다"를 고르는 폼. 아니라면 짧은 이유가 꼭 필요하다.
 * 기준 합의(동의/수정 필요)와 결과물 확인(충족/미충족)에 같이 쓴다.
 */
export function ItemAnswerForm({ action, criteria, prefill, okLabel, noLabel, reasonHint, submitLabel, savedLabel }: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  criteria: string[]; prefill: Prefill; okLabel: string; noLabel: string; reasonHint: string; submitLabel: string; savedLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [choice, setChoice] = useState<(boolean | null)[]>(() =>
    criteria.map((_, i) => prefill.find((p) => p.item === i)?.ok ?? null));

  return (
    <form className="answer-form" action={formAction}>
      <ol className="answer-list">
        {criteria.map((text, i) => (
          <li key={i} className="answer-item">
            <p className="answer-text"><span className="num criteria-no">{i + 1}</span>{text}</p>
            <div className="choice" role="radiogroup" aria-label={`${i + 1}번 항목`}>
              <label className={choice[i] === true ? "on ok" : undefined}>
                <input type="radio" name={`v${i}`} value="ok" checked={choice[i] === true}
                  onChange={() => setChoice(choice.map((c, j) => (j === i ? true : c)))} required />
                {okLabel}
              </label>
              <label className={choice[i] === false ? "on no" : undefined}>
                <input type="radio" name={`v${i}`} value="no" checked={choice[i] === false}
                  onChange={() => setChoice(choice.map((c, j) => (j === i ? false : c)))} />
                {noLabel}
              </label>
            </div>
            {choice[i] === false && (
              <label className="field">
                <span>이유 (이름 없이 항목에만 보입니다)</span>
                <input name={`r${i}`} required minLength={2} maxLength={100} placeholder={reasonHint}
                  defaultValue={prefill.find((p) => p.item === i)?.reason ?? ""} />
              </label>
            )}
          </li>
        ))}
      </ol>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && !pending && <p className="ok" role="status">{savedLabel}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "저장하는 중…" : submitLabel}</button>
    </form>
  );
}
