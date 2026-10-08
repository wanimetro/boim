import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { db } from "./supabase";

/** 로그인 세션만 다루는 클라이언트 (publishable 키 + 쿠키). 데이터는 db()로 읽는다. */
export async function authClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* 서버 컴포넌트에서는 못 씀. proxy가 갱신한다 */ }
      },
    },
  });
}

export type User = { id: string; email: string | null; nickname: string };

export const currentUser = cache(async (): Promise<User | null> => {
  const { data } = await (await authClient()).auth.getUser();
  if (!data.user) return null;
  const { data: p } = await db().from("profiles").select("nickname").eq("id", data.user.id).maybeSingle();
  const fallback = (data.user.user_metadata?.nickname as string | undefined)
    ?? (data.user.user_metadata?.name as string | undefined) ?? data.user.email?.split("@")[0] ?? "팀원";
  if (!p) await db().from("profiles").upsert({ id: data.user.id, nickname: fallback.slice(0, 20) });
  return { id: data.user.id, email: data.user.email ?? null, nickname: p?.nickname ?? fallback.slice(0, 20) };
});

/** 로그인이 필요한 화면. 안 돼 있으면 로그인 후 이 주소로 돌아온다. */
export async function requireUser(next: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** 로그인 뒤 돌아갈 주소는 우리 사이트 안쪽만 허용한다. */
export function safeNext(next: unknown, fallback = "/"): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

/** 나중에 붙일 소셜 로그인. 환경 변수에 적힌 것만 버튼이 보인다. 예: NEXT_PUBLIC_AUTH_PROVIDERS=kakao,google */
export const PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",").map((s) => s.trim()).filter((s): s is "kakao" | "google" => s === "kakao" || s === "google");
