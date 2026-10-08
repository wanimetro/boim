import Link from "next/link";
import { notFound } from "next/navigation";
import { teamByToken, membersOf, tasksOf, currentMember, logView } from "@/lib/data";
import { dday, md, STATUS_LABEL } from "@/lib/format";
import { MePicker } from "./me-picker";

export default async function Board({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const team = await teamByToken(token);
  if (!team) notFound();
  const members = await membersOf(team.id);
  const [tasks, me] = await Promise.all([tasksOf(team, members), currentMember(team, members)]);
  await logView(team.id, me?.id ?? null);

  const count = { done: 0, wait: 0, none: 0 };
  tasks.forEach((t) => count[t.status]++);
  const next = tasks.find((t) => t.status !== "done");
  const mine = me ? tasks.filter((t) => t.owner_id === me.id && t.status !== "done") : [];

  return (
    <main className="wrap">
      <header className="stack-sm">
        <span className="eyebrow">보임 · 묻지 않아도 보이는 팀플</span>
        <h1>{team.name}</h1>
      </header>

      <MePicker token={token} members={members} me={me} back={`/t/${token}`} />

      {me && mine.length > 0 && (
        <p className="callout">
          <b className="num">{me.code}</b> 님이 올릴 업무가 <b className="num">{mine.length}</b>개 있습니다.
        </p>
      )}

      <section className="summary" aria-label="상태 요약">
        <div><b className="num">{count.done}</b><span>완료</span></div>
        <div><b className="num">{count.wait}</b><span>확인 중</span></div>
        <div><b className="num">{count.none}</b><span>파일 없음</span></div>
      </section>

      {tasks.length === 0 ? (
        <p className="muted">아직 등록된 업무가 없습니다. 역할 분담을 마쳤다면 첫 업무를 등록해 주세요.</p>
      ) : next ? (
        <p className="muted">가장 가까운 남은 마감: <b className="fg">{next.title}</b> · <span className="num">{md(next.due)} ({dday(next.due)})</span></p>
      ) : (
        <p className="muted">모든 업무가 완료됐습니다.</p>
      )}

      <ul className="list">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link className={`task${me && t.owner_id === me.id ? " is-mine" : ""}`} href={`/t/${token}/task/${t.seq}`}>
              <span className="title">{t.title}</span>
              <span className={`pill s-${t.status}`}>{STATUS_LABEL[t.status]}</span>
              <span className="rule">완료 기준: {t.rule}</span>
              <span className="meta">
                <span>담당 <b className="num">{t.owner}</b></span>
                <span className="num">{md(t.due)} · {dday(t.due)}</span>
                {t.latest?.review === "fail" && <span className="warn">다시 올려 주세요</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link className="btn ghost" href={`/t/${token}/new`}>업무 등록하기</Link>

      <p className="note">
        “완료”는 완료 기준에 맞는 파일이 올라와야만 바뀝니다. 올린 파일은 확인 후 완료로 표시됩니다.
      </p>
    </main>
  );
}
