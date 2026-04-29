---
name: ticket-edit
description: >
  기존 티켓을 수정·재라우팅·철회하는 라우터 스킬. 자연어 요청을 본문 수정(E1)·메타 변경(E2)·
  의존 재배선(E3)·철회(E4)·분할병합(E5)으로 분류해 처리하고, _index.md를 sync한다.
  done/ready/in-progress 티켓은 거부 (worktree 또는 후속 티켓 권유).
  사용자가 `/nidost:ticket-edit {N}`을 입력할 때 트리거하세요.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(test:*)
  - Bash(ls:*)
  - Bash(grep:*)
  - Bash(rm:*)
  - Bash(git status:*)
  - Bash(git add:*)
  - Bash(git commit:*)
---

# ticket-edit

기존 티켓을 수정·재라우팅·철회하는 라우터 스킬. `ticket` 스킬이 신규 작성을 담당하고, 본 스킬은 작성 이후의 모든 변경을 책임진다.

본 스킬의 본질은 **분류와 라우팅**. 자연어 요청을 5개 편집 종류(E1~E5)로 나눠 적절한 처리 경로로 보낸다.

---

## 핵심 원칙

- **단일 티켓 단위**: 한 번의 호출로 한 티켓만 편집. 복수 티켓 동시 편집은 의존 그래프 재계산 정합성 문제로 미지원
- **분류 게이트 필수**: STEP 2의 사용자 확인을 건너뛰지 않는다. 잘못 분류 시 _index.md sync 누락·의존 그래프 손상 위험
- **상태 전이 미관여**: 상태 컬럼 전이는 `dev-from-ticket` / `merge-ticket`이 책임. 본 스킬은 **E4 철회 시 `pending`/`skipped` 양방향 전이만** 직접 기록
- **`_index.md` SSOT 유지**: frontmatter·본문 변경은 `_index.md`의 해당 행과 즉시 동기화. 의존 변경은 영향 받는 다른 행도 자동 patch
- **done 티켓 불변**: 이미 완료된 티켓은 절대 편집하지 않는다. 후속 티켓(`ticket` (B) 케이스)으로 안내

---

## 진입 조건

- `docs/prd/prd.md` 존재 → frontmatter `version`을 `{PRD_VERSION}`으로 추출
- `docs/project.config.yaml` 존재 + `repo.scopes` 비어있지 않음
- `docs/tickets/v{PRD_VERSION}/_index.md` 존재
- 인자로 받은 티켓 번호의 `docs/tickets/v{PRD_VERSION}/{N}.md` 존재

조건 미충족 시 종료:

> ⚠️ ticket-edit는 신규 작성된 티켓을 대상으로 합니다.
> 먼저 `/nidost:ticket`으로 티켓을 생성해주세요.

---

## 입력 모드

| 형식 | 동작 |
|---|---|
| `/nidost:ticket-edit {N}` | 자연어 요청을 추가로 묻고 분류 게이트 진입 |
| `/nidost:ticket-edit {N} {자유 설명}` | 즉시 분류 게이트 진입 |

번호는 **현재 PRD 버전 기준** 패딩 없는 정수. 다른 버전을 편집하려면 PRD 버전을 먼저 정렬해야 한다.

복수 티켓(`/nidost:ticket-edit 7,11`)은 미지원 — 한 번에 한 티켓만 처리. 여러 티켓 편집이 필요하면 본 스킬을 반복 호출.

---

## STEP 0: 사전 체크 + 상태 가드

### 0-1. 진입 조건 검증

```bash
test -f docs/prd/prd.md || { echo "❌ docs/prd/prd.md 없음"; exit 1; }
test -f docs/project.config.yaml || { echo "❌ docs/project.config.yaml 없음"; exit 1; }
TARGET="docs/tickets/v{PRD_VERSION}/{N}.md"
test -f "$TARGET" || { echo "❌ 티켓 없음: $TARGET"; exit 1; }
test -f "docs/tickets/v{PRD_VERSION}/_index.md" || { echo "❌ _index.md 없음"; exit 1; }
```

### 0-2. 상태 가드

`_index.md`에서 `{N}`의 `상태` 컬럼을 조회해 분기.

