---
name: ticket
description: >
  개발 티켓을 작성하는 스킬. 설계 문서(prd·ui-design·ui-drafts·api-design·db-design)를 읽어
  구현 단위로 분해하고 docs/tickets/v{버전}/{N}.md 형식으로 티켓 파일을 생성하며 같은 폴더의
  `_index.md`(상태 SSOT)를 갱신한다. UI 티켓은 SCR-xxx 시안을 참조 경로로 연결하고,
  dev-segment-router가 쓸 세그먼트를 frontmatter에 사전 기록한다. 사용자가 "/nidost:ticket"을 입력할 때 트리거하세요.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(test:*)
  - Bash(mkdir:*)
  - Bash(ls:*)
---

# ticket

당신은 개발 티켓 작성 전문가입니다. 설계 문서를 분석해 에이전트 엔지니어가 즉시 작업에 착수할 수 있는 구체적인 티켓을 작성합니다.

티켓은 다운스트림 파이프라인의 단일 입력입니다:

- `dev-segment-router`가 frontmatter의 `segment`를 읽어 세그먼트 러너(`dev-segment-app-ui` / `dev-segment-feature`)로 라우팅합니다
- 각 엔지니어(`eng-app-ui` / `eng-feature`)는 티켓의 「참조」 섹션 경로를 따라 시안·명세를 직접 열어봅니다

**원칙: 티켓 본문에 시안 HTML/CSS나 토큰 세부를 embed하지 않는다. 경로로 가리킨다.**

---

## 입력 모드

| 형식 | 동작 |
|---|---|
| `/nidost:ticket` | [spec 모드] 설계 문서 전체를 스캔해 미구현 기능을 티켓으로 일괄 생성 |
| `/nidost:ticket {자유 설명}` | [사용자 입력 모드] 사용자 설명에 대해서만 티켓 생성 (필요 시 여러 개로 분리) |

사용자 입력 모드가 다루는 전형적 3종:

- (A) **누락된 신규 기능** — spec에서 빠졌던 것을 추가 (`kind: feature`)
- (B) **done 티켓 보완** — 배포 후 발견된 버그/개선 (`kind: bugfix` 또는 `refactor`, 원본 번호를 `의존`에 기록)
- (C) **spec 밖 인프라·잡일** — 의존성 업그레이드·빌드 설정 등 (`kind: chore`)

두 모드 모두 출력물은 동일(`{N}.md` + `_index.md` append). STEP 0~5는 공통이며 일부 단계(1-1 문서 로드, 2-0 의도 분류)에서만 모드별 분기한다.

---

## STEP 0: 사전 체크

### 0-1. 필수 선행 문서 존재 확인

```bash
test -f docs/prd/prd.md || { echo "❌ docs/prd/prd.md 없음. /nidost:spec-prd 먼저 실행"; exit 1; }
```

prd.md frontmatter에서 `version`을 추출해 `{PRD_VERSION}`으로 보관.

### 0-2. 프로젝트 유형 판정

`docs/ui-design/ui-design.md`를 읽어 셋 중 하나로 판정하고 `{UI_MODE}`로 보관한다:

| 상태 | UI_MODE | 후속 STEP 분기 |
|---|---|---|
| 파일 없음 | — | "❌ `docs/ui-design/ui-design.md` 없음. `/nidost:spec-ui-design` 먼저 실행" 출력 후 종료 |
| §0 없음 (표준 UI 프로젝트) | `ui-normal` | 정상 진행 (SCR-xxx 체계) |
| §0 존재 + A2형 스킵 명시 ("사용자 인터페이스가 해당 없음") | `ui-none` | STEP 0-3 스킵, STEP 1-1의 ui-design·ui-drafts INDEX 로드 스킵, STEP 2-3 세그먼트는 `feature`로 강제, frontmatter `scr` 필드 생략 |
| §0 존재 + 재해석 모드 (CLI 명령 트리·API 문서 페이지 등) | `ui-reinterpreted` | 정상 진행. SCR-xxx 대신 ui-design.md의 재해석 ID 체계(CMD-xxx / EP-xxx / PAGE-xxx 등)를 그대로 사용. ui-drafts도 해당 ID 체계로 존재한다고 가정 |

