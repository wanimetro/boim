import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@/lib/auth";
import { signOut } from "./auth-actions";
import { BrandMark } from "./brand-logo";

type TeamLink = { token: string; name: string; is_leader: boolean };

/** 위쪽 바: 심볼 + 보임, 닉네임, 로그아웃 */
export function TopBar({ user }: { user: User }) {
  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          <BrandMark size={26} />
          보임
        </Link>
        <span className="who">{user.nickname} 님</span>
        <form action={signOut}><button className="link-btn small" type="submit">로그아웃</button></form>
      </div>
    </header>
  );
}

/**
 * 화면 틀. 모바일은 한 줄(side는 main 아래로 이어짐), PC는 왼쪽 사이드바 + 본문.
 * side-nav(내 팀 목록)는 PC에서만 보인다. 모바일은 홈 화면이 팀 목록이다.
 */
export function AppShell({ user, teams, current, side, children }: {
  user: User; teams: TeamLink[]; current?: string; side?: ReactNode; children: ReactNode;
}) {
  return (
    <>
      <TopBar user={user} />
      <div className="shell">
        <main className="main">{children}</main>
        <aside className="side" aria-label="팀">
          <nav className="side-nav" aria-label="내 팀">
            <span className="eyebrow">내 팀</span>
            {teams.map((t) => (
              <Link key={t.token} href={`/t/${t.token}`} aria-current={t.token === current ? "page" : undefined}>
                <span className="clip">{t.name}</span>
                {t.is_leader && <span className="pill s-done">팀장</span>}
              </Link>
            ))}
            <Link href="/">+ 팀 만들기 · 코드로 참여</Link>
          </nav>
          {side}
        </aside>
      </div>
    </>
  );
}
