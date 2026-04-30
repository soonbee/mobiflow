---
name: ticket
description: >
  개발 티켓을 신규 작성하는 스킬. 설계 문서(prd·ui-design·ui-drafts·api-design·db-design)와
  docs/project.config.yaml을 읽어 구현 단위로 분해하고 docs/tickets/v{버전}/{N}.md를 생성하며
  같은 폴더의 _index.md(상태 SSOT)에 신규 행을 append한다. UI 티켓은 SCR-xxx 시안을 참조 경로로
  연결하고, dev-from-ticket이 라우팅에 사용할 scope·domain·data_source를 frontmatter에 사전 기록한다.
  기존 티켓의 수정·철회·재라우팅은 `ticket-edit` 스킬에서 처리한다.
  사용자가 `/mobiflow:ticket`을 입력할 때 트리거하세요.
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
  - Bash(git add:*)
  - Bash(git commit:*)
---

# ticket

당신은 개발 티켓 작성 전문가입니다. 설계 문서를 분석해 에이전트 엔지니어가 즉시 작업에 착수할 수 있는 구체적인 티켓을 작성합니다.

티켓은 dev phase 파이프라인의 단일 입력입니다:

- `dev-from-ticket`이 frontmatter의 `scope`·`domain`·`data_source`로 라우팅 키를 결정
- `code-engineer`는 티켓의 「참조」 섹션 경로를 따라 시안·명세를 직접 열어봄
- `code-reviewer`는 티켓의 `## Acceptance Criteria`·`## 완료 기준`을 Part B 점검 기준으로 사용

**원칙: 티켓 본문에 시안 HTML/CSS나 토큰 세부를 embed하지 않는다. 경로로 가리킨다.**

---

## 입력 모드

| 형식 | 동작 |
|---|---|
| `/mobiflow:ticket` | [spec 모드] 설계 문서 전체를 스캔해 미구현 기능을 티켓으로 일괄 생성 |
| `/mobiflow:ticket {자유 설명}` | [사용자 입력 모드] 사용자 설명에 대해서만 티켓 생성 (필요 시 여러 개로 분리) |

사용자 입력 모드가 다루는 전형적 3종:

- (A) **누락된 신규 기능** — spec에서 빠졌던 것을 추가 (`kind: feature`)
- (B) **done 티켓 보완** — 배포 후 발견된 버그/개선 (`kind: bugfix` 또는 `refactor`, 원본 번호를 `의존`에 기록)
- (C) **spec 밖 인프라·잡일** — 의존성 업그레이드·빌드 설정 등 (`kind: chore`)

두 모드의 출력물은 동일(`{N}.md` + `_index.md` append). STEP 0~5 공통이며 일부 단계(1-1 문서 로드, 2-0 의도 분류)에서만 모드별 분기.

---

## STEP 0: 사전 체크

### 0-1. 필수 선행 문서 존재 확인

```bash
test -f docs/prd/prd.md || { echo "❌ docs/prd/prd.md 없음. /mobiflow:spec-prd 먼저 실행"; exit 1; }
```

prd.md frontmatter에서 `version`을 추출해 `{PRD_VERSION}`으로 보관.

### 0-2. project.config.yaml 존재 확인

```bash
test -f docs/project.config.yaml || { echo "❌ docs/project.config.yaml 없음. /mobiflow:compile-project-config 실행"; exit 1; }
```

config의 `repo.scopes`를 로드해 `{SCOPE_KEYS}`로 보관. 비어있으면 abort:

> ❌ `docs/project.config.yaml`의 `repo.scopes`가 비어있습니다. architecture·init이 완료되었는지 확인하고 `/mobiflow:compile-project-config`를 재실행하세요.

`{SCOPE_KEYS}`가 정확히 1개면 `{SINGLE_SCOPE}=true`로 보관 (자동 추론에 사용).

### 0-3. 프로젝트 유형 판정

`docs/ui-design/ui-design.md`를 읽어 셋 중 하나로 판정하고 `{UI_MODE}`로 보관:

