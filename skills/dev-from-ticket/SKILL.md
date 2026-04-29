---
name: dev-from-ticket
description: >
  dev phase 진입점. 티켓(`docs/tickets/v{버전}/`)을 의존성 순으로 worktree에서 구현·리뷰한다.
  티켓 frontmatter의 scope·domain·data_source로 라우팅 키를 구성하고, stack-resolver로 use-*를
  결정하며, 도메인·티켓 컨텍스트로 with-*/review-*를 합성한다. 기본 `--review` 모드로 ready 상태
  정지(머지는 `merge-ticket` 담당), `--auto` 플래그 시 즉시 squash merge. `_index.md`가 상태 SSOT.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - Skill
---

# dev-from-ticket

dev phase의 최상위 진입점. 티켓을 입력으로 받아 각 티켓을 격리된 worktree에서 구현하고, 의존성 순으로 `develop` 브랜치에 squash merge한다.

## 핵심 원칙

- **선언적 라우팅**: 티켓 frontmatter의 `scope`·`domain`·`data_source`가 SSOT
- **격리**: 티켓별 git worktree (`worktrees/t{N}/`)
- **순차 실행**: 병렬 불가 (서브에이전트 구조 제약)
- **상태 집약**: `docs/tickets/v{version}/_index.md`가 전체 상태 SSOT
- **리뷰 게이트**: 기본 `--review` 모드 — `ready`에서 정지. `--auto`는 unattended 배치용
- **실패 격리**: `failed`·`skipped` 구분. 검증 실패는 한 티켓만 skip, 러너 실패는 전체 중단
- **smoke 일원화**: format / lint / typecheck / test / token-lint를 `npm run smoke`가 통합. `code-engineer`가 통과 책임 (D2)
- **2층 검증 분리**: 본 phase는 Layer 1(개별 검증)만. visual-check·test-backfill은 `integration-verify` (D5)

---

## 입력 모드

### 대상 선택

| 형식 | 동작 |
|---|---|
| `/nidost:dev-from-ticket v0.2.0` | `docs/tickets/v0.2.0/` 전체 (done·ready 제외) |
| `/nidost:dev-from-ticket 3` | 현재 PRD 버전의 `3.md`만 |
| `/nidost:dev-from-ticket 7, 11` | 현재 PRD 버전의 `7.md`, `11.md` |

### 모드 플래그

| 플래그 | 기본 | 동작 |
|---|---|---|
| `--review` | **on** | 러너 완료 후 `ready`로 정지. worktree·feature 브랜치 보존. merge는 `merge-ticket` 담당 |
| `--auto` | off | 러너 완료 후 즉시 squash merge + `done` 마킹 |

둘 다 지정 시 `--auto` 우선. 인자 없이 호출 시 에러 후 종료.

---

## STEP 0: 사전 체크

### 0-1. 필수 선행 문서

```bash
test -f docs/prd/prd.md || { echo "❌ docs/prd/prd.md 없음"; exit 1; }
```

PRD frontmatter에서 `version` 추출 → `{PRD_VERSION}`.

### 0-2. project.config.yaml 존재 (신규)

```bash
test -f docs/project.config.yaml || {
  echo "❌ docs/project.config.yaml 없음. /nidost:compile-project-config 실행 필요"
  exit 1
}
```

config의 `repo.scopes`가 비어있으면 abort:

```bash
# yq 또는 grep로 repo.scopes 비어있지 않음 확인
```

`stack-resolver`가 동작하려면 config·scope 정보 필수.

### 0-3. 티켓 디렉토리 및 `_index.md`

```bash
TARGET_VERSION="{인자에서 추출 또는 PRD_VERSION}"
test -d "docs/tickets/v${TARGET_VERSION}" || { echo "❌ 티켓 없음. /nidost:ticket 먼저 실행"; exit 1; }
test -f "docs/tickets/v${TARGET_VERSION}/_index.md" || { echo "❌ _index.md 없음"; exit 1; }
```

### 0-4. git-flow

