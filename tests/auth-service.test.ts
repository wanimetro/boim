import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({signIn:vi.fn(),signUp:vi.fn(),save:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/server/repositories/auth-repository',()=>({authRepository:{signIn:mocks.signIn,signUp:mocks.signUp}}));
vi.mock('@/server/repositories/profile-repository',()=>({profileRepository:{save:mocks.save}}));
import {signIn,signUp} from '@/server/services/auth-service';
beforeEach(()=>vi.resetAllMocks());
describe('auth service and safe navigation outcomes',()=>{
  it('rejects malformed credentials before contacting Auth',async()=>{
    expect(await signIn({email:'invalid',password:'secret',next:'/'})).toHaveProperty('error');
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it('normalizes email and prevents an external redirect',async()=>{
    mocks.signIn.mockResolvedValue({error:null});
    expect(await signIn({email:' User@Example.com ',password:'secret',next:'//evil.example'})).toEqual({next:'/'});
    expect(mocks.signIn).toHaveBeenCalledWith('user@example.com','secret');
  });
  it('does not write a profile after signup is rejected',async()=>{
    mocks.signUp.mockResolvedValue({data:{user:null,session:null},error:{code:'email_exists'}});
    expect(await signUp({email:'user@example.com',password:'password',nickname:'닉네임'})).toHaveProperty('error','이미 가입된 이메일입니다. 로그인해 주세요.');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('writes the signup profile using the Auth-issued id',async()=>{
    mocks.signUp.mockResolvedValue({data:{user:{id:'verified-id'},session:{}},error:null});
    expect(await signUp({email:'user@example.com',password:'password',nickname:' 닉네임 ',next:'/join/ABC'})).toEqual({next:'/join/ABC'});
    expect(mocks.save).toHaveBeenCalledWith('verified-id','닉네임');
  });
});
