import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@/lib/auth";
import { signOut } from "./auth-actions";
import { BrandMark } from "./brand-logo";

type TeamLink = { token: string; name: string; is_leader: boolean };

/** 위쪽 바: 심볼 + 보임 / 지금 팀(누르면 다른 팀으로), 닉네임, 로그아웃 */
export function TopBar({ user, teams, current, memberCount }: { user: User; teams?: TeamLink[]; current?: string; memberCount?: number }) {
  const team = teams?.find((t) => t.token === current);
  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          <BrandMark size={28} />
          보임
        </Link>
        {team && (
          <>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <details className="team-switch">
              <summary>
                <span className="clip">{team.name}</span>
                {memberCount !== undefined && <span className="muted"> · 팀원 {memberCount}</span>}
                <span className="caret" aria-hidden="true">▾</span>
              </summary>
              <nav className="team-menu" aria-label="내 팀">
                {teams!.map((t) => (
                  <Link key={t.token} href={`/t/${t.token}`} aria-current={t.token === current ? "page" : undefined}>
                    <span className="clip">{t.name}</span>
                    {t.is_leader && <span className="pill s-lime">팀장</span>}
                  </Link>
                ))}
                <Link href="/" className="team-menu-new">+ 팀 만들기 · 코드로 참여</Link>
              </nav>
            </details>
          </>
        )}
        <span className="who">{user.nickname} 님</span>
        <form action={signOut}><button className="link-btn small" type="submit">로그아웃</button></form>
      </div>
    </header>
  );
}

/**
 * 화면 틀. 본문 + (있으면) 오른쪽 칸. 모바일은 한 줄로 이어진다(오른쪽 칸은 본문 아래).
 * 다른 팀으로 가는 길은 위쪽 바의 팀 이름에 있다.
 */
export function AppShell({ user, teams, current, memberCount, side, children }: {
  user: User; teams: TeamLink[]; current?: string; memberCount?: number; side?: ReactNode; children: ReactNode;
}) {
  return (
    <>
      <TopBar user={user} teams={teams} current={current} memberCount={memberCount} />
      <div className={`shell${side ? " has-side" : ""}`}>
        <main className="main">{children}</main>
        {side && <aside className="side" aria-label="팀">{side}</aside>}
      </div>
    </>
  );
}
