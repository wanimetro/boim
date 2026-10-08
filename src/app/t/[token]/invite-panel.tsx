"use client";

import { useState } from "react";

/** 초대 링크 복사. 링크를 연 사람은 로그인(또는 가입) 뒤 바로 이 팀 팀원이 된다. */
export function InvitePanel({ code, origin, isLeader, regenerate }: {
  code: string | null; origin: string; isLeader: boolean; regenerate: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = code ? `${origin}/join/${code}` : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { document.getElementById("invite-link")?.focus(); }
  };

  return (
    <details className="panel invite">
      <summary><h2>팀원 초대</h2></summary>
      {code ? (
        <>
          <p className="muted small">이 링크를 팀 단톡방에 올려 주세요. 연 사람은 로그인하거나 가입하면 바로 팀원이 됩니다.</p>
          <div className="copy-row">
            <input id="invite-link" className="copy" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="초대 링크" />
            <button className="btn small-btn" type="button" onClick={copy}>{copied ? "복사됨" : "복사"}</button>
          </div>
          <p className="small">초대 코드 <b className="num">{code}</b> · 링크 대신 홈 화면에서 코드를 넣어도 됩니다.</p>
        </>
      ) : <p className="muted small">초대 코드가 없습니다.</p>}
      {isLeader && (
        <button className="link-btn" type="button" disabled={busy}
          onClick={async () => { setBusy(true); await regenerate(); setBusy(false); }}>
          {busy ? "바꾸는 중…" : "초대 코드 새로 만들기 (예전 링크는 막힘)"}
        </button>
      )}
    </details>
  );
}
