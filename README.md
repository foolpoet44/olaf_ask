# olaf-ask — 질문 접수

로그인 없이 **소속·성명·직급·질문**만 받고, 사무국이 **제출 현황**을 보며 **질문 카드를 전체 화면으로 공유**한다.
Cloudflare Pages + D1(무료) · 런타임 의존성 0 · 빌드 단계 없음.

| 주소 | 용도 |
|---|---|
| `/` | 참여자 제출 폼 (로그인 없음) |
| `/admin` | 사무국 — 제출 현황 · 카드 목록 · 전체 화면 공유(`←`/`→` 이동 · `Esc` 닫기 · `A` 작성자 가리기) · 숨김 |

규칙: 사번·이메일·전화번호가 들어간 입력은 거부 · 같은 성명·본문은 한 건 · 접속자(해시)당 10분에 10건 · 본문 불변(DB 트리거) · 삭제 = 숨김 · 순위·점수 없음(접수순 고정).
사무국 화면은 환경변수 `ADMIN_KEY` 하나로만 막는다(미설정이면 닫힘 503). 보안 기능은 이 정도가 전부다.

## 배포 (한 번만, 약 10분)

1. **D1 만들기** (로컬 터미널, Node 20+)
   ```bash
   npx wrangler login
   npx wrangler d1 create olaf-ask
   ```
   출력된 `database_id`를 `wrangler.toml`의 `REPLACE_WITH_DATABASE_ID` 자리에 넣고 커밋한다.
2. **표 만들기**
   ```bash
   npm run db:remote
   ```
3. **Pages 연결** — Cloudflare 대시보드 → Workers & Pages → Create → Pages → *Connect to Git* → 이 리포 선택.
   Build command 비움 · Build output directory `public`.
4. **설정** (Pages 프로젝트 → Settings)
   - Bindings → D1 database: 변수명 `DB` = `olaf-ask`
   - Variables and Secrets → `ADMIN_KEY` (Secret) = 사무국이 쓸 키
5. 다시 배포(Deployments → Retry)하면 `https://<프로젝트>.pages.dev/` 가 열린다. 사무국은 `/admin` 에서 키를 입력한다.

## 로컬 개발·테스트

```bash
npm test            # node:test · D1 을 node:sqlite 로 흉내 내 실제 마이그레이션 SQL·트리거까지 검증
npm run db:local    # 로컬 D1 에 표 만들기
npm run dev         # wrangler pages dev (ADMIN_KEY=dev-key)
```

## 구조

```
public/            정적 화면 (index.html·admin.html·js·css)
functions/api/     Pages Functions: intake.js(제출) · admin/intake/index.js(현황·목록) · admin/intake/[id].js(숨김)
src/               rules.js(검사·순수 함수) · http.js(응답·사무국 키)
migrations/        D1 표 (0001_init.sql)
test/              단위 + 핸들러 테스트
```

## 알아둘 점

- 인터넷에 열린 공개 폼이다. 타인 이름으로 제출할 수 있고, 미제출자는 파악할 수 없다. 접수가 끝나면 Pages 프로젝트를 내리거나 폼을 닫는다(수정·마감 스위치는 만들지 않았다).
- 데이터는 Cloudflare D1에 저장된다 — 사내 서버가 아니다. 내보내기: `npx wrangler d1 export olaf-ask --remote --output backup.sql`
- 무료 한도(Pages Functions·D1)는 이 용도에 충분하나 정책이 바뀔 수 있으니 대시보드에서 확인.
