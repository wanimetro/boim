"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, BUCKET } from "@/lib/supabase";
import { newInviteCode } from "@/lib/data";
import { memberOnly } from "@/lib/team-access";
import { deadlineMs } from "@/lib/format";

async function taskBySeq(teamId: string, seq: number) {
  const { data } = await db().from("tasks").select("id, seq").eq("team_id", teamId).eq("seq", seq).maybeSingle();
  if (!data) throw new Error("업무를 찾을 수 없습니다.");
  return data;
}

export type FormState = { error?: string };

type TaskInput = { title: string; owner_id: string; due: string; due_time: string; rule: string };

/** 등록·수정 공통 검사. 통과하면 값, 아니면 안내 문구 */
function readTaskForm(formData: FormData, memberIds: string[]): TaskInput | { error: string } {
  const title = String(formData.get("title") ?? "").trim();
  const owner_id = String(formData.get("owner") ?? "");
  const due = String(formData.get("due") ?? "");
  const due_time = String(formData.get("due_time") || "23:59");
  const rule = String(formData.get("rule") ?? "").trim();

  if (!title || title.length > 80) return { error: "업무 이름을 80자 안으로 적어 주세요." };
  if (!memberIds.includes(owner_id)) return { error: "담당을 골라 주세요." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "중간 마감 날짜를 골라 주세요." };
  if (!/^\d{2}:\d{2}$/.test(due_time)) return { error: "마감 시각을 다시 골라 주세요." };
  if (deadlineMs(due, due_time) <= Date.now()) return { error: "마감은 지금보다 뒤로 정해 주세요." };
  if (rule.length < 5 || rule.length > 200) return { error: "완료 기준을 파일을 보고 판단할 수 있게 한 줄로 적어 주세요." };
  return { title, owner_id, due, due_time, rule };
}

export async function createTask(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { team, members, me } = await memberOnly(token);
  const input = readTaskForm(formData, members.map((m) => m.id));
  if ("error" in input) return input;

  const { data: last } = await db().from("tasks").select("seq").eq("team_id", team.id)
    .order("seq", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db().from("tasks").insert({ team_id: team.id, seq: (last?.seq ?? 0) + 1, ...input, created_by: me.id });
  if (error) return { error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  revalidatePath(`/t/${token}`);
  redirect(`/t/${token}`);
}

export async function updateTask(token: string, seq: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { team, members, me } = await memberOnly(token);
  const { data: task } = await db().from("tasks")
    .select("id, title, owner_id, due, due_time, rule, created_by").eq("team_id", team.id).eq("seq", seq).maybeSingle();
  if (!task) return { error: "업무를 찾을 수 없습니다." };
  if (!(me.is_leader || task.created_by === me.id)) return { error: "팀장이나 이 업무를 등록한 사람만 고칠 수 있습니다." };
  if (deadlineMs(task.due, String(task.due_time)) <= Date.now()) return { error: "마감이 지난 업무는 고칠 수 없습니다." };

  const input = readTaskForm(formData, members.map((m) => m.id));
  if ("error" in input) return input;
  const before = { title: task.title, owner_id: task.owner_id, due: task.due, due_time: String(task.due_time).slice(0, 5), rule: task.rule };
  const changed = (Object.keys(input) as (keyof TaskInput)[]).filter((k) => input[k] !== before[k]);
  if (changed.length === 0) redirect(`/t/${token}/task/${seq}`);

  const { error } = await db().from("tasks").update(input).eq("id", task.id);
  if (error) return { error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  await db().from("task_edits").insert({
    task_id: task.id, member_id: me.id,
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, input[k]])),
  });
  revalidatePath(`/t/${token}`);
  redirect(`/t/${token}/task/${seq}`);
}

/** 팀장이 초대 코드를 새로 만든다. 예전 코드·링크는 더 이상 쓸 수 없다. */
export async function regenerateInvite(token: string) {
  const { team, me } = await memberOnly(token);
  if (!me.is_leader) throw new Error("팀장만 초대 코드를 바꿀 수 있습니다.");
  for (let i = 0; i < 5; i++) {
    const { error } = await db().from("teams").update({ invite_code: newInviteCode() }).eq("id", team.id);
    if (!error) break;
  }
  revalidatePath(`/t/${token}`);
}

/** 이 기기에서 앱 알림을 켠다. 알림은 이 계정이 담당인 업무에 간다(모든 팀). */
export async function savePush(token: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<FormState> {
  const { user } = await memberOnly(token);
  if (!/^https:\/\/\S+$/.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "알림을 켜지 못했습니다." };
  const { error } = await db().from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  return error ? { error: "알림을 켜지 못했습니다." } : {};
}

export async function removePush(token: string, endpoint: string) {
  const { user } = await memberOnly(token);
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
}

const MAX_BYTES = 20 * 1024 * 1024;

/** 브라우저가 Supabase Storage에 바로 올릴 수 있는 서명 URL을 발급한다 (Vercel 요청 크기 제한 회피). */
export async function prepareUpload(token: string, seq: number, fileName: string, size: number) {
  const { team } = await memberOnly(token);
  const task = await taskBySeq(team.id, seq);
  if (size > MAX_BYTES) return { error: "20MB보다 큰 파일은 링크(구글 드라이브 등)로 보내 주세요." };
  const ext = (fileName.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? "").toLowerCase();
  const path = `${team.code}/${task.seq}/${crypto.randomUUID()}${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "업로드를 준비하지 못했습니다." };
  return { path: data.path, signedToken: data.token };
}

export async function submitWork(
  token: string, seq: number,
  input: { path?: string; fileName?: string; link?: string; note?: string },
): Promise<FormState> {
  const { team, me } = await memberOnly(token);
  const task = await taskBySeq(team.id, seq);

  const path = input.path && input.path.startsWith(`${team.code}/${task.seq}/`) ? input.path : null;
  const link = input.link?.trim() || null;
  if (link && !/^https?:\/\/\S+$/.test(link)) return { error: "링크는 https:// 로 시작해야 합니다." };
  if (!path && !link) return { error: "파일이나 링크 중 하나를 올려 주세요." };

  const { error } = await db().from("submissions").insert({
    task_id: task.id, uploader_id: me.id, file_path: path,
    file_name: path ? (input.fileName ?? "").slice(0, 120) : null,
    link_url: link, note: input.note?.trim().slice(0, 300) || null,
  });
  if (error) return { error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  revalidatePath(`/t/${token}`);
  return {};
}
