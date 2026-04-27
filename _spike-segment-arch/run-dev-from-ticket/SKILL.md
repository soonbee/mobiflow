---
name: run-dev-from-ticket
description: >
  dev phase 오케스트레이터. 티켓(`docs/tickets/v{버전}/`)을 의존성 순으로 티켓별
  git worktree에서 구현한다. 기본은 `--review` 모드로 `ready` 상태에서 정지(머지는
  `merge-ticket` 스킬이 담당), `--auto` 플래그 시 즉시 squash merge. `_index.md`가 상태의 SSOT.
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

# run-dev-from-ticket

dev phase의 최상위 진입점. 티켓을 입력으로 받아 각 티켓을 격리된 worktree에서 구현하고, 의존성 순으로 `develop` 브랜치에 squash merge한다.

## 핵심 원칙

- **선언적 의존성**: 티켓의 `의존` 필드가 SSOT. 번호 순서는 힌트일 뿐
- **격리**: 티켓별 git worktree로 작업 공간 분리 (`worktrees/t{N}/`)
- **순차 실행**: 병렬 불가 (서브에이전트 구조 제약). MVP는 한 번에 한 티켓
- **상태 집약**: `docs/tickets/v{version}/_index.md`가 전체 티켓 상태의 SSOT
- **리뷰 게이트**: 기본 `--review` 모드. 러너 완료 시 `ready`(worktree·브랜치 보존)로 정지, `develop` 반영은 `merge-ticket` 스킬이 담당. `--auto`는 unattended 배치용
- **실패 격리**: 실패 티켓은 worktree 보존 + `failed` 마킹 + 중단
- **세그먼트 판정 위임**: 티켓 frontmatter의 `segment`를 `dev-segment-router`가 검증

---

## 입력 모드

### 대상 선택

| 형식                                 | 동작                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| `/nidost:run-dev-from-ticket v0.2.0` | `docs/tickets/v0.2.0/` 전체 티켓 (done·ready 제외) 실행 |
| `/nidost:run-dev-from-ticket 3`      | 현재 PRD 버전의 `003.md`만                              |
| `/nidost:run-dev-from-ticket 7, 11`  | 현재 PRD 버전의 `007.md`, `011.md`                      |

### 모드 플래그

| 플래그     | 기본   | 동작                                                                                        |
| ---------- | ------ | ------------------------------------------------------------------------------------------- |
| `--review` | **on** | 러너 완료 후 `ready` 상태로 정지. worktree·feature 브랜치 보존. merge는 `merge-ticket` 담당 |
| `--auto`   | off    | 러너 완료 후 즉시 squash merge + `done` 마킹 (unattended 배치용)                            |

둘 다 지정하면 `--auto` 우선. 인자 없이 호출 시 에러 후 종료.

---

## STEP 0: 사전 체크

### 0-1. 필수 선행 문서

```bash
test -f docs/prd/prd.md || { echo "❌ docs/prd/prd.md 없음"; exit 1; }
```

PRD frontmatter에서 `version`을 추출해 `{PRD_VERSION}`으로 보관.

### 0-2. 티켓 디렉토리 및 `_index.md`

```bash
TARGET_VERSION="{인자에서 추출 또는 PRD_VERSION}"
test -d "docs/tickets/v${TARGET_VERSION}" || { echo "❌ 티켓 없음. /nidost:ticket 먼저 실행"; exit 1; }
test -f "docs/tickets/v${TARGET_VERSION}/_index.md" || { echo "❌ _index.md 없음. /nidost:ticket 재실행 권장"; exit 1; }
```

### 0-3. git-flow 확인

```bash
git show-ref --verify --quiet refs/heads/develop || { echo "❌ develop 브랜치 없음 (init 스킬이 생성)"; exit 1; }
```

### 0-4. 작업 디렉토리 청결

```bash
test -z "$(git status --porcelain)" || { echo "⚠️ uncommitted 변경사항 있음. stash/commit 후 재실행"; exit 1; }
```

### 0-5. worktree 디렉토리 준비

```bash
mkdir -p worktrees
grep -q '^worktrees/' .gitignore 2>/dev/null || echo "⚠️ '.gitignore'에 'worktrees/' 추가 권장"
```

---

## STEP 1: 인자 파싱

