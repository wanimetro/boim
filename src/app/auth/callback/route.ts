import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/domain/auth";
import { exchangeCode } from "@/server/services/auth-service";

/** 소셜 로그인(카카오·구글)에서 돌아오는 곳. 세션을 만들고 원래 가려던 곳(초대 링크 등)으로 보낸다. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const ok = await exchangeCode(code);
    if (ok) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=oauth`, request.url));
}
