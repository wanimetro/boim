# 보임 3계층 구조

## 책임과 의존 방향

| 계층 | 위치 | 책임 |
|---|---|---|
| 표현 | `src/app`, `src/lib/auth.ts`, `src/lib/team-access.ts` | 화면, 요청/폼 해석, 서버 세션 전달, 리다이렉트·캐시 |
| 비즈니스 | `src/server/services`, `src/domain`, `src/lib/metrics.ts` | 팀 소속·역할·마감 검사, 상태·지표 판정, 제출·알림·운영 집계 |
| 데이터 접근 | `src/server/repositories` | DB/Storage 조회·저장, 관계 결과와 저장 오류 처리, 원자적 RPC |
| 연동 어댑터 | `src/server/integrations`, `src/lib/supabase.ts`, `src/proxy.ts` | 쿠키·세션, SDK 연결, 푸시 전송 |

화면에서 DB/Storage를 직접 조회하지 않는다. 서비스는 Next.js navigation이나 Supabase SDK에 의존하지 않는다. 기존 `lib/data.ts`, `lib/admin.ts`, `lib/push.ts`는 호환용 facade다. 새 코드는 서비스/도메인 모듈을 직접 사용한다. 사용자 ID는 검증된 서버 세션에서 가져오며, 변경 서비스는 팀 소속과 작업 권한을 다시 확인한다. 닉네임 메타데이터는 표시용이며 권한 판단에 사용하지 않는다.

브라우저의 서명 URL 파일 업로드만 `src/client/storage-upload.ts`에서 Storage로 직접 전송한다. 업로드 허가·경로·크기는 서버 제출 서비스가 판단한다. OAuth·세션 쿠키·proxy는 프레임워크 연동 경계이므로 인증 어댑터로 남긴다.

## DB 원자성

- `create_team_with_leader`: 팀과 최초 팀장 등록을 한 트랜잭션으로 실행한다.
- `join_team_atomic`: 팀 행을 잠그고 초대 코드 재확인·중복 참여 확인·팀원 번호 할당을 실행한다.
- `create_task_atomic`: 팀 행 잠금 아래 업무 번호를 할당하고 저장한다.
- `update_task_with_edit`: 업무 행 잠금 아래 권한·현재 마감을 재확인하고 실제 변경 필드와 업무를 함께 저장한다. 이력 실패 시 업무 변경도 롤백된다.
- `save_criteria_votes`, `save_submission_checks`: 업무 행 잠금 아래 팀 소속·대상자(등록한 사람/올린 사람 제외)·기준 차수·최신 결과물을 재확인하고 한 사람의 항목별 응답을 통째로 바꾼다. 확정 여부는 `src/domain/criteria.ts`가 응답과 시각으로 계산한다.
- 이 함수들은 SECURITY INVOKER이며 service_role에만 EXECUTE를 부여한다. RLS와 기존 테이블 권한은 유지한다.

Auth 계정 생성과 프로필 저장, Storage 업로드와 제출 등록, 외부 푸시 발송은 서로 다른 시스템 작업이다. 이 코드 분리가 이들 시스템 간 분산 트랜잭션이나 알림의 exactly-once 전달을 보장하지는 않는다.

## 검증과 배포

`npm test`, `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, `npm run build`를 실행한다. 아키텍처 테스트는 표현→Repository/SDK 직접 의존과 서비스→Next.js/SDK 의존을 금지한다. 서비스 테스트와 PGlite PostgreSQL 통합 테스트로 비인증·비회원·마감·담당자·저장 실패·실제 롤백·RPC 역할별 실행 권한을 검증한다. PGlite 테스트는 운영 계정이나 네트워크를 사용하지 않는다.

새 RPC 마이그레이션을 DB에 적용한 후 이 코드를 배포해야 한다. 함수 추가는 기존 코드와 호환되며 테이블·기존 데이터를 삭제하지 않는다. 권한 마이그레이션 0006은 실제 적용 SQL과 이력을 맞춰 관리한다. 운영 적용 후 함수 ACL/RLS와 익명 접근을 확인하고, 사용자 화면의 인증 흐름은 별도 실제 계정으로 점검한다.
