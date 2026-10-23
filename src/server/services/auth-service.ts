import "server-only";
import { cache } from "react";
import { authRepository } from "@/server/repositories/auth-repository";
import { profileRepository } from "@/server/repositories/profile-repository";
export type User = { id: string; email: string | null; nickname: string };

export const currentUser = cache(async (): Promise<User | null> => {
  const { data } = await authRepository.user();
  if (!data.user) return null;
  const p = await profileRepository.nickname(data.user.id);
  const fallback = (data.user.user_metadata?.nickname as string | undefined)
    ?? (data.user.user_metadata?.name as string | undefined) ?? data.user.email?.split("@")[0] ?? "팀원";
  if (!p) await profileRepository.save(data.user.id, fallback.slice(0, 20));
  return { id: data.user.id, email: data.user.email ?? null, nickname: p?.nickname ?? fallback.slice(0, 20) };
});


import { safeNext, PROVIDERS } from "@/domain/auth";
export type AuthState = { error?: string; email?: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function message(code: string | undefined, fallback: string) {
  if (code === "invalid_credentials") return "이메일이나 비밀번호가 맞지 않습니다.";
  if (code === "user_already_exists" || code === "email_exists") return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (code === "weak_password") return "비밀번호를 8자 이상으로 정해 주세요.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  return fallback;
}

export async function signIn(input: Record<string, string>): Promise<AuthState & { next?: string }> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const next = safeNext(input.next);
  if (!EMAIL.test(email) || !password) return { error: "이메일과 비밀번호를 적어 주세요.", email };
  const { error } = await authRepository.signIn(email, password);
  if (error) return { error: message(error.code, "로그인하지 못했습니다."), email };
  return { next };
}

export async function signUp(input: Record<string, string>): Promise<AuthState & { next?: string }> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const nickname = String(input.nickname ?? "").trim();
  const next = safeNext(input.next);
  if (!EMAIL.test(email)) return { error: "이메일 주소를 확인해 주세요.", email };
  if (password.length < 8) return { error: "비밀번호를 8자 이상으로 정해 주세요.", email };
  if (!nickname || nickname.length > 20) return { error: "팀원에게 보일 이름을 20자 안으로 적어 주세요.", email };

  const { data, error } = await authRepository.signUp(email, password, nickname);
  if (error) return { error: message(error.code, "가입하지 못했습니다."), email };
  if (data.user) await profileRepository.save(data.user.id, nickname);
  if (!data.session) return { error: "가입은 됐지만 로그인하지 못했습니다. 로그인 화면에서 다시 시도해 주세요.", email };
  return { next };
}

export async function signOut() { await authRepository.signOut(); }
export async function exchangeCode(code: string) { const { error } = await authRepository.exchange(code); return !error; }
export async function socialSignIn(provider: string, callbackUrl: string) {
  if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) return null;
  const { data } = await authRepository.social(provider as "kakao" | "google", callbackUrl);
  return data.url;
}
