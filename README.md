# mobiflow

서비스 개발 프로세스를 AI-native로 진행하기 위한 subagent와 skill 모음.
프로젝트 유형(웹/앱/백엔드/CLI/라이브러리)이나 사용자 전문성(개발자/디자이너/기획자)에 무관하게 동일한 체인으로 기획부터 설계까지 완성할 수 있다.

## Phase 흐름

```
init → spec → draft → dev → refine → verify (예정)
```

| Phase             | 목적                                                                         | 산출물                                                               | 진입                                                                                                |
| ----------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **init**          | 프로젝트 부트스트랩 (doc-guide·INDEX 템플릿 배포)                            | `docs/doc-guide.md`, `docs/INDEX.md`                                 | `/mobiflow:init`                                                                                    |
| **spec**          | 기획·설계 7개 문서 작성 (PRD → … → api-design)                               | `docs/<카테고리>/<카테고리>.md` 7종 + Lock 태그                      | `/mobiflow:spec-*` 체인                                                                             |
| **draft**         | 정적 HTML/CSS/JS로 시각 SSOT 시안 빌드 + 사용자 손질 창구                    | `docs/ui-drafts/` 트리 + `draft/v*` 태그                             | `/mobiflow:draft-build` (빌드) · `/mobiflow:draft-revise` (수정·비교) ([상세](./draft-phase.md))    |
| **dev**           | 티켓 단위 코드 구현 (구현→smoke→리뷰 루프, worktree 격리)                    | 실제 앱·웹·기능 구현 코드 + `_index.md` 상태                         | `/mobiflow:ticket` (작성) · `/mobiflow:dev-from-ticket` (실행) ([상세](./plans/dev-phase-rebuild/)) |
| **refine**        | 동작하는 코드를 멀티턴 손질·보강 + 사전·승급 게이트로 spec 영향 큰 변경 차단 | 사후 티켓 + `docs/spec-backlog*.md` 갱신 + spec inline patch (MINOR) | `/mobiflow:refine` ([상세](./plans/refine-phase.md))                                                |
| **verify** (예정) | 버전 단위 통합 검증 (visual-check + 테스트 백필)                             | 시각 일치 보고 + 추가 테스트                                         | `/mobiflow:integration-verify` (구현 예정)                                                          |

UI가 없는 프로젝트(백엔드 API·CLI·라이브러리)는 spec-ui-design이 §0 범위 선언으로 스킵되며 draft phase도 `draft-build` 내부에서 자동 스킵된다. dev phase는 곧장 `domain: contract` 티켓으로 진입한다.

## 핵심 설계 원칙

- **고정 체인 + 재해석 모드** — 프로젝트 유형과 무관하게 같은 순서로 진행한다. canonical form이 직접 적용되지 않는 단계는 `## 0. 범위 선언` 섹션을 추가해 재해석된 의미로 작성한다. 예: 클라이언트 완결형 앱의 `spec-db-design`은 AsyncStorage 스키마로, CLI 도구의 `spec-design-tokens`는 로그·출력 포맷으로 재해석.
- **전문성 중립 인터뷰** — 한 질문에 비즈니스 답변·전문 답변 모두 유효하다. AI가 답변의 추상도를 감지해 전문 결정으로 변환한다. 디자인 비전공자가 "차분하고 신뢰감 있는 느낌"이라고 답하면 AI가 구체 HEX·폰트로 변환하듯, 비개발자가 "서버 관리 안 하고 싶어요"라고 답하면 AI가 관리형 스택으로 변환한다.
- **버전 진화** — 모든 문서는 **Working**(편집 가능)과 **Lock**(커밋+태그 완료, 불변) 상태를 오가며 점진적으로 발전한다. 상위 문서 변경은 bump level(PATCH/MINOR/MAJOR)에 따라 하위 문서에 차등 전파된다.
- **공통 규약 중앙화** — 인터뷰 상한, 결정 로그, 수정 프로토콜, frontmatter 규격은 `docs/doc-guide.md`에 정의되고 각 스킬은 참조한다.

