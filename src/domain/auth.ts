/** 로그인 뒤 돌아갈 주소는 우리 사이트 안쪽만 허용한다. */
export function safeNext(next: unknown, fallback = "/"): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

/** 나중에 붙일 소셜 로그인. 환경 변수에 적힌 것만 버튼이 보인다. 예: NEXT_PUBLIC_AUTH_PROVIDERS=kakao,google */
export const PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",").map((s) => s.trim()).filter((s): s is "kakao" | "google" => s === "kakao" || s === "google");
