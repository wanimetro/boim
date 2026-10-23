// Framework-facing authentication facade.
import "server-only";
import { redirect } from "next/navigation";
import { currentUser, type User } from "@/server/services/auth-service";
export { currentUser } from "@/server/services/auth-service";
export type { User } from "@/server/services/auth-service";
/** 로그인이 필요한 화면. 안 돼 있으면 로그인 후 이 주소로 돌아온다. */
export async function requireUser(next: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export { safeNext, PROVIDERS } from "@/domain/auth";