## 기획·설계 스킬 체인 & 의존 관계

```
init
 │
 ▼
spec-prd (PRD)
 │
 ├─→ spec-user-journey  ─────────┐
 │                               │
 ├─→ spec-design-tokens ─────────┤
 │                               │
 └─→ spec-architecture ──────────┤
            │                    │
            ▼                    │
     spec-db-design              │
            │                    │
            ▼                    ▼
     spec-api-design       spec-ui-design
```

- PRD 확정 후 `spec-user-journey`, `spec-architecture`, `spec-design-tokens` 세 스킬은 서로 독립 — 팀 작업 시 병렬 실행 가능
- `spec-ui-design`은 위 세 스킬의 수렴 지점
- `spec-api-design`은 architecture와 db-design 모두 필요

## draft phase 구조

draft phase는 두 오케스트레이터 스킬, 두 서브에이전트, 한 가이드 SSOT로 구성된다.

```
draft-build (오케스트레이터)
 │  사용자: /mobiflow:draft-build
 ▼
screen-builder (서브에이전트, full-build/single-scr) ─→ draft-conventions
 │                                                       (작성·리뷰 SSOT)
 ▼
screen-auditor (서브에이전트, full/scoped) ─────────────→ draft-conventions
 │
 ▼
빌드 완료 → (선택) draft-revise (사용자 손질 시)
                     │  사용자: /mobiflow:draft-revise
                     ▼
                L1 in-scope     → screen-builder(patch) → screen-auditor(scoped)
                L1 token-tweak  → tokens.css + design-tokens.md PATCH 동기 (영향 화면 게이트)
                L1-explore      → screen-builder(explore) → 비교 → 결정 게이트 → 폐기/반영
                L2 token-shape  → design-tokens.md patch + spec-lock(MINOR) 권유
                L3 requirement  → spec phase 정식 재진입 권유 (직접 수정 안 함)
```

| 구성                | 종류          | 역할                                                              |
| ------------------- | ------------- | ----------------------------------------------------------------- |
| `draft-build`       | 스킬          | spec → 시안 빌드 오케스트레이터. fresh/update/rebuild 자동 분기   |
| `draft-revise`      | 스킬          | 빌드 후 사용자 수정 요청을 5분류로 라우팅                         |
| `draft-conventions` | 스킬 (가이드) | 작성·리뷰 규약 단일 SSOT. `user-invocable: false` (사용자 비호출) |
| `screen-builder`    | 서브에이전트  | 시안 작성. 4 호출 모드(full-build / single-scr / patch / explore) |
| `screen-auditor`    | 서브에이전트  | 시안 검수 (비파괴). 강한 판정 + 약한 평론 노트 분리 보고          |

draft phase 오케스트레이터(`draft-build`, `draft-revise`)는 모두 `disable-model-invocation: true` — phase 경계는 사용자 명시 결정. 자연어 언급으로 자동 트리거되지 않는다. 자세한 흐름·STEP 정의는 [draft-phase.md](./draft-phase.md) 참조.

## dev phase 구조

dev phase는 1개 진입점 스킬, 1개 디스패치 스킬, 2개 서브에이전트, 그리고 4개 카테고리의 atomic 스킬로 구성된다. 에이전트는 **역할로만** 분기하고 스택·도메인·티켓별 특이점은 모두 **스킬로 흡수**한다 (조합 폭발 방지).

