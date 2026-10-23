import "server-only";
import { authClient } from "@/server/integrations/auth-client";
export const authRepository = {
  async user() { return (await authClient()).auth.getUser(); },
  async signIn(email: string, password: string) { return (await authClient()).auth.signInWithPassword({ email, password }); },
  async signUp(email: string, password: string, nickname: string) { return (await authClient()).auth.signUp({ email, password, options: { data: { nickname } } }); },
  async signOut() { return (await authClient()).auth.signOut(); },
  async exchange(code: string) { return (await authClient()).auth.exchangeCodeForSession(code); },
  async social(provider: "kakao" | "google", callbackUrl: string) { return (await authClient()).auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl } }); },
};
