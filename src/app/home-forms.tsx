"use client";

import { useActionState } from "react";
import { createMyTeam, joinByCode, type TeamState } from "./team-actions";

export function HomeForms() {
  const [made, make, making] = useActionState<TeamState, FormData>(createMyTeam, {});
  const [joined, join, joining] = useActionState<TeamState, FormData>(joinByCode, {});
  return (
    <>
      <form className="panel" action={join}>
        <h2>초대 코드로 참여</h2>
        <div className="copy-row">
          <label className="sr-only" htmlFor="invite-code">초대 코드</label>
          <input id="invite-code" name="code" className="code-input" required maxLength={12} placeholder="예: K7M2Q9XA" autoCapitalize="characters" />
          <button className="btn small-btn" type="submit" disabled={joining}>참여</button>
        </div>
        {joined.error && <p className="error" role="alert">{joined.error}</p>}
      </form>

      <form className="panel" action={make}>
        <h2>새 팀 만들기</h2>
        <p className="muted small">만든 사람이 팀장이 됩니다. 만든 뒤 초대 링크를 단톡방에 올려 팀원을 부르세요.</p>
        <label className="field">
          <span>팀 이름</span>
          <input id="team-name" name="name" required maxLength={40} placeholder="예: 마케팅원론 3조" />
        </label>
        {made.error && <p className="error" role="alert">{made.error}</p>}
        <button className="btn" type="submit" disabled={making}>{making ? "만드는 중…" : "팀 만들기"}</button>
      </form>
    </>
  );
}