```
ticket (스킬) — 티켓 작성. scope/domain/data_source 라우팅 키 채움
   │  사용자: /mobiflow:ticket
   ▼
dev-from-ticket (오케스트레이터) — STEP 0~4
   │  사용자: /mobiflow:dev-from-ticket {N | v{버전}} [--review|--auto]
   │
   │  STEP 3-3 (티켓별 컨텍스트 합성):
   │   a. stack-resolver(scope) ──→ use-* 스킬 결정
   │   b. domain 결정 ──────────→ domain-app-ui / domain-web-ui / domain-contract
   │   c. with-* 결정 (scr, data_source) ──→ with-ui-draft / with-mock-data / with-api-contract
   │   d. review-* 결정 ────────→ review-ui-* / review-code / review-impl / review-design-tokens
   │
   │  STEP 3-4 (구현·검증·리뷰 루프, 외부 상한 3회):
   ▼
code-engineer (서브에이전트) ─→ 로드된 스킬을 Skill tool로 동적 invoke
   │                              구현 + npm run smoke 통과까지 책임 (내부 상한 3회)
   ▼
code-reviewer (서브에이전트) ─→ Part A (품질) + Part B (AC) verdict
   │                              🔴 → 외부 루프 / 🟡·pass → 진행
   ▼
ready (--review 모드) 또는 done (--auto 모드 squash merge)
```

| 구성                                                     | 종류         | 역할                                                               |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| `ticket`                                                 | 스킬         | 티켓 작성. frontmatter 채움(자동/대화형) + 검증 + `_index.md` 갱신 |
| `dev-from-ticket`                                        | 스킬         | dev 진입점·오케스트레이터. 의존성·worktree·합성·실행 루프          |
| `stack-resolver`                                         | 스킬         | scope → 매칭 프로파일 → `use-*` 목록. 사이드 이펙트 없는 순수 함수 |
| `code-engineer`                                          | 서브에이전트 | 모든 구현. smoke 통과 책임. 검사 우회(ts-ignore 등) 금지           |
| `code-reviewer`                                          | 서브에이전트 | 품질·AC·토큰 점검. 코드 수정 X (Read-only 도구만)                  |
| `domain-app-ui` / `domain-web-ui` / `domain-contract`    | 스킬         | 도메인 보편 원칙 (스택 무관)                                       |
| `use-expo-sdk55` / `use-unistyles3`                      | 스킬         | 라이브러리 레퍼런스 (스택별 특이점). 프로파일이 결정해 로드        |
| `with-ui-draft` / `with-mock-data` / `with-api-contract` | 스킬         | 티켓 컨텍스트별 가이드                                             |
| `review-*`                                               | 스킬         | 리뷰 체크리스트 (Part A 품질·UI / Part B AC / 토큰)                |

스택 추가는 `skills/stack-resolver/profiles/<id>.yaml` 1개 + 부속 `use-*` 스킬만 추가하면 됨 (에이전트 변경 없음).

검증 2층 분리: dev phase는 Layer 1(개별 검증 — 코드/AC/smoke). Layer 2(시각 일치성·테스트 백필)는 별도 `integration-verify` phase 책임 (구현 예정).

자세한 설계·결정 사항은 [`plans/dev-phase-rebuild/`](./plans/dev-phase-rebuild/) 참조.

## refine phase 구조

refine phase는 1개 진입점 스킬, 2개 백로그 artifact로 구성된다. 새로운 에이전트는 추가하지 않고 **dev phase 자산(`code-engineer`/`code-reviewer`)과 draft phase 자산(`screen-builder`/`screen-auditor`)을 모두 재사용**하며, 영향도 휴리스틱은 `doc-guide.md`를 SSOT로 `draft-revise`와 공유한다.

```
refine (오케스트레이터)
   │  사용자: /mobiflow:refine "<자연어 요청>"
   ▼
STEP 1: 분리 판정 (케이스 D — 다중·광범위 요청 시 항목별 영향도 표)
   │
   ▼
STEP 2: 사전 게이트 (케이스 B)
   │  MAJOR 항목 → 3지선다 (① 백로그 / ② 좁혀 다시 / ③ 인라인 ⚠권장X)
   │
   ▼
STEP 3-4: 브랜치(refine/wip/<slug>) + 멀티턴 손질
   │  변경 유형 분류 → 시각 / 비시각 / 혼합
   │
   │  [시각 — draft-first]
   │   screen-builder(patch | token-tweak | token-shape) → screen-auditor
   │   → 사용자 시각 검토 (① 좋다 → 코드 동기 / ② 조정 / ③ 원래대로 = 매몰비용 0)
   │
   │  [비시각 / 코드 동기]
   │   code-engineer + smoke + 사용자 확인
   │
   ▼
STEP 5: 승급 게이트 (케이스 C — 작업 중 MAJOR 감지 시 즉시 중단)
   │  ① 백로그+브랜치(backlog/<bl-id>)보존 / ② 좁혀 다시 / ③ 인라인 ⚠
   │
   ▼
STEP 6: 비시각 SSOT 영향 분석·항목별 동의 게이트 → 동의된 SSOT만 patch + Lock 권유
   │  (시각 SSOT는 4-A에서 이미 처리됨, 스킵)
   │
   ▼
STEP 7: 사후 티켓 생성 → squash merge → develop
```

