"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, BUCKET } from "@/lib/supabase";
import { newInviteCode } from "@/lib/data";
import { memberOnly } from "@/lib/team-access";
import { currentUser } from "@/lib/auth";
import type { TaskInput } from "@/domain/task";
import { createTaskForUser, updateTaskForUser } from "@/server/services/task-service";

async function taskBySeq(teamId: string, seq: number) {
  const { data } = await db().from("tasks").select("id, seq").eq("team_id", teamId).eq("seq", seq).maybeSingle();
  if (!data) throw new Error("업무를 찾을 수 없습니다.");
  return data;
}

export type FormState = { error?: string };

function readTaskForm(formData: FormData): TaskInput {
  return {
    title: String(formData.get("title") ?? ""),
    owner_id: String(formData.get("owner") ?? ""),
    due: String(formData.get("due") ?? ""),
    due_time: String(formData.get("due_time") || "23:59"),
    rule: String(formData.get("rule") ?? ""),
  };
}

export async function createTask(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  const result = await createTaskForUser(user?.id ?? null, token, readTaskForm(formData));
  if ("error" in result) return result;
  revalidatePath(`/t/${token}`);
  redirect(`/t/${token}`);
}

export async function updateTask(token: string, seq: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  const result = await updateTaskForUser(user?.id ?? null, token, seq, readTaskForm(formData));
  if ("error" in result) return result;
  if (result.changed) revalidatePath(`/t/${token}`);
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
