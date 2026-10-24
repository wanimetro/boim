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
      .select("id, title, owner_id, due, due_time, criteria, created_by, submissions(count)")
      .eq("team_id", teamId).eq("seq", seq).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(teamId: string, memberId: string, input: TaskInput) {
    const { error } = await db().rpc("create_task_atomic", { p_team_id: teamId, p_member_id: memberId, p_input: input });
    if (error) throw error;
  },
  async updateWithEdit(taskId: string, memberId: string, input: TaskInput): Promise<boolean> {
    const { data, error } = await db().rpc("update_task_with_edit", { p_task_id: taskId, p_member_id: memberId, p_input: input });
    if (error) throw error;
    return Boolean(data);
  },
};