| 구성                                          | 종류          | 역할                                                                               |
| --------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `refine`                                      | 스킬          | 진입점·오케스트레이터. 사전·승급 게이트, 세션 루프, 사후 티켓, 머지                |
| `code-engineer` / `code-reviewer`             | 서브에이전트  | dev phase 그대로 재사용 (변경 없음)                                                |
| `screen-builder` / `screen-auditor`           | 서브에이전트  | draft phase 그대로 재사용. STEP 4-A 시각 변경 흐름에서 sub-agent로 호출            |
| `stack-resolver` 외 dev 스킬                  | 스킬          | `use-*`/`domain-*`/`with-*`/`review-*` 모두 그대로 재사용                          |
| `docs/spec-backlog.md`                        | artifact      | active 백로그 (`pending` 항목)                                                     |
| `docs/spec-backlog-archive.md`                | artifact      | archive 백로그 (`accepted-v*` / `rejected` / `superseded` / `inline-resolved-v*`)  |
| `doc-guide.md` §「spec 영향도 판정 휴리스틱」 | 가이드 (SSOT) | `refine`(사전·승급 게이트)·`draft-revise`(L3 판정) 공유 — 본 스킬에 사본 두지 않음 |

`draft-revise` 자체는 손대지 않는다 — 오케스트레이터 충돌 회피. refine은 draft-revise가 부르는 atomic sub-agent(`screen-builder`/`screen-auditor`)만 직접 호출하고, 좁은 분류(`patch`/`token-tweak`/`token-shape`)만 자체 보유.

핵심 설계 포인트:

- **시각 SSOT-first** — 시각 변경은 시안·토큰을 먼저 변경하고 사용자 검토 후 코드 동기. 거부 시 코드 무손상 (매몰비용 0)
- **모든 SSOT 갱신은 사용자 동의** — 시각 SSOT는 STEP 4-A 검토 게이트로, 비시각 SSOT(`ui-design.md` 등)는 STEP 6 미리보기·항목별 동의 게이트로. 자동 patch 없음
- **워크트리 미사용** — feature 브랜치만 사용 (base = `develop`). dev server·IDE 컨텍스트 보존이 멀티턴 손질의 핵심
- **사후 티켓** — 세션 시작 시점에 티켓 없음. 종료 시 변경 분석 기반으로 `docs/tickets/v{버전}/` 안에 dev 티켓과 함께 생성 (`kind=polish/bugfix/refactor` 구분)
- **휘발 방지** — 차단된 MAJOR 항목은 백로그(active)에 자동 등록. 작업물(브랜치)도 `backlog/<bl-id>`로 rename·보존 (영구 보존 원칙)
- **③번 인라인 옵션** — 차단이 아니라 남용 가시화 가드레일. archive에 `inline-resolved-v<버전>` 상태로 자동 추적 등록되어 다음 spec 라운드 회고 시 패턴이 보임

검증 분리: refine phase는 동작하는 코드를 보면서 손질하므로 별도 visual-check를 두지 않는다. 시각 일치성·테스트 백필은 verify phase의 책임 (구현 예정).

`refine` 오케스트레이터는 `disable-model-invocation: true` — phase 경계는 사용자 명시 결정. 자연어 언급으로 자동 트리거되지 않는다.

자세한 흐름·결정 사항은 [`plans/refine-phase.md`](./plans/refine-phase.md) 참조.