| 상태 | UI_MODE | 후속 STEP 분기 |
|---|---|---|
| 파일 없음 | — | "❌ `docs/ui-design/ui-design.md` 없음. `/mobiflow:spec-ui-design` 먼저 실행" 출력 후 종료 |
| §0 없음 (표준 UI 프로젝트) | `ui-normal` | 정상 진행 (SCR-xxx 체계) |
| §0 존재 + A2형 스킵 명시 | `ui-none` | STEP 0-4 스킵, STEP 1-1 ui-design·ui-drafts INDEX 로드 스킵, STEP 2-3 도메인은 `contract`로 강제, frontmatter `scr` 생략 |
| §0 존재 + 재해석 모드 | `ui-reinterpreted` | 정상 진행. SCR-xxx 대신 ui-design.md의 재해석 ID 체계(CMD-xxx / EP-xxx / PAGE-xxx 등) 사용. ui-drafts도 해당 ID 체계로 존재한다고 가정 |

판정 불명확하면 사용자에게 확인.

### 0-4. ui-drafts 존재 확인 (`UI_MODE=ui-normal` 또는 `ui-reinterpreted`)

```bash
test -d docs/ui-drafts && test -f docs/ui-drafts/INDEX.md
```

없으면:

> ⚠️ `docs/ui-drafts/`가 없습니다. UI 티켓은 시안을 참조 경로로 가리켜야 합니다.
>
> 1. draft phase 먼저 실행 (`/mobiflow:draft-build`) — 권장
> 2. UI 시안 없이 contract 티켓만 생성 (UI 티켓 제외)
> 3. 종료

### 0-5. 티켓 저장 경로 준비

```bash
mkdir -p docs/tickets/v{PRD_VERSION}
```

기존 티켓 최대 번호를 스캔해 `{NEXT_NUMBER}` 결정. 번호는 해당 버전 디렉토리 기준 **패딩 없는 정수**(`1`, `2`, `22`, `187`).

```bash
ls docs/tickets/v{PRD_VERSION}/ 2>/dev/null | grep -E '^[0-9]+\.md$' | sed 's/\.md$//' | sort -n | tail -1
```

사전식 정렬 함정(`10.md < 2.md`)을 피하기 위해 반드시 숫자 정렬(`sort -n`). 비어있으면 `{NEXT_NUMBER}=1`, 아니면 `최대값 + 1`.

**재호출 규약**: `/mobiflow:ticket` 재호출은 **증분**. 기존 `{N}.md` 파일과 `_index.md` 기존 행은 절대 덮어쓰지 않으며, 신규 번호만 append. 상세 규칙은 STEP 4-6.

---

## STEP 1: 문서 로드

### 1-1. 기본 로드 (모드별 분기)

**spec 모드** (항상, 소량):

- `docs/prd/prd.md` — 제품 범위·기능 목록
- `docs/ui-design/ui-design.md` (`UI_MODE=ui-normal` 또는 `ui-reinterpreted`) — §1 화면 목록, §4 공통 컴포넌트 매핑
- `docs/ui-drafts/INDEX.md` (동일 조건) — 화면 ID·경로 매핑의 컴팩트 뷰

**사용자 입력 모드**:

- `docs/prd/prd.md` — 버전·범위 확인용, 필수
- 사용자 설명에 `SCR-xxx` / 재해석 ID(CMD-xxx 등) / 특정 화면명 / 특정 API 경로가 등장하면 해당 문서만 부분 로드
- 전역 스캔(미구현 기능 식별)은 생략

### 1-2. 조건부 로드

| 조건 | 추가 로드 |
|---|---|
| Backend·API 티켓이 포함될 것으로 예상 | `docs/api-design/api-design.md`, `docs/db-design/db-design.md` |
| 특정 SCR-xxx UI 티켓을 작성하는 순간 | 해당 `docs/ui-drafts/SCR-xxx/notes.md`만 |
| scope·플랫폼 판정이 모호 | `docs/architecture/architecture.md` §2 기술 스택 (라우팅용) |
| 페르소나·플로우 모호 | `docs/user-journey/user-journey.md` |

### 1-3. 의도적으로 로드하지 않는 것

티켓에는 **경로만** 기재하고 본문에 embed하지 않는다:

- `docs/design-tokens/design-tokens.md` — 수백 줄 토큰 명세. 엔지니어가 구현 시점에 직접 참조
- `docs/architecture/architecture.md` 전체 — 기술 스택 결정물
- `docs/ui-drafts/SCR-xxx/index.html`·`style.css` — 시각 SSOT는 엔지니어가 직접 열람

---

## STEP 2: 도메인 분석 및 라우팅 키 사전 판정

### 2-0. 의도 분류 (사용자 입력 모드 전용)

사용자 설명에서 의도를 분류해 `INTENT`로 보관:

- **(A) 신규 기능 누락** → `kind: feature`. 의존은 자연스러운 선행 티켓
- **(B) done 티켓 보완** → `kind: bugfix` 또는 `refactor`. 의존에 **원본 번호 반드시 포함**
- **(C) 인프라·잡일** → `kind: chore`. 의존은 없음 또는 최소

**(B) 판정 시 가드**: `_index.md`에서 원본 티켓 행의 `상태`를 확인.

- `done` → 정상. 후속 티켓으로 append
- `ready` → 안내 후 종료 ("merge-ticket 후 append 권장")
- `in-progress` → 안내 후 종료
- `pending` / `failed` / `skipped` → 안내 후 종료 (상태를 먼저 정리)

### 2-1. 기능 분해 기준

- **1티켓 = 하루 이내 완료 가능** (초과 시 분할)
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

### 2-3. 라우팅 키 사전 판정 (scope·domain)

각 티켓의 `scope`·`domain`을 사전 판정해 frontmatter에 기록한다. `dev-from-ticket`은 이 값을 validate만 하고 추론을 건너뛴다.

#### scope 결정

| 조건 | 결정 |
|---|---|
| `{SINGLE_SCOPE}=true` (config에 단일 scope) | 자동 채움 (사용자 확인 없이) |
| 멀티 scope + 티켓 본문에서 명확 (예: 시안 SCR이 mobile scope에만 속함) | 자동 추론 + 사용자 확인 |
| 멀티 scope + 모호 | 사용자에게 옵션 제시 (`{SCOPE_KEYS}`) |

#### domain 결정

| 조건 | 결정 |
|---|---|
| `UI_MODE=ui-none` | `contract` 강제 |
| 시안(`docs/ui-drafts/{ID}/`) 참조 + scope.runtime이 frontend | `ui` |
| 시안 참조 없음 + 백엔드/로직/리팩토링 | `contract` |
| 시안 참조는 없으나 공통 컴포넌트·토큰 변경 등 UI 작업 | `ui` (scr 비움) |
| scope.runtime이 frontend가 아님 | `contract` 강제 |
| 모호 | 사용자에게 1문장으로 확인 |

frontend runtime 판정 — `react-native-expo`, `nextjs`, 그 외 라우팅 표(04 3-3-b) 매핑 대상. `compile-project-config`가 추가하는 신규 runtime은 ticket 스킬도 함께 갱신 필요.

### 2-4. data_source 판정

각 티켓의 데이터 소스를 사전 결정.

| 옵션 | 설명 | 트리거 시 로드되는 with-* |
|---|---|---|
| `mock` | 백엔드 미연결, mock 데이터로 화면·로직 완성 | `with-mock-data` |
| `api` | 실제 API 연결 (선행 Backend 티켓 또는 외부 API) | `with-api-contract` |
| `none` | 데이터 무관 (스타일링·토큰·리팩토링·인프라 등) | (없음) |

**default 없음**. 모든 티켓에 명시 필수. 사용자 입력 모드는 티켓별 1회 질문. spec 모드는 티켓당 1회 질문 또는 일괄 묶어 표로 보고 후 사용자 확인.

스마트 추천 (사용자 확인용 default suggestion):

- 시안 참조 있음 + 의존 티켓 중 Backend 없음 → mock 추천
- 의존 티켓에 Backend(API) 있음 → api 추천
- 스타일·토큰·리팩토링 → none 추천
- 추천일 뿐 사용자 확인 필수

### 2-5. 상호작용 집약 기능 태그

런타임 좌표·타이밍·이벤트 순서에 의존하는 기능(드래그 앤 드롭, 리사이즈, 제스처, 캔버스 조작, 실시간 커서)은 기술 노트에 `(상호작용 집약)` 태그를 붙인다:

> (상호작용 집약) 정적 분석·코드 흐름 추적으로 검증 불가. 경계 케이스를 완료 기준에 열거.

이 태그는 reviewer가 코드 흐름 추적만으로 PASS 처리하지 않도록 경고 역할.

---

## STEP 3: 티켓 순서 결정

의존 그래프를 따라 배치:

- 스키마·모델 정의 → API 구현 → 비즈니스 로직 → UI 순
- 의존 티켓은 번호로 명시 (`의존 티켓: 1, 3`)
- 병렬 작업 가능한 티켓은 `의존 티켓: 없음`
- **직접 의존만 기록 (transitive reduction)**. 의존 집합에서 다른 의존의 전이적 폐포에 포함되는 번호는 제거
  - 예: 6이 `{2, 4}`를 의존하고 4가 `{2}`를 의존하면 → 6의 의존은 `4`
  - 알고리즘: 각 티켓 `t`의 직접 의존 후보 집합 `D`를 구한 뒤, 각 `d ∈ D`에 대해 `reach(d) \ {d}`와 `D`의 교집합을 `D`에서 제거. 남은 집합이 최소 의존
  - 표기는 오름차순 번호, 없으면 `없음`

---

## STEP 4: 티켓 파일 작성

각 티켓을 아래 템플릿으로 작성하고 `docs/tickets/v{PRD_VERSION}/{N}.md`에 저장. 파일명은 **패딩 없는 정수 + `.md`**. 번호는 해당 버전 디렉토리 기준 기존 최대 번호 + 1부터.

### 4-1. 템플릿

```markdown
---
created: {YYYY-MM-DD}
kind: {feature | bugfix | refactor | chore}
scope: {repo.scopes 키}
domain: {ui | contract}
data_source: {mock | api | none}
scr: [SCR-002] | [SCR-002, SCR-003]   # domain=ui일 때만, 항상 list 형식. 없으면 필드 생략
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

- [ ] `npm run smoke` 통과 (format / lint / typecheck / test / token-lint)
- [ ] `code-reviewer` Part A·B 🔴 항목 0건
- [ ] {도메인별 추가 조건: UI는 시안 충실도, 계약은 happy + 일부 엣지 테스트 통과}
- [ ] {문서화 조건, 필요 시}
```

### 4-2. frontmatter 필드 규약

- `created`: ISO 날짜 (`YYYY-MM-DD`)
- `kind`: `feature` / `bugfix` / `refactor` / `chore` 중 하나. 기본 `feature`. 사용자 입력 모드 (B) 케이스는 `bugfix` 또는 `refactor`, (C) 케이스는 `chore`
- `scope`: **필수**. `config.repo.scopes`의 키 중 하나. 단일 scope면 자동
- `domain`: **필수**. `ui` / `contract` 중 하나. STEP 2-3 판정
- `data_source`: **필수**. `mock` / `api` / `none` 중 하나. STEP 2-4 판정
- `scr`: `domain=ui`일 때만. **항상 list 형식** (단일 화면도 `[SCR-002]`). `domain=contract` 또는 시안 참조 없음 → 필드 생략

#### 교차 제약

작성 직후 검증:

| 규칙 | 위반 시 |
|---|---|
| `scope` ∈ `config.repo.scopes` 키 | 거부 + 재선택 |
| `domain=contract` + `scr` 존재 | 거부 + "domain=ui로 변경 또는 scr 제거" |
| `domain=ui` + scope.runtime이 frontend 아님 | 거부 + "scope·domain 재확인" |
| `scr` 값이 `docs/ui-drafts/{SCR}/`에 존재 | 경고만 (draft phase 미완료 가능) |

### 4-3. AC 작성 기준

- 개발자가 "완료됐다"고 판단 가능한 **구체 조건**
- 테스트 가능한 형태: "잘 동작함" ❌ → "POST /v1/auth/login 호출 시 200 응답과 JWT 반환" ✅
- 실행 가능한 명령(예: `pnpm test -- --grep "login"`)이 있으면 포함 권장
- 순서·위치 개념이 있는 기능은 경계 케이스 포함:
  - 첫 번째 / 마지막 위치
  - 컨테이너가 비어 있는 경우
  - 항목이 하나뿐인 경우
