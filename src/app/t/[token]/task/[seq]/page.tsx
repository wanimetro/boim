import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { tasksOf, teamsOfUser } from "@/lib/data";
import { openTeam, canEditTask } from "@/lib/team-access";
import { dday, dueLabel, dateTime, STATUS_LABEL } from "@/lib/format";
import type { Objection } from "@/domain/criteria";
import { fileLinksForUser } from "@/server/services/submission-service";
import { AppShell } from "@/app/app-shell";
import { NotMember } from "../../not-member";
import { TeamSide } from "../../team-side";
import { confirmedBy, submissionPill } from "../../criteria-labels";
import { checkSubmission } from "../../actions";
import { ItemAnswerForm } from "./item-answer-form";
import { UploadForm } from "./upload-form";

/** 항목 목록. 반대 의견은 이름 없이 그 항목 아래에 이유만 보인다 */
function CriteriaList({ criteria, objections, tone = "미충족 의견", onlyFlagged }: { criteria: string[]; objections?: Objection[]; tone?: string; onlyFlagged?: boolean }) {
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

  const latest = task.latest;
  const st = latest?.state ?? null;
  // 자기 결과물(올림·담당)은 다른 팀원이 확인한다
  const canCheck = Boolean(latest && latest.checkers.includes(me.id) && st && (st.kind === "open" || st.kind === "objected"));
  const myChecks = latest ? latest.checks.filter((c) => c.member_id === me.id) : [];
  const editable = canEditTask(me, task);
  // 받은 피드백: 담당자에게 맨 위에 보여 준다
  const feedback = st?.kind === "objected" ? st.objections : null;

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
          </span>
          {editable && <Link className="link-btn" href={`/t/${token}/task/${task.seq}/edit`}>업무 수정</Link>}
        </div>
      </header>

      {isOwner && feedback && (
        <section className="panel feedback" aria-label="받은 피드백">
          <div className="panel-head"><h2>받은 피드백</h2><span className="pill s-none">{feedback.length}개 항목</span></div>
          <p className="muted small">팀원이 이름 없이 남긴 의견입니다. 표시된 항목을 고쳐서 다시 올려 주세요. 새로 올리면 확인을 처음부터 다시 합니다.</p>
          <CriteriaList criteria={task.criteria} objections={feedback} tone="미충족 의견" onlyFlagged />
          <a className="btn self-start small-btn" href="#upload">고쳐서 다시 올리기</a>
        </section>
      )}

      {/* 모바일: 기준 → 결과물 확인 → 올리기 → 기록 / PC: 왼쪽 기준·확인·기록, 오른쪽 올리기 */}
      <div className="split">
        <div className="split-a">
          <section className="panel">
            <h2>완료 기준</h2>
            <CriteriaList criteria={task.criteria} />
            <p className="muted small">업무를 나눌 때 팀이 정한 기준입니다. 올린 결과물은 이 기준으로 팀원이 항목마다 확인하고, 결과물이 올라온 뒤에는 기준을 바꿀 수 없습니다.</p>
          </section>

          {latest && st && (
            <section className="panel">
              <div className="panel-head"><h2>결과물 확인</h2><span className={`pill ${submissionPill(st).cls}`}>{submissionPill(st).label}</span></div>
              <p className="small clip">
                {nick.get(latest.uploader_id ?? "") ?? "?"} 님이 <span className="num">{dateTime(latest.created_at)}</span>에 올림 ·{" "}
                {latest.file_path && files.get(latest.file_path) && <a href={files.get(latest.file_path)} target="_blank" rel="noopener">{latest.file_name ?? "파일 열기"}</a>}
                {latest.link_url && <a href={latest.link_url} target="_blank" rel="noopener noreferrer">{latest.link_url}</a>}
              </p>
              {latest.note && <p className="muted small">메모: {latest.note}</p>}

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
              {st.kind === "objected" && !isOwner && (
                <>
                  <CriteriaList criteria={task.criteria} objections={st.objections} tone="미충족 의견" />
                  <p className="callout warn-box small">
                    표시된 항목이 고쳐져 다시 올라오면 확인을 처음부터 다시 합니다.
                  </p>
                </>
              )}
              {st.kind === "confirmed" && <p className="muted small">{confirmedBy(st.by)} 고칠 부분이 있으면 새로 올려 주세요. 다시 확인을 거칩니다.</p>}
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
              {!latest.checkers.includes(me.id) && (st.kind === "open" || st.kind === "objected") && (
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
