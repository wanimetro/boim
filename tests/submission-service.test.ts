import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/server/services/team-access-service",()=>({requireTeamMember:vi.fn()}));
vi.mock("@/server/repositories/submission-repository",()=>({submissionRepository:{task:vi.fn(),save:vi.fn(),prepare:vi.fn()}}));
import { requireTeamMember } from "@/server/services/team-access-service";
import { submissionRepository as repo } from "@/server/repositories/submission-repository";
import { submitWorkForUser,prepareSubmission } from "@/server/services/submission-service";
beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(requireTeamMember).mockResolvedValue({team:{id:'team',code:'T1',name:'팀',token:'token',invite_code:null},members:[],me:{id:'member',user_id:'user',code:'U01',is_leader:false,nickname:'팀원'},userId:'user'});
  vi.mocked(repo.task).mockResolvedValue({id:'task',seq:2});
});
describe('submission authorization and storage boundary',()=>{
  it('rejects a nonmember before looking up the task or issuing an upload capability',async()=>{
    vi.mocked(requireTeamMember).mockRejectedValue(new Error('forbidden'));
    await expect(prepareSubmission('outsider','token',2,'file.pdf',100)).rejects.toThrow('forbidden');
    expect(repo.prepare).not.toHaveBeenCalled(); expect(repo.task).not.toHaveBeenCalled();
  });
  it('does not save a file path from another team',async()=>{
    expect(await submitWorkForUser('user','token',2,{path:'T2/2/other.pdf'})).toHaveProperty('error');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('derives uploader identity from membership rather than client input',async()=>{
    await submitWorkForUser('user','token',2,{path:'T1/2/file.pdf',note:'  제출  '});
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({task_id:'task',uploader_id:'member',note:'제출'}));
  });
  it('rejects an oversized upload before creating the signed capability',async()=>{
    expect(await prepareSubmission('user','token',2,'file.pdf',21*1024*1024)).toHaveProperty('error');
    expect(repo.prepare).not.toHaveBeenCalled();
  });
});