| 상태 | 처리 |
|---|---|
| `pending` | 모든 편집 허용 |
| `skipped` | 모든 편집 허용 (재실행 의도로 정정) |
| `failed` | 본문·메타 편집 허용. 단 worktree·feature 브랜치 정리는 사용자 책임 (안내 출력) |
| `in-progress` | 거부. "worktree(`worktrees/t{N}`) 안에서 수정하세요" |
| `ready` | 거부. "worktree에서 수정하거나 `/nidost:merge-ticket {N}` 후 후속 티켓으로 처리하세요" |
| `done` | 거부. "후속 티켓 권유: `/nidost:ticket "{설명}"` (kind: bugfix/refactor, 의존: {N})" |

**`failed` 진입 시 추가 안내**:

> ⚠️ 티켓 #{N} 상태가 `failed`입니다. 본문·메타 편집은 허용되지만 상태 전이는 본 스킬에서 처리하지 않습니다.
> 편집 완료 후 재실행: worktree(`worktrees/t{N}`)·feature 브랜치를 사용자가 직접 제거한 뒤 `_index.md` 상태를 `pending`으로 되돌리고 `/nidost:dev-from-ticket {N}` 호출.

상태 가드 통과 시 STEP 1로.

---

## STEP 1: 사용자 입력 수집·정규화

### 1-1. 자연어 요청 수집

호출 시 자유 설명이 함께 왔으면 그대로 사용. 비어있거나 모호하면 묻는다:

> 티켓 #{N} "{제목}" (상태: {상태})에 어떤 변경을 원하시나요? 자유롭게 적어주세요.

### 1-2. 정규화

자연어를 다음 슬롯으로 추출:

```yaml
request:
  intent: "AC에 빈 목록 케이스 추가"
  target_section: body | frontmatter | deps | withdraw | split | merge | unknown
  fields_hinted: [acceptance_criteria]   # 본문 섹션 또는 frontmatter 필드명
```

- **intent**: 사용자 표현 그대로 보존
- **target_section**: 변경 대상 섹션의 1차 추정
- **fields_hinted**: 사용자가 명시적으로 언급한 본문 섹션 또는 frontmatter 필드 (예: `scope`, `data_source`, `의존`, `AC`, `참조`, `기술 노트`)

---

## STEP 2: 분류 게이트

자연어 요청을 5개 편집 종류로 분류.

| 코드 | 정의 | 처리 STEP |
|---|---|---|
| **E1** | 본문 수정 (제목·User Story·AC·참조·기술 노트·완료 기준·파일 스코프) | STEP 3-A |
| **E2** | frontmatter 메타 변경 (`scope` / `domain` / `data_source` / `scr` / `kind`) | STEP 3-B |
| **E3** | 의존 관계 변경 (`의존 티켓` 추가·제거) | STEP 3-C |
| **E4** | 티켓 철회 (`pending`/`skipped` ↔ `skipped`) | STEP 3-D |
| **E5** | 분할 (1→N) / 병합 (N→1) | STEP 3-E |

### 2-1. 분류 휴리스틱

| 신호 | 추정 |
|---|---|
| "AC 추가/수정", "참조 누락", "제목 다듬기", 본문 어휘 | E1 |
| "scope을 X로", "도메인을 ui로", "mock에서 api로", "SCR 추가/제거" | E2 |
| "X 의존 추가/제거", "Y 다음에 와야 함", "선행 조건 변경" | E3 |
| "철회", "취소", "안 하기로", "skip" | E4 |
| "둘로 나누기", "분할", "두 티켓을 하나로", "병합", "merge" | E5 |
| 모호 / 복합 | 사용자에게 분류 확인 (게이트에서 정정) |

휴리스틱은 **참고**일 뿐. 모호하면 STEP 2-2의 사용자 확인에서 정정한다.

### 2-2. 사용자 확인 게이트 (필수)

분류 결과를 사용자에게 제시:

```
편집 분류:
  티켓 #{N} "{제목}" (상태: {상태})
  → {분류 코드}: {분류 설명}

  요청 요약: {정규화된 intent}
  영향 대상:
    - 티켓 파일: docs/tickets/v{PRD_VERSION}/{N}.md
    - _index.md 컬럼: {예상 변경 컬럼}
    - 다른 티켓 영향: {예상 N건 또는 없음}

이대로 진행할까요? 분류가 다르다고 판단되면 알려주세요.
```