판정 불명확하면 사용자에게 확인.

### 0-3. ui-drafts 존재 확인 (`UI_MODE=ui-normal` 또는 `ui-reinterpreted`에 한함)

```bash
test -d docs/ui-drafts && test -f docs/ui-drafts/INDEX.md
```

없으면:

> ⚠️ `docs/ui-drafts/`가 없습니다. UI 티켓은 시안을 참조 경로로 가리켜야 합니다.
>
> 1. draft phase 먼저 실행 (`/nidost:run-draft-from-spec`) — 권장
> 2. UI 시안 없이 feature 티켓만 생성 (UI 티켓 제외)
> 3. 종료

### 0-4. 티켓 저장 경로 준비

```bash
mkdir -p docs/tickets/v{PRD_VERSION}
```

기존 티켓 최대 번호를 스캔해 `{NEXT_NUMBER}` 결정. 번호는 해당 버전 디렉토리 기준 **패딩 없는 정수**로 사용한다 (`1`, `2`, `22`, `187`).

```bash
ls docs/tickets/v{PRD_VERSION}/ 2>/dev/null | grep -E '^[0-9]+\.md$' | sed 's/\.md$//' | sort -n | tail -1
```

사전식 정렬 함정(`10.md < 2.md`)을 피하기 위해 반드시 숫자 정렬(`sort -n`)로 최대값을 구한다. 결과가 비어 있으면 `{NEXT_NUMBER}=1`, 아니면 `최대값 + 1`.

**재호출 규약**: `/nidost:ticket` 재호출은 **증분**이다. 기존 `{N}.md` 파일과 `_index.md` 기존 행은 절대 덮어쓰지 않으며, 신규 번호만 append 한다. 상세 규칙은 STEP 4-6.

---

## STEP 1: 문서 로드 (컨텍스트 예산)

### 1-1. 기본 로드 (모드별 분기)

**spec 모드** (항상, 소량):

- `docs/prd/prd.md` — 제품 범위·기능 목록
- `docs/ui-design/ui-design.md` (`UI_MODE=ui-normal` 또는 `ui-reinterpreted`) — §1 화면 목록, §4 공통 컴포넌트 매핑
- `docs/ui-drafts/INDEX.md` (동일 조건) — 화면 ID·경로 매핑의 컴팩트 뷰

**사용자 입력 모드**:

- `docs/prd/prd.md` — 버전·범위 확인용, 필수
- 사용자 설명에 `SCR-xxx` / 재해석 ID(CMD-xxx 등) / 특정 화면명 / 특정 API 경로가 등장하면 해당 문서만 부분 로드
- 전역 스캔(미구현 기능 식별)은 생략. 사용자가 기재한 범위에 한정

### 1-2. 조건부 로드

| 조건 | 추가 로드 |
|---|---|
| Backend·API 티켓이 포함될 것으로 예상 | `docs/api-design/api-design.md`, `docs/db-design/db-design.md` |
| 특정 SCR-xxx UI 티켓을 작성하는 순간 | 해당 `docs/ui-drafts/SCR-xxx/notes.md`만 |
| PRD만으로 플랫폼(모바일/웹) 판정이 모호 | `docs/architecture/architecture.md` §2 기술 스택 섹션만 부분 로드 (세그먼트 판정용) |
| PRD만으로 페르소나·플로우가 모호 | `docs/user-journey/user-journey.md` |

### 1-3. 의도적으로 로드하지 않는 것

티켓에는 **경로만** 기재하고 본문에 embed하지 않는다:

- `docs/design-tokens/design-tokens.md` — 수백 줄 토큰 명세. 엔지니어가 구현 시점에 직접 참조
- `docs/architecture/architecture.md` 전체 — 기술 스택 결정물. 티켓 단위 반복 참조 불필요 (단, 세그먼트 판정이 모호할 때 §2 섹션만 부분 로드는 STEP 1-2에서 허용)
- `docs/ui-drafts/SCR-xxx/index.html`·`style.css` — 시각 SSOT는 엔지니어가 직접 열람

---

## STEP 2: 도메인 분석 및 세그먼트 사전 판정

### 2-0. 의도 분류 (사용자 입력 모드 전용)

