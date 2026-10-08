import Link from "next/link";
import { signOut } from "./auth-actions";

export function UserBar({ nickname }: { nickname: string }) {
  return (
    <nav className="user-bar" aria-label="계정">
      <Link href="/" className="brand">보임</Link>
      <span className="muted small">{nickname} 님</span>
      <form action={signOut}><button className="link-btn small" type="submit">로그아웃</button></form>
    </nav>
  );
}