사용자가 분류를 정정하면 그대로 받아들인다. AI 추정보다 사용자 의도가 우선.

확인 후 STEP 3-A~E로 라우팅.

---

## STEP 3-A: E1 본문 수정

티켓 본문(제목·User Story·참조·파일 스코프·AC·기술 노트·완료 기준)만 수정. frontmatter는 건드리지 않는다.

### 3-A-1. 변경 적용

사용자 요청을 그대로 받아 `Edit` 도구로 해당 섹션 수정. 가능하면 사용자에게 변경 후 본문을 미리 보여주고 확인받는다.

### 3-A-2. 제약·검증

- **제목 변경** (`# [{N}] {새 제목}`)
  - `_index.md`의 해당 행 `제목` 컬럼을 sync
  - `## 개요`의 「타입」 라인은 본문에 영향 없으므로 sync 불필요
- **참조 추가**
  - 디스크 존재 검증 (예: `docs/ui-drafts/SCR-007/`이 실제 존재하는지)
  - frontmatter `scr` 정합성: 참조에 `SCR-xxx` 추가했는데 frontmatter `scr`에 빠져있으면 경고 + "frontmatter도 같이 수정하려면 E2로" 안내
- **AC·기술 노트·파일 스코프 추가/수정**: 자유롭게 적용
- **frontmatter 변경 요청 감지**: 사용자가 본문 수정 중 frontmatter도 바꾸길 원하면 → E2로 재분류 안내 후 STEP 2로 복귀

### 3-A-3. `_index.md` sync

- 제목 변경 시: `제목` 컬럼만 patch
- 그 외: `_index.md` 변경 없음

---

## STEP 3-B: E2 frontmatter 메타 변경

`scope` / `domain` / `data_source` / `scr` / `kind` 변경.

### 3-B-1. 변경 대상 식별

사용자 요청에서 변경할 필드와 새 값을 추출. 모호하면 묻는다:

> 변경할 frontmatter 필드와 새 값을 알려주세요.
> 예: `data_source: mock → api`, `scope: mobile → backend`

### 3-B-2. frontmatter 갱신

`Edit` 도구로 frontmatter 해당 필드만 patch. 그 외 필드는 보존.

### 3-B-3. 교차 제약 재검증

`ticket` SKILL.md 4-2 규약과 동일.

| 규칙 | 위반 시 |
|---|---|
| `scope` ∈ `config.repo.scopes` 키 | 거부 + 재선택 |
| `domain` ∈ {ui, contract} | 거부 |
| `data_source` ∈ {mock, api, none} | 거부 |
| `kind` ∈ {feature, bugfix, refactor, chore} | 거부 |
| `domain=contract` + `scr` 존재 | 거부 + "scr 함께 제거하거나 domain을 ui 유지" |
| `domain=ui` + scope.runtime이 frontend 아님 | 거부 + "scope·domain 재확인" |
| `scr` 값이 `docs/ui-drafts/{SCR}/`에 존재 | 경고만 (draft phase 미완료 가능) |

frontend runtime 목록: `react-native-expo`, `nextjs` (라우팅 표 `dev-from-ticket` 3-3-b 매핑 대상).

### 3-B-4. 본문 「타입」 라인 sync

`## 개요`의 `- **타입:** {Backend | Frontend | Fullstack | Infra} / {Feature | Bugfix | Refactor | Chore}`:

- `kind` 변경 시 → 우측(`Feature/Bugfix/...`) sync
- `domain`·`scope` 변경 시 → 좌측(`Backend/Frontend/...`) 재추정. 모호하면 사용자에게 확인

### 3-B-5. `_index.md` sync

| frontmatter 필드 | `_index.md` 컬럼 |
|---|---|
| `domain` | `도메인` |
| `scope` | `scope` |
| `scr` | `SCR` |
| `kind` | (표시 안 함, sync 없음) |
| `data_source` | (표시 안 함, sync 없음) |

`SCR` 컬럼은 `scr=[]` 또는 필드 없음 → `-`. 배열은 쉼표 구분.