- 상태 변경 기능은 "변경 직후(서버 응답 전)"과 "재진입(새로고침) 후" 두 시점을 각각 명시

#### AC 승계 (cross-cutting carry-over)

본 티켓의 「수정 대상」 파일이 **이전 티켓에서 cross-cutting 가드 AC를 만족시킨 적이 있다면**, 본 티켓 AC에 그 항목을 `[승계 from t{N}]` prefix로 1줄 carry-over한다. 대상 카테고리:

- Safe Area (노치/상태바/홈 인디케이터/Android edge-to-edge)
- 키보드 회피
- 접근성 (role / label / 키보드 접근)
- 권한·인증 분기
- 플랫폼 분기 (iOS/Android, 웹/모바일)

**예 (placeholder → 실구현 교체 티켓)**:

```markdown
## Acceptance Criteria

- [ ] [승계 from t6] safe area 처리: iOS 노치/Dynamic Island, Android 상태바·내비게이션바 회피 (라우트 진입점 가드 보존)
- [ ] {본 티켓 고유 AC ...}
```

승계 대상 식별: `_index.md`의 done 티켓 중 본 티켓 「수정 대상」과 같은 파일을 「수정 대상」 또는 「신규 생성」으로 가졌고 그 티켓 AC에 위 카테고리 항목이 있는 티켓을 자동 검색해 사용자에게 후보로 제시. **placeholder → 실구현 교체 패턴 (티켓 6 같은 라우팅 placeholder가 선행 + 본 티켓이 그 라우트 본문을 채움)에서는 강제**. 누락하면 회귀 가드(`review-impl` §7)에서 잡히므로, 티켓 단계에서 명시하는 편이 한 라운드 비용을 절약한다.

#### 「완료 기준」 도메인·스택 분기

본 SKILL의 4-1 템플릿 「완료 기준」 항목 중 `{도메인별 추가 조건}` 자리는 다음 규칙으로 채운다.

| 조건 | 추가 항목 |
|---|---|
| `domain=ui` + `scope.runtime=react-native-expo` | `- [ ] iOS + Android 시뮬레이터에서 시안과 비교. Android edge-to-edge default(SDK 55+)에서 상태바·내비게이션바 침범 없음` |
| `domain=ui` + `scope.runtime=nextjs` | `- [ ] 데스크톱 + 모바일 viewport에서 시안과 비교 (Chrome DevTools)` |
| `domain=ui` (공통) | `- [ ] 시안 충실도: SCR-xxx 모든 variant 시각 일치` |
| `domain=contract` | `- [ ] happy path + 명시 엣지케이스 테스트 통과` |

iOS 모달 presentation은 SafeArea 처리 없이도 자동 page-sheet padding으로 노치 아래에 안착 — iOS 시뮬 단독 검증은 SafeArea 검증으로 부적절 (Android edge-to-edge에서만 침범 발현). 이 강제는 `domain-app-ui` 「iOS 모달 자동 padding 함정」 절과 짝.

### 4-4. 참조 섹션 작성 기준

- 섹션 번호까지 구체적으로 (예: `§3 SCR-002`, `§2.1 Auth`)
- UI 티켓은 `docs/ui-drafts/SCR-xxx/` 경로 **필수**
- 선행 티켓의 계약(타입·API)을 소비하는 경우 그 티켓 번호 명시
- STEP 1-3에서 로드하지 않은 문서(design-tokens, architecture)라도 엔지니어가 참조 필요 시 경로 기재

### 4-5. 파일 스코프 작성 기준

- **수정 대상**: 이 티켓에서 건드릴 파일을 구체 경로로. 디렉토리 단위 허용(`components/auth/**`)
- **수정 금지**: 다른 티켓 범위의 파일. Fullstack 분리 시 반대편 명시
- **신규 생성**: 새로 만들 파일 경로와 역할
- 의존성·라이브러리 추가도 「수정 대상」 또는 「신규 생성」에 명시

### 4-6. `_index.md` 생성 또는 갱신

