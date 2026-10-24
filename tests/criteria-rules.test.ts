import { describe, expect, it } from "vitest";
import { CONFIRM_WINDOW_MS as W, readAnswers, roundState, statusFromLatest, submissionState, type Answer, type Round } from "@/domain/criteria";

const T0 = Date.parse("2026-10-24T00:00:00Z");
const at = (ms: number) => new Date(T0 + ms).toISOString();
const ans = (member_id: string, item: number, ok: boolean, ms: number, version = 1): Answer =>
  ({ member_id, item, ok, reason: ok ? null : "이유", version, created_at: at(ms) });
const base = { items: 2, version: 1, start: T0, participants: ["a", "b"] };

describe("round confirmation", () => {
  it("stays open until everyone answers or the window ends", () => {
    expect(roundState({ ...base, answers: [ans("a", 0, true, 1), ans("a", 1, true, 1)], now: T0 + 60_000 }))
      .toMatchObject({ kind: "open", answered: 1, required: 2, autoAt: T0 + W });
  });
  it("confirms as soon as every participant agrees with every item", () => {
    const answers = ["a", "b"].flatMap((m, i) => [ans(m, 0, true, 1000 * (i + 1)), ans(m, 1, true, 1000 * (i + 1))]);
    expect(roundState({ ...base, answers, now: T0 + 5000 })).toEqual({ kind: "confirmed", at: T0 + 2000, by: "all" });
  });
  it("confirms by silence after 12 hours", () => {
    expect(roundState({ ...base, answers: [], now: T0 + W })).toEqual({ kind: "confirmed", at: T0 + W, by: "timeout" });
  });
  it("does not count a half-answered member as answered", () => {
    expect(roundState({ ...base, answers: [ans("a", 0, true, 1)], now: T0 + 1 })).toMatchObject({ answered: 0 });
  });
  it("blocks confirmation on any objection, even after the window, and groups reasons by item without names", () => {
    const r = roundState({ ...base, answers: [ans("a", 1, false, 1), ans("b", 1, false, 2), ans("b", 0, true, 2)], now: T0 + 2 * W });
    expect(r).toEqual({ kind: "objected", objections: [{ item: 1, reasons: ["이유", "이유"] }], answered: 1, required: 2 });
    expect(JSON.stringify(r)).not.toMatch(/"a"|"b"/);
  });
  it("confirms when an objection is withdrawn after the window", () => {
    const r = roundState({ ...base, answers: [ans("a", 0, true, W + 10), ans("a", 1, true, W + 10)], now: T0 + W + 20 });
    expect(r).toEqual({ kind: "confirmed", at: T0 + W + 10, by: "timeout" });
  });
  it("ignores answers from an older criteria version or from non-participants", () => {
    const r = roundState({ ...base, answers: [ans("a", 0, false, 1, 0), ans("creator", 0, false, 1)], now: T0 + 1 });
    expect(r.kind).toBe("open");
  });
  it("confirms immediately when there is nobody else to ask", () => {
    expect(roundState({ ...base, participants: [], answers: [], now: T0 })).toEqual({ kind: "confirmed", at: T0, by: "all" });
  });
});

describe("submission checks", () => {
  const confirmed: Round = { kind: "confirmed", at: T0 + 1000, by: "all" };
  const sub = (ms: number, review: "pending" | "pass" | "fail" = "pending") =>
    ({ id: "s", uploader_id: "a", created_at: at(ms), review, review_note: review === "fail" ? "분량 부족" : null });
  const run = (over: Partial<Parameters<typeof submissionState>[0]>) =>
    submissionState({ sub: sub(0), criteria: confirmed, items: 2, version: 1, members: ["a", "b", "c"], checks: [], now: T0, next: null, ...over });

  it("waits for confirmed criteria before starting the check", () => {
    expect(run({ criteria: { kind: "open", autoAt: T0 + W, answered: 0, required: 1 } })).toEqual({ kind: "waiting" });
  });
  it("starts the 12-hour window when the criteria were confirmed, if that was after the upload", () => {
    expect(run({ now: T0 + 2000 })).toMatchObject({ kind: "open", autoAt: T0 + 1000 + W, required: 2 });
    expect(run({ now: T0 + 1000 + W })).toEqual({ kind: "confirmed", at: T0 + 1000 + W, by: "timeout" });
  });
  it("excludes the uploader and fails on a single unmet item", () => {
    expect(run({ checks: [ans("b", 0, true, 5), ans("b", 1, false, 5)], now: T0 + 10 })).toMatchObject({ kind: "objected", objections: [{ item: 1 }] });
    expect(statusFromLatest(run({ checks: [ans("b", 1, false, 5)], now: T0 + 10 }))).toBe("none");
  });
  it("marks a still-pending submission as replaced once a newer one arrives", () => {
    expect(run({ next: T0 + 5000, now: T0 + 2 * W })).toEqual({ kind: "superseded" });
    expect(run({ sub: sub(-2 * W), criteria: { kind: "confirmed", at: T0 - 2 * W, by: "all" }, next: T0, now: T0 + W })).toMatchObject({ kind: "confirmed", by: "timeout" });
  });
  it("keeps old operator reviews as they were", () => {
    expect(statusFromLatest(run({ sub: sub(0, "pass") }))).toBe("done");
    expect(run({ sub: sub(0, "fail") })).toEqual({ kind: "legacy", pass: false, note: "분량 부족" });
  });
});

describe("reading answers from a form", () => {
  const form = (o: Record<string, string>) => (k: string) => o[k] ?? "";
  it("requires every item and a 2-100 character reason for every no", () => {
    expect(readAnswers(2, form({ v0: "ok" }))).toEqual({ error: "2번 항목에 답해 주세요." });
    expect(readAnswers(1, form({ v0: "no", r0: " " }))).toHaveProperty("error");
    expect(readAnswers(2, form({ v0: "ok", v1: "no", r1: " 링크 없음 " }))).toEqual({ answers: [{ item: 0, ok: true }, { item: 1, ok: false, reason: "링크 없음" }] });
  });
});
