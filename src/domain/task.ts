import type { Answer, SubmissionState } from "./criteria";
import { statusFromLatest } from "./criteria";

export type Status = "done" | "wait" | "none";
export type Review = "pending" | "pass" | "fail";
export type Team = { id: string; code: string; name: string; token: string; invite_code: string | null };
export type Member = { id: string; code: string; is_leader: boolean; user_id: string | null; nickname: string };
export type Submission = {
  id: string; uploader_id: string | null; file_path: string | null; file_name: string | null;
  link_url: string | null; note: string | null; review: Review; review_note: string | null; created_at: string;
  /** 이 결과물의 팀원 확인 상태 (현재 기준 차수) */
  state: SubmissionState;
  /** 현재 기준 차수의 항목별 확인. 화면에는 이름 없이 항목·이유만 보인다 */
  checks: Answer[];
  /** 이 결과물을 확인할 팀원 (올린 사람·담당자 제외) */
  checkers: string[];
};
export type Task = {
  id: string; seq: number; code: string; title: string; owner_id: string; created_by: string | null;
  owner: string; owner_code: string; due: string; due_time: string; rule: string;
  /** 팀이 업무를 나눌 때 정한 완료 기준 항목 */
  criteria: string[]; criteria_version: number;
  /** 완료 기준이 바뀐 기록 (최근 것부터). 팀원 모두에게 "기준 수정됨"과 전/후로 보인다 */
  criteria_edits: { at: string; before: string[]; after: string[] }[];
  status: Status; latest: Submission | null; submissions: Submission[];
};
export type TaskInput = { title: string; owner_id: string; due: string; due_time: string; criteria: string[] };
export type EditableTask = Omit<TaskInput, "criteria"> & { id: string; created_by: string | null; criteria: string[]; submissions?: { count: number }[] };

export function statusOf(latest: Pick<Submission, "state"> | null): Status {
  return statusFromLatest(latest?.state ?? null);
}