### 1-1. 플래그 추출

인자 문자열에서 `--auto` / `--review`를 분리해 `MODE`로 보관. 기본 `MODE = review`. `--auto`가 존재하면 `MODE = auto`(둘 다 있으면 auto 우선). 나머지 토큰이 대상 선택 인자.

### 1-2. 대상 티켓 집합 `T` 결정

| 인자 패턴               | 처리                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `v{X.Y.Z}`              | `TARGET_VERSION = X.Y.Z`, `T =` 해당 디렉토리의 모든 티켓 번호 |
| 숫자 (예: `3`)          | `TARGET_VERSION = PRD_VERSION`, `T = [003]` (3자리 패딩)       |
| 쉼표 목록 (예: `7, 11`) | `T = [007, 011]`                                               |

### 1-3. 티켓 파일 존재 확인

대상 번호 중 파일 없는 것이 있으면:

> ❌ 티켓 {N}.md를 찾을 수 없습니다. `docs/tickets/v${TARGET_VERSION}/`를 확인하세요.

---

## STEP 2: 의존 그래프 구축 및 정렬

### 2-1. `_index.md` 파싱 (권위 있는 상태 기준)

의존(`의존` 컬럼)은 **현재 체크아웃된 브랜치의 `_index.md`** 에서 파싱한다(스키마 정보이므로 어느 브랜치에서 읽어도 동일).

상태(`상태` 컬럼)는 다음 규칙으로 산출하여 맵에 보관한다:

- `worktrees/tN`이 존재하면 → 해당 worktree 안의 `_index.md`의 상태 (feature 브랜치가 최신)
- 존재하지 않으면 → **develop의 `_index.md`** 기준 (`git show develop:docs/tickets/v${TARGET_VERSION}/_index.md`)

이유: 새 플로우에서 `in-progress`·`ready`·`failed` 마킹은 feature 브랜치(worktree)에만 기록되고, `done`·`pending`은 develop에 반영된다.

### 2-2. 의존 체인 확장 → `T'`

`T`의 각 티켓에 대해 `의존`을 재귀 수집. 예: `T = {007}` + 007→003→002 의존 체인 → `T' = {002, 003, 007}`.

### 2-3. `done` · `ready` 스킵 → `T''`

`T'`에서 `상태 ∈ {done, ready}`인 티켓을 제거. 이미 완료(`done`)되었거나 구현이 끝나 리뷰 대기 중(`ready`)인 의존은 재실행하지 않는다(플래그 없음). 이 스킵은 재오픈 방지를 겸한다 — `done` 티켓의 수정·보완은 `/nidost:ticket "{설명}"`으로 후속 티켓을 append해서 처리하며(원본 번호를 `의존`에 기록), 이 스킬에서 되돌리지 않는다.

### 2-4. 위상 정렬

`T''`를 의존 그래프 기준 위상 정렬. 순환 의존 감지 시 중단:

> ❌ 순환 의존 감지: {cycle} — 티켓 수정 필요

### 2-5. 의존성 미충족 시 대화형 선택

사용자 요청 `T` 외 실행 대상이 있으면(`T'' ⊃ T`):

> ℹ️ 요청한 티켓 `{T}` 실행을 위해 의존 티켓 `{T'' \ T}`도 실행해야 합니다.
>
> 실행 순서 (위상 정렬):
>
> 1. 002 DB 스키마 마이그레이션 (pending)
> 2. 003 인증 API (pending)
> 3. 007 로그인 화면 (pending) ← 요청 대상
> 4. 의존 체인부터 순서대로 실행
> 5. 종료

2번 선택 시 종료. 1번 선택 시 `T''` 전체 실행. 1·2 외 응답은 선택지를 재질의한다.

---

## STEP 3: 티켓별 순차 실행

`T''`를 위상 정렬 순으로 순회. 각 티켓에 대해 3-0 ~ 3-6 수행.

### 3-0. 의존 벽 체크 (ready 상태 의존 처리)

현재 티켓의 모든 의존 티켓 상태를 **2-1의 권위 있는 상태 규칙**(worktree 존재 시 worktree 기준, 아니면 develop 기준)으로 조회. 의존 중 `ready` 상태가 하나라도 있으면 이 티켓은 **자동 진행 불가**(develop에 의존 변경분 미반영이므로 worktree를 develop에서 뗄 수 없음). 사용자에게 안내:

> ⚠️ 티켓 {N} 실행 전제 미충족
>
> 의존 티켓 `{ready 번호 목록}`이 `ready` 상태(리뷰 대기)입니다. 진행하려면 먼저 develop에 반영이 필요합니다.
>
> 선택:
>
> 1. 해당 의존 티켓을 지금 merge한 뒤 계속 (`merge-ticket {번호 목록}` 실행 후 {N} 재개)
> 2. 이 티켓과 이후 티켓 실행 중단 (현재까지 완료된 항목은 유지)

1번 선택 시 사용자에게 `/nidost:merge-ticket {번호 목록}` 실행을 지시하고, 본 스킬은 종료(사용자가 수동 머지 후 `run-dev-from-ticket`을 재호출하여 이어감). 2번 선택 시 종료. 1·2 외 응답은 재질의.

### 3-1. worktree 생성

```bash
TITLE="{티켓 제목}"
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
[ -z "$SLUG" ] && BRANCH="feature/t{N}" || BRANCH="feature/t{N}-${SLUG}"

git worktree add -b "$BRANCH" "worktrees/t{N}" develop
```

영문이 없어 SLUG가 비면 번호만 사용(`feature/t007`).

### 3-2. `_index.md` 상태 갱신 (worktree 안에서)

**main/develop에는 커밋하지 않는다**. worktree 내부(`feature/tN-*` 브랜치)에서만 `_index.md` 해당 행을 갱신·커밋한다.

- `상태` → `in-progress`
- `worktree` → `worktrees/t{N}`

```bash
(cd "worktrees/t{N}" && \
  # docs/tickets/v${TARGET_VERSION}/_index.md의 해당 행 수정
  git add "docs/tickets/v${TARGET_VERSION}/_index.md" && \
  git commit -m "chore(t{N}): mark in-progress")
```

이 커밋은 다음 단계(러너)의 구현 커밋과 함께 squash merge 시 develop에 한 커밋으로 합쳐진다.

### 3-3. 세그먼트 검증

`Skill` tool로 `dev-segment-router`를 호출한다(슬래시 invoke 아님). 입력은 티켓 파일 경로. 출력 YAML의 `status`가:

- `valid` → 계속
- `warning` → 경고 로그로 출력 후 계속
- `invalid` → 사용자 보고 후 **이 티켓만 skipped**로 마킹하고 다음 티켓으로 진행(전체 중단 아님). `_index.md`의 `skipped` 기록은 worktree 내부에서 커밋 후 worktree를 보존(다른 티켓 진행에 영향 없음). 사용자가 티켓 수정 후 `_index.md`를 `pending`으로 되돌려 재실행한다

### 3-4. 러너 playbook 실행

검증된 세그먼트에 따라 다음 playbook을 **`Skill` tool로 load**한다:

| segment   | playbook                |
| --------- | ----------------------- |
| `app-ui`  | `dev-segment-app-ui`    |
| `feature` | `dev-segment-feature`   |

**Playbook을 단일 서브에이전트로 위임하지 마라.** 오케스트레이터(이 스킬) 자신이 playbook 내부의 각 단계(1-1, 1-2, 2-1, 2-2, 3-1)를 순서대로 직접 실행하며, **각 단계마다 명시된 서브에이전트를 별도의 `Task` 호출**로 실행한다. 한 호출에 여러 단계의 책임을 합치지 마라 — 특히 `eng-feature`/`eng-app-ui`에 formatter·static-fixer·metro-load-checker·reviewer의 책임을 떠넘기지 마라. 루프 A 조건도 오케스트레이터가 평가하며, 충족 시 1-1로 복귀한다.

러너 실행 시 **working directory를 `worktrees/t{N}`로 고정**한다. 각 `Task` 호출의 프롬프트에 다음을 포함:

> 작업 디렉토리는 `{프로젝트 루트}/worktrees/t{N}`이다. 모든 파일 조작과 쉘 명령은 이 경로를 기준으로 수행하라. 상위 경로나 다른 worktree를 참조·수정하지 마라.

오케스트레이터는 각 서브에이전트 호출 사이·완료 후 worktree 안에 커밋을 쌓는다 (playbook의 통상 완료 기준 준수).

