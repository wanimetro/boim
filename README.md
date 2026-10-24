# 보임 (BOIM) 웹앱 — 4조 MVP

묻지 않아도 어디까지 됐는지 보이는 팀플 보드. Next.js(App Router) + Supabase, Vercel 배포.

확인할 가정: “완료”를 기준에 맞는 파일을 올려야만 바뀌게 하면, 담당자가 묻거나 재촉하지 않아도 직접 올린다.
판정: 본인 첨부율 60% 이상 개발 착수 · 30% 미만 설계 전환.

## 화면

| 주소 | 누가 | 하는 일 |
|---|---|---|
| `/` | 로그인한 사람 | 내 팀 목록, 새 팀 만들기(만든 사람이 팀장), 초대 코드로 참여 |
| `/login` | 누구나 | 이메일 로그인·가입 (소셜 로그인 버튼은 켜면 나타남) |
| `/join/{초대 코드}` | 초대받은 사람 | 로그인돼 있으면 바로 팀원, 아니면 로그인·가입 뒤 팀원 |
| `/t/{팀 토큰}` | 팀원 | 팀 업무 보드, 알림 받기, 팀원 초대(링크 복사·팀장은 코드 새로 만들기) |
| `/t/{팀 토큰}/task/{번호}` | 팀원 | 완료 기준 확인, 파일·링크 올리기, 올린 기록 |
| `/t/{팀 토큰}/new` | 팀원 | 업무·담당·중간 마감(날짜·시각)·완료 기준 등록 |
| `/admin` | 우리 팀(운영) | 흐름 확인(팀·팀원·업무·올림·열람), 판정, 검수, 알림 발송 현황, 판정 포함/제외 |

팀원만 자기 팀 보드를 볼 수 있다. 팀 화면에는 가입 때 정한 닉네임이 보이고, 운영 화면과 측정에는 T1·U01 같은 번호만 쓴다. 운영자는 팀을 만들지 않는다.

## 사람이 하는 일 (오즈의 마법사)

- **팀원 확인 (운영자 검수 대신):** 완료 기준은 항목(1~8개)으로 나눠 적는다.
  1. **기준 합의:** 등록한 사람을 뺀 팀원이 항목마다 동의/수정 필요(이유 필수). 전원 동의하거나 12시간 동안 수정 의견이 없으면 확정. 의견이 있으면 기준을 고칠 때까지(새로 합의) 멈춘다.
  2. **결과물 확인:** 기준 확정 뒤, 올린 사람을 뺀 팀원이 항목마다 충족/미충족(이유 필수). 전원 충족이거나 12시간 동안 미충족 의견이 없으면 완료. 미충족이 있으면 다시 올려야 한다.
  - 소수 팀에서 반대한 사람이 짐작되지 않도록, 의견은 이름 없이 **항목**에만 이유와 함께 보인다(운영 화면도 같다).
  - 확정은 응답과 시각으로 계산하므로 따로 예약 작업이 없다. 예전 운영자 통과/반려 기록은 그대로 인정한다.
- **본인/대신:** 로그인한 계정으로 자동 기록된다(올린 사람 ≠ 담당이면 “대신”).
- **판정 제외:** 우리 팀이나 장난 가입처럼 테스트 대상이 아닌 팀은 `/admin`의 **팀 흐름**에서 판정에서 뺀다.
- **알림은 앱이 보낸다:** 마감 1시간 전·30분 전에, 아직 아무것도 올리지 않은 담당자에게 웹 푸시가 간다(Supabase pg_cron이 5분마다 `/api/cron/remind`를 부름). 발송·실패·“알림 안 켬” 건수는 `/admin`의 **앱 알림 발송**에서 본다.
  - 팀원은 보드에서 **알림 받기**를 한 번 누른다. 알림은 계정에 붙어서 여러 팀의 내 업무에 모두 온다.
  - 아이폰은 사파리 **공유 → 홈 화면에 추가** 후 홈 화면 아이콘으로 열어야 알림을 켤 수 있다(iOS 16.4 이상).

판정(워크북 3쪽): 각 팀의 **첫 중간 마감 항목 전체** 중 **마감 24시간 전까지** 담당 본인이 올려 통과한 항목의 비율. 24시간 안·마감 뒤·대신 올린 항목은 따로 세고 판정에는 넣지 않는다. 앱 알림은 24시간 안에만 가므로 판정 숫자에 영향을 주지 않는다. 모든 팀의 첫 중간 마감이 지나야 확정된다.

## 배포 (처음 한 번)

### 1. Supabase
1. supabase.com에서 새 프로젝트를 만든다 (리전: Northeast Asia (Seoul)).
2. **SQL Editor**에 `supabase/migrations/` 안의 파일을 파일명 순서대로 전체 붙여 넣고 실행한다. 테이블 9개, 5분 알림 예약 작업, 비공개 버킷 `submissions`가 생긴다.
   - CLI를 쓰면: `npx supabase link --project-ref <ref>` 후 `npx supabase db push`
