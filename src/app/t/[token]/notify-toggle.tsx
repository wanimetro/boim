"use client";

import { useEffect, useState, useTransition } from "react";
import { savePush, removePush } from "./actions";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** 마감 1시간 전·30분 전 알림 켜기. 이 계정이 담당인 업무(모든 팀)에 대해 온다. */
export function NotifyToggle({ token }: { token: string }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(isIOS() && !standalone() ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = () => start(async () => {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePush(token, json);
      if (res.error) { await sub.unsubscribe(); return setError(res.error); }
      setState("on");
    } catch {
      setError("알림을 켜지 못했습니다. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.");
    }
  });

  const turnOff = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await removePush(token, sub.endpoint); await sub.unsubscribe(); }
    setState("off");
  });

  if (state === "loading") return null;

  return (
    <section className="notify">
      {state === "on" && (
        <>
          <span><b>알림 켜짐</b> · 내가 담당인 업무의 마감 1시간 전·30분 전에 알려 드립니다.</span>
          <button className="link-btn" onClick={turnOff} disabled={pending}>끄기</button>
        </>
      )}
      {state === "off" && (
        <>
          <span>마감 <b>1시간 전·30분 전</b>에 아직 올리지 않은 업무를 알려 드릴까요?</span>
          <button className="btn small-btn" onClick={turnOn} disabled={pending}>{pending ? "켜는 중…" : "알림 받기"}</button>
        </>
      )}
      {state === "ios-install" && (
        <span>아이폰은 알림을 받으려면 사파리 <b>공유 → 홈 화면에 추가</b>로 보드를 추가한 뒤, 홈 화면 아이콘으로 열어 주세요.</span>
      )}
      {state === "denied" && <span>이 기기에서 알림이 꺼져 있습니다. 브라우저 설정에서 이 사이트의 알림을 허용하면 받을 수 있습니다.</span>}
      {state === "unsupported" && <span>이 브라우저는 알림을 지원하지 않습니다. 크롬이나 사파리(홈 화면 추가)로 열어 주세요.</span>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
