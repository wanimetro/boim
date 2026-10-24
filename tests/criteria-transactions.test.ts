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

const vote = (member: string, version: number, votes: string) =>
  db.query("select public.save_criteria_votes($1,$2,$3,$4::jsonb)", [task, member, version, votes]);
const check = (member: string, version: number, checks: string, id = sub) =>
  db.query("select public.save_submission_checks($1,$2,$3,$4::jsonb)", [id, member, version, checks]);
async function rejects(run: () => Promise<unknown>, message: string) {
  await db.exec("savepoint attempt;");
  await expect(run()).rejects.toThrow(message);
  await db.exec("rollback to attempt;");
}

describe("criteria agreement and submission checks", () => {
  it("migrates an existing one-line rule into a single criterion", async () => {
    const t = await db.query<{ criteria: string[] }>("select criteria from public.tasks where id=$1", [task]);
    expect(t.rows[0].criteria).toHaveLength(2);
  });
  it("replaces a member's whole answer instead of piling up rows", async () => {
    await vote(mate, 1, JSON.stringify([{ item: 0, ok: false, reason: "분량이 애매함" }, { item: 1, ok: true }]));
    await vote(mate, 1, okAll);
    const rows = await db.query<{ ok: boolean }>("select ok from public.criteria_votes where member_id=$1", [mate]);
    expect(rows.rows.map(r => r.ok)).toEqual([true, true]);
  });
  it("requires a reason for every objection and an answer for every item", async () => {
    await rejects(() => vote(mate, 1, JSON.stringify([{ item: 0, ok: false }, { item: 1, ok: true }])), "invalid answers");
    await rejects(() => vote(mate, 1, JSON.stringify([{ item: 0, ok: true }])), "invalid answers");
    await rejects(() => vote(mate, 1, JSON.stringify([{ item: 0, ok: true }, { item: 0, ok: true }])), "invalid answers");
  });
  it("does not let the creator vote on their own criteria or an outsider vote at all", async () => {
    await rejects(() => vote(creator, 1, okAll), "own task cannot vote");
    await rejects(() => vote(outsider, 1, okAll), "membership required");
  });
  it("does not let the owner or anyone who uploaded for the task vote on its criteria", async () => {
    await db.exec(`update public.tasks set created_by=null, owner_id='${mate}';`);
    await rejects(() => vote(mate, 1, okAll), "own task cannot vote");
    await db.exec(`update public.tasks set owner_id='${creator}'; insert into public.submissions(task_id,uploader_id,link_url) values('${task}','${mate}','https://example.com/m');`);
    await rejects(() => vote(mate, 1, okAll), "own task cannot vote");
  });
  it("does not let the owner check work someone else uploaded for them", async () => {
    await db.exec(`update public.tasks set owner_id='${mate}';`);
    await rejects(() => check(mate, 1, okAll), "own work cannot check");
  });
  it("lets the owner change only the criteria", async () => {
    await db.exec(`update public.tasks set owner_id='${mate}'; update public.members set is_leader=false where id='${creator}';`);
    const base = { title: "업무", owner_id: mate, due: "2099-11-01", due_time: "18:00", criteria: ["자료 여섯 장", "출처 표기"] };
    const edit = (input: object) => db.query("select public.update_task_with_edit($1,$2,$3::jsonb)", [task, mate, JSON.stringify(input)]);
    await edit(base);
    expect((await db.query<{ criteria: string[] }>("select criteria from public.tasks")).rows[0].criteria).toEqual(base.criteria);
    await rejects(() => edit({ ...base, due: "2099-12-01" }), "owner may edit criteria only");
  });
  it("rejects a stale vote after the criteria were edited", async () => {
    await db.query("select public.update_task_with_edit($1,$2,$3::jsonb)", [task, creator,
      JSON.stringify({ title: "업무", owner_id: creator, due: "2099-11-01", due_time: "18:00", criteria: ["자료 여섯 장", "출처 표기"] })]);
    await rejects(() => vote(mate, 1, okAll), "criteria changed");
    await vote(mate, 2, okAll);
  });
  it("only lets someone other than the uploader check the latest submission", async () => {
    await rejects(() => check(creator, 1, okAll), "own work cannot check");
    await check(mate, 1, JSON.stringify([{ item: 0, ok: true }, { item: 1, ok: false, reason: "출처 링크가 없음" }]));
    const rows = await db.query<{ item: number; reason: string | null }>("select item,reason from public.submission_checks order by item");
    expect(rows.rows).toEqual([{ item: 0, reason: null }, { item: 1, reason: "출처 링크가 없음" }]);
    await db.exec(`insert into public.submissions(task_id,uploader_id,link_url,created_at) values('${task}','${creator}','https://example.com/2',now()+interval '1 second');`);
    await rejects(() => check(mate, 1, okAll), "not latest");
  });
  it("is callable by the service role only", async () => {
    const r = await db.query<{ anon: boolean; service: boolean }>("select has_function_privilege('anon','public.save_submission_checks(uuid,uuid,integer,jsonb)','execute') as anon, has_function_privilege('service_role','public.save_submission_checks(uuid,uuid,integer,jsonb)','execute') as service");
    expect(r.rows[0]).toEqual({ anon: false, service: true });
  });
});
