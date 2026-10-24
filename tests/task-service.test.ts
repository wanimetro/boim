import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/task-repository", () => ({
  taskRepository: { findTeam: vi.fn(), listMembers: vi.fn(), findTask: vi.fn(), create: vi.fn(), updateWithEdit: vi.fn() },
}));
import { taskRepository } from "@/server/repositories/task-repository";
import { createTaskForUser, updateTaskForUser } from "@/server/services/task-service";

const repo = vi.mocked(taskRepository);
const token = "a".repeat(24);
const input = { title: "발표 준비", owner_id: "member", due: "2026-11-01", due_time: "18:00", criteria: ["발표 자료 다섯 장", "발표자 노트 포함"] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
  repo.findTeam.mockResolvedValue({ id: "team" });
  repo.listMembers.mockResolvedValue([{ id: "member", user_id: "user", is_leader: false }]);
  repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "member" });
  repo.create.mockResolvedValue(); repo.updateWithEdit.mockResolvedValue(true);
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
    expect(repo.updateWithEdit).not.toHaveBeenCalled();
  });
  it("locks the criteria once something has been uploaded, but still allows other edits", async () => {
    repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "member", submissions: [{ count: 1 }] });
    await expect(updateTaskForUser("user", token, 1, { ...input, criteria: ["더 쉬운 기준"] })).resolves.toEqual({ error: "결과물이 이미 올라와서 완료 기준은 바꿀 수 없습니다." });
    await expect(updateTaskForUser("user", token, 1, { ...input, title: "새 이름" })).resolves.toEqual({ ok: true, changed: true });
    expect(repo.updateWithEdit).toHaveBeenCalledTimes(1);
  });
  it("allows a leader to edit a task created by another member", async () => {
    repo.listMembers.mockResolvedValue([{ id: "member", user_id: "user", is_leader: true }]);
    repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "someone-else" });
    await expect(updateTaskForUser("user", token, 1, { ...input, title: "변경" })).resolves.toEqual({ ok: true, changed: true });
  });
  it("cannot reopen an expired task by submitting a new future deadline", async () => {
    repo.findTask.mockResolvedValue({ ...input, id: "task", created_by: "member", due: "2026-10-22" });
    await expect(updateTaskForUser("user", token, 1, input)).resolves.toEqual({ error: "마감이 지난 업무는 고칠 수 없습니다." });
    expect(repo.updateWithEdit).not.toHaveBeenCalled();
  });
  it("does not write or log an unchanged edit", async () => {
    await expect(updateTaskForUser("user", token, 1, input)).resolves.toEqual({ ok: true, changed: false });
    expect(repo.updateWithEdit).not.toHaveBeenCalled();
  });
  it("scopes the lookup to the team and uses one atomic persistence call", async () => {
    await updateTaskForUser("user", token, 7, { ...input, title: "새 발표" });
    expect(repo.findTask).toHaveBeenCalledWith("team", 7);
    expect(repo.updateWithEdit).toHaveBeenCalledWith("task", "member", { ...input, title: "새 발표" });
  });
  it("trims criteria, drops empty lines, and rejects empty or oversized lists", async () => {
    await createTaskForUser("user", token, { ...input, criteria: ["  발표 자료 다섯 장 ", "", "발표자 노트 포함"] });
    expect(repo.create).toHaveBeenCalledWith("team", "member", input);
    repo.create.mockClear();
    await expect(createTaskForUser("user", token, { ...input, criteria: ["", "  "] })).resolves.toHaveProperty("error");
    await expect(createTaskForUser("user", token, { ...input, criteria: Array.from({ length: 9 }, (_, i) => `기준 ${i}`) })).resolves.toHaveProperty("error");
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("treats a reordered criteria list as a change", async () => {
    await expect(updateTaskForUser("user", token, 1, { ...input, criteria: [...input.criteria].reverse() })).resolves.toEqual({ ok: true, changed: true });
  });
  it("does not report success if atomic persistence fails", async () => {
    repo.updateWithEdit.mockRejectedValue(new Error("internal database details"));
    await expect(updateTaskForUser("user", token, 1, { ...input, title: "변경" })).resolves.toEqual({ error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  });
});
