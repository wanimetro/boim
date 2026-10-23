import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
function files(dir:string):string[] { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.tsx?$/.test(e.name)?[path.join(dir,e.name)]:[]); }
function imports(file:string) {
  const ast=ts.createSourceFile(file,readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
  return ast.statements.filter(ts.isImportDeclaration).map(n=>(n.moduleSpecifier as ts.StringLiteral).text);
}
describe("three-layer dependency boundaries",()=>{
  it("keeps persistence SDKs and repositories out of presentation entry points",()=>{
    const violations=files(path.resolve("src/app")).flatMap(f=>imports(f).filter(i=>/@supabase|lib\/supabase|repositories|repository|server\/integrations/.test(i)).map(i=>`${f}: ${i}`));
    expect(violations).toEqual([]);
  });
  it("keeps framework navigation and SDK imports out of business services",()=>{
    const violations=files(path.resolve("src/server/services")).flatMap(f=>imports(f).filter(i=>/^next\/|^@supabase|lib\/supabase|\/app\//.test(i)).map(i=>`${f}: ${i}`));
    expect(violations).toEqual([]);
  });
});
