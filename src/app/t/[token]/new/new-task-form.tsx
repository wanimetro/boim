"use client";

import { useActionState, useState } from "react";
import { MAX_CRITERIA } from "@/domain/criteria";
import type { FormState } from "../actions";

export type TaskDefaults = { title: string; owner_id: string; due: string; due_time: string; criteria: string[] };

const EXAMPLES = ["사례마다 출처 링크가 있다", "사례마다 3줄 요약이 있다", "문서 하나로 모았다"];

/** 업무 등록·수정 공통 폼 */
export function TaskForm({ action, members, minDate, defaults, submitLabel, criteriaNote, criteriaLocked }: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  members: { id: string; name: string }[]; minDate: string; defaults?: TaskDefaults; submitLabel: string; criteriaNote?: string;
  /** 결과물이 올라온 뒤: 기준은 그대로 보내고 읽기 전용으로 보여 준다 */
  criteriaLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  // key로 항목을 구분해, 중간 항목을 지워도 나머지 입력이 섞이지 않게 한다
  const [rows, setRows] = useState(() => (defaults?.criteria.length ? defaults.criteria : [""]).map((text, i) => ({ key: i, text })));
  const [nextKey, setNextKey] = useState(rows.length);
  const add = () => { setRows([...rows, { key: nextKey, text: "" }]); setNextKey(nextKey + 1); };
  const remove = (key: number) => setRows(rows.filter((r) => r.key !== key));
  const edit = (key: number, text: string) => setRows(rows.map((r) => (r.key === key ? { ...r, text } : r)));

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

      {criteriaLocked && defaults ? (
        <fieldset className="criteria-edit">
          <legend>완료 기준</legend>
          <ol className="criteria">
            {defaults.criteria.map((text, i) => (
              <li key={i}><span className="num criteria-no">{i + 1}</span><span className="criteria-body">{text}</span>
                <input type="hidden" name="criteria" value={text} /></li>
            ))}
          </ol>
          {criteriaNote && <p className="callout warn-box small">{criteriaNote}</p>}
        </fieldset>
      ) : (
      <fieldset className="criteria-edit">
        <legend>완료 기준</legend>
        <p className="muted small">
          업무를 나눌 때 팀이 함께 정한 기준을 항목으로 나눠 적어 주세요. 파일만 보고 “됐다/안 됐다”를 가를 수 있게 적으면 좋아요. 담당자는 올리기 전에 이 항목을 하나씩 체크하고, 올린 뒤에는 다른 팀원이 항목마다 확인합니다.
        </p>
        <ol>
          {rows.map((r, i) => (
            <li key={r.key}>
              <span className="num criteria-no" aria-hidden="true">{i + 1}</span>
              <label className="sr-only" htmlFor={`criteria-${r.key}`}>기준 {i + 1}</label>
              <input id={`criteria-${r.key}`} name="criteria" maxLength={100} value={r.text} required={i === 0}
                onChange={(e) => edit(r.key, e.target.value)} placeholder={`예: ${EXAMPLES[i % EXAMPLES.length]}`} />
              {rows.length > 1 && (
                <button type="button" className="link-btn small" onClick={() => remove(r.key)} aria-label={`기준 ${i + 1} 지우기`}>지우기</button>
              )}
            </li>
          ))}
        </ol>
        {rows.length < MAX_CRITERIA && <button type="button" className="btn ghost small-btn self-start" onClick={add}>+ 기준 추가</button>}
        {criteriaNote && <p className="callout warn-box small">{criteriaNote}</p>}
      </fieldset>
      )}

      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "저장하는 중…" : submitLabel}</button>
    </form>
  );
}
