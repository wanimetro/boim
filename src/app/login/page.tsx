import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, safeNext, PROVIDERS } from "@/lib/auth";
import { teamByInvite } from "@/lib/data";
import { AuthForms } from "./auth-forms";

export const metadata: Metadata = { title: "로그인 · 보임" };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentUser()) redirect(next);

  // 초대 링크로 왔다면 어느 팀에 들어가는지 먼저 보여 준다
  const invite = next.match(/^\/join\/([A-Za-z0-9]{6,10})$/)?.[1];
  const team = invite ? await teamByInvite(invite) : null;

  return (
    <div className="auth">
      <section className="auth-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/boim-logo.png" alt="보임 BOIM" width={240} height={240} />
        <p className="tagline">묻지 않아도 어디까지 됐는지 보이는 팀플</p>
      </section>
      <main className="auth-form">
        <header className="stack-sm">
          <span className="eyebrow">보임 · 묻지 않아도 보이는 팀플</span>
          {team ? (
            <>
              <h1>{team.name}에 초대받았어요</h1>
              <p className="muted">로그인하거나, 처음이라면 가입해 주세요. 마치면 바로 이 팀의 팀원이 됩니다.</p>
            </>
          ) : (
            <h1>로그인</h1>
          )}
        </header>
        {sp.error === "oauth" && <p className="error" role="alert">소셜 로그인을 마치지 못했습니다. 다시 시도해 주세요.</p>}
        <AuthForms next={next} providers={PROVIDERS} defaultMode={team ? "signup" : "signin"} />
      </main>
    </div>
  );
}