```bash
git show-ref --verify --quiet refs/heads/develop || { echo "❌ develop 없음 (init이 생성)"; exit 1; }
```

### 0-5. 작업 디렉토리 청결

```bash
test -z "$(git status --porcelain)" || { echo "⚠️ uncommitted 변경. stash/commit 후 재실행"; exit 1; }
```

### 0-6. worktree 디렉토리

```bash
mkdir -p worktrees
grep -q '^worktrees/' .gitignore 2>/dev/null || echo "⚠️ '.gitignore'에 'worktrees/' 추가 권장"
```

---

## STEP 1: 인자 파싱

### 1-1. 플래그 추출

`--auto` / `--review`를 분리해 `MODE` 보관. 기본 `MODE=review`. `--auto` 존재 시 `MODE=auto`. 나머지 토큰이 대상 선택 인자.

### 1-2. 대상 티켓 집합 `T` 결정

| 인자 | 처리 |
|---|---|
| `v{X.Y.Z}` | `TARGET_VERSION = X.Y.Z`, `T =` 해당 디렉토리의 모든 티켓 번호 |
| 숫자 | `TARGET_VERSION = PRD_VERSION`, `T = [N]` |
| 쉼표 목록 | `T = [...]` |

### 1-3. 티켓 파일 존재 확인

대상 번호 중 파일 없는 것 → 에러 출력 후 종료.

---

## STEP 2: 의존 그래프 구축 및 정렬

### 2-1. `_index.md` 파싱

의존(`의존` 컬럼)은 현재 체크아웃된 브랜치의 `_index.md`에서 파싱.

상태(`상태` 컬럼)는 다음 규칙:

- `worktrees/tN`이 존재 → 해당 worktree의 `_index.md`
- 존재하지 않음 → develop의 `_index.md` (`git show develop:docs/tickets/v${TARGET_VERSION}/_index.md`)

이유: `in-progress`·`ready`·`failed` 마킹은 feature 브랜치에만 기록되고, `done`·`pending`은 develop에 반영됨.

### 2-2. 의존 체인 확장 → `T'`

`T`의 각 티켓에 대해 `의존`을 재귀 수집.

### 2-3. `done` · `ready` 스킵 → `T''`

`상태 ∈ {done, ready}`인 티켓 제거.

### 2-4. 위상 정렬

순환 의존 감지 시 abort.

### 2-5. 의존성 미충족 시 대화형 선택

사용자 요청 `T` 외 실행 대상이 있으면(`T'' ⊃ T`) 사용자에게 선택지 제시:

1. 의존 체인부터 순서대로 실행
2. 종료

---

## STEP 3: 티켓별 순차 실행

`T''`를 위상 정렬 순으로 순회. 각 티켓에 대해 3-0 ~ 3-6 수행.

### 3-0. 의존 벽 체크

의존 티켓 중 `ready` 상태가 있으면 자동 진행 불가. 사용자에게 안내 후 본 스킬 종료. `merge-ticket` 실행 후 재호출.

### 3-1. worktree 생성

```bash
TITLE="{티켓 제목}"
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
[ -z "$SLUG" ] && BRANCH="feature/t{N}" || BRANCH="feature/t{N}-${SLUG}"

git worktree add -b "$BRANCH" "worktrees/t{N}" develop
```

### 3-2. 티켓 frontmatter 검증

티켓 파일을 파싱해 frontmatter 필드 검증:

#### 필드 존재 검사

- `scope`, `domain`, `data_source`, `kind` 모두 있어야 함

#### 값 검사

- `kind` ∈ {feature, bugfix, refactor, chore}
- `domain` ∈ {ui, contract}
- `data_source` ∈ {mock, api, none}
- `scope` ∈ `config.repo.scopes` 키

#### 교차 제약

- `domain=contract` + `scr` 존재 → invalid
- `domain=ui` + scope.runtime이 frontend 아님 → invalid
- `scr` 정규화: `scr=[]` 또는 `scr` 필드 없음 → 동등 ("시안 참조 없음")

