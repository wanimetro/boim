import "server-only";
import { requireTeamMember } from "./team-access-service";
import { submissionRepository as repo } from "@/server/repositories/submission-repository";
export async function prepareSubmission(userId: string | null, token: string, seq: number, fileName: string, size: number) {
  const { team } = await requireTeamMember(userId, token);
  const task = await repo.task(team.id, seq);
  if (!Number.isFinite(size) || size < 0 || size > 20 * 1024 * 1024) return { error: "20MB보다 큰 파일은 링크(구글 드라이브 등)로 보내 주세요." };
  const ext = (fileName.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? "").toLowerCase();
  try { return await repo.prepare(`${team.code}/${task.seq}/${crypto.randomUUID()}${ext}`); }
  catch { return { error: "업로드를 준비하지 못했습니다." }; }
}
export async function submitWorkForUser(userId: string | null, token: string, seq: number, input: { path?: string; fileName?: string; link?: string; note?: string }) {
  const { team, me } = await requireTeamMember(userId, token);
  const task = await repo.task(team.id, seq);
  const path = input.path && input.path.startsWith(`${team.code}/${task.seq}/`) ? input.path : null;
  const link = input.link?.trim() || null;
  if (link && !/^https?:\/\/\S+$/.test(link)) return { error: "링크는 https:// 로 시작해야 합니다." };
  if (!path && !link) return { error: "파일이나 링크 중 하나를 올려 주세요." };
  try { await repo.save({ task_id: task.id, uploader_id: me.id, file_path: path, file_name: path ? (input.fileName ?? "").slice(0, 120) : null, link_url: link, note: input.note?.trim().slice(0, 300) || null }); }
  catch { return { error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }; }
  return {};
}