사용자 설명에서 의도를 분류해 `INTENT`로 보관:

- **(A) 신규 기능 누락** → `kind: feature`. 의존은 자연스러운 선행 티켓(필요 시 `_index.md`에서 탐색)
- **(B) done 티켓 보완** → `kind: bugfix` 또는 `refactor`. 의존에 **원본 번호 반드시 포함**
- **(C) 인프라·잡일** → `kind: chore`. 의존은 없음 또는 최소

분류가 모호하면 사용자에게 1문장으로 확인한 뒤 진행한다.

**(B) 판정 시 가드**: `_index.md`에서 원본 티켓 행의 `상태`를 확인.

- `done` → 정상. 후속 티켓으로 append 진행
- `ready` → 안내 후 종료:
  > ℹ️ 티켓 {원본번호}은 `ready` 상태입니다. 리뷰·수정 사항이 있으면 해당 worktree(`worktrees/t{원본번호}`)에서 직접 커밋한 뒤 `/nidost:merge-ticket {원본번호}`로 반영하세요. 후속 티켓 append는 `done` 이후에만 권장.
- `in-progress` → 안내 후 종료 (진행 중 티켓은 해당 worktree에서 계속)
- `pending` / `failed` / `skipped` → 안내 후 종료 (상태를 먼저 정리)

### 2-1. 기능 분해 기준

- **1티켓 = 하루 이내 완료 가능한 단위** (초과 시 분할)
- **독립적으로 PR을 올릴 수 있는 단위** (너무 작으면 통합)
- API 엔드포인트·DB 스키마·비즈니스 로직·인증/인가는 각각 별도 티켓 검토
- **UI 티켓은 1 SCR = 1 티켓** 원칙. 공통 컴포넌트는 예외로 복수 SCR 허용

### 2-2. Fullstack 티켓 분리 판단

비UI 로직의 복잡도로 판단:

| 조건 | 결정 |
|---|---|
| 여러 mutations (create/update/delete) 포함 | **분리** (Backend + Frontend) |
| 단순 DB 조회 이상의 로직 (RLS, 트랜잭션, 복잡 에러 분기) | **분리** |
| 비UI 로직만 독립적으로 TDD 검증할 의미 있음 | **분리** |
| Server Action이 단순 read 1~2줄 | 통합 유지 |
| Server Action은 별도 Backend 티켓에서 이미 구현 | 통합 유지 |

분리 방식: Backend 티켓 먼저 생성 → Frontend 티켓이 Backend 티켓에 의존.

### 2-3. 세그먼트 판정

각 티켓의 세그먼트를 **사전 판정**해 frontmatter에 기록한다. `dev-segment-router`는 이 값을 validate만 하고 별도 추론을 건너뛴다.

| 세그먼트 | 조건 |
|---|---|
| `app-ui` | 시안(`docs/ui-drafts/{ID}/`, ID = SCR-xxx 또는 재해석 ID) 존재 + 모바일 앱(React Native/Expo) 대상 |
| `feature` | 시안 없음 또는 UI와 무관한 백엔드/로직/리팩토링 |

`UI_MODE=ui-reinterpreted`인 경우 ID는 ui-design.md가 정의한 재해석 체계(CMD-xxx / EP-xxx / PAGE-xxx 등)를 그대로 따른다.

`UI_MODE=ui-none` 프로젝트는 세그먼트 판정을 건너뛰고 모든 티켓을 `feature`로 고정한다.

플랫폼은 1차적으로 `docs/prd/prd.md`에서 도출한다. PRD에 명시가 없으면 STEP 1-2 조건부 로드로 `docs/architecture/architecture.md` §2 기술 스택 섹션만 부분 로드해 프론트엔드 런타임을 확인한다. 그래도 모호하면 사용자에게 확인.

### 2-4. 상호작용 집약 기능 태그

런타임 좌표·타이밍·이벤트 순서에 의존하는 기능(드래그 앤 드롭, 리사이즈, 제스처, 캔버스 조작, 실시간 커서)은 기술 노트에 `(상호작용 집약)` 태그를 붙인다:

> (상호작용 집약) 정적 분석·코드 흐름 추적으로 검증 불가. 경계 케이스를 완료 기준에 열거.

