import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "boim_admin";
const digest = (s: string) => createHash("sha256").update(`boim:${s}`).digest("hex");

export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(digest(input)), b = Buffer.from(digest(expected));
  return timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!expected || !value) return false;
  const a = Buffer.from(value), b = Buffer.from(digest(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdmin() {
  (await cookies()).set(COOKIE, digest(process.env.ADMIN_PASSWORD!), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/admin",
  });
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("운영자 로그인이 필요합니다.");
}
