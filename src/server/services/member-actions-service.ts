import "server-only";
import { requireTeamMember } from "./team-access-service";
import { newInviteCode } from "./team-service";
import { teamRepository } from "@/server/repositories/team-repository";
import { notificationRepository } from "@/server/repositories/notification-repository";
export async function regenerateInviteForUser(userId: string | null, token: string) {
  const { team, me } = await requireTeamMember(userId, token);
  if (!me.is_leader) throw new Error("팀장만 초대 코드를 바꿀 수 있습니다.");
  for (let i = 0; i < 5; i++) {
    try { await teamRepository.regenerate(team.id, newInviteCode()); return; }
    catch (error) { if ((error as { code?: string }).code !== "23505") throw error; }
  }
  throw new Error("초대 코드를 바꾸지 못했습니다.");
}
export async function savePushForUser(userId: string | null, token: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const member = await requireTeamMember(userId, token);
  if (!/^https:\/\/\S+$/.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "알림을 켜지 못했습니다." };
  try { await notificationRepository.save(member.userId, sub); return {}; }
  catch { return { error: "알림을 켜지 못했습니다." }; }
}
export async function removePushForUser(userId: string | null, token: string, endpoint: string) {
  const member = await requireTeamMember(userId, token); await notificationRepository.remove(member.userId, endpoint);
}
