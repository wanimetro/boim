import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { teamsOfUser } from "@/lib/data";
import { AppShell } from "./app-shell";
import { HomeForms } from "./home-forms";
import { BrandLockup } from "./brand-logo";

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="auth">
        <section className="auth-brand">
          <BrandLockup />
          <p className="tagline">묻지 않아도 어디까지 됐는지 보이는 팀플</p>
        </section>
        <main className="auth-form">
          <header className="stack-sm">
            <span className="eyebrow">보임 · 묻지 않아도 보이는 팀플</span>
            <h1 className="display" style={{ fontSize: "1.9rem", lineHeight: 1.2 }}>누가 어디까지 했는지, 묻기 전에 보입니다</h1>
            <p className="muted">업무마다 담당·중간 마감·완료 기준을 정하고, 결과물이 올라와야 “완료”로 바뀝니다.</p>
          </header>
          <Link className="btn" href="/login">로그인 · 가입</Link>
          <p className="muted small">초대 링크를 받았다면 그 링크를 열어 주세요. 가입하면 바로 그 팀에 들어갑니다.</p>
        </main>
      </div>
    );
  }

  const teams = await teamsOfUser(user.id);
  return (
    <AppShell user={user} teams={teams}>
      <header className="stack-sm">
        <h1>내 팀</h1>
      </header>
      {teams.length === 0 ? (
        <p className="muted">아직 들어간 팀이 없습니다. 팀을 만들거나, 팀장에게 받은 초대 코드로 참여해 주세요.</p>
      ) : (
        <ul className="team-grid">
          {teams.map((t) => (
            <li key={t.id}>
              <Link className="task team-card" href={`/t/${t.token}`}>
                <span className="title">{t.name}</span>
                {t.is_leader && <span className="pill s-done">팀장</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="team-grid"><HomeForms /></div>
    </AppShell>
  );
}
