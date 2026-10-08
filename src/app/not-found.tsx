import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="muted">링크가 잘렸거나 지워진 업무일 수 있습니다. 단톡방에 고정된 팀 링크로 다시 들어와 주세요.</p>
      <Link className="back" href="/">처음으로</Link>
    </main>
  );
}
