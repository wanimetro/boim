import "server-only";
import { db } from "@/lib/supabase";
import type { ItemAnswer } from "@/domain/criteria";

// 응답 저장만 한다. 누가·언제 응답할 수 있는지는 criteria-service가 판단하고, RPC가 한 번 더 확인한다.
export const criteriaRepository = {
  async saveVotes(taskId: string, memberId: string, version: number, answers: ItemAnswer[]) {
    const { error } = await db().rpc("save_criteria_votes", { p_task_id: taskId, p_member_id: memberId, p_version: version, p_votes: answers });
    if (error) throw error;
  },
  async saveChecks(submissionId: string, memberId: string, version: number, answers: ItemAnswer[]) {
    const { error } = await db().rpc("save_submission_checks", { p_submission_id: submissionId, p_member_id: memberId, p_version: version, p_checks: answers });
    if (error) throw error;
  },
};
