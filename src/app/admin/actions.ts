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

/** 테스트 대상이 아닌 팀을 판정에서 빼거나 다시 넣는다 */
export async function toggleStudy(formData: FormData) {
  await requireAdmin();
  await db().from("teams").update({ in_study: formData.get("in_study") === "1" }).eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin");
}