### 3-B-6. 사용자 안내 (data_source 변경 시)

`data_source` 변경은 `dev-from-ticket`의 `with-*` 결정에 영향:

| 변경 | 영향 |
|---|---|
| `mock → api` | `with-mock-data` 빠지고 `with-api-contract` 추가 |
| `api → mock` | 반대 |
| `* → none` | `with-*` 모두 빠짐 |

`dev-from-ticket`이 다음 실행 시 자동 재로드하므로 본 스킬에서 별도 조치는 불필요. 안내만 출력.

---

## STEP 3-C: E3 의존 관계 변경

`의존 티켓` 추가·제거. 변경된 티켓의 의존 집합과 **다른 티켓의 transitive reduction**을 함께 재계산.

### 3-C-1. 변경 사항 수집

사용자에게 추가·제거할 의존 번호를 받는다.

```
현재 의존: {기존 의존 번호 목록 또는 '없음'}
변경:
  - 추가: {N1, N2, ...}
  - 제거: {N3, ...}
```

### 3-C-2. 순환 의존 감지

추가 후의 의존 그래프가 DAG인지 확인. 순환 발견 시 거부 + 사용자에게 경로 표시:

> ❌ 순환 의존이 발생합니다: {N} → {N1} → ... → {N}
> 추가 의존을 재검토하세요.

### 3-C-3. 의존 그래프 재구성

`_index.md` 전체 행을 파싱해 의존 그래프 `G` 구성. 변경된 티켓의 의존 집합을 patch한 그래프 `G'`을 만든다.

### 3-C-4. transitive reduction 자동 재계산

`G'`의 **모든 노드**에 대해 의존 집합을 reduce (직접 의존만 남김):

- 알고리즘: 각 노드 `t`의 의존 후보 집합 `D`에 대해, 각 `d ∈ D`의 `reach(d) \ {d}`와 `D`의 교집합을 `D`에서 제거. 남은 집합이 최소 의존
- 변경된 행과 함께 **다른 행의 의존 집합도 변할 수 있음**. 모두 patch 대상

### 3-C-5. 사전 보고 게이트 (필수)

자동 patch 직전 사용자에게 영향 범위 보고:

```
의존 재배선 결과 (transitive reduction 자동 적용):

  티켓 #{N} 자체:
    의존: {기존} → {신규}

  영향 받는 다른 티켓:
    - #{X}: 의존 {기존} → {신규} (이유: {N}의 변경으로 transitive 폐포 변동)
    - #{Y}: 의존 {기존} → {신규}
    ...

  영향 없음: 그 외 티켓

진행할까요? (Y/n)
```

거절 → 본 스킬 종료. patch 적용 안 함.

### 3-C-6. patch 적용

진행 시:

- 변경된 모든 티켓의 본문 `## 개요` `의존 티켓` 라인 sync
- 변경된 모든 행의 `_index.md` `의존` 컬럼 sync

`done` 상태인 티켓의 의존 집합이 자동 변경 대상이 되면 거부 + 사용자에게 안내 (done 불변 원칙):

> ⚠️ 티켓 #{X}는 `done` 상태이지만 의존 재계산으로 변경 대상에 포함됩니다. done 티켓은 불변이므로 이번 변경은 적용하지 않습니다.
> 의존 재배선 자체를 취소하거나, #{X}를 제외한 부분만 수동 patch하세요.

---

## STEP 3-D: E4 철회

티켓을 `skipped` 상태로 전환. 본문은 보존하고 「철회」 섹션을 추가.

### 3-D-1. 사유 수집

```
티켓 #{N} "{제목}"을 철회합니다.
사유를 입력하세요 (한 문장):
```

### 3-D-2. 본문 처리

티켓 파일 끝에 「철회」 섹션 추가:

```markdown
## 철회 (Withdrawn)

- 철회일: {YYYY-MM-DD}
- 사유: {사용자 입력}
```

본문 다른 섹션은 보존 (이력 보존).

### 3-D-3. `_index.md` 처리

해당 행의 `상태` → `skipped`. 다른 컬럼(제목·도메인·scope·SCR·의존·worktree)은 그대로 유지.

