import { chooseMe } from "./actions";
import type { Member } from "@/lib/data";

/** 로그인 대신 "나는 U01" 을 한 번 고르게 한다. 이 기기에 90일 동안 기억된다. */
export function MePicker({ token, members, me, back }: { token: string; members: Member[]; me: Member | null; back: string }) {
  const action = chooseMe.bind(null, token);
  if (me) {
    return (
      <form action={action} className="me-row">
        <span>나: <b className="num">{me.code}</b></span>
        <input type="hidden" name="back" value={back} />
        <label className="sr-only" htmlFor="me-change">다른 번호로 바꾸기</label>
        <select id="me-change" name="member" defaultValue={me.id}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
        </select>
        <button className="link-btn" type="submit">바꾸기</button>
      </form>
    );
  }
  return (
    <form action={action} className="panel">
      <h2>내 번호를 골라 주세요</h2>
      <p className="muted">팀 단톡방에서 받은 번호입니다. 이 기기에서는 한 번만 고르면 됩니다.</p>
      <input type="hidden" name="back" value={back} />
      <div className="chips" role="radiogroup" aria-label="내 번호">
        {members.map((m) => (
          <button key={m.id} className="chip" type="submit" name="member" value={m.id}>{m.code}</button>
        ))}
      </div>
    </form>
  );
}