3. **Project Settings → API**에서 URL, anon(publishable) 키, service_role(secret) 키를 확인한다.

### 2. Vercel
1. 이 `web` 폴더를 GitHub 저장소로 올린다.
2. vercel.com에서 **Add New → Project**로 저장소를 가져온다. 저장소 루트가 `web`이 아니면 Root Directory를 `web`으로 지정한다.
3. **Environment Variables**에 `.env.example`의 값을 모두 넣는다.
   - `SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_`을 붙이지 않는다.
   - `ADMIN_PASSWORD`는 팀원끼리만 공유한다.
4. 알림 예약 작업이 앱을 부를 주소와 비밀 값을 Supabase **SQL Editor**에서 Vault에 넣는다(저장소에 올리지 않는다):
   ```sql
   select vault.create_secret('https://<도메인>/api/cron/remind', 'boim_cron_url');
   select vault.create_secret('<CRON_SECRET과 같은 값>', 'boim_cron_secret');
   ```
5. Deploy. 나온 주소에서 가입하고 팀을 만들어 초대 링크까지 확인한다.

### 3. 테스트 전 확인
- 팀 링크를 시크릿 창과 로그아웃한 폰에서 열어 본다.
- 파일 하나를 올려 보고 `/admin`에서 통과시켜 본다. 확인 후 그 업무는 지워도 된다(Supabase Table Editor).

## 소셜 로그인 붙이기 (카카오·구글)

코드는 준비돼 있다. 아래만 하면 로그인 화면에 버튼이 생긴다.

1. **카카오:** developers.kakao.com에서 앱을 만들고 REST API 키·Client Secret을 받는다. Redirect URI에 `https://<supabase 프로젝트>.supabase.co/auth/v1/callback`을 넣는다.
   **구글:** Google Cloud Console에서 OAuth 클라이언트(웹)를 만들고 같은 Redirect URI를 넣는다.
2. Supabase **Authentication → Sign In / Providers**에서 Kakao·Google을 켜고 키를 넣는다.
3. Vercel 환경 변수 `NEXT_PUBLIC_AUTH_PROVIDERS=kakao,google`(켠 것만)을 넣고 다시 배포한다.

로그인 뒤 돌아오는 주소(`/auth/callback`)는 Supabase **URL Configuration**의 Redirect URLs(`https://boim-ten.vercel.app/**`)에 이미 등록돼 있다. 초대 링크로 들어와 소셜 로그인해도 그 팀에 바로 참여된다.

## 로그인 설정 (Supabase)

`supabase/config.toml`의 `[auth]`를 `npx supabase config push`로 운영에 반영한다. 지금 값: 이메일 인증 끔(가입 즉시 로그인), 사이트 주소 `https://boim-ten.vercel.app`. 반영 전에 `npx supabase config diff`로 바뀌는 항목만 확인한다.

## 로컬 개발

Docker Desktop이 켜져 있어야 한다.

```bash
npx supabase start      # 로컬 DB·스토리지 (처음엔 이미지 내려받느라 오래 걸림)
npm run dev
```

`npx supabase start`가 출력하는 URL·키로 `.env.local`을 만든다(`.env.example` 참고). 가입하고 팀을 만들어 테스트한다. 끝나면 `npx supabase stop --no-backup`.

## 스키마 바꾸기

`npx supabase migration new <name>`으로 `supabase/migrations/`에 파일을 만들고 `npx supabase db push`로 운영 DB에 반영한다. 새 테이블에는 생성 마이그레이션에서 필요한 역할의 GRANT를 명시한다.

Data API 권한 적용과 신규 환경 검증은 [검증 안내](docs/data-api-grants.md)를 따른다. 로컬은 `auto_expose_new_tables = false`로 자동 권한에 의존하지 않는다.

## 이번에 만들지 않은 것

자동 검수(AI 판별) · 외부 연동 · 결제. 가정을 확인하는 데 필요 없거나 사람이 대신할 수 있다.

## 나중에 앱으로 확장할 때

계정은 Supabase Auth라 모바일 앱(React Native 등)에서 같은 계정으로 로그인할 수 있다. 지금은 서버만 DB에 접근하므로(RLS 켜고 정책 없음), 앱이 DB를 직접 읽게 하려면 `members.user_id = auth.uid()` 기준의 RLS 정책과 필요한 역할의 테이블 GRANT를 함께 추가한다.

## 코드 구조

화면·서비스·Repository의 책임과 테스트·DB 배포 순서는 [3계층 구조 안내](docs/architecture.md)를 따른다. 신규 RPC 마이그레이션은 앱 코드 배포 전에 적용한다.
