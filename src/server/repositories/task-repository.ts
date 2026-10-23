import "server-only";
import { db } from "@/lib/supabase";
import type { EditableTask, Member, TaskInput } from "@/domain/task";

// Only persistence lives here; authorization and task rules live in task-service.
export const taskRepository = {
  async findTeam(token: string): Promise<{ id: string } | null> {
    const { data, error } = await db().from("teams").select("id").eq("token", token).maybeSingle();
    if (error) throw error;
    return data;
  },
  async listMembers(teamId: string): Promise<Pick<Member, "id" | "user_id" | "is_leader">[]> {
    const { data, error } = await db().from("members").select("id, user_id, is_leader").eq("team_id", teamId);
    if (error) throw error;
    return data ?? [];
  },
  async findTask(teamId: string, seq: number): Promise<EditableTask | null> {
    const { data, error } = await db().from("tasks")
      .select("id, title, owner_id, due, due_time, rule, created_by")
      .eq("team_id", teamId).eq("seq", seq).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(teamId: string, memberId: string, input: TaskInput) {
    const { data: last, error: readError } = await db().from("tasks").select("seq")
      .eq("team_id", teamId).order("seq", { ascending: false }).limit(1).maybeSingle();
    if (readError) throw readError;
    const { error } = await db().from("tasks").insert({
      team_id: teamId, seq: (last?.seq ?? 0) + 1, ...input, created_by: memberId,
    });
    if (error) throw error;
  },
  async update(taskId: string, input: TaskInput) {
    const { error } = await db().from("tasks").update(input).eq("id", taskId);
    if (error) throw error;
  },
  async appendEdit(taskId: string, memberId: string, before: Partial<TaskInput>, after: Partial<TaskInput>) {
    const { error } = await db().from("task_edits").insert({ task_id: taskId, member_id: memberId, before, after });
    if (error) throw error;
  },
};
