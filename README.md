# olaf-ask — 질문 접수

로그인 없이 **소속·성명·직급·질문**만 받고, 사무국이 **제출 현황**을 보며 **질문 카드를 전체 화면으로 공유**한다.
Cloudflare Workers(정적 화면 포함) + D1(무료) · 런타임 의존성 0 · 빌드 단계 없음.

| 주소 | 용도 |
|---|---|
| `/` | 참여자 제출 폼 (로그인 없음) — **질문 대상 교수 4명 버튼 선택**: 오전 조성인·남창주 / 오후 송성혁·정석환 |
| `/admin` | 사무국 — 제출 현황 · **대상자 32명 질문 여부(교수별 ✓/미제출)** · 교수 탭 · 카드 목록 · 전체 화면 공유(`←`/`→` 이동 · `Esc` 닫기 · `A` 작성자 가리기) · 숨김 |

규칙: 사번·이메일·전화번호가 들어간 입력은 거부 · 같은 성명·본문은 한 건 · 접속자(해시)당 10분에 10건 · 본문 불변(DB 트리거) · 삭제 = 숨김 · 순위·점수 없음(접수순 고정).
사무국 화면은 환경변수 `ADMIN_KEY` 하나로만 막는다(미설정이면 닫힘 503). 보안 기능은 이 정도가 전부다.

## 배포 (브라우저만 · 터미널 불필요)

Cloudflare 가 이 리포를 **Workers**로 빌드한다(`npx wrangler deploy`). Worker 하나가 정적 화면(`public/`)과 API 를 함께 제공한다.

1. Cloudflare 대시보드 → **Workers & Pages → Create → Import a repository** → `olaf_ask` 선택.
   빌드 설정은 기본값 그대로(Build command 비움 · Deploy command `npx wrangler deploy`).
2. 첫 배포가 끝나면 **D1 `olaf-ask` 가 자동으로 만들어지고**(`wrangler.toml`의 `database_id`를 비워 둔 자동 프로비저닝), 표는 **첫 요청 때 앱이 스스로 만든다** — 따로 실행할 SQL 없음.
3. 프로젝트 → **Settings → Variables and Secrets → Add** → 이름 `ADMIN_KEY` · 종류 **Secret** · 값 = 사무국이 쓸 키 → 저장(자동 재배포).
4. `https://olaf-ask.<계정>.workers.dev/` 가 제출 폼, `/admin` 이 사무국 화면.

> 자동 프로비저닝이 안 되면(배포 로그에 D1 오류): 대시보드 → Storage & Databases → D1 → Create `olaf-ask` → 나온 ID 를 `wrangler.toml` 의 `[[d1_databases]]` 아래 `database_id = "…"` 로 넣어 커밋.
> 이후 코드를 고치면 `main` 에 푸시할 때마다 자동 재배포된다.

## 로컬 개발·테스트

```bash
npm test      # node:test · D1 을 node:sqlite 로 흉내 내 실제 표·트리거까지 검증
npm run dev   # wrangler dev (ADMIN_KEY=dev-key, 로컬 D1 자동 생성)
```

## 구조

```
public/          정적 화면 (index.html·admin.html·js·css)
src/worker.js    진입점 — API 라우팅, 그 외는 assets 로
src/handlers/    intake.js(제출) · admin-list.js(현황·목록) · admin-patch.js(숨김)
src/rules.js     검사 규칙(순수 함수) · src/http.js 응답·사무국 키 · src/schema.js 표 정의(멱등)
test/            단위 + 핸들러 + Worker 테스트
```

## 알아둘 점

- 인터넷에 열린 공개 폼이다. 타인 이름으로 제출할 수 있고, 미제출자는 파악할 수 없다. 접수가 끝나면 Worker 를 삭제하거나 폼을 닫는다(수정·마감 스위치는 만들지 않았다).
- 데이터는 Cloudflare D1에 저장된다 — 사내 서버가 아니다. 내보내기: `npx wrangler d1 export olaf-ask --remote --output backup.sql`
- 무료 한도(Workers·D1)는 이 용도에 충분하나 정책이 바뀔 수 있으니 대시보드에서 확인.

## 대상자 명단

`src/roster.js` 가 대상자 명단(성명·소속·직급만, 사번·이메일 제외)이다. 제출의 성명(공백 무시)과 맞춰 사무국 화면에 질문 여부를 표시한다. 명단을 바꾸려면 이 파일을 고쳐 푸시한다. 기존 DB 는 첫 요청 때 `professor` 칸이 자동 추가되며, 그 이전 접수는 '교수 미지정'으로 남는다. 교수 목록은 `src/rules.js` 의 `PROFESSORS` 와 `public/` 화면 두 곳에 있다.
