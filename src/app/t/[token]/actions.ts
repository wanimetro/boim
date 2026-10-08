"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, BUCKET } from "@/lib/supabase";
import { teamByToken, membersOf, currentMember, setCurrentMember } from "@/lib/data";

async function load(token: string) {
  const team = await teamByToken(token);
  if (!team) throw new Error("팀 링크가 올바르지 않습니다.");
  const members = await membersOf(team.id);
  return { team, members };
}

async function taskBySeq(teamId: string, seq: number) {
  const { data } = await db().from("tasks").select("id, seq").eq("team_id", teamId).eq("seq", seq).maybeSingle();
  if (!data) throw new Error("업무를 찾을 수 없습니다.");
  return data;
}

export async function chooseMe(token: string, formData: FormData) {
  const { team, members } = await load(token);
  const id = String(formData.get("member") ?? "");
  if (!members.some((m) => m.id === id)) return;
  await setCurrentMember(team, id);
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith(`/t/${token}`) ? back : `/t/${token}`);
}

export type FormState = { error?: string };

export async function createTask(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { team, members } = await load(token);
  const me = await currentMember(team, members);
  const title = String(formData.get("title") ?? "").trim();
  const owner = String(formData.get("owner") ?? "");
  const due = String(formData.get("due") ?? "");
  const dueTime = String(formData.get("due_time") || "23:59");
  const rule = String(formData.get("rule") ?? "").trim();

  if (!title || title.length > 80) return { error: "업무 이름을 80자 안으로 적어 주세요." };
  if (!members.some((m) => m.id === owner)) return { error: "담당을 골라 주세요." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "중간 마감 날짜를 골라 주세요." };
  if (!/^\d{2}:\d{2}$/.test(dueTime)) return { error: "마감 시각을 다시 골라 주세요." };
  if (rule.length < 5 || rule.length > 200) return { error: "완료 기준을 파일을 보고 판단할 수 있게 한 줄로 적어 주세요." };

  const { data: last } = await db().from("tasks").select("seq").eq("team_id", team.id)
    .order("seq", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db().from("tasks").insert({
    team_id: team.id, seq: (last?.seq ?? 0) + 1, title, owner_id: owner, due, due_time: dueTime, rule, created_by: me?.id ?? null,
  });
  if (error) return { error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  revalidatePath(`/t/${token}`);
  redirect(`/t/${token}`);
}

/** 이 기기에서 앱 알림을 켠다. 알림은 지금 고른 "나"의 업무에만 간다. */
export async function savePush(token: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<FormState> {
  const { team, members } = await load(token);
  const me = await currentMember(team, members);
  if (!me) return { error: "먼저 내 번호를 골라 주세요." };
  if (!/^https:\/\/\S+$/.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "알림을 켜지 못했습니다." };
  const { error } = await db().from("push_subscriptions").upsert(
    { member_id: me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  return error ? { error: "알림을 켜지 못했습니다." } : {};
}

export async function removePush(token: string, endpoint: string) {
  const { team, members } = await load(token);
  const me = await currentMember(team, members);
  if (!me) return;
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("member_id", me.id);
}

const MAX_BYTES = 20 * 1024 * 1024;

/** 브라우저가 Supabase Storage에 바로 올릴 수 있는 서명 URL을 발급한다 (Vercel 요청 크기 제한 회피). */
export async function prepareUpload(token: string, seq: number, fileName: string, size: number) {
  const { team } = await load(token);
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
  const { team, members } = await load(token);
  const me = await currentMember(team, members);
  if (!me) return { error: "먼저 내 번호를 골라 주세요." };
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
