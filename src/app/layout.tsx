import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// 본문·제목은 Pretendard 하나로 (한글 글자만 필요한 만큼 나눠 받는 CDN 버전). 숫자·코드만 IBM Plex Mono.
const PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
const mono = IBM_Plex_Mono({ weight: ["500"], subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "보임 팀 보드",
  description: "묻지 않아도 어디까지 됐는지 보이는 팀플",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#131e19" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={mono.variable}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
