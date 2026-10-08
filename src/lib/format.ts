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

/** 마감 시각 (서울 기준 날짜 + 시각) → epoch ms */
export function deadlineMs(due: string, dueTime = "23:59"): number {
  return Date.parse(`${due}T${dueTime.slice(0, 5)}:00+09:00`);
}

/** 10/9 18:00 — 23:59면 시각은 생략 */
export function dueLabel(due: string, dueTime: string): string {
  return dueTime.startsWith("23:59") ? md(due) : `${md(due)} ${dueTime.slice(0, 5)}`;
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export const STATUS_LABEL = { done: "완료", wait: "확인 중", none: "파일 없음" } as const;
