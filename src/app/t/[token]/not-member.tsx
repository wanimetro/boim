import Link from "next/link";

export function NotMember({ nickname }: { nickname: string }) {
  return (
    <main className="wrap">
      <h1>이 팀의 팀원이 아닙니다</h1>
      <p className="muted">
        <b className="fg">{nickname}</b> 님 계정은 이 팀에 들어 있지 않습니다. 팀장에게 초대 링크를 받아 열면 바로 참여됩니다.
      </p>
      <Link className="btn ghost" href="/">내 팀 목록으로</Link>
    </main>
  );
}