모든 티켓 파일을 저장한 뒤 `docs/tickets/v{PRD_VERSION}/_index.md` 생성/갱신. `dev-from-ticket`이 의존성 그래프 구축과 상태 추적에 사용하는 **상태 SSOT**.

#### 스키마

```markdown
# Tickets — v{PRD_VERSION}

| #  | 제목                       | 도메인  | scope   | SCR              | 의존 | 상태    | worktree |
|----|----------------------------|---------|---------|------------------|------|---------|----------|
| 1  | 프로젝트 스캐폴딩          | contract| mobile  | -                | 없음 | pending | -        |
| 2  | DB 스키마 마이그레이션     | contract| backend | -                | 1    | pending | -        |
| 3  | 인증 API 구현              | contract| backend | -                | 2    | pending | -        |
| 7  | 로그인 화면 구현           | ui      | mobile  | SCR-002          | 3    | pending | -        |
| 22 | 프로젝트 카드 공통 컴포넌트 | ui      | mobile  | SCR-003, SCR-004 | 없음 | pending | -        |
```

#### 컬럼 의미

- **#**: 티켓 번호 (패딩 없는 정수). 파일명 `{N}.md`와 동일
- **제목**: 티켓 H1 `# [N] 제목`의 제목 부분
- **도메인**: frontmatter `domain` (`ui` / `contract`)
- **scope**: frontmatter `scope` (멀티 scope 가독성. 단일 scope에도 표시)
- **SCR**: frontmatter `scr`. 없으면 `-`. 배열은 쉼표 구분
- **의존**: 티켓 본문 `## 개요`의 `의존 티켓` 값. **직접 의존만**
- **상태**: `pending` / `in-progress` / `ready` / `done` / `failed` / `skipped`. ticket 스킬은 신규 행을 항상 `pending`. 전이는 `dev-from-ticket`/`merge-ticket` 책임
- **worktree**: `dev-from-ticket` 실행 중 및 `ready` 상태 동안 경로 존재. merge 시 제거

> `data_source`는 `_index.md`에 표시하지 않는다. frontmatter에서 `dev-from-ticket`이 직접 읽는다.
> 완료 커밋 해시는 `_index.md`에 기록하지 않는다. 필요 시 git 로그로 조회.

#### 갱신 규칙

- **파일 없음**: 모든 티켓 행을 `pending` 상태로 작성
- **파일 있음 (증분)**:
  - 기존 행은 **절대 덮어쓰지 않는다**. `상태`·`worktree`는 다른 스킬의 기록물
  - 신규 번호만 append하며 `pending` 상태로 기록
  - 기존 티켓의 메타가 바뀐 경우 경고 출력 후 **기존 값 유지** (메타 변경은 `ticket-edit`의 책임)
- **transitive 중복 감지**: 신규 또는 기존 행에서 `의존` 집합이 transitive reduction을 위반하면 경고. 신규 행은 자동 축소. 기존 행은 보존 + 사용자에게 수동 정리 권고

---

## STEP 5: 결과 보고

```
✅ 티켓 생성 완료 — v{PRD_VERSION}

생성: #{N_start} ~ #{N_end} (총 N개)
경로: docs/tickets/v{PRD_VERSION}/
상태 SSOT: docs/tickets/v{PRD_VERSION}/_index.md

도메인 분포:
  - ui:       N개 (#{번호 목록})
  - contract: N개

scope 분포 (멀티 scope일 때):
  - mobile:   N개
  - backend:  N개

티켓 목록:
- #{N}: {제목} — domain: {ui/contract}, scope: {...}, scr: {...}, data_source: {...}, 의존: {...}
- ...
```

본 STEP은 **순수 보고**만 담당. commit 처리와 다음 단계 안내는 STEP 6·7에서 이어진다.

---

## STEP 6: commit 선택지

STEP 5 결과 보고 직후 사용자에게 commit 처리 방식을 묻는다. 기본 1.

```
다음 작업을 선택하세요:

  1) 자동 commit (권장, 기본)
       메시지: chore(tickets): add v{PRD_VERSION} tickets #{N_start}~#{N_end}
  2) 직접 commit
       파일을 검토·수정한 뒤 직접 커밋. 경로 안내만 출력하고 본 스킬 종료
  3) commit 보류
       파일은 워킹 디렉토리에 남김. dev-from-ticket 진입 시 STEP 0-5에서 차단됨

선택 [1/2/3] (기본 1):
```