### 3-D-4. 의존 영향 경고

본 티켓을 의존하던 다른 티켓이 있으면 경고:

> ⚠️ 다음 티켓이 #{N}을 의존하고 있습니다:
>   - #{X1}, #{X2}, ...
>
> 이 티켓들의 의존 그래프는 자동 재배선되지 않습니다. 필요 시 `/nidost:ticket-edit {X1}`로 의존을 정리하세요.

### 3-D-5. 양방향 전이 (`pending` ↔ `skipped`)

상태 가드(STEP 0-2)에서 `skipped` 상태도 편집 허용. E4를 `skipped`에 호출하면 **`pending`으로 복원** 의미로 동작:

- 「철회」 섹션 제거
- `_index.md` 상태 → `pending`

복원 시에도 분류 게이트는 거치며, 사용자에게 의도(철회 / 복원)를 명시 확인.

---

## STEP 3-E: E5 분할 / 병합

복잡 케이스. 두 하위 모드로 분기.

### 3-E-split: 1 → N

#### 3-E-split-1. 분할 단위 수집

```
티켓 #{N} "{제목}"을 N개로 분할합니다.

각 신규 티켓의 제목·AC·의존을 알려주세요. 메타(scope/domain/data_source/scr/kind)는
원본 frontmatter를 default로 inherit하며, 다르게 설정하려면 명시해주세요.

예:
  - 신규 1: "API 엔드포인트 설계", AC: [...], 의존: 원본의 의존 그대로
  - 신규 2: "API 핸들러 구현", AC: [...], 의존: 신규 1
```

#### 3-E-split-2. 신규 번호 할당

`docs/tickets/v{PRD_VERSION}/`의 기존 max 번호 + 1, +2, ... 순차. `{NEW_NUMBERS}`로 보관.

#### 3-E-split-3. 신규 티켓 작성

`ticket` STEP 4 템플릿 그대로 사용. frontmatter는 원본을 default로 inherit (메타가 다르면 사용자 입력 우선). 신규 N개의 `{NEW_N}.md` 작성.

#### 3-E-split-4. 원본 처리 (사용자 선택)

```
원본 티켓 #{N} 처리 방법:
  1) skipped 마킹 (권장, 기본)
       본문 끝에 "→ #{NEW_NUMBERS}로 분할됨" 메모 추가
       _index.md 상태 → skipped, 행은 보존
  2) 삭제
       {N}.md 파일 삭제 + _index.md 행 삭제
       단 다른 티켓이 #{N}을 의존 중이면 거부

선택 [1/2] (기본 1):
```

#### 3-E-split-5. 의존 재배선

원본 #{N}을 의존하던 행이 있으면 사용자에게 묻는다:

```
다음 티켓들이 원본 #{N}을 의존하고 있습니다:
  - #{X1}, #{X2}, ...

각 티켓의 의존을 어디로 옮길까요?
  - 신규 #{NEW_NUMBERS} 중 선택 (복수 가능)
  - 변경 안 함 (원본이 skipped로 보존되면 의존은 유효, 다만 의미상 죽은 의존)
```

답변에 따라 영향 행의 `의존 티켓` + `_index.md` `의존` 컬럼 sync. 이후 STEP 3-C-4와 동일하게 transitive reduction 재계산.

#### 3-E-split-6. `_index.md` 갱신

- 신규 N개 행 append (`pending` 상태)
- 원본 행 처리 (skipped 또는 삭제)
- 영향 받은 의존 컬럼 sync

### 3-E-merge: N → 1

#### 3-E-merge-1. 합병 대상 수집

```
합병할 티켓 번호 목록과 신규 단일 티켓의 제목을 알려주세요.
예: "{N}, {N2}, {N3}을 합병해 'X 일괄 처리'로"
```

대상 번호 검증:

- 모든 대상이 상태 가드(STEP 0-2)를 통과해야 함. `done`/`ready`/`in-progress`는 즉시 거부
- 한 대상이라도 거부 상태면 합병 자체를 중단

#### 3-E-merge-2. 신규 번호 할당

기존 max + 1. `{NEW_N}`.

#### 3-E-merge-3. 메타 inherit

대상들의 frontmatter를 비교:

