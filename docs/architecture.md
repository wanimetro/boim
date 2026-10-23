# 3계층 전환: 업무 생성·수정

첫 전환 범위는 업무 생성·수정이다. 프로젝트 전체의 전환 완료를 뜻하지 않는다.

| 계층 | 코드 | 책임 |
|---|---|---|
| 표현 | `src/app/t/[token]/actions.ts`의 createTask/updateTask | FormData 해석, 서버 세션 조회, 캐시 갱신, 리다이렉트 |
| 비즈니스 | `src/server/services/task-service.ts`, `src/domain/task.ts` | 팀 소속·역할·마감·담당자 검사, 변경 필드 계산 |
| 데이터 접근 | `src/server/repositories/task-repository.ts` | Supabase 조회·저장·오류 확인 |

서비스에 전달하는 userId는 서버 세션에서 가져온다. 클라이언트 입력으로 대체하지 않는다. 서비스는 매 요청 팀 소속과 작성자/팀장 권한을 확인한다. 기존 data.ts의 타입·statusOf export는 호환성을 위해 유지하고 실제 정의는 domain으로 이동했다.

## 검증

`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`를 사용한다. 서비스 테스트는 Repository 경계에서 대체하여 비회원·권한 없는 수정·기존 마감 경과·다른 팀 담당자·무변경 수정·수정 이력 저장 실패를 확인한다.

## 다음 단계

팀·제출·검수·알림·운영 화면의 기존 직접 DB 접근은 아직 남아 있다. 업무 번호 할당은 조회 후 INSERT 방식이고 업무 UPDATE와 이력 INSERT도 별개 요청이다. 이 PR에서는 DB 스키마를 바꾸지 않았다. 동시성 및 두 저장의 원자성은 별도 트랜잭션/RPC 변경으로 해결해야 한다. 이력 저장이 실패하면 성공으로 응답하지 않지만 이미 수행한 업무 UPDATE를 되돌리지는 못한다.
