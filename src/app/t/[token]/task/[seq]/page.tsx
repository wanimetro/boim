import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { tasksOf, teamsOfUser } from "@/lib/data";
import { openTeam, canEditTask, canEditCriteria } from "@/lib/team-access";
import { dday, dueLabel, dateTime, STATUS_LABEL } from "@/lib/format";
import type { Objection } from "@/domain/criteria";
import { fileLinksForUser } from "@/server/services/submission-service";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "../../not-member";
import { TeamSide } from "../../team-side";
import { agreementPill, confirmedBy, submissionPill } from "../../criteria-labels";
import { checkSubmission, voteCriteria } from "../../actions";
import { ItemAnswerForm } from "./item-answer-form";
import { UploadForm } from "./upload-form";

/** 항목 목록. 반대 의견은 이름 없이 그 항목 아래에 이유만 보인다 */
function CriteriaList({ criteria, objections, tone, onlyFlagged }: { criteria: string[]; objections?: Objection[]; tone: string; onlyFlagged?: boolean }) {
  return (
    <ol className="criteria">
      {criteria.map((text, i) => {
        const o = objections?.find((x) => x.item === i);
        if (onlyFlagged && !o) return null;
        return (
          <li key={i} className={o ? "flagged" : undefined}>
            <span className="num criteria-no">{i + 1}</span>
            <span className="criteria-body">
              <span>{text}</span>
              {o && (
                <span className="objections">
                  <span className="objection-head">{tone} {o.reasons.length}건</span>
                  {o.reasons.map((r, j) => <span key={j} className="objection">“{r}”</span>)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

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
  const a = task.agreement;
  const aPill = agreementPill(a);
  // 자기 업무(등록·담당·올림)에는 기준 의견을 내지 않는다
  const canVote = task.voters.includes(me.id) && a.kind !== "confirmed";
  const myVotes = task.votes.filter((v) => v.member_id === me.id);

  const latest = task.latest;
  const st = latest?.state ?? null;
  // 자기 결과물(올림·담당)은 다른 팀원이 확인한다
  const canCheck = Boolean(latest && latest.checkers.includes(me.id) && st && (st.kind === "open" || st.kind === "objected"));
  const myChecks = latest ? latest.checks.filter((c) => c.member_id === me.id) : [];
  const editable = canEditTask(me, task);
  const criteriaEditable = editable || canEditCriteria(me, task);
  // 받은 피드백: 담당자(그리고 기준을 고칠 수 있는 사람)에게 맨 위에 보여 준다
  const workFeedback = st?.kind === "objected" ? st.objections : null;
  const criteriaFeedback = a.kind === "objected" ? a.objections : null;
  const showFeedback = (isOwner || criteriaEditable) && (workFeedback || criteriaFeedback);

  return (
    <AppShell user={user} teams={teams} current={token}
      side={<TeamSide token={token} members={members} me={me} inviteCode={team.invite_code} origin={origin} />}>
      <Link className="back" href={`/t/${token}`}>← 팀 보드로</Link>
      <header className="stack-sm">
        <span className="eyebrow">
          <span className="num">{task.code}</span> · 담당 {task.owner} · 마감{" "}
          <span className="num">{dueLabel(task.due, task.due_time)} ({dday(task.due)})</span>
        </span>
        <h1>{task.title}</h1>
        <div className="title-row" style={{ alignItems: "center" }}>
          <span className="pill-row">
            <span className={`pill s-${task.status}`}>{STATUS_LABEL[task.status]}</span>
            <span className={`pill ${aPill.cls}`}>{aPill.label}</span>
          </span>
          {criteriaEditable && <Link className="link-btn" href={`/t/${token}/task/${task.seq}/edit`}>{editable ? "업무 수정" : "완료 기준 고치기"}</Link>}
        </div>
      </header>

      {showFeedback && (
        <section className="panel feedback" aria-label="받은 피드백">
          <div className="panel-head"><h2>받은 피드백</h2><span className="pill s-none">{(workFeedback?.length ?? 0) + (criteriaFeedback?.length ?? 0)}개 항목</span></div>
          <p className="muted small">팀원이 이름 없이 남긴 의견입니다. 표시된 항목을 고친 뒤 아래 버튼으로 이어서 진행해 주세요.</p>
          {workFeedback && (
            <div className="stack-sm">
              <h3>결과물에 대한 의견</h3>
              <CriteriaList criteria={task.criteria} objections={workFeedback} tone="미충족 의견" onlyFlagged />
              {isOwner && <a className="btn self-start small-btn" href="#upload">고쳐서 다시 올리기</a>}
            </div>
          )}
          {criteriaFeedback && (
            <div className="stack-sm">
              <h3>완료 기준에 대한 의견</h3>
              <CriteriaList criteria={task.criteria} objections={criteriaFeedback} tone="수정 의견" onlyFlagged />
              {criteriaEditable
                ? <Link className="btn self-start small-btn" href={`/t/${token}/task/${task.seq}/edit`}>기준 고치기</Link>
                : <p className="muted small">기준은 담당자·등록한 사람·팀장이 고칠 수 있습니다.</p>}
            </div>
          )}
        </section>
      )}

      {/* 모바일: 기준 → 결과물 확인 → 올리기 → 기록 / PC: 왼쪽 기준·확인·기록, 오른쪽 올리기 */}
      <div className="split">
        <div className="split-a">
          <section className="panel">
            <div className="panel-head"><h2>완료 기준</h2><span className={`pill ${aPill.cls}`}>{aPill.label}</span></div>
            <CriteriaList criteria={task.criteria} objections={a.kind === "objected" ? a.objections : undefined} tone="수정 의견" />
            {a.kind === "confirmed" && <p className="muted small">{confirmedBy(a.by, "기준")} 이 기준으로 결과물을 확인합니다.</p>}
            {a.kind === "open" && a.required === 0 && (
              <p className="muted small">
                아직 함께 확인할 팀원이 없습니다. 팀원을 초대하면 그 팀원이 동의 여부를 고를 수 있고, 아무도 의견을 내지 않으면{" "}
                <b className="num">{dateTime(new Date(a.autoAt).toISOString())}</b>에 이 기준으로 확정됩니다.
              </p>
            )}
            {a.kind === "open" && a.required > 0 && (
              <p className="muted small">
                팀원 <b className="num">{a.answered}/{a.required}</b>명이 답했습니다.{" "}
                <b className="num">{dateTime(new Date(a.autoAt).toISOString())}</b>까지 수정 의견이 없으면 이 기준으로 확정됩니다.
              </p>
            )}
            {a.kind === "objected" && (
              <p className="callout warn-box small">
                수정 의견이 있어 기준이 아직 확정되지 않았습니다.{" "}
                {criteriaEditable
                  ? <>의견을 보고 <Link href={`/t/${token}/task/${task.seq}/edit`}>기준을 고치면</Link> 처음부터 다시 합의합니다.</>
                  : "담당자·등록한 사람·팀장이 기준을 고치거나, 의견을 낸 팀원이 동의로 바꾸면 다시 진행됩니다."}
              </p>
            )}
          </section>

          {canVote && (
            <section className="panel">
              <h2>{myVotes.length ? "내 기준 의견 바꾸기" : "이 기준에 동의하나요?"}</h2>
              <p className="muted small">
                결과물이 아니라 <b className="fg">기준 자체</b>가 명확하고 적당한지에 대한 의견이에요. 결과물에 대한 의견은 결과물이 올라오고 기준이 확정된 뒤 “결과물 확인”에서 남겨 주세요.
                수정이 필요하면 이유를 적어 주세요. 이름은 보이지 않고 항목에 이유만 붙습니다.
              </p>
              <ItemAnswerForm action={voteCriteria.bind(null, token, task.seq, task.criteria_version)}
                criteria={task.criteria} prefill={myVotes} okLabel="동의" noLabel="수정 필요"
                reasonHint="예: 분량 기준이 없어 판단하기 어려움" submitLabel="의견 보내기" savedLabel="의견을 보냈습니다." />
            </section>
          )}

          {latest && st && (
            <section className="panel">
              <div className="panel-head"><h2>결과물 확인</h2><span className={`pill ${submissionPill(st).cls}`}>{submissionPill(st).label}</span></div>
              <p className="small clip">
                {nick.get(latest.uploader_id ?? "") ?? "?"} 님이 <span className="num">{dateTime(latest.created_at)}</span>에 올림 ·{" "}
                {latest.file_path && files.get(latest.file_path) && <a href={files.get(latest.file_path)} target="_blank" rel="noopener">{latest.file_name ?? "파일 열기"}</a>}
                {latest.link_url && <a href={latest.link_url} target="_blank" rel="noopener noreferrer">{latest.link_url}</a>}
              </p>
              {latest.note && <p className="muted small">메모: {latest.note}</p>}

              {st.kind === "waiting" && <p className="muted small">완료 기준이 확정되면 팀원 확인이 시작됩니다.</p>}
              {st.kind === "open" && st.required === 0 && (
                <p className="muted small">
                  아직 확인할 다른 팀원이 없습니다. 팀원을 초대하면 그 팀원이 항목마다 확인하고, 아무도 미충족 의견을 내지 않으면{" "}
                  <b className="num">{dateTime(new Date(st.autoAt).toISOString())}</b>에 완료됩니다.
                </p>
              )}
              {st.kind === "open" && st.required > 0 && (
                <p className="muted small">
                  팀원 <b className="num">{st.answered}/{st.required}</b>명이 확인했습니다.{" "}
                  <b className="num">{dateTime(new Date(st.autoAt).toISOString())}</b>까지 미충족 의견이 없으면 완료됩니다.
                </p>
              )}
              {st.kind === "objected" && (
                <>
                  <CriteriaList criteria={task.criteria} objections={st.objections} tone="미충족 의견" />
                  <p className="callout warn-box small">
                    {isOwner ? "표시된 항목을 고쳐서 다시 올려 주세요. 새로 올리면 확인을 처음부터 다시 합니다." : "표시된 항목이 고쳐져 다시 올라오면 확인을 처음부터 다시 합니다."}
                  </p>
                </>
              )}
              {st.kind === "confirmed" && <p className="muted small">{confirmedBy(st.by, "결과물")} 고칠 부분이 있으면 새로 올려 주세요. 다시 확인을 거칩니다.</p>}
              {st.kind === "legacy" && !st.pass && (
                <p className="callout warn-box small">확인 결과 완료 기준에 맞지 않았습니다. 고쳐서 다시 올려 주세요.{st.note ? ` 이유: ${st.note}` : ""}</p>
              )}

              {canCheck && (
                <div className="stack-sm">
                  <h3>{myChecks.length ? "내 확인 바꾸기" : "기준을 하나씩 확인해 주세요"}</h3>
                  <ItemAnswerForm action={checkSubmission.bind(null, token, task.seq, latest.id, task.criteria_version)}
                    criteria={task.criteria} prefill={myChecks} okLabel="충족" noLabel="미충족"
                    reasonHint="예: 2번 사례에 출처 링크가 없음" submitLabel="확인 보내기" savedLabel="확인을 보냈습니다." />
                </div>
              )}
              {!latest.checkers.includes(me.id) && (st.kind === "open" || st.kind === "waiting" || st.kind === "objected") && (
                <p className="muted small">{latest.uploader_id === me.id ? "직접 올린 결과물은" : "내가 맡은 업무의 결과물은"} 다른 팀원이 확인합니다.</p>
              )}
            </section>
          )}
        </div>

        <div className="split-b" id="upload">
          <UploadForm token={token} seq={task.seq} criteria={task.criteria} isOwner={isOwner} ownerName={task.owner} meName={me.nickname} />
        </div>

        <div className="split-c">
          {task.submissions.length > 0 && (
            <section className="stack-sm">
              <h2>올린 기록</h2>
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
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
