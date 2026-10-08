const TZ = "Asia/Seoul";

/** 서울 기준 오늘 (yyyy-mm-dd) */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function dday(due: string): string {
  const n = Math.round((Date.parse(due) - Date.parse(today())) / 864e5);
  return n > 0 ? `D-${n}` : n === 0 ? "오늘 마감" : `마감 ${-n}일 지남`;
}

export function md(date: string): string {
  const [, m, d] = date.split("-");
  return `${+m}/${+d}`;
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export const STATUS_LABEL = { done: "완료", wait: "확인 중", none: "파일 없음" } as const;
