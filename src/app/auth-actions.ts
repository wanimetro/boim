"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authClient, safeNext, PROVIDERS } from "@/lib/auth";
import { db } from "@/lib/supabase";

export type AuthState = { error?: string; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function message(code: string | undefined, fallback: string) {
  if (code === "invalid_credentials") return "이메일이나 비밀번호가 맞지 않습니다.";
  if (code === "user_already_exists" || code === "email_exists") return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (code === "weak_password") return "비밀번호를 8자 이상으로 정해 주세요.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  return fallback;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!EMAIL.test(email) || !password) return { error: "이메일과 비밀번호를 적어 주세요.", email };
  const { error } = await (await authClient()).auth.signInWithPassword({ email, password });
  if (error) return { error: message(error.code, "로그인하지 못했습니다."), email };
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!EMAIL.test(email)) return { error: "이메일 주소를 확인해 주세요.", email };
  if (password.length < 8) return { error: "비밀번호를 8자 이상으로 정해 주세요.", email };
  if (!nickname || nickname.length > 20) return { error: "팀원에게 보일 이름을 20자 안으로 적어 주세요.", email };

  const { data, error } = await (await authClient()).auth.signUp({ email, password, options: { data: { nickname } } });
  if (error) return { error: message(error.code, "가입하지 못했습니다."), email };
  if (data.user) await db().from("profiles").upsert({ id: data.user.id, nickname });
  if (!data.session) return { error: "가입은 됐지만 로그인하지 못했습니다. 로그인 화면에서 다시 시도해 주세요.", email };
  redirect(next);
}

export async function signOut() {
  await (await authClient()).auth.signOut();
  redirect("/login");
}

/** 소셜 로그인 (카카오·구글). Supabase에서 해당 제공자를 켜고 NEXT_PUBLIC_AUTH_PROVIDERS에 적으면 동작한다. */
export async function signInWith(provider: string, next: string) {
  if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) return;
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { data } = await (await authClient()).auth.signInWithOAuth({
    provider: provider as "kakao" | "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (data.url) redirect(data.url);
}
