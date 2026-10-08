# 보임 (BOIM) 웹앱 — 4조 MVP

묻지 않아도 어디까지 됐는지 보이는 팀플 보드. Next.js(App Router) + Supabase, Vercel 배포.

확인할 가정: “완료”를 기준에 맞는 파일을 올려야만 바뀌게 하면, 담당자가 묻거나 재촉하지 않아도 직접 올린다.
판정: 본인 첨부율 60% 이상 개발 착수 · 30% 미만 설계 전환.

## 화면

| 주소 | 누가 | 하는 일 |
|---|---|---|
| `/t/{팀 토큰}` | 테스트 팀원 | 팀 업무 보드. 처음 한 번 “내 번호(U01)”를 고른다 |
| `/t/{팀 토큰}/task/{번호}` | 테스트 팀원 | 완료 기준 확인, 파일·링크 올리기, 올린 기록 |
| `/t/{팀 토큰}/new` | 팀장 | 업무·담당·중간 마감·완료 기준 등록 |
| `/admin` | 우리 팀(운영) | 본인 첨부율·판정, 검수(통과/반려), 팀 만들기와 팀 링크 |

로그인은 없다. 팀 링크의 토큰을 아는 사람만 그 팀에 들어온다. 실명은 저장하지 않고 T1·U01 같은 식별자만 쓴다.

## 사람이 하는 일 (오즈의 마법사)

- **검수:** `/admin`에서 올라온 결과물이 완료 기준에 맞는지 보고 통과/반려. 반려 이유는 담당자 화면에 보인다.
- **본인/대신:** 자동으로 기록된다(올린 사람 번호 ≠ 담당 번호면 “대신”). 팀원이 번호를 잘못 골랐을 수 있으니 이상하면 팀장에게 확인한다.
- **마감 하루 전:** `/admin`의 “오늘 알림 보낼 업무”에 뜬 담당자에게만 카톡 1:1로 한 번 안내하고 **DM 보냄**을 누른다. 재촉하지 않는다.

판정(워크북 3쪽): 각 팀의 **첫 중간 마감 항목 전체** 중 **DM 보내기 전에** 담당 본인이 올려 통과한 항목의 비율. 알림 뒤·마감 뒤·대신 올린 항목은 따로 세고 판정에는 넣지 않는다. 모든 팀의 첫 중간 마감이 지나야 확정된다.

## 배포 (처음 한 번)

### 1. Supabase
1. supabase.com에서 새 프로젝트를 만든다 (리전: Northeast Asia (Seoul)).
2. **SQL Editor**에 `supabase/migrations/` 안의 파일을 번호 순서대로(`0001` → `0002`) 붙여 넣고 실행한다. 테이블 5개와 비공개 버킷 `submissions`가 생긴다.
   - CLI를 쓰면: `npx supabase link --project-ref <ref>` 후 `npx supabase db push`
3. **Project Settings → API**에서 URL, anon(publishable) 키, service_role(secret) 키를 확인한다.

### 2. Vercel
1. 이 `web` 폴더를 GitHub 저장소로 올린다.
2. vercel.com에서 **Add New → Project**로 저장소를 가져온다. 저장소 루트가 `web`이 아니면 Root Directory를 `web`으로 지정한다.
3. **Environment Variables**에 `.env.example`의 다섯 값을 넣는다.
   - `SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_`을 붙이지 않는다.
   - `ADMIN_PASSWORD`는 팀원끼리만 공유한다.
4. Deploy. 나온 주소(`https://xxx.vercel.app`)로 `/admin`에 들어가 테스트 팀을 만든다. 팀 링크가 화면에 나온다.

### 3. 테스트 전 확인
- 팀 링크를 시크릿 창과 로그아웃한 폰에서 열어 본다.
- 파일 하나를 올려 보고 `/admin`에서 통과시켜 본다. 확인 후 그 업무는 지워도 된다(Supabase Table Editor).

## 로컬 개발

Docker Desktop이 켜져 있어야 한다.

```bash
npx supabase start      # 로컬 DB·스토리지 (처음엔 이미지 내려받느라 오래 걸림)
npm run dev
```

`npx supabase start`가 출력하는 URL·키로 `.env.local`을 만든다(`.env.example` 참고). 테스트 팀은 `/admin`에서 만든다. 끝나면 `npx supabase stop --no-backup`.

## 스키마 바꾸기

`supabase/migrations/`에 다음 번호 파일을 추가하고 `npx supabase db push`로 운영 DB에 반영한다.

## 이번에 만들지 않은 것

로그인 · 자동 검수(AI 판별) · 푸시 알림 · 외부 연동 · 결제. 가정을 확인하는 데 필요 없거나 사람이 대신할 수 있다. 수요가 확인되면(첨부율 60% 이상) 로그인과 알림부터 붙인다.

## 나중에 앱으로 확장할 때

화면은 서버 컴포넌트 + 서버 액션이라 DB 구조(`teams · members · tasks · submissions · views`)를 그대로 두고 모바일 앱(React Native 등)에서는 Supabase Auth + RLS 정책을 추가해 같은 DB를 쓰면 된다.
