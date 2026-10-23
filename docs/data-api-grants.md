# Data API 권한 적용·검증

2026-10-30부터 기존 Supabase 프로젝트의 새 public 테이블에도 명시적인 GRANT가 필요하다.
근거: https://github.com/orgs/supabase/discussions/45329

## 권한 범위

9개 업무 테이블에 service_role의 SELECT/INSERT/UPDATE/DELETE와 public 스키마 USAGE를 부여한다. teams.code 기본값의 nextval()에 필요한 team_code_seq USAGE도 부여한다. anon/authenticated 테이블 권한은 추가하지 않는다. RLS와 정책 없음 구조를 유지한다.

기존 데이터베이스는 보완 마이그레이션 `0006_data_api_grants.sql`을 적용한다. 새 환경은 생성 마이그레이션에서도 GRANT를 받는다. 이 변경은 기존 권한을 회수하지 않으며 기본 권한을 광범위하게 복원하지 않는다.

## 적용 순서

1. 배포 환경과 Supabase 프로젝트의 연결을 확인한다. Dashboard의 Data API 설정에서 public 스키마 노출을 확인한다.
2. 적용 예정 마이그레이션을 확인한 뒤 해당 프로젝트에서 `npx supabase db push`로 미적용 마이그레이션을 적용한다. SQL Editor를 사용하는 환경은 위 보완 마이그레이션을 실행한다.
3. `scripts/verify-data-api-grants.sql`을 SQL Editor 또는 psql로 실행한다. required privilege의 granted, schema_usage, team_code_sequence_usage가 모두 true이고 업무 테이블의 rls_enabled가 true인지 확인한다.
4. 아래 실제 API 검증을 수행한다. SQL 권한 조회만으로 API 설정·RLS·인증 흐름을 검증한 것으로 취급하지 않는다.

## 자동 권한 없는 새 환경

저장소의 [api] auto_expose_new_tables = false를 지원하는 Supabase CLI를 사용한다. 폐기 가능한 로컬 환경에서 npx supabase start 후 npx supabase db reset을 실행한다.

reset은 로컬 테스트 데이터만 대상으로 한다. preview branch 또는 자동 노출을 끈 새 테스트 프로젝트에서도 전체 마이그레이션을 재적용하고 동일한 권한 조회와 API 검증을 반복한다. 실제 서비스용 Vault 값·cron URL을 테스트 환경에 복사하지 않는다.

## 실제 API 검증

- 가입 및 프로필 생성, 팀 생성·초대 참여, 업무 생성·수정과 task_edits 기록을 확인한다.
- 제출 등록·검수, views 기록, 푸시 구독 저장·삭제, 테스트 알림의 notifications 기록을 확인한다.
- team_code_seq를 사용하는 팀 생성이 성공하는지 확인한다.
- anon/authenticated로 업무 테이블에 직접 접근하여 데이터가 노출되지 않는지 확인한다. 기존 ACL에서는 RLS에 따라 빈 결과가 나올 수 있다.

42501 permission denied는 GRANT 누락과 RLS 정책 거부를 오류 메시지로 구분한다. API 권한 문제를 해결하려고 모든 테이블에 anon 권한을 일괄 부여하지 않는다.

## 미확인 항목

이 문서는 저장소 소스에 근거한다. 운영·preview DB ACL, 기본 권한, 객체 소유자, 수동 생성 객체, 프로젝트 설정 및 실제 API 성공 여부는 각 환경에서 별도 확인해야 한다. 저장소 변경이나 PR 생성은 운영 DB 적용 완료를 뜻하지 않는다.
