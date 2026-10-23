import { timingSafeEqual } from "node:crypto";
import { sendReminders } from "@/server/services/reminder-service";
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || Buffer.byteLength(got) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return new Response("unauthorized", { status: 401 });
  try { return Response.json(await sendReminders(process.env.APP_URL ?? new URL(request.url).origin)); }
  catch { return Response.json({ error: "알림을 처리하지 못했습니다." }, { status: 500 }); }
}