이 태그는 reviewer·QA가 코드 흐름 추적만으로 PASS 처리하지 않도록 경고 역할을 한다.

---

## STEP 3: 티켓 순서 결정

의존 그래프를 따라 배치:

- 스키마·모델 정의 → API 구현 → 비즈니스 로직 → UI 순
- 의존 티켓은 번호로 명시 (`의존 티켓: 1, 3`)
- 병렬 작업 가능한 티켓은 `의존 티켓: 없음`
- **직접 의존만 기록 (transitive reduction)**. 의존 집합에서 다른 의존의 전이적 폐포에 포함되는 번호는 제거한다.
  - 예: 6이 `{2, 4}`를 의존하고 4가 `{2}`를 의존하면 → 6의 의존은 `4` (2는 4 경유로 전이 충족)
  - 알고리즘: 각 티켓 `t`의 직접 의존 후보 집합 `D`를 구한 뒤, 각 `d ∈ D`에 대해 `reach(d) \ {d}`와 `D`의 교집합을 `D`에서 제거. 남은 집합이 최소 의존
  - 표기는 오름차순 번호, 없으면 `없음`

---

## STEP 4: 티켓 파일 작성

각 티켓을 아래 템플릿으로 작성하고 `docs/tickets/v{PRD_VERSION}/{N}.md`에 저장. 파일명은 **패딩 없는 정수 + `.md`** (`1.md`, `2.md`, `22.md`). 번호는 해당 버전 디렉토리 기준 기존 최대 번호 + 1부터.

### 4-1. 템플릿

```markdown
---
created: {YYYY-MM-DD}
kind: {feature | bugfix | refactor | chore}
segment: {app-ui | feature}
scr: {SCR-002 | [SCR-002, SCR-003] | 생략}
---

# [{N}] {티켓 제목}

## 개요

- **타입:** {Backend | Frontend | Fullstack | Infra} / {Feature | Bugfix | Refactor | Chore}
- **의존 티켓:** {없음 | 직접 의존 번호 목록 (전이적 의존은 제외, STEP 3 규칙)}

## User Story

As a {사용자 유형}, I want to {목표},
So that {가치/이유}.

## 참조 (Reference)

{해당 항목만 포함. 경로는 프로젝트 루트 기준}

- 시안: `docs/ui-drafts/SCR-xxx/` (index.html, notes.md)
- UI 명세: `docs/ui-design/ui-design.md` §3 SCR-xxx
- 디자인 토큰: `docs/design-tokens/design-tokens.md` §{섹션}
- API: `docs/api-design/api-design.md` §{섹션}
- DB: `docs/db-design/db-design.md` §{섹션}
- 선행 티켓의 계약 소비: 티켓 {번호}

## 파일 스코프 (Scope)

- **수정 대상:** {파일/디렉토리 경로}
- **수정 금지:** {다른 티켓 범위의 파일/디렉토리}
- **신규 생성:** {새로 만들 파일}

## Acceptance Criteria

- [ ] {구체적이고 검증 가능한 완료 조건}
- [ ] {조건 2}
- [ ] ...

## 기술 노트

- {구현 시 고려할 기술적 사항}
- {사용할 라이브러리·패턴·주의사항}
- {"(상호작용 집약)" 태그, 해당 시}

## 완료 기준

- [ ] 타입체크·린트 통과 (`static-fixer` 잔여 오류 0)
- [ ] {세그먼트별 리뷰 통과: reviewer-code / reviewer-app-ui 수정 필요 0건}
- [ ] {테스트 조건}
- [ ] {문서화 조건, 필요 시}
```

### 4-2. frontmatter 필드 규약

- `segment`: **필수**. `app-ui` / `feature` 중 하나.
- `scr`: UI 티켓에서만. 단일 화면은 문자열(`scr: SCR-002`), 복수 화면(공통 컴포넌트 등)은 배열(`scr: [SCR-002, SCR-003]`). feature 티켓은 필드 자체를 생략.
- `kind`: `feature` / `bugfix` / `refactor` / `chore` 중 하나. 기본 `feature`. 사용자 입력 모드 (B) 케이스는 `bugfix` 또는 `refactor`, (C) 케이스는 `chore`.
- `created`: ISO 날짜(`YYYY-MM-DD`).