## 권장 실행 순서

프로젝트 유형과 무관하게 아래 순서를 따른다. canonical form이 직접 적용되지 않는 단계는 「재해석 모드」로 작성한다.

```
[init/spec/draft]
spec-prd → spec-user-journey → spec-architecture → spec-design-tokens
        → spec-ui-design → spec-db-design → spec-api-design
        → /mobiflow:draft-build              (draft phase 빌드)
        → /mobiflow:draft-revise             (선택 — 시안 수정·비교)

[gate: draft → dev 전환]
        → /mobiflow:compile-project-config   (gate: docs/ 마지막 변경분을 fact view로 컴파일)
        → /mobiflow:expo-sdk55-unistyles-stack  (스택 scaffold — 첫 dev 진입 시 1회.
                                                   smoke 계약 심기 포함)

[dev]
        → /mobiflow:ticket                   (티켓 작성 — scope/domain/data_source 채움)
        → /mobiflow:dev-from-ticket {N}      (티켓별 worktree 구현·smoke·리뷰)
        → /mobiflow:merge-ticket {N | all}   (ready → done 전이, develop에 squash merge)

[refine]
        → /mobiflow:refine "<자연어 요청>"    (필요 시 반복 — 멀티턴 손질·보강.
                                                사전·승급 게이트로 spec 영향 큰
                                                변경은 spec-backlog로 자동 escalate)

[verify (예정)]
        → /mobiflow:integration-verify v{버전}   (visual-check + 테스트 백필 + 보완)
```

draft phase는 UI 유무와 무관하게 모든 프로젝트가 진입한다. UI가 없는 프로젝트(ui-design §0 A2형 스킵)는 `draft-build` 내부에서 자동 스킵된다.

`draft-revise`는 빌드 후 사용자가 추가 손질을 원할 때만 호출한다. 자연어 요청을 5개 레벨(L1 in-scope / L1 token-tweak / L1-explore / L2 token-shape / L3 requirement)로 분류해 적절한 경로로 라우팅한다. L1·L1-explore는 draft 안에서 처리, L2는 design-tokens.md 단일 문서 patch, L3는 spec phase 정식 재진입.

**프로젝트 유형별 재해석 예시:**

- **프론트 전용 앱** → `spec-db-design`은 클라이언트 완결형(AsyncStorage·IndexedDB) 스키마로, `spec-api-design`은 외부 인터페이스 없음으로 재해석
- **백엔드 전용 API** → `spec-user-journey`는 Integrator 시나리오로, `spec-design-tokens`는 로그·CLI 출력 포맷으로, `spec-ui-design`은 API 문서 또는 관리자 대시보드로 재해석
- **라이브러리·SDK** → `spec-architecture`는 빌드·배포 파이프라인으로, `spec-api-design`은 공개 함수 시그니처로 재해석

재해석 시 문서 본문 최상단에 `## 0. 범위 선언` 섹션을 추가해 canonical form이 적용되지 않는 이유와 대체 관심사를 기술한다.

각 스킬 완료 후 `/mobiflow:spec-lock <카테고리>`로 문서를 Lock한다. Lock을 생략하고 다음 스킬로 진행하면 다음 스킬 시작 시 자동으로 Lock을 권유받는다.

## 의존 테이블

| 스킬               | 필수 의존                                      |
| ------------------ | ---------------------------------------------- |
| spec-prd           | —                                              |
| spec-user-journey  | prd                                            |
| spec-architecture  | prd                                            |
| spec-design-tokens | prd                                            |
| spec-ui-design     | prd, user-journey, architecture, design-tokens |
| spec-db-design     | prd, architecture                              |
| spec-api-design    | prd, architecture, db-design                   |

각 spec 스킬은 STEP 0에서 필수 의존 문서가 없거나 frontmatter가 손상된 경우 차단한다.

## 문서 수명 주기

문서는 **Working ↔ Lock** 두 상태를 오간다:

- **Working** — 편집 가능 상태. 같은 버전 내에서 이터레이션. 커밋·태그 없음
- **Lock** — 커밋 + 태그 (`doc/<카테고리>/v<버전>`) 완료. 불변 상태

상태 전이:

```
Working (v0.1.0) → commit + tag → Lock → 수정 시작 → Working (v0.2.0) → ...
```

**Lock 판별**: `doc/<카테고리>/v<버전>` 태그 존재 여부

**spec 스킬 재실행 시 동작:**

- 파일 없음 → 신규 생성 (v0.1.0 Working)
- Working 상태 → 이어서 편집 (버전 유지)
- Lock 상태 → 수정(새 버전 Working 진입) 또는 종료

**Lock 수행**: `/mobiflow:spec-lock <카테고리>` 유틸리티 스킬 또는 수동 `git commit` + `git tag`

**묵시적 Lock 유도**: spec 스킬은 시작 시 필수 선행 문서의 Working 상태를 감지하고 Lock을 권유한다.

**연쇄 변경**: 상위 문서 수정 시 bump level(PATCH/MINOR/MAJOR)에 따라 하위 문서 영향이 차등 적용된다.

상세는 `docs/doc-guide.md` 「문서 수명 주기」, 「Working 상태 편집 규칙」, 「Lock 상태 수정 프로토콜」, 「연쇄 변경 정책」을 참조한다.

## 공통 규약

`/mobiflow:init` 실행 시 프로젝트에 생성되는 `docs/doc-guide.md`에 모든 공통 규약이 정의되어 있다:

- **frontmatter 규격** 및 카테고리별 필수 의존 테이블
- **결정 로그 규약** — 표 형식, 자동 선택 표기, 재해석 모드 표기
- **인터뷰 상한 규약** — Heavy(`spec-architecture`)는 5/7, Standard(나머지)는 4/6. 정지 조건, 앵커 패턴, 사용자 위임 처리, 전문성 중립 질문 원칙 포함
- **문서 수명 주기** — Working ↔ Lock 상태 정의 및 전이
- **Working 상태 편집 규칙** — 동일 버전 내 이터레이션 규약
- **Lock 상태 수정 프로토콜** — 상위 문서 변경 감지부터 CHANGELOG·INDEX 갱신까지의 자동화 절차
- **묵시적 Lock 유도** — spec 스킬이 선행 문서의 Working 상태를 감지하고 Lock을 권유하는 규약
- **연쇄 변경 정책** — PATCH/MINOR/MAJOR 영향도 기반 하위 문서 대응
- **Coordinated Update** — 연쇄 변경 워크플로우
- **Git 컨벤션** — 커밋 메시지 형식과 태그 형식 (`docs/<카테고리>/v<버전>`)

**유틸리티 스킬 `spec-lock`**: `/mobiflow:spec-lock <카테고리>`로 문서를 Working → Lock(commit + tag)으로 전환한다.

**컴파일러 스킬 `compile-project-config`**: `docs/` 변경 후 `/mobiflow:compile-project-config`로 `docs/project.config.yaml`(기계 판독 fact view)을 갱신한다. AI agent·CI·툴이 query하는 라우팅 키(repo 경로, 스택 enum, 패키지 매니저 등)를 단방향 컴파일로 노출. **권장 게이트**: draft 종료 직후·dev 진입 직전에 한 번 실행 — 이 시점이 `docs/`(특히 architecture·ui-design)의 마지막 변경분까지 반영하면서 dev phase 첫 동작(스택 스캐폴더·`stack-resolver`)이 config를 query하기 직전이다. dev 도중 `docs/`가 추가로 바뀌면 다시 호출하거나 `--check`로 drift만 감지한다. `--check` 모드는 drift 감지만 수행 (CI용). 상세는 `docs/doc-guide.md` 「기계 판독 view」 참조.

각 spec 스킬은 본문에 자기 특이사항(결정 축 목록·위임 불가 축·재해석 가이드 등)만 두고 공통 부분은 doc-guide를 참조한다.

저장소 내 템플릿은 `skills/init/templates/doc-guide.md`에서 확인할 수 있다.
