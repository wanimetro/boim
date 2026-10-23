import "server-only";
import type { TaskInput } from "@/domain/task";
import { deadlineMs } from "@/domain/time";
import { taskRepository } from "@/server/repositories/task-repository";

export type TaskResult = { ok: true; changed: boolean } | { error: string };
const SAVE_FAILED = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";

// userId must come from the verified server session, never from form input.
async function requireMembership(userId: string | null, token: string) {
  if (!userId) throw new Error("로그인이 필요합니다.");
  const team = /^[0-9a-f]{24}$/.test(token) ? await taskRepository.findTeam(token) : null;
  if (!team) throw new Error("팀을 찾을 수 없습니다.");
  const members = await taskRepository.listMembers(team.id);
  const me = members.find(member => member.user_id === userId);
  if (!me) throw new Error("이 팀의 팀원만 할 수 있습니다.");
  return { team, members, me };
}

function validate(input: TaskInput, memberIds: string[], now: number): string | null {
  if (!input.title || input.title.length > 80) return "업무 이름을 80자 안으로 적어 주세요.";
  if (!memberIds.includes(input.owner_id)) return "담당을 골라 주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due)) return "중간 마감 날짜를 골라 주세요.";
  if (!/^\d{2}:\d{2}$/.test(input.due_time)) return "마감 시각을 다시 골라 주세요.";
  const deadline = deadlineMs(input.due, input.due_time);
  if (!Number.isFinite(deadline) || deadline <= now) return "마감은 지금보다 뒤로 정해 주세요.";
  if (input.rule.length < 5 || input.rule.length > 200) return "완료 기준을 파일을 보고 판단할 수 있게 한 줄로 적어 주세요.";
  return null;
}

function normalize(input: TaskInput): TaskInput {
  return { ...input, title: input.title.trim(), rule: input.rule.trim(), due_time: input.due_time || "23:59" };
}

export async function createTaskForUser(userId: string | null, token: string, raw: TaskInput): Promise<TaskResult> {
  const { team, members, me } = await requireMembership(userId, token);
  const input = normalize(raw);
  const error = validate(input, members.map(member => member.id), Date.now());
  if (error) return { error };
  try {
    await taskRepository.create(team.id, me.id, input);
    return { ok: true, changed: true };
  } catch {
    return { error: SAVE_FAILED };
  }
}

export async function updateTaskForUser(userId: string | null, token: string, seq: number, raw: TaskInput): Promise<TaskResult> {
  const { team, members, me } = await requireMembership(userId, token);
  const task = await taskRepository.findTask(team.id, seq);
  if (!task) return { error: "업무를 찾을 수 없습니다." };
  if (!(me.is_leader || task.created_by === me.id)) return { error: "팀장이나 이 업무를 등록한 사람만 고칠 수 있습니다." };
  const now = Date.now();
  if (deadlineMs(task.due, String(task.due_time)) <= now) return { error: "마감이 지난 업무는 고칠 수 없습니다." };
  const input = normalize(raw);
  const error = validate(input, members.map(member => member.id), now);
  if (error) return { error };
  const before: TaskInput = { title: task.title, owner_id: task.owner_id, due: task.due, due_time: task.due_time.slice(0, 5), rule: task.rule };
  const changed = (Object.keys(input) as (keyof TaskInput)[]).filter(key => input[key] !== before[key]);
  if (!changed.length) return { ok: true, changed: false };
  try {
    const saved = await taskRepository.updateWithEdit(task.id, me.id, input);
    return { ok: true, changed: saved };
  } catch {
    return { error: SAVE_FAILED };
  }
}
