"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { safeNext } from "@/domain/auth";
import * as auth from "@/server/services/auth-service";
export type AuthState = auth.AuthState;
const fields = (form: FormData) => Object.fromEntries(["email", "password", "nickname", "next"].map(key => [key, String(form.get(key) ?? "")]));
export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const result = await auth.signIn(fields(form)); if (result.next) redirect(result.next); return result;
}
export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const result = await auth.signUp(fields(form)); if (result.next) redirect(result.next); return result;
}
export async function signOut() { await auth.signOut(); redirect("/login"); }
export async function signInWith(provider: string, next: string) {
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = await auth.socialSignIn(provider, `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`);
  if (url) redirect(url);
}
