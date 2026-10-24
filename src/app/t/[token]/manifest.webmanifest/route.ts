import { teamByToken } from "@/lib/data";

/** 팀마다 홈 화면 아이콘이 그 팀 보드로 열리게 한다 (아이폰 알림은 홈 화면에 추가해야 온다). */
export async function GET(_req: Request, ctx: RouteContext<"/t/[token]/manifest.webmanifest">) {
  const { token } = await ctx.params;
  const team = await teamByToken(token);
  if (!team) return new Response("not found", { status: 404 });
  return Response.json({
    name: `보임 · ${team.code}`,
    short_name: "보임",
    start_url: `/t/${token}`,
    scope: `/t/${token}`,
    display: "standalone",
    background_color: "#f2f5f2",
    theme_color: "#0e5a43",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }, { headers: { "content-type": "application/manifest+json" } });
}
