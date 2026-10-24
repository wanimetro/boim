import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin";
import { getAdminDashboard } from "@/server/services/admin-service";
import { dateTime, md } from "@/lib/format";
import { LoginForm } from "./forms";
import { toggleStudy } from "./actions";

export const metadata: Metadata = { title: "보임 운영", robots: { index: false } };

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function Admin() {
  if (!(await isAdmin())) {
    return (
      <main className="wrap">
        <h1>보임 운영</h1>
        <LoginForm />
      </main>
    );
  }

  const { rows, study, sum, rate, v, pushStats, recent, taskInfo, memberCode, editsOf, flow } = await getAdminDashboard();

  return (
    <main className="wrap wide">
      <header className="stack-sm">
        <span className="eyebrow">보임 운영 · 오즈의 마법사</span>
        <h1>판정과 흐름</h1>
      </header>

      <section className="panel">
        <h2>본인 첨부율 (판정)</h2>
        <p className="big num">{pct(rate)} <span className={`pill ${v.cls}`}>{v.label}</span></p>
        <p className="muted small">
          첫 중간 마감 항목 {sum.total}개 중, 마감 24시간 전까지 담당 본인이 올려 통과한 항목 {sum.ok}개.
          60% 이상 개발 착수 · 30% 미만 설계 전환. 모든 팀의 첫 중간 마감이 지나야 판정이 확정됩니다.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>팀</th><th>첫 마감</th><th>항목</th><th>24시간 전 본인</th><th>24시간 안 본인</th><th>대신</th><th>마감 후</th><th>없음</th><th>비율</th><th>열람</th></tr></thead>
            <tbody>
              {study.map((r) => (
                <tr key={r.team.id}>
                  <td>{r.team.code}</td><td className="num">{r.first.due ? md(r.first.due) : "–"}</td>
                  <td className="num">{r.c.total}</td><td className="num">{r.c["self-before"]}</td>
                  <td className="num">{r.c["self-after"]}</td><td className="num">{r.c.proxy}</td>
                  <td className="num">{r.c.late}</td><td className="num">{r.c.none}</td>
                  <td className="num">{r.c.total ? pct(r.c["self-before"] / r.c.total) : "–"}</td>
                  <td className="num">{r.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">결과물은 팀원 확인이 끝나야(전원 충족 또는 12시간 동안 미충족 의견 없음) 통과로 셉니다.</p>
      </section>

      <section className="panel">
        <h2>앱 알림 발송</h2>
        <p className="muted small">마감 1시간 전·30분 전에 아직 아무것도 올리지 않은 담당자에게 자동으로 갑니다. “알림 안 켬”은 담당자가 이 기기에서 알림을 켜지 않아 보내지 못한 건수입니다.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>팀</th><th>알림 켠 사람</th><th>1시간 전</th><th>30분 전</th><th>실패</th><th>알림 안 켬</th></tr></thead>
            <tbody>
              {pushStats.map((p) => (
                <tr key={p.r.team.id}>
                  <td>{p.r.team.code}</td><td className="num">{p.on}/{p.r.members.length}</td>
                  <td className="num">{p.s60}</td><td className="num">{p.s30}</td>
                  <td className="num">{p.failed}</td><td className="num">{p.noDevice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recent.length > 0 && (
          <ul className="history">
            {recent.map((n, i) => {
              const info = taskInfo.get(n.task_id);
              return (
                <li key={i}>
                  <span className="num">{dateTime(n.sent_at)}</span>
                  <span className="num">{info?.t.code ?? "?"} · {memberCode.get(n.member_id) ?? "?"}</span>
                  <span>{n.kind === "60" ? "1시간 전" : "30분 전"}{n.error ? ` · ${n.error}` : ""}</span>
                  <span className={`pill ${n.status === "sent" ? "s-done" : n.status === "failed" ? "s-none" : "s-wait"}`}>
                    {n.status === "sent" ? "보냄" : n.status === "failed" ? "실패" : "알림 안 켬"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>팀원 확인 흐름</h2>
        <p className="muted small">
          운영자 검수 대신, 올린 사람과 담당자를 뺀 팀원이 완료 기준을 항목마다 확인합니다.
          전원 충족이거나 12시간 동안 미충족 의견이 없으면 완료됩니다. 누가 반대했는지는 팀 화면에도 운영 화면에도 보이지 않습니다.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>팀</th><th>결과물 확인 중</th><th>미충족 의견</th><th>전원 확인 완료</th><th>12시간 경과 완료</th></tr></thead>
            <tbody>
              {flow.map((f) => (
                <tr key={f.r.team.id}>
                  <td>{f.r.team.code}</td>
                  <td className="num">{f.checking}</td><td className="num">{f.rejected}</td>
                  <td className="num">{f.byAll}</td><td className="num">{f.byTimeout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>팀 흐름</h2>
        <p className="muted small">팀은 사용자가 직접 만들고 초대 링크로 팀원을 부릅니다. 테스트 대상이 아닌 팀(우리 팀, 장난 가입 등)은 “판정 제외”로 빼 주세요.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>팀</th><th>이름</th><th>만든 날</th><th>팀원</th><th>업무</th><th>수정</th><th>올림</th><th>열람</th><th>판정</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id}>
                  <td>{r.team.code}</td>
                  <td className="clip">{r.team.name}</td>
                  <td className="num">{dateTime(r.team.created_at)}</td>
                  <td className="num">{r.members.length}</td>
                  <td className="num">{r.tasks.length}</td>
                  <td className="num">{r.tasks.reduce((a, t) => a + editsOf(t.id).length, 0)}</td>
                  <td className="num">{r.tasks.reduce((a, t) => a + t.submissions.length, 0)}</td>
                  <td className="num">{r.views}</td>
                  <td>
                    <form action={toggleStudy}>
                      <input type="hidden" name="id" value={r.team.id} />
                      <input type="hidden" name="in_study" value={r.team.in_study ? "0" : "1"} />
                      <button className="link-btn small">{r.team.in_study ? "포함 · 빼기" : "제외 · 넣기"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