- **모든 대상이 일치**하는 필드: 신규에 그대로 inherit
- **충돌**하는 필드(`scope`/`domain`/`data_source`/`scr`/`kind` 중 다른 값): 사용자에게 직접 결정 요청

```
합병 메타 충돌:
  - scope: #{N}=mobile, #{N2}=backend → ?
  - data_source: #{N}=mock, #{N2}=api → ?

각 필드를 결정해주세요.
```

#### 3-E-merge-4. 신규 티켓 작성

`ticket` STEP 4 템플릿 사용. 본문은 대상들의 본문을 모아 합성하되 사용자 검토 권장:

- AC·참조·기술 노트는 dedup 후 합치고 사용자에게 미리 보여주고 확인받음
- User Story는 사용자가 새로 작성

#### 3-E-merge-5. 대상 처리

대상 티켓 모두 `skipped` 마킹 + 본문 끝에 "→ #{NEW_N}로 병합됨" 메모 추가:

```markdown
## 철회 (Withdrawn)

- 철회일: {YYYY-MM-DD}
- 사유: #{NEW_N}로 병합됨
```

`_index.md`의 대상 행 상태 → `skipped`.

#### 3-E-merge-6. 의존 재배선

대상들 중 어느 하나라도 의존하던 다른 티켓이 있으면 그 의존을 신규 `{NEW_N}`으로 일괄 변경. 단:

- 신규 티켓 자기 자신을 의존하게 되는 케이스는 제거 (대상끼리 서로 의존 중이었다면 합병 후 자기 의존)
- transitive reduction 재계산 (STEP 3-C-4 동일)

#### 3-E-merge-7. `_index.md` 갱신

- 신규 1개 행 append (`pending` 상태)
- 대상 행들 상태 sync (`skipped`)
- 영향 받은 의존 컬럼 sync

---

## STEP 4: 결과 보고

```
✅ ticket-edit 완료 — #{N}

분류: {E1 ~ E5}
변경:
  - 티켓 본문: docs/tickets/v{PRD_VERSION}/{N}.md
  - _index.md 행: {변경 컬럼 목록}
  - 영향 받은 다른 티켓: {번호 목록 또는 없음}
  - 신규 티켓 (E5-split·merge): #{NEW_NUMBERS} 또는 #{NEW_N}

상태 SSOT: docs/tickets/v{PRD_VERSION}/_index.md
```

본 STEP은 **순수 보고**만 담당. commit 처리와 다음 단계 안내는 STEP 5·6에서 이어진다.

---

## STEP 5: commit 선택지

```
다음 작업을 선택하세요:

  1) 자동 commit (권장, 기본)
       메시지: {분류별 prefix}
  2) 직접 commit
       파일을 검토·수정한 뒤 직접 커밋. 경로 안내만 출력하고 STEP 6으로
  3) commit 보류
       파일은 워킹 디렉토리에 남김

선택 [1/2/3] (기본 1):
```

### 5-1. 분류별 commit 메시지

| 분류 | 메시지 |
|---|---|
| E1 | `chore(tickets): edit body of #{N}` |
| E2 | `chore(tickets): retarget #{N} (frontmatter)` |
| E3 | `chore(tickets): rewire deps for #{N}` |
| E4 (철회) | `chore(tickets): withdraw #{N}` |
| E4 (복원) | `chore(tickets): restore #{N}` |
| E5-split | `chore(tickets): split #{N} → #{NEW_NUMBERS}` |
| E5-merge | `chore(tickets): merge #{ORIGINALS} → #{NEW_N}` |

### 5-2. 분기 처리

#### 1 선택 / Enter

```bash
git add docs/tickets/v{PRD_VERSION}/
git commit -m "{분류별 메시지}"
```

E3·E5는 영향 받은 다른 티켓 파일도 함께 staging.

이후 STEP 6으로.

#### 2 선택

변경 파일 목록을 다시 출력하고 안내:

> 다음 파일을 검토·수정한 뒤 직접 commit하세요:
>   docs/tickets/v{PRD_VERSION}/{N}.md
>   docs/tickets/v{PRD_VERSION}/_index.md
>   {E3·E5 시 영향 받은 다른 티켓 파일}
>
> 커밋 예: `git add docs/tickets/v{PRD_VERSION}/ && git commit`

