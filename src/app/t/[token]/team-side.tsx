import type { Member } from "@/lib/data";
import { InvitePanel } from "./invite-panel";
import { regenerateInvite } from "./actions";

/** 팀원과 초대 링크. PC에서는 사이드바, 모바일에서는 본문 아래에 이어서 보인다. */
export function TeamSide({ token, members, me, inviteCode, origin }: {
  token: string; members: Member[]; me: Member; inviteCode: string | null; origin: string;
}) {
  return (
    <>
      <section className="panel">
        <h2>팀원 <span className="num muted">{members.length}</span></h2>
        <ul className="members">
          {members.map((m) => (
            <li key={m.id} className={m.id === me.id ? "me" : undefined}>
              {m.nickname}{m.is_leader ? " · 팀장" : ""}
            </li>
          ))}
        </ul>
      </section>
      <InvitePanel code={inviteCode} origin={origin} isLeader={me.is_leader} regenerate={regenerateInvite.bind(null, token)} />
    </>
  );
}
