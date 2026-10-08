"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { createTeam, teamByInvite } from "@/lib/data";

export type TeamState = { error?: string };

export async function createMyTeam(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 40) return { error: "팀 이름을 40자 안으로 적어 주세요. 예: 마케팅원론 3조" };
  let token: string;
  try { token = (await createTeam(user.id, name)).token; }
  catch { return { error: "팀을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }; }
  redirect(`/t/${token}`);
}

/** 코드를 직접 넣어 참여 → 초대 링크와 같은 경로로 보낸다 */
export async function joinByCode(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!(await teamByInvite(code))) return { error: "초대 코드를 찾을 수 없습니다. 팀장에게 다시 받아 주세요." };
  redirect(`/join/${code}`);
}