### 3-5. 성공 시 마무리 (MODE 분기)

러너가 수정 필요 0건으로 완료하면 `MODE`에 따라 분기.

#### 3-5A. `MODE = review` (기본) — `ready` 전이

worktree·feature 브랜치를 **그대로 보존**한다. `_index.md` 갱신은 **worktree 내부에서만** 수행하며, main/develop은 건드리지 않는다.

- `상태` → `ready`
- `worktree` → `worktrees/t{N}` (유지)

권장 구현: 3-2의 `chore(t{N}): mark in-progress` 커밋을 amend하여 feature 브랜치에 "상태 마커 + 구현" 커밋을 압축해 둔다. amend 대신 별도 커밋으로 두어도 최종 squash merge에서 동일하게 흡수된다.

```bash
(cd "worktrees/t{N}" && \
  # _index.md 상태를 ready로 수정
  git add "docs/tickets/v${TARGET_VERSION}/_index.md" && \
  git commit --amend --no-edit)    # 또는 새 커밋: git commit -m "chore(t{N}): mark ready"
```

사용자는 worktree에 직접 들어가 리뷰·추가 테스트·수정 커밋을 할 수 있으며, 최종 반영은 `/nidost:merge-ticket {N}` 또는 `/nidost:merge-ticket all`로 수행한다.

#### 3-5B. `MODE = auto` — 즉시 squash merge

먼저 **worktree 안에서** `_index.md`를 최종 상태로 수정·커밋한 뒤 develop으로 squash merge한다. 결과적으로 develop에는 "구현 + `_index.md` done 마킹"이 하나의 커밋으로 합쳐진다.

```bash
# 1) worktree 안에서 done 마킹 커밋
(cd "worktrees/t{N}" && \
  # _index.md 해당 행을 상태=done, worktree=- 로 수정
  git add "docs/tickets/v${TARGET_VERSION}/_index.md" && \
  git commit -m "chore(t{N}): mark done")

# 2) develop에 squash merge
cd "{프로젝트 루트}"
git checkout develop

# 티켓 타입에 따른 커밋 prefix (Feature → feat, Bugfix → fix, Refactor → refactor, Chore/Infra → chore)
git merge --squash "$BRANCH"
git commit -m "$(cat <<EOF
${PREFIX}(t{N}): ${TITLE}

{선택: 티켓 AC 요약 또는 러너 결과 요약}
EOF
)"

COMMIT_HASH=$(git rev-parse --short HEAD)   # 보고용. _index.md에는 기록하지 않음

git worktree remove "worktrees/t{N}"
git branch -D "$BRANCH"
```

`_index.md`의 최종 상태(`상태: done`, `worktree: -`)는 위 squash 커밋에 이미 포함되어 있다. **별도의 `_index.md` 갱신 커밋은 만들지 않는다**. 완료 커밋 해시는 `COMMIT_HASH`를 보고에만 사용한다.

### 3-6. 실패 시 중단

러너가 루프 상한 초과·복구 불가능한 오류로 보고하면:

- `_index.md`: worktree 안에서 해당 티켓 `상태` → `failed`로 수정·커밋 (`git commit -m "chore(t{N}): mark failed"`). main/develop은 건드리지 않는다. `worktree` 경로는 그대로 유지
- worktree **삭제 금지** (디버깅 위해 보존)
- 이후 티켓 실행 중단
- 사용자 안내:

> ❌ 티켓 {N} 실행 실패
>
> - 세그먼트: {segment}
> - worktree: `worktrees/t{N}` (보존)
> - 실패 단계: {러너의 마지막 단계}
> - 잔여 피드백: {러너 출력 요약}
>
> 복구 옵션:
>
> 1. worktree에서 수동으로 완료 → worktree의 `_index.md`를 `ready`로 수정·커밋(amend 권장) → `/nidost:merge-ticket {N}`으로 develop에 반영
> 2. 티켓 포기: `git worktree remove worktrees/t{N} --force && git branch -D {BRANCH}` 후 main의 `_index.md`를 `skipped`로 수정·커밋(단독 커밋 1회 허용)
> 3. 티켓 내용 자체를 수정한 뒤 worktree를 제거하고 main의 `_index.md`를 `pending`으로 되돌린 뒤 재실행

