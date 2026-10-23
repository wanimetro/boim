import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
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

