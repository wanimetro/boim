import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/task-repository", () => ({
  taskRepository: { findTeam: vi.fn(), listMembers: vi.fn(), findTask: vi.fn(), create: vi.fn(), update: vi.fn(), appendEdit: vi.fn() },
}));
import { taskRepository } from "@/server/repositories/task-repository";
import { createTaskForUser, updateTaskForUser } from "@/server/services/task-service";

const repo = vi.mocked(taskRepository);
const token = "a".repeat(24);
const input = { title: "발표 준비", owner_id: "member", due: "2026-11-01", due_time: "18:00", rule: "발표 자료 다섯 장" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
  repo.findTeam.mockResolvedValue({ id: "team" });
  repo.listMembers.mockResolvedValue([{ id: "member", user_id: "user", is_leader: false }]);
  repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "member" });
  repo.create.mockResolvedValue(); repo.update.mockResolvedValue(); repo.appendEdit.mockResolvedValue();
});
afterEach(() => vi.useRealTimers());

describe("task authorization and rules", () => {
  it("rejects an unauthenticated request before reading or writing persistence", async () => {
    await expect(createTaskForUser(null, token, input)).rejects.toThrow("로그인이 필요합니다");
    expect(repo.findTeam).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("does not allow a user from another team to create a task", async () => {
    await expect(createTaskForUser("outsider", token, input)).rejects.toThrow("팀원만");
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("uses the verified membership as creator and normalizes input", async () => {
    await expect(createTaskForUser("user", token, { ...input, title: "  발표 준비  " })).resolves.toEqual({ ok: true, changed: true });
    expect(repo.create).toHaveBeenCalledWith("team", "member", input);
  });
  it("rejects an assignee outside the team", async () => {
    await expect(createTaskForUser("user", token, { ...input, owner_id: "outsider" })).resolves.toHaveProperty("error");
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("rejects deadlines in the past without saving", async () => {
    await expect(createTaskForUser("user", token, { ...input, due: "2026-10-22" })).resolves.toHaveProperty("error");
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("rejects editing by a member who is neither leader nor creator", async () => {
    repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "someone-else" });
    await expect(updateTaskForUser("user", token, 1, { ...input, title: "변경" })).resolves.toHaveProperty("error");
    expect(repo.update).not.toHaveBeenCalled();
  });
  it("allows a leader to edit a task created by another member", async () => {
    repo.listMembers.mockResolvedValue([{ id: "member", user_id: "user", is_leader: true }]);
    repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "someone-else" });
    await expect(updateTaskForUser("user", token, 1, { ...input, title: "변경" })).resolves.toEqual({ ok: true, changed: true });
  });
  it("cannot reopen an expired task by submitting a new future deadline", async () => {
    repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "member", due: "2026-10-22" });
    await expect(updateTaskForUser("user", token, 1, input)).resolves.toEqual({ error: "마감이 지난 업무는 고칠 수 없습니다." });
    expect(repo.update).not.toHaveBeenCalled();
  });
  it("does not write or log an unchanged edit", async () => {
    await expect(updateTaskForUser("user", token, 1, input)).resolves.toEqual({ ok: true, changed: false });
    expect(repo.update).not.toHaveBeenCalled(); expect(repo.appendEdit).not.toHaveBeenCalled();
  });
  it("records only changed fields and scopes the lookup to the team", async () => {
    await updateTaskForUser("user", token, 7, { ...input, title: "새 발표" });
    expect(repo.findTask).toHaveBeenCalledWith("team", 7);
    expect(repo.appendEdit).toHaveBeenCalledWith("task", "member", { title: "발표 준비" }, { title: "새 발표" });
  });
  it("does not report success if audit persistence fails", async () => {
    repo.appendEdit.mockRejectedValue(new Error("internal database details"));
    await expect(updateTaskForUser("user", token, 1, { ...input, title: "변경" })).resolves.toEqual({ error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  });
});