frontend runtime 목록: `react-native-expo`, `nextjs` (라우팅 표 3-3-b 매핑 대상). 신규 runtime 추가 시 본 검증과 라우팅 표 함께 갱신.

#### 검증 실패 처리

- `_index.md` (worktree 내부) `상태` → `skipped`
- worktree 안에서 commit (`chore(t{N}): mark skipped — frontmatter invalid`)
- 사유를 사용자에게 보고
- 다음 티켓 진행 (전체 abort 아님)

검증 통과 시 worktree 안에서 in-progress 마킹 commit.

### 3-3. 컨텍스트 합성

#### 3-3-a. stack-resolver 호출

```
Skill: stack-resolver(scope=<티켓.scope>)
```

반환 YAML의 `status` 분기:

- `ok` → `stack_skills = response.skills`
- `not-found` / `ambiguous` / `invalid` → 이 티켓 `skipped` (suggestions를 사용자에 보고) + 다음 티켓

#### 3-3-b. 도메인 결정

| 조건 | 결정 |
|---|---|
| `domain=contract` | `domain_skill = domain-contract` |
| `domain=ui` + `scope.runtime=react-native-expo` | `domain_skill = domain-app-ui` |
| `domain=ui` + `scope.runtime=nextjs` | `domain_skill = domain-web-ui` |
| 매칭 실패 (방어선) | 이 티켓 `skipped` (3-2에서 거부됐어야 함) |

#### 3-3-c. with-* 결정

| 조건 | 추가 |
|---|---|
| `scr` 비어있지 않음 | `with-ui-draft` |
| `data_source=mock` | `with-mock-data` |
| `data_source=api` | `with-api-contract` |
| `data_source=none` | (없음) |

#### 3-3-d. review-* 결정

| 조건 | 추가 |
|---|---|
| `domain=ui` 공통 | `review-ui-common`, `review-impl` |
| `domain=ui` + `scope.runtime=react-native-expo` | `review-ui-app` |
| `domain=ui` + `scope.runtime=nextjs` | `review-ui-web` |
| `domain=ui` + `tooling.token_lint=no` (config) | `review-design-tokens` |
| `domain=contract` | `review-code`, `review-impl` |

#### 합성 결과

```
engineer_context = stack_skills ∪ {domain_skill} ∪ with_skills
reviewer_context = stack_skills ∪ {domain_skill} ∪ review_skills
```

### 3-4. 구현·검증·리뷰 루프

**외부 루프 A** (상한 3회).

```
loop_count = 0
last_feedback = null

while loop_count < 3:
  ── engineer 호출 ─────────────────────────────────────
  Task: code-engineer
    프롬프트 구성:
      - 작업 디렉토리: <repo_root>/worktrees/t{N}
      - 로드 지시: "Skill tool로 다음을 차례로 invoke: {engineer_context}"
      - 티켓 파일 경로: docs/tickets/v{TARGET_VERSION}/{N}.md
      - 티켓 frontmatter 요약 (scope, domain, scr, data_source, kind)
      - 디자인 시안 경로 (scr 있을 시): docs/ui-drafts/{SCR}/
      - smoke 통과까지 책임 (내부 상한 3회)
      - 금지: lint disable, @ts-ignore, @ts-expect-error, as any
      - 보고 직전 모든 변경을 commit하고 `git -C <worktree> status`로 working tree clean 검증 (smoke 통과 후 commit 누락 빈번)
      - last_feedback (있으면 reviewer 피드백 정리, 마지막 라운드만)

  반환:
    status: ok | escalated
    smoke_internal_count: 0~3
    working_tree_clean: true | false
    summary: 변경 파일 + 핵심 결정·가정

  status=escalated 처리:
    → 외부 루프 종료, 3-6 진입 (failed, reason: smoke-escalated)

  ── reviewer 호출 ────────────────────────────────────
  Task: code-reviewer
    프롬프트 구성:
      - 작업 디렉토리: <repo_root>/worktrees/t{N}
      - 로드 지시: "Skill tool로 다음을 차례로 invoke: {reviewer_context}"
      - 티켓 파일 경로 (Part B AC 점검 위해)
      - diff 범위: develop..HEAD

  반환:
    part_a: { verdict, items }
    part_b: { verdict, items }
    overall: pass | 🟡 | 🔴

  ── verdict 분기 ─────────────────────────────────────
  if overall == pass or overall == 🟡:
    → 3-5 (성공)
  elif overall == 🔴:
    last_feedback = reviewer 출력 정리 (Part A·B 🔴 항목만)
    loop_count += 1
    continue   # 외부 루프 다음 라운드

# while 종료 = loop_count == 3 도달
→ 3-6 (failed, reason: review-loop-cap)
```

