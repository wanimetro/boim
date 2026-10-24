/** 보임 심볼: 팀원의 진행이 쌓이는 막대 세 개. 마지막(라임)이 "다 보이는" 완료. 파일 버전은 public/brand/boim-mark.svg */
export function BrandMark({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}
      aria-label={title} className="brand-mark">
      <rect width="48" height="48" rx="13" fill="#0e5a43" />
      <rect x="11" y="26" width="7" height="12" rx="3.5" fill="#ffffff" />
      <rect x="20.5" y="18" width="7" height="20" rx="3.5" fill="#ffffff" />
      <rect x="30" y="10" width="7" height="28" rx="3.5" fill="#c6f36a" />
    </svg>
  );
}

/** 로그인·첫 화면용 큰 로고: 심볼 + 보임 + BOIM */
export function BrandLockup() {
  return (
    <div className="lockup">
      <BrandMark size={56} />
      <span className="lockup-text">
        <span className="lockup-ko">보임</span>
        <span className="lockup-en">BOIM</span>
      </span>
    </div>
  );
}