---

## STEP 4: 완료 보고

```
✅ dev 실행 완료 — v{TARGET_VERSION}  [MODE={review|auto}]

실행 대상 (T''):    {번호 목록} (총 N개)
리뷰 대기 (ready):  {번호 목록} (R개)   # review 모드에서 증가
완료 (done):        {번호 목록} (M개)   # auto 모드에서 증가
실패 (failed):      {번호 목록} (K개)
건너뜀 (skipped):   {번호 목록} (S개, 세그먼트 검증 실패 포함)

세그먼트 분포:
  - app-ui:  N개
  - feature: N개

상태 SSOT: docs/tickets/v{TARGET_VERSION}/_index.md

다음 단계:
  - Ready 티켓 리뷰 및 머지 → /nidost:merge-ticket <NNN | all>
  - 남은 pending 있음      → /nidost:run-dev-from-ticket {남은 번호}
  - 전체 완료(done)         → /nidost:segment-close
```

실패·건너뜀이 있으면 각 항목의 복구 방법을 간결히 첨부. 의존 벽(3-0)으로 중단된 경우 해당 `ready` 티켓을 `merge-ticket`으로 반영한 뒤 재호출하도록 안내.

---

## 주의사항

- **git-flow 전제**: `develop` 브랜치 필수. `init` 스킬이 생성
- **worktree 경로**: `worktrees/t{N}/`. `.gitignore`에 추가 권장
- **uncommitted 변경사항 금지**: STEP 0-4에서 차단. 사용자가 stash/commit 후 재실행
- **병렬 실행 불가**: 순차만 지원. 향후 개선 여지
- **실패 티켓 worktree 보존**: 디버깅 목적. 사용자 수동 정리
- **의존성 자동 실행 금지**: 사용자 동의 없이는 의존 체인을 실행하지 않는다
- **세그먼트 `invalid` = 스킵, `failed` = 중단**: 검증 실패는 이 티켓만 건너뛰고 다음으로, 러너 실패는 전체 중단
- **`_index.md` 상태 필드 외 갱신 금지**: 의존·세그먼트·SCR 등 스키마 정보는 ticket 스킬의 소관. 이 스킬은 `상태`·`worktree` 두 컬럼만 수정 (완료 커밋 컬럼은 스키마에서 제거됨)
- **`_index.md` 커밋 위치**: 이 스킬은 main/develop 브랜치에 절대 커밋하지 않는다. 모든 상태 마커 커밋은 **worktree 내부(feature 브랜치)**에서 수행하며, `run-dev-from-ticket --auto` 모드에서 develop에 반영되는 것은 오직 squash merge 커밋 1건이다. `--review` 모드에서는 main/develop 둘 다 건드리지 않는다
- **모드 분리**: `--review`(기본)는 merge 금지 — develop에 절대 손대지 않고 `ready`에서 정지. `--auto`만이 이 스킬 내에서 merge를 수행. `ready → done` 전이는 전적으로 `merge-ticket` 스킬의 책임
- **의존 벽**: 의존 티켓이 `ready`면 실행 불가(3-0). develop에 의존 변경분이 반영되어야 worktree를 뗄 수 있음. 사용자가 먼저 `merge-ticket`으로 반영하거나 실행 범위 조정
- **재호출 시 resume**: 스킬 재호출 = `_index.md` 현재 상태 기준. 2-3에서 `done`·`ready` 티켓은 자동 스킵된다. `failed`/`skipped`는 3-6의 복구 절차에 따라 사용자가 상태를 수정한 뒤 재호출한다. 이전 호출의 메모리 상태는 재사용하지 않는다
- **done 티켓 재오픈 금지**: 배포 후 발견된 버그·누락·개선은 이 스킬에서 되돌리지 않는다. `/nidost:ticket "{설명}"`으로 후속 티켓을 append하고(`kind`는 bugfix/refactor/feature 중 적절한 값), 원본이 있으면 `의존`에 넣어 체인을 유지한다. 2-3의 `done` 자동 스킵은 이 정책과 정합적이다

---

## 언어/톤

한국어. 진행 상황은 `[N/M] 티켓 {N} {제목} — {segment}` 형식으로 간결히.