**핵심 동작 규칙**:

- 컨텍스트 전달 = 스킬 *이름 목록*. 에이전트가 Skill tool로 자체 로드 (e1)
- reviewer 피드백 누적 = **마지막 라운드만** (컨텍스트 폭발 방지, e2)
- smoke escalated = 외부 루프 즉시 종료 (e3)
- 🟡(권장)만 있으면 통과. 🔴(수정 필요)만 외부 루프 트리거 (e4)
- 내부 smoke 루프와 외부 루프는 별개 카운터 (e5)

오케스트레이터는 각 Task 호출 사이·완료 후 worktree 안에 commit을 쌓는다.

### 3-5. 성공 시 마무리 (MODE 분기)

#### 3-5A. `MODE = review` (기본) — `ready` 전이

worktree·feature 브랜치 **그대로 보존**. `_index.md` 갱신은 **worktree 내부에서만**, main/develop 미접촉.

- `상태` → `ready`
- `worktree` → `worktrees/t{N}` (유지)

권장: 3-2의 in-progress commit을 amend하거나 별도 commit. 최종 squash merge에서 동일하게 흡수.

```bash
(cd "worktrees/t{N}" && \
  # _index.md 상태를 ready로 수정
  git add "docs/tickets/v${TARGET_VERSION}/_index.md" && \
  git commit --amend --no-edit)    # 또는 새 commit
```

사용자는 worktree에서 직접 리뷰·추가 테스트·수정 commit 가능. 최종 반영은 `/nidost:merge-ticket {N}`.

#### 3-5B. `MODE = auto` — 즉시 squash merge

먼저 worktree 안에서 `_index.md`를 최종 상태로 commit한 뒤 develop으로 squash merge.

```bash
# 1) worktree 안에서 done 마킹
(cd "worktrees/t{N}" && \
  # _index.md 해당 행: 상태=done, worktree=-
  git add "docs/tickets/v${TARGET_VERSION}/_index.md" && \
  git commit -m "chore(t{N}): mark done")

# 2) develop에 squash merge
cd "{프로젝트 루트}"
git checkout develop

# 티켓 kind에 따른 commit prefix:
# Feature → feat, Bugfix → fix, Refactor → refactor, Chore → chore
git merge --squash "$BRANCH"
git commit -m "$(cat <<EOF
${PREFIX}(t{N}): ${TITLE}

{선택: 티켓 AC 요약 또는 러너 결과 요약}
EOF
)"

COMMIT_HASH=$(git rev-parse --short HEAD)

git worktree remove "worktrees/t{N}"
git branch -D "$BRANCH"
```

`_index.md`의 최종 상태(`상태: done`, `worktree: -`)는 squash commit에 이미 포함됨. **별도 `_index.md` 갱신 commit 만들지 않음**.

### 3-6. 실패 시 중단

