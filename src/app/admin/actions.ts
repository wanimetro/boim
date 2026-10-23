"use server";

import { revalidatePath } from "next/cache";
import { reviewSubmission, setStudyInclusion } from "@/server/services/admin-service";
import { passwordMatches, setAdmin } from "@/lib/admin";

export type AdminState = { error?: string; ok?: string };

export async function login(_prev: AdminState, formData: FormData): Promise<AdminState> {
  if (!passwordMatches(String(formData.get("password") ?? ""))) return { error: "비밀번호가 맞지 않습니다." };
  await setAdmin();
  return {};
}

export async function review(formData: FormData) {
  await reviewSubmission(String(formData.get("id") ?? ""), String(formData.get("verdict") ?? ""), String(formData.get("reason") ?? ""));
  revalidatePath("/admin");
}

/** 테스트 대상이 아닌 팀을 판정에서 빼거나 다시 넣는다 */
export async function toggleStudy(formData: FormData) {
  await setStudyInclusion(String(formData.get("id") ?? ""), formData.get("in_study") === "1");
  revalidatePath("/admin");
}
