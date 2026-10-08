"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { passwordMatches, requireAdmin, setAdmin } from "@/lib/admin";

export type AdminState = { error?: string; ok?: string };

export async function login(_prev: AdminState, formData: FormData): Promise<AdminState> {
  if (!passwordMatches(String(formData.get("password") ?? ""))) return { error: "비밀번호가 맞지 않습니다." };
  await setAdmin();
  return {};
}

export async function review(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const verdict = String(formData.get("verdict") ?? "");
  if (verdict !== "pass" && verdict !== "fail") return;
  await db().from("submissions").update({
    review: verdict,
    review_note: verdict === "fail" ? String(formData.get("reason") ?? "").trim().slice(0, 200) || null : null,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath("/admin");
}

/** 마감 하루 전 카톡 DM을 보낸 뒤 누른다. 이 시각 뒤에 올린 것은 판정에서 뺀다. */
export async function markReminded(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("task") ?? "");
  const undo = formData.get("undo") === "1";
  await db().from("tasks").update({ reminded_at: undo ? null : new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin");
}

export async function createTeam(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const memberCodes = [...new Set(String(formData.get("members") ?? "")
    .split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const leader = String(formData.get("leader") ?? "").trim().toUpperCase();

  if (!/^T\d{1,2}$/.test(code)) return { error: "팀 코드는 T1, T2 처럼 적어 주세요." };
  if (!name) return { error: "팀 이름을 적어 주세요. 예: T1 · 마케팅원론 팀 발표" };
  if (memberCodes.length < 2 || memberCodes.some((c) => !/^U\d{2,3}$/.test(c)))
    return { error: "팀원 번호를 U01, U02 처럼 쉼표로 나눠 두 명 이상 적어 주세요. 실명은 넣지 않습니다." };

  const { data: team, error } = await db().from("teams").insert({ code, name }).select("id").single();
  if (error || !team) return { error: error?.code === "23505" ? `${code}는 이미 있습니다.` : "팀을 만들지 못했습니다." };
  await db().from("members").insert(memberCodes.map((c) => ({ team_id: team.id, code: c, is_leader: c === leader })));
  revalidatePath("/admin");
  return { ok: `${code} 팀을 만들었습니다.` };
}
