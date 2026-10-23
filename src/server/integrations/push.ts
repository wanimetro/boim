import "server-only";
import webpush from "web-push";

let ready = false;

export function pushClient() {
  if (!ready) {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) throw new Error("VAPID 키 환경 변수가 없습니다.");
    webpush.setVapidDetails(process.env.APP_URL ?? "https://boim-ten.vercel.app", pub, priv);
    ready = true;
  }
  return webpush;
}

export type PushPayload = { title: string; body: string; url: string; tag: string };
