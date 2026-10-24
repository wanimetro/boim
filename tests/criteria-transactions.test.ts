import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

let db: PGlite;
const u1 = "11111111-1111-4111-8111-111111111111", u2 = "11111111-1111-4111-8111-222222222222";
const team = "22222222-2222-4222-8222-222222222222", other = "22222222-2222-4222-8222-333333333333";
const creator = "33333333-3333-4333-8333-333333333333", mate = "33333333-3333-4333-8333-444444444444", outsider = "33333333-3333-4333-8333-555555555555";
const task = "44444444-4444-4444-8444-444444444444", sub = "66666666-6666-4666-8666-666666666666";
const okAll = JSON.stringify([{ item: 0, ok: true }, { item: 1, ok: true }]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create function public.gen_random_bytes(n integer) returns bytea language sql as $$ select decode(repeat('ab',n),'hex') $$;`);
  const dir = path.resolve("supabase/migrations");
  for (const file of readdirSync(dir).filter(f => /^000/.test(f)).sort()) {
    let sql = readFileSync(path.join(dir, file), "utf8").replace(/create extension if not exists pgcrypto;/g, "");
    if (file.includes("push_reminders")) sql = sql.split("-- 5분마다")[0];
    await db.exec(sql);
  }
  for (const file of readdirSync(dir).filter(f => /^\d{14}_/.test(f)).sort()) await db.exec(readFileSync(path.join(dir, file), "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec(`begin; insert into auth.users values('${u1}'),('${u2}');
    insert into public.teams(id,code,name,token) values('${team}','T900','팀','${"a".repeat(24)}'),('${other}','T901','남','${"b".repeat(24)}');
    insert into public.members(id,team_id,user_id,code,is_leader) values('${creator}','${team}','${u1}','U01',true),('${mate}','${team}','${u2}','U02',false),('${outsider}','${other}',null,'U01',true);
    insert into public.tasks(id,team_id,seq,title,owner_id,created_by,due,due_time,rule,criteria) values('${task}','${team}',1,'업무','${creator}','${creator}','2099-11-01','18:00','a / b',array['자료 다섯 장','출처 표기']);
    insert into public.submissions(id,task_id,uploader_id,link_url) values('${sub}','${task}','${creator}','https://example.com');`);
});
afterEach(async () => { await db.exec("rollback;"); });
afterAll(async () => { await db.close(); });

const check = (member: string, version: number, checks: string, id = sub) =>
  db.query("select public.save_submission_checks($1,$2,$3,$4::jsonb)", [id, member, version, checks]);
const editTask = (member: string, criteria: string[], extra: object = {}) =>
  db.query("select public.update_task_with_edit($1,$2,$3::jsonb)", [task, member,
    JSON.stringify({ title: "업무", owner_id: creator, due: "2099-11-01", due_time: "18:00", criteria, ...extra })]);
async function rejects(run: () => Promise<unknown>, message: string) {
  await db.exec("savepoint attempt;");
  await expect(run()).rejects.toThrow(message);
  await db.exec("rollback to attempt;");
}

describe("submission checks and criteria rules", () => {
  it("migrates an existing one-line rule into criteria items", async () => {
    const t = await db.query<{ criteria: string[] }>("select criteria from public.tasks where id=$1", [task]);
    expect(t.rows[0].criteria).toHaveLength(2);
  });
  it("has no in-app criteria agreement table", async () => {
    const r = await db.query("select 1 from information_schema.tables where table_name='criteria_votes'");
    expect(r.rows).toEqual([]);
  });
  it("replaces a member's whole check instead of piling up rows, and requires reasons for unmet items", async () => {
    await check(mate, 1, JSON.stringify([{ item: 0, ok: false, reason: "분량이 부족함" }, { item: 1, ok: true }]));
    await check(mate, 1, okAll);
    expect((await db.query<{ ok: boolean }>("select ok from public.submission_checks where member_id=$1", [mate])).rows.map(r => r.ok)).toEqual([true, true]);
    await rejects(() => check(mate, 1, JSON.stringify([{ item: 0, ok: false }, { item: 1, ok: true }])), "invalid answers");
    await rejects(() => check(mate, 1, JSON.stringify([{ item: 0, ok: true }])), "invalid answers");
    await rejects(() => check(mate, 1, JSON.stringify([{ item: 0, ok: true }, { item: 0, ok: true }])), "invalid answers");
  });
  it("only lets someone other than the uploader or owner check, and only the latest submission", async () => {
    await rejects(() => check(creator, 1, okAll), "own work cannot check");
    await rejects(() => check(outsider, 1, okAll), "membership required");
    await db.exec(`update public.tasks set owner_id='${mate}';`);
    await rejects(() => check(mate, 1, okAll), "own work cannot check");
    await db.exec(`update public.tasks set owner_id='${creator}';
      insert into public.submissions(task_id,uploader_id,link_url,created_at) values('${task}','${creator}','https://example.com/2',now()+interval '1 second');`);
    await rejects(() => check(mate, 1, okAll), "not latest");
  });
  it("locks the criteria once anything has been uploaded, even for the leader", async () => {
    await rejects(() => editTask(creator, ["자료 세 장", "출처 표기"]), "criteria locked");
    await editTask(creator, ["자료 다섯 장", "출처 표기"], { title: "이름만 바꿈" });
    expect((await db.query<{ title: string }>("select title from public.tasks")).rows[0].title).toBe("이름만 바꿈");
  });
  it("allows fixing criteria before anything is uploaded, and bumps the version", async () => {
    await db.exec(`delete from public.submissions;`);
    await editTask(creator, ["자료 여섯 장", "출처 표기"]);
    expect((await db.query<{ criteria_version: number }>("select criteria_version from public.tasks")).rows[0].criteria_version).toBe(2);
  });
  it("does not let the owner edit a task they did not create", async () => {
    await db.exec(`update public.tasks set owner_id='${mate}', created_by=null; update public.members set is_leader=false; delete from public.submissions;`);
    await rejects(() => db.query("select public.update_task_with_edit($1,$2,$3::jsonb)", [task, mate,
      JSON.stringify({ title: "업무", owner_id: mate, due: "2099-11-01", due_time: "18:00", criteria: ["쉬운 기준", "출처 표기"] })]), "edit forbidden");
  });
  it("is callable by the service role only", async () => {
    const r = await db.query<{ anon: boolean; service: boolean }>("select has_function_privilege('anon','public.save_submission_checks(uuid,uuid,integer,jsonb)','execute') as anon, has_function_privilege('service_role','public.save_submission_checks(uuid,uuid,integer,jsonb)','execute') as service");
    expect(r.rows[0]).toEqual({ anon: false, service: true });
  });
});
