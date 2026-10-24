import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
let db: PGlite;
const user = "11111111-1111-4111-8111-111111111111", team = "22222222-2222-4222-8222-222222222222", member = "33333333-3333-4333-8333-333333333333", task = "44444444-4444-4444-8444-444444444444";
const input = { title: "변경된 업무", owner_id: member, due: "2099-11-01", due_time: "18:00", criteria: ["자료 다섯 장", "출처 표기"] };
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create function public.gen_random_bytes(n integer) returns bytea language sql as $$ select decode(repeat('ab',n),'hex') $$;`);
  const dir=path.resolve("supabase/migrations");
  for (const file of readdirSync(dir).filter(f=>/^000/.test(f)).sort()) {
    let sql=readFileSync(path.join(dir,file),"utf8").replace(/create extension if not exists pgcrypto;/g,"");
    if(file.includes("push_reminders")) sql=sql.split("-- 5분마다")[0];
    await db.exec(sql);
  }
  for (const file of readdirSync(dir).filter(f=>/^\d{14}_/.test(f)).sort()) await db.exec(readFileSync(path.join(dir,file),"utf8"));
},30000);
beforeEach(async () => {
  await db.exec(`begin; insert into auth.users values('${user}');
    insert into public.teams(id,code,name,token,invite_code) values('${team}','T900','테스트','${"a".repeat(24)}','ABCDEFGH');
    insert into public.members(id,team_id,user_id,code,is_leader) values('${member}','${team}','${user}','U01',true);
    insert into public.tasks(id,team_id,seq,title,owner_id,created_by,due,due_time,rule,criteria) values('${task}','${team}',1,'원래 업무','${member}','${member}','2099-11-01','18:00','자료 다섯 장',array['자료 다섯 장']);`);
});
afterEach(async()=>{await db.exec("rollback;");});
afterAll(async()=>{await db.close();});
const update=()=>db.query("select public.update_task_with_edit($1,$2,$3::jsonb)",[task,member,JSON.stringify(input)]);

describe("Postgres atomic team and task persistence",()=>{
  it("commits the task and only the actual changed fields in its edit",async()=>{
    await update();
    const edits=await db.query<{before:unknown;after:unknown}>("select before,after from public.task_edits");
    expect(edits.rows).toEqual([{before:{title:"원래 업무",criteria:["자료 다섯 장"]},after:{title:input.title,criteria:input.criteria}}]);
    const t=await db.query<{rule:string;criteria_version:number}>("select rule,criteria_version from public.tasks where id=$1",[task]);
    expect(t.rows[0]).toEqual({rule:"자료 다섯 장 / 출처 표기",criteria_version:2});
  });
  it("rolls back the task if its edit cannot be inserted",async()=>{
    await db.exec("create function reject_edit() returns trigger language plpgsql as $$ begin raise exception 'test audit failure'; end $$; create trigger reject_edit before insert on public.task_edits for each row execute function reject_edit(); savepoint attempt;");
    await expect(update()).rejects.toThrow("test audit failure");
    await db.exec("rollback to attempt;");
    expect((await db.query<{title:string}>("select title from public.tasks where id=$1",[task])).rows[0].title).toBe("원래 업무");
    expect((await db.query("select * from public.task_edits")).rows).toEqual([]);
  });
  it("rolls back team creation when leader registration fails",async()=>{
    await db.exec("create function reject_member() returns trigger language plpgsql as $$ begin raise exception 'test leader failure'; end $$; create trigger reject_member before insert on public.members for each row execute function reject_member(); savepoint attempt;");
    await expect(db.query("select public.create_team_with_leader($1,'새 팀',$2,'NEWCODE1')",[user,"b".repeat(24)])).rejects.toThrow("test leader failure");
    await db.exec("rollback to attempt;");
    expect((await db.query("select * from public.teams where token=$1",["b".repeat(24)])).rows).toEqual([]);
  });
  it("does not let a nonleader edit a task with a null creator",async()=>{
    await db.exec(`update public.members set is_leader=false where id='${member}'; update public.tasks set created_by=null; savepoint attempt;`);
    // 이 팀원은 담당자라 완료 기준만 고칠 수 있다. 업무 이름까지 바꾸려 하면 막힌다
    await expect(update()).rejects.toThrow("owner may edit criteria only"); await db.exec("rollback to attempt;");
  });
  it("allocates task numbers in the atomic operation",async()=>{
    await db.query("select public.create_task_atomic($1,$2,$3::jsonb)",[team,member,JSON.stringify(input)]);
    await db.query("select public.create_task_atomic($1,$2,$3::jsonb)",[team,member,JSON.stringify(input)]);
    expect((await db.query<{seq:number}>("select seq from public.tasks order by seq")).rows.map(r=>r.seq)).toEqual([1,2,3]);
  });
  it("rejects a rotated invite without inserting a member",async()=>{
    const other="55555555-5555-4555-8555-555555555555";
    await db.exec(`insert into auth.users values('${other}'); savepoint attempt;`);
    await expect(db.query("select public.join_team_atomic($1,$2,'OLDCODE1')",[team,other])).rejects.toThrow("invite expired");
    await db.exec("rollback to attempt;");
    expect((await db.query("select * from public.members where user_id=$1",[other])).rows).toEqual([]);
  });
  it("grants execution only to the service role",async()=>{
    const result=await db.query<{anon:boolean;authenticated:boolean;service:boolean}>("select has_function_privilege('anon','public.update_task_with_edit(uuid,uuid,jsonb)','execute') as anon,has_function_privilege('authenticated','public.update_task_with_edit(uuid,uuid,jsonb)','execute') as authenticated,has_function_privilege('service_role','public.update_task_with_edit(uuid,uuid,jsonb)','execute') as service");
    expect(result.rows[0]).toEqual({anon:false,authenticated:false,service:true});
    await db.exec("set local role service_role;"); await update();
  });
});
