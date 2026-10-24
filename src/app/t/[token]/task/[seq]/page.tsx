import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { tasksOf, teamsOfUser } from "@/lib/data";
import { openTeam, canEditTask } from "@/lib/team-access";
import { dday, dueLabel, dateTime } from "@/lib/format";
import { fileLinksForUser } from "@/server/services/submission-service";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "../../not-member";
import { TeamSide } from "../../team-side";
import { submissionPill } from "../../criteria-labels";
import { CheckIcon, CrossIcon } from "../../progress";
import { checkSubmission } from "../../actions";
import { ItemAnswerForm } from "./item-answer-form";
import { UploadForm } from "./upload-form";

export default async function TaskPage({ params }: PageProps<"/t/[token]/task/[seq]">) {
  const { token, seq } = await params;
  const { user, team, members, me } = await openTeam(token, `/t/${token}/task/${seq}`);
  if (!me) return <NotMember nickname={user.nickname} />;
  const [tasks, teams] = await Promise.all([tasksOf(team, members), teamsOfUser(user.id)]);
  const task = tasks.find((t) => t.seq === Number(seq));
  if (!task) notFound();
  const nick = new Map(members.map((m) => [m.id, m.nickname]));
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const files = await fileLinksForUser(user.id, token, task.submissions.flatMap((s) => (s.file_path ? [s.file_path] : [])));

  const isOwner = me.id === task.owner_id;
  const editable = canEditTask(me, task);
  const latest = task.latest;
  const st = latest?.state ?? null;
  const isMineWork = Boolean(latest && (isOwner || latest.uploader_id === me.id));
  // 자기 결과물(올림·담당)은 다른 팀원이 확인한다
  const canCheck = Boolean(latest && latest.checkers.includes(me.id) && st && (st.kind === "open" || st.kind === "objected"));
  const myChecks = latest ? latest.checks.filter((c) => c.member_id === me.id) : [];
  const done = task.status === "done";
  const objections = st?.kind === "objected" ? st.objections : [];
  const flagged = objections.map((o) => o.item);
  const needsUpload = !latest || task.status === "none";
  const soon = (d: string) => d.startsWith("D-") && Number(d.slice(2)) <= 2;

  // 기준별 확인 결과: 이름 없이 충족·미충족 수와 이유만
  const perItem = task.criteria.map((text, i) => {
    const rows = latest?.checks.filter((c) => c.item === i) ?? [];
    const no = objections.find((o) => o.item === i);
    return { text, ok: rows.filter((r) => r.ok).length, no: no?.reasons ?? [] };
  });

  const step = !latest ? 1 : done ? 3 : 2;
  const midLabel = st?.kind === "objected" ? `팀원 확인 · 미충족 ${objections.length}`
    : st?.kind === "open" ? (st.required ? `팀원 확인 ${st.answered}/${st.required}` : "팀원 확인 대기") : "팀원 확인";
  const midTone = st?.kind === "objected" ? "none" : "wait";
  const nextMine = tasks.find((t) => t.owner_id === me.id && t.id !== task.id && t.status !== "done");

  return (
    <AppShell user={user} teams={teams} current={token}
      side={<TeamSide token={token} members={members} me={me} inviteCode={team.invite_code} origin={origin} />}>
      <Link className="back" href={`/t/${token}`}>← 팀 보드</Link>

      <header className="task-head">
        <div className="stack-sm">
          <span className="muted small">
            담당 {task.owner}{isOwner ? " (나)" : ""} · 마감 <b className={`num${!done && soon(dday(task.due)) ? " warn" : ""}`}>{dueLabel(task.due, task.due_time)} · {dday(task.due)}</b>
          </span>
          <h1 className="task-title">{task.title}</h1>
          {editable && <Link className="link-btn small" href={`/t/${token}/task/${task.seq}/edit`}>업무 수정</Link>}
        </div>
        <ol className="stepper" aria-label="진행 단계">
          <li className={step > 1 ? "is-done" : "is-now"}>
            <span className="bullet">{step > 1 ? <CheckIcon size={13} /> : "1"}</span>올리기
          </li>
          <li className={`line${step > 1 ? " is-done" : ""}`} aria-hidden="true" />
          <li className={step === 2 ? `is-now tone-${midTone}` : step > 2 ? "is-done" : ""}>
            <span className="bullet">{step > 2 ? <CheckIcon size={13} /> : "2"}</span>{midLabel}
          </li>
          <li className={`line${step > 2 ? " is-done" : ""}`} aria-hidden="true" />
          <li className={step === 3 ? "is-final" : ""}>
            <span className="bullet">{step === 3 ? <CheckIcon size={13} /> : "3"}</span>완료
          </li>
        </ol>
      </header>

      {done && st?.kind === "confirmed" && (
        <section className="done-hero" aria-label="완료">
          <span className="done-check" aria-hidden="true"><CheckIcon size={34} color="#24400a" /></span>
          <h2>{st.by === "all" ? <>팀원 모두가 확인해서<br />완료로 넘어갔어요</> : <>12시간 동안 미충족 의견이 없어<br />완료됐어요</>}</h2>
          <p>
            {st.by === "all"
              ? `팀원 ${latest!.checkers.length}명이 기준 ${task.criteria.length}개를 모두 충족으로 확인했어요.`
              : "확인할 팀원이 의견을 남기지 않아 자동으로 완료됐어요."}
          </p>
          <span className="done-meta">
            {st.by === "all" && <span className="pill s-lime">확인 {latest!.checkers.length}/{latest!.checkers.length}명</span>}
            <span className="pill on-green num">{dateTime(new Date(st.at).toISOString())}</span>
          </span>
          {isMineWork && nextMine && (
            <Link className="done-next" href={`/t/${token}/task/${nextMine.seq}`}>다음 할 일 · {nextMine.title} →</Link>
          )}
        </section>
      )}

      <div className="task-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>{latest ? "기준별 확인 결과" : "완료 기준"}</h2>
              <span className="pill-row">
                {task.criteria_edits.length > 0 && <span className="pill s-wait">기준 수정됨</span>}
                {latest && latest.checkers.length > 0 && <span className="muted small">팀원 {latest.checkers.length}명 확인 · 이름은 보이지 않아요</span>}
              </span>
            </div>
            <ol className="results">
              {perItem.map((r, i) => {
                const state = !latest ? "plain" : r.no.length ? "no" : done || r.ok > 0 ? "ok" : "pending";
                return (
                  <li key={i} className={`result is-${state}`}>
                    <span className="result-icon" aria-hidden="true">
                      {state === "ok" ? <CheckIcon size={16} color="#24400a" /> : state === "no" ? <CrossIcon size={16} color="#ffffff" /> : <span className="num">{i + 1}</span>}
                    </span>
                    <div className="result-body">
                      <p className="result-title">{latest ? `${i + 1}. ` : ""}{r.text}</p>
                      {state === "ok" && <p className="small muted">{r.ok === 0 ? "미충족 의견 없음" : `충족 ${r.ok}명`}</p>}
                      {state === "pending" && <p className="small muted">아직 확인한 팀원이 없어요</p>}
                      {state === "no" && (
                        <>
                          <p className="small result-no">미충족 {r.no.length}명 · 고쳐야 할 부분</p>
                          {r.no.map((reason, j) => <p key={j} className="quote">“{reason}”</p>)}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {task.criteria_edits.length > 0 && (
              <details className="criteria-history">
                <summary>팀장이 기준을 <b className="num">{task.criteria_edits.length}</b>번 고쳤습니다 · 마지막 <span className="num">{dateTime(task.criteria_edits[0].at)}</span> · 바뀐 내용 보기</summary>
                <ol>
                  {task.criteria_edits.map((e, i) => (
                    <li key={i}>
                      <span className="num muted small">{dateTime(e.at)}</span>
                      <div className="diff">
                        <div><span className="eyebrow">바뀌기 전</span><ol>{e.before.map((c, j) => <li key={j} className={e.after.includes(c) ? undefined : "gone"}>{c}</li>)}</ol></div>
                        <div><span className="eyebrow">바뀐 뒤</span><ol>{e.after.map((c, j) => <li key={j} className={e.before.includes(c) ? undefined : "new"}>{c}</li>)}</ol></div>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {latest ? (
              <p className="small muted result-foot clip">
                올린 파일{" "}
                {latest.file_path && files.get(latest.file_path) && <a href={files.get(latest.file_path)} target="_blank" rel="noopener">{latest.file_name ?? "파일 열기"}</a>}
                {latest.link_url && <a href={latest.link_url} target="_blank" rel="noopener noreferrer">{latest.link_url}</a>}
                {" "}· {nick.get(latest.uploader_id ?? "") ?? "?"} · <span className="num">{dateTime(latest.created_at)}</span>
                {latest.note && <> · 메모: {latest.note}</>}
              </p>
            ) : (
              <p className="muted small">업무를 나눌 때 팀이 정한 기준입니다. 결과물이 올라온 뒤에는 기준을 바꿀 수 없습니다.</p>
            )}
          </section>

          {task.submissions.length > 1 && (
            <details className="panel history-box">
              <summary>올린 기록 <span className="num muted">{task.submissions.length}</span></summary>
              <ul className="history">
                {task.submissions.map((s) => {
                  const p = submissionPill(s.state);
                  const url = s.file_path ? files.get(s.file_path) : s.link_url;
                  return (
                    <li key={s.id}>
                      <span className="num">{dateTime(s.created_at)}</span>
                      <span>{nick.get(s.uploader_id ?? "") ?? "?"}</span>
                      <span className="clip">{url ? <a href={url} target="_blank" rel="noopener noreferrer">{s.file_name ?? s.link_url}</a> : (s.file_name ?? s.link_url)}</span>
                      <span className={`pill ${p.cls}`}>{p.label}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>

        <section className="now-card" id="now" aria-label="지금 할 일">
          <span className="pill s-lime self-start">지금 할 일</span>
          {canCheck && latest ? (
            <>
              <h2>{myChecks.length ? "내 확인 바꾸기" : "기준을 하나씩 확인해 주세요"}</h2>
              <p className="now-sub">{nick.get(latest.uploader_id ?? "") ?? "?"} 님이 올린 결과물을 열어 보고 항목마다 골라 주세요. 미충족이면 이유를 적어 주세요. 이름은 보이지 않아요.</p>
              <ItemAnswerForm action={checkSubmission.bind(null, token, task.seq, latest.id, task.criteria_version)}
                criteria={task.criteria} prefill={myChecks} okLabel="충족" noLabel="미충족"
                reasonHint="예: 2번 사례에 출처 링크가 없음" submitLabel="확인 보내기" savedLabel="확인을 보냈습니다." />
            </>
          ) : needsUpload ? (
            <>
              <h2>{flagged.length
                ? `${flagged.map((i) => `${i + 1}번`).join(", ")} 항목을 고쳐서 다시 올려 주세요`
                : isOwner ? "결과물을 올려 주세요" : `${task.owner} 님 대신 올릴 수 있어요`}</h2>
              <p className="now-sub">{flagged.length ? "새로 올리면 팀원 확인을 처음부터 다시 해요." : "기준을 모두 체크해야 올릴 수 있어요. 올리면 다른 팀원이 항목마다 확인해요."}</p>
              <UploadForm token={token} seq={task.seq} criteria={task.criteria} flagged={flagged} isOwner={isOwner} ownerName={task.owner} meName={me.nickname} />
            </>
          ) : done ? (
            <>
              <h2>{nextMine ? "다음 업무로 넘어가요" : "이 업무는 끝났어요"}</h2>
              {nextMine
                ? <Link className="btn lime" href={`/t/${token}/task/${nextMine.seq}`}>{nextMine.title}</Link>
                : <Link className="btn lime" href={`/t/${token}`}>팀 보드로</Link>}
              <details className="reupload">
                <summary>고칠 부분이 있어서 새로 올리기</summary>
                <UploadForm token={token} seq={task.seq} criteria={task.criteria} flagged={[]} isOwner={isOwner} ownerName={task.owner} meName={me.nickname} />
              </details>
            </>
          ) : (
            <>
              <h2>{isMineWork ? "팀원 확인을 기다리는 중이에요" : "다른 팀원의 확인을 기다리는 중이에요"}</h2>
              {st?.kind === "open" && (
                <p className="now-sub">
                  {st.required
                    ? <>팀원 <b className="num">{st.answered}/{st.required}</b>명이 확인했어요. <b className="num">{dateTime(new Date(st.autoAt).toISOString())}</b>까지 미충족 의견이 없으면 완료돼요.</>
                    : <>아직 확인할 다른 팀원이 없어요. 팀원을 초대하면 그 팀원이 확인하고, 아무도 의견이 없으면 <b className="num">{dateTime(new Date(st.autoAt).toISOString())}</b>에 완료돼요.</>}
                </p>
              )}
              {st?.kind === "open" && st.required > 0 && <span className="meter on-dark" aria-hidden="true"><span style={{ width: `${(st.answered / st.required) * 100}%` }} /></span>}
              <details className="reupload">
                <summary>빠뜨린 게 있어서 새로 올리기</summary>
                <UploadForm token={token} seq={task.seq} criteria={task.criteria} flagged={[]} isOwner={isOwner} ownerName={task.owner} meName={me.nickname} />
              </details>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
