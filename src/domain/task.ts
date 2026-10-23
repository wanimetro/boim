export type Status = "done" | "wait" | "none";
export type Review = "pending" | "pass" | "fail";
export type Team = { id: string; code: string; name: string; token: string; invite_code: string | null };
export type Member = { id: string; code: string; is_leader: boolean; user_id: string | null; nickname: string };
export type Submission = {
  id: string; uploader_id: string | null; file_path: string | null; file_name: string | null;
  link_url: string | null; note: string | null; review: Review; review_note: string | null; created_at: string;
};
export type Task = {
  id: string; seq: number; code: string; title: string; owner_id: string; created_by: string | null;
  owner: string; owner_code: string; due: string; due_time: string; rule: string;
  status: Status; latest: Submission | null; submissions: Submission[];
};
export type TaskInput = { title: string; owner_id: string; due: string; due_time: string; rule: string };
export type EditableTask = TaskInput & { id: string; created_by: string | null };

export function statusOf(latest: Submission | null): Status {
  if (!latest) return "none";
  if (latest.review === "pass") return "done";
  if (latest.review === "pending") return "wait";
  return "none";
}