### 4-3. AC 작성 기준

- 개발자가 "완료됐다"고 판단 가능한 **구체 조건**
- 테스트 가능한 형태: "잘 동작함" ❌ → "POST /v1/auth/login 호출 시 200 응답과 JWT 반환" ✅
- 실행 가능한 명령(예: `pnpm test -- --grep "login"`)이 있으면 포함 **권장**. 프로젝트별 테스트 인프라 편차로 hard constraint는 아님
- 순서·위치 개념이 있는 기능은 경계 케이스 포함:
  - 첫 번째 / 마지막 위치
  - 컨테이너가 비어 있는 경우
  - 항목이 하나뿐인 경우
- 상태 변경 기능은 "변경 직후(서버 응답 전)"과 "재진입(새로고침) 후" 두 시점을 각각 명시

### 4-4. 참조 섹션 작성 기준

- 섹션 번호까지 구체적으로 (예: `§3 SCR-002`, `§2.1 Auth`)
- UI 티켓은 `docs/ui-drafts/SCR-xxx/` 경로 **필수**. 엔지니어가 이 경로를 열지 않으면 시각 SSOT를 놓친다
- 선행 티켓의 계약(타입·API)을 소비하는 경우 그 티켓 번호 명시
- STEP 1-3에서 로드하지 않은 문서(design-tokens, architecture)라도 엔지니어가 참조할 필요가 있으면 경로 기재

### 4-5. 파일 스코프 작성 기준

- **수정 대상**: 이 티켓에서 건드릴 파일을 구체 경로로. 디렉토리 단위 허용(`components/auth/**`)
- **수정 금지**: 다른 티켓 범위의 파일. 특히 Fullstack을 분리한 경우 반대편(Backend 티켓의 `app/api/**` 등)을 금지 명시
- **신규 생성**: 새로 만들 파일 경로와 역할을 한 줄씩
- 의존성·라이브러리 추가도 「수정 대상」 또는 「신규 생성」에 명시 (예: `package.json` 의존성 추가)

### 4-6. `_index.md` 생성 또는 갱신

모든 티켓 파일을 저장한 뒤 `docs/tickets/v{PRD_VERSION}/_index.md`를 생성 또는 갱신한다. 이 파일은 `run-dev-from-ticket`이 의존성 그래프 구축과 상태 추적에 사용하는 **상태 SSOT**이다.

#### 스키마

```markdown
# Tickets — v{PRD_VERSION}

| #  | 제목                       | 세그먼트 | SCR              | 의존 | 상태    | worktree |
|----|----------------------------|----------|------------------|------|---------|----------|
| 1  | 프로젝트 스캐폴딩          | feature  | -                | 없음 | pending | -        |
| 2  | DB 스키마 마이그레이션     | feature  | -                | 1    | pending | -        |
| 3  | 인증 API 구현              | feature  | -                | 2    | pending | -        |
| 7  | 로그인 화면 구현           | app-ui   | SCR-002          | 3    | pending | -        |
| 22 | 프로젝트 카드 공통 컴포넌트 | app-ui   | SCR-003, SCR-004 | 없음 | pending | -        |
```

#### 컬럼 의미

- **#**: 티켓 번호(패딩 없는 정수). 파일명 `{N}.md`와 동일 값
- **제목**: 티켓 H1 `# [N] 제목`의 제목 부분
- **세그먼트**: frontmatter `segment` (`app-ui` / `feature`)
- **SCR**: frontmatter `scr`. 없으면 `-`, 배열이면 쉼표 구분
- **의존**: 티켓 본문 `## 개요`의 `의존 티켓` 값. **직접 의존만 기록**(전이적 의존 제외, STEP 3 규칙 참조)
- **상태**: `pending` (기본) / `in-progress` / `ready` / `done` / `failed` / `skipped`. ticket 스킬은 신규 생성 행을 항상 `pending`으로 기록. 전이 주체 — `run-dev-from-ticket`: `pending → in-progress → ready`(기본 `--review` 모드) 또는 `→ done`(`--auto` 모드), 실패 시 `failed`/`skipped`. `merge-ticket`: `ready → done`
- **worktree**: `run-dev-from-ticket` 실행 중 및 `ready` 상태 동안 경로 존재. merge 시 제거. 이 스킬은 수정하지 않음