이후 STEP 6으로.

#### 3 선택

> ⚠️ commit 보류 — 워킹 디렉토리에 변경 파일이 남습니다.

이후 STEP 6으로 (보류 경고 부연 출력).

---

## STEP 6: 다음 단계 안내

commit 분기 결과와 무관하게 **분류에 따라** 다음 단계를 출력한다.

### 6-1. 분류별 안내

#### E1 / E2 / E3 (본문·메타·의존 수정)

```
다음 단계:
  - 구현 진입:   /nidost:dev-from-ticket {N}
  - 추가 수정:   /nidost:ticket-edit {N}
```

#### E4 (철회)

```
다음 단계:
  - 의존 정리:   /nidost:ticket-edit {X}   # #{N}을 의존하던 티켓이 있는 경우
  - 복원 필요:   /nidost:ticket-edit {N}
```

dev-from-ticket 안내는 출력하지 않음 (철회된 티켓은 구현 대상이 아님).

#### E4 (복원)

```
다음 단계:
  - 구현 진입:   /nidost:dev-from-ticket {N}
  - 추가 수정:   /nidost:ticket-edit {N}
```

#### E5-split (1→N)

```
다음 단계:
  - 구현 진입 (신규):   /nidost:dev-from-ticket {NEW_NUMBERS}
  - 추가 수정 (신규):   /nidost:ticket-edit {NEW_N_one}
  - 원본 처리 확인:     원본 #{N}은 {skipped 또는 삭제} 처리됨
```

#### E5-merge (N→1)

```
다음 단계:
  - 구현 진입:   /nidost:dev-from-ticket {NEW_N}
  - 추가 수정:   /nidost:ticket-edit {NEW_N}
  - 합병 대상:   #{ORIGINALS}은 모두 skipped 처리됨
```

### 6-2. STEP 5에서 3(보류) 선택 시 추가 안내

위 다음 단계 출력 직후 부연:

> ⚠️ 위 다음 단계는 commit 정리 후 진행 가능합니다:
>
> - `/nidost:dev-from-ticket`은 STEP 0-5에서 `git status --porcelain`이 비어있지 않으면 abort
> - `/nidost:ticket-edit` 추가 호출은 working tree를 더 키웁니다
> - 진입 전 stash/commit으로 정리 필요

본 스킬 종료.

---

## 주의사항

- **단일 티켓 단위**: 한 호출당 한 티켓만. 의존 그래프 재계산 정합성을 위한 제약
- **상태 가드 우선**: STEP 0-2에서 `done`/`ready`/`in-progress` 거부. 우회 금지 (거부 사유 자체가 안전장치)
- **분류 게이트 필수**: STEP 2-2의 사용자 확인을 건너뛰지 않는다. 잘못 분류 시 _index.md sync 누락
- **transitive reduction 자동 재계산 (E3·E5)**: 변경된 티켓뿐 아니라 영향 받는 다른 행의 의존 컬럼도 자동 patch. 사전 보고 게이트로 사용자에게 영향 범위 1회 확인
- **done 티켓 불변**: 의존 재계산 결과 done 티켓이 변경 대상이 되면 변경 자체를 거부. 사용자가 부분 수동 처리
- **상태 전이 미관여**: 본 스킬은 `pending`/`skipped` 양방향 전이(E4)만 직접 기록. 그 외 상태(`in-progress`/`ready`/`done`/`failed`) 전이는 `dev-from-ticket`/`merge-ticket` 책임
- **`failed` 편집 후 재실행**: worktree·feature 브랜치는 사용자가 직접 정리한 뒤 `_index.md` 상태를 `pending`으로 되돌리고 dev-from-ticket 재호출
- **commit 선택지의 보류(3)**: 다음 단계 dev-from-ticket이 STEP 0-5에서 차단됨. 의도적 보류만 사용

---

## 언어/톤

한국어. 분류 코드(E1~E5)는 본 스킬 내부 안내에 그대로 노출. 변경 보고는 `티켓 #{N} → {변경 요약}` 형식으로 간결히. 영향 받는 다른 티켓이 있으면 표 또는 목록으로 명시.