```
실패 사유 식별:
  - smoke-escalated:   code-engineer 내부 smoke 루프 상한 도달
  - review-loop-cap:   외부 루프 A 상한 도달
  - validation-skipped (3-2): 검증 실패 → skipped 처리, 3-6 아님
  - resolver-skipped (3-3-a): stack-resolver 실패 → skipped 처리

처리:
  _index.md (worktree 내부) `상태` → failed
  worktree·feature 브랜치 보존 (디버깅용)
  사용자 안내:
    - 사유 (smoke-escalated / review-loop-cap)
    - 잔여 피드백 (escalated → 마지막 smoke 출력, review-loop-cap → 마지막 reviewer 피드백)
    - 복구 옵션:
      1. worktree에서 수동 완료 → ready 마킹 → /nidost:merge-ticket
      2. 티켓 포기 → worktree 제거 + main의 _index.md skipped 마킹
      3. 티켓 수정 후 worktree 제거 → main의 _index.md pending 복원 → 재실행
  이후 티켓 실행 중단
```

`skipped`(검증·resolver 실패) = 한 티켓만 건너뛰고 다음 티켓 진행. `failed`(러너 실패) = 전체 중단.

---

## STEP 4: 완료 보고

```
✅ dev 실행 완료 — v{TARGET_VERSION}  [MODE={review|auto}]

실행 대상 (T''):    {번호 목록} (총 N개)
리뷰 대기 (ready):  {번호 목록} (R개)   # review 모드
완료 (done):        {번호 목록} (M개)   # auto 모드
실패 (failed):      {번호 목록} (K개)
건너뜀 (skipped):   {번호 목록} (S개, 검증·resolver 실패 포함)

도메인 분포:
  - ui:       N개
  - contract: N개

scope 분포 (멀티 scope 프로젝트):
  - mobile:   N개
  - backend:  N개

상태 SSOT: docs/tickets/v{TARGET_VERSION}/_index.md

다음 단계:
  - Ready 티켓 머지 → /nidost:merge-ticket <NNN | all>
  - 남은 pending 있음 → /nidost:dev-from-ticket {남은 번호}
  - 모든 done 도달 → /nidost:integration-verify v{TARGET_VERSION}
```

실패·건너뜀이 있으면 각 항목의 복구 방법을 간결히 첨부.

---

## 주의사항

- **git-flow 전제**: `develop` 브랜치 필수
- **worktree 경로**: `worktrees/t{N}/`. `.gitignore` 권장
- **uncommitted 변경 금지**: STEP 0-5에서 차단
- **병렬 실행 불가**: 순차만 지원
- **실패 티켓 worktree 보존**: 디버깅 목적
- **의존성 자동 실행 금지**: 사용자 동의 없이 의존 체인 실행 X
- **`_index.md` 컬럼 스키마 고정**: 컬럼 추가·삭제·이름 변경 금지. 본 스킬은 행 단위 갱신만 수행
- **`_index.md` 커밋 위치**: 본 스킬은 main/develop 절대 미커밋. 모든 상태 마커는 worktree 내부(feature 브랜치). `--auto`에서 develop 반영은 squash merge 1건
- **모드 분리**: `--review`는 merge 금지. `--auto`만 본 스킬에서 merge. `ready → done` 전이는 `merge-ticket`의 책임
- **의존 벽**: 의존 티켓이 `ready`면 실행 불가. 사용자가 `merge-ticket` 또는 실행 범위 조정
- **재호출 시 resume**: `_index.md` 현재 상태 기준. `done`·`ready` 자동 스킵
- **done 티켓 재오픈 금지**: 후속 티켓 append로 처리 (`/nidost:ticket "{설명}"`)
- **smoke 계약 누락 (D2 R3)**: 프로젝트에 `npm run smoke` 미정의 시 code-engineer가 escalate. `expo-sdk55-unistyles-stack` 등 scaffolder가 smoke 정의 책임
- **token-lint 검출 (f1)**: `config.tooling.token_lint` 필드로 결정. `yes`면 smoke가 검사, `no`면 `review-design-tokens` 추가 로드

---

## 언어/톤

한국어. 진행 상황은 `[N/M] 티켓 {N} {제목} — {domain}/{scope}` 형식으로 간결히. 컨텍스트 합성 결과는 `engineer/reviewer 컨텍스트 = [...]`로 노출.