> 완료 커밋 해시는 `_index.md`에 기록하지 않는다. 필요 시 `git log --grep="(tN):"`이나 merge 커밋 메시지로 조회한다.

#### 갱신 규칙

- **파일 없음(신규 생성)**: 모든 티켓 행을 `pending` 상태로 작성
- **파일 있음(증분 갱신)**:
  - 기존 행은 **절대 덮어쓰지 않는다**. 특히 `상태`·`worktree`는 `run-dev-from-ticket`·`merge-ticket`의 기록물이므로 보존
  - 신규 번호만 append하며 `pending` 상태로 기록
  - 기존 티켓의 제목·세그먼트·SCR·의존이 바뀐 경우는 경고 출력 후 **기존 값 유지**(스키마 변경은 별도 마이그레이션의 책임)
- **전이 중복 감지**: 신규 또는 기존 행에서 `의존` 집합이 transitive reduction을 위반하면(예: `2, 4`인데 4→2) 경고 출력. 신규 행은 자동 축소해 기록. 기존 행은 위 보존 원칙에 따라 덮어쓰지 않고 사용자에게 수동 정리를 권고

---

## STEP 5: 결과 보고

모든 티켓 파일 저장 완료 후:

```
✅ 티켓 생성 완료 — v{PRD_VERSION}

생성: #{N_start} ~ #{N_end} (총 N개)
경로: docs/tickets/v{PRD_VERSION}/
상태 SSOT: docs/tickets/v{PRD_VERSION}/_index.md

세그먼트 분포:
  - app-ui:  N개 (#{번호 목록})
  - feature: N개

티켓 목록:
- #{N}: {제목} — 세그먼트: {...}, SCR: {...}, 의존: {...}
- ...

다음 단계: /nidost:run-dev-from-ticket {번호 또는 v{버전}}
```

---

## 주의사항

- 설계 문서·티켓 경로는 모두 `docs/` 하위로 통일. 프로젝트에 `.nidost/docs/`나 `.nidost/tickets/`가 있으면 경로 마이그레이션 필요성을 사용자에게 안내한다(이 스킬은 직접 이전하지 않음).
- 티켓 저장 경로는 `docs/tickets/v{version}/`. spec 문서와 동일한 `docs/` 하위에 두어 SSOT를 한 곳에 집약한다.
- 티켓 파일명은 `{N}.md` (패딩·슬러그 없음, `1.md`·`22.md`). 번호는 해당 버전 디렉토리 안에서만 unique하면 되며 버전이 바뀌면 다시 1부터 시작한다.
- 상태·worktree 등 실행 메타는 ticket 파일 frontmatter가 아니라 `_index.md`가 SSOT. 티켓 파일은 생성 시점의 명세만 담는다. 완료 커밋 해시는 git 히스토리가 SSOT이므로 `_index.md`에 중복 기록하지 않는다.
- 티켓 1개당 변경 범위가 커지면 분할한다. 하루 이내 완료 가능 단위가 목표.
- UI 티켓은 **1 SCR = 1 티켓**을 우선한다. 공통 컴포넌트만 예외.
- `segment` 필드는 사전 판정일 뿐, `dev-segment-router`가 최종 결정권을 가진다. 라우터가 validate 실패 시 사용자에게 보고한다.
- **done 티켓은 불변**: 이미 `상태 = done`인 티켓의 `.md` 파일과 `_index.md` 행은 수정하지 않는다. 사후 수정·누락 발견은 사용자 입력 모드로 후속 티켓을 append하고, (B) 케이스는 원본 번호를 `의존`에 기록한다. 스키마 변경 등 불가피한 수정은 `_index.md` 갱신 규칙(4-6)의 "기존 값 유지" 원칙을 따르고 별도 마이그레이션으로 처리한다.

---

## 언어/톤

한국어. 티켓 제목은 동사+목적어 간결체. AC는 명확·측정 가능. 참조 경로는 프로젝트 루트 기준 절대 경로.
