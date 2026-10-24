"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import type { TaskInput } from "@/domain/task";
import { createTaskForUser, updateTaskForUser } from "@/server/services/task-service";
import { regenerateInviteForUser, savePushForUser, removePushForUser } from "@/server/services/member-actions-service";
import { prepareSubmission, submitWorkForUser } from "@/server/services/submission-service";
import { checkSubmissionForUser } from "@/server/services/criteria-service";
export type FormState = { error?: string; ok?: boolean };
function readTaskForm(formData: FormData): TaskInput {
  return {
    title: String(formData.get("title") ?? ""),
    owner_id: String(formData.get("owner") ?? ""),
    due: String(formData.get("due") ?? ""),
    due_time: String(formData.get("due_time") || "23:59"),
    criteria: formData.getAll("criteria").map(String),
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


export async function regenerateInvite(token: string) {
  await regenerateInviteForUser((await currentUser())?.id ?? null, token); revalidatePath(`/t/${token}`);
}
export async function savePush(token: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<FormState> {
  return savePushForUser((await currentUser())?.id ?? null, token, sub);
}
export async function removePush(token: string, endpoint: string) { await removePushForUser((await currentUser())?.id ?? null, token, endpoint); }
export async function prepareUpload(token: string, seq: number, fileName: string, size: number) { return prepareSubmission((await currentUser())?.id ?? null, token, seq, fileName, size); }
export async function submitWork(token: string, seq: number, input: { path?: string; fileName?: string; link?: string; note?: string; checked?: number[] }): Promise<FormState> {
  const result = await submitWorkForUser((await currentUser())?.id ?? null, token, seq, input);
  if (!("error" in result)) revalidatePath(`/t/${token}`); return result;
}

/** 항목별 응답 폼: v0..vN = ok|no, r0..rN = 이유 */
const reader = (formData: FormData) => (key: string) => String(formData.get(key) ?? "");

export async function checkSubmission(token: string, seq: number, submissionId: string, version: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const result = await checkSubmissionForUser((await currentUser())?.id ?? null, token, seq, submissionId, version, reader(formData));
  if ("error" in result) return result;
  revalidatePath(`/t/${token}`); revalidatePath(`/t/${token}/task/${seq}`);
  return { ok: true };
}