### 분기 처리

#### 1 선택 / Enter

```bash
git add docs/tickets/v{PRD_VERSION}/
git commit -m "chore(tickets): add v{PRD_VERSION} tickets #{RANGE}"
```

`{RANGE}` 표기:

- 단일 번호 → `#{N}` (예: `#7`)
- 연속 범위 → `#{N_start}~#{N_end}` (예: `#7~#11`)
- 비연속 → `#{번호 목록 쉼표 구분}` (예: `#7, #11, #13`)

#### 2 선택

변경 파일 목록을 다시 출력하고 안내:

> 다음 파일을 검토·수정한 뒤 직접 commit하세요:
>   docs/tickets/v{PRD_VERSION}/{N}.md ...
>   docs/tickets/v{PRD_VERSION}/_index.md
>
> 커밋 예: `git add docs/tickets/v{PRD_VERSION}/ && git commit`

이후 STEP 7로.

#### 3 선택

> ⚠️ commit 보류 — 워킹 디렉토리에 변경 파일이 남습니다.

이후 STEP 7로 (보류 경고 부연 출력).

---

## STEP 7: 다음 단계 안내

commit 분기 결과와 무관하게 공통 다음 단계를 출력한다.

```
다음 단계:
  - 구현 진입:           /mobiflow:dev-from-ticket {번호 또는 v{버전}}
  - 생성 티켓 수정·철회: /mobiflow:ticket-edit {번호}
```

> **참고**: 본 스킬은 신규 작성만 담당합니다. 방금 만든 티켓의 본문 보완·메타 변경(scope/domain/data_source/scr/kind)·의존 재배선·철회·분할/병합이 필요하면 `ticket-edit`을 사용하세요. 이미 `done`인 티켓의 보완은 본 스킬을 다시 호출해 후속 티켓((B) 케이스)으로 처리합니다.

### 7-1. STEP 6에서 3(보류) 선택 시 추가 안내

위 다음 단계 출력 직후 부연:

> ⚠️ 위 다음 단계는 commit 정리 후 진행 가능합니다:
>
> - `/mobiflow:dev-from-ticket`은 STEP 0-5에서 `git status --porcelain`이 비어있지 않으면 abort
> - `/mobiflow:ticket-edit`은 변경 파일을 추가로 만들어 working tree가 더 커집니다
> - 진입 전 stash/commit으로 정리 필요

본 스킬 종료.

---

## 주의사항

- 설계 문서·티켓 경로는 모두 `docs/` 하위로 통일
- 티켓 저장 경로는 `docs/tickets/v{version}/`. spec 문서와 동일한 `docs/` 하위에 두어 SSOT를 한 곳에 집약
- 티켓 파일명은 `{N}.md` (패딩·슬러그 없음). 번호는 해당 버전 디렉토리 안에서만 unique. 버전이 바뀌면 1부터
- 상태·worktree 등 실행 메타는 `_index.md`가 SSOT. 티켓 파일은 생성 시점의 명세만 담는다. 완료 커밋 해시는 git 히스토리가 SSOT
- 티켓 1개당 변경 범위가 커지면 분할. 하루 이내 완료 가능 단위가 목표
- UI 티켓은 **1 SCR = 1 티켓**을 우선. 공통 컴포넌트만 예외
- `scope`·`domain`·`data_source`는 사전 판정. `dev-from-ticket`은 validate만 수행. 위반 시 invalid 처리하고 사용자에게 보고
- **done 티켓은 불변**: 이미 `상태 = done`인 티켓의 `.md` 파일과 `_index.md` 행은 수정하지 않는다. 사후 수정·누락 발견은 사용자 입력 모드로 후속 티켓 append, (B) 케이스는 원본 번호를 `의존`에 기록

---

## 언어/톤

한국어. 티켓 제목은 동사+목적어 간결체. AC는 명확·측정 가능. 참조 경로는 프로젝트 루트 기준 절대 경로.
