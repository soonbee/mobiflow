---
name: merge-ticket
description: >
  `ready` 상태 티켓의 feature 브랜치를 develop으로 squash merge하고 `done` 처리한다.
  `run-dev-from-ticket --review`의 후속 단계. 인자는 티켓 번호(쉼표 목록) 또는 `all`.
  worktree·feature 브랜치를 정리하고, `_index.md`의 최종 상태(done·worktree:-)는 squash merge 커밋에 포함시킨다.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# merge-ticket

`run-dev-from-ticket --review`로 구현이 끝나 `ready` 상태로 대기 중인 티켓을 사용자 리뷰 후 `develop`에 squash merge하고 `done`으로 전이시킨다. `_index.md`의 상태 전이는 오직 이 스킬과 `run-dev-from-ticket`만 수행한다.

## 핵심 원칙

- **ready만 대상**: `_index.md`에서 `상태 = ready`인 티켓만 처리. 그 외는 에러 또는 스킵
- **상태 SSOT**: `docs/tickets/v{PRD_VERSION}/_index.md`가 대상 탐색과 상태 기록의 근거
- **의존 순 merge**: 다수 대상 처리 시 의존 그래프 위상 정렬로 순서 결정
- **실패 격리**: conflict 등 실패한 티켓은 worktree·브랜치 보존 + 사용자 안내 + 나머지 처리 중단
- **분리된 책임**: 구현(run-dev-from-ticket)과 머지(이 스킬)를 분리해 리뷰 게이트 제공

---

## 입력 모드

| 형식                              | 동작                                                      |
| --------------------------------- | --------------------------------------------------------- |
| `/nidost:merge-ticket 7`          | 현재 PRD 버전의 `007` 티켓(상태 ready) merge              |
| `/nidost:merge-ticket 7, 11`      | 현재 PRD 버전의 `007`, `011` 순차 merge                   |
| `/nidost:merge-ticket all`        | 현재 PRD 버전의 **모든** `ready` 티켓을 의존 순으로 merge |
| `/nidost:merge-ticket v0.2.0 all` | 명시 버전의 모든 `ready` 티켓 merge                       |
| `/nidost:merge-ticket v0.2.0 7`   | 명시 버전의 `007` merge                                   |

인자 없이 호출 시 에러 후 종료. 대상이 0개이면 안내 후 정상 종료.

---

## STEP 0: 사전 체크

### 0-1. PRD / 버전 확인

```bash
test -f docs/prd/prd.md || { echo "❌ docs/prd/prd.md 없음"; exit 1; }
```

PRD frontmatter에서 `version`을 추출해 `{PRD_VERSION}`로 보관. 인자에 `v{X.Y.Z}`가 있으면 `TARGET_VERSION = X.Y.Z`, 없으면 `TARGET_VERSION = PRD_VERSION`.

### 0-2. `_index.md` 존재

```bash
test -f "docs/tickets/v${TARGET_VERSION}/_index.md" || { echo "❌ _index.md 없음"; exit 1; }
```

### 0-3. git-flow 확인

```bash
git show-ref --verify --quiet refs/heads/develop || { echo "❌ develop 브랜치 없음"; exit 1; }
```

### 0-4. 작업 디렉토리 청결

```bash
test -z "$(git status --porcelain)" || { echo "⚠️ uncommitted 변경사항 있음. stash/commit 후 재실행"; exit 1; }
```

현재 브랜치와 무관하게 실행 가능하지만, merge 단계에서 `git checkout develop`으로 전환되므로 전환 가능 상태여야 한다.

---

## STEP 1: 인자 파싱 및 대상 집합 `M`

### 1-1. 버전 토큰 제거

인자에서 `v{X.Y.Z}` 토큰을 추출(있으면 0-1에서 이미 처리). 나머지 토큰을 대상 인자로 사용.

### 1-2. 대상 번호 집합 `M` 결정

`all` 인자의 `ready` 스캔은 **각 worktree의 `_index.md`** 를 기준으로 한다. 새 플로우에서 `ready` 상태는 feature 브랜치(worktree)에만 기록되며 develop의 `_index.md`는 해당 티켓을 여전히 `pending`으로 표시한다(merge 완료 시 squash로 `done`이 됨).

| 인자                | 처리                                            |
| ------------------- | ----------------------------------------------- |
| `all`               | `git worktree list`에서 `worktrees/tN` 각각 열어 해당 worktree의 `_index.md`가 그 티켓을 `ready`로 표시한 번호 집합 |
| 숫자 (예: `7`)      | `M = [007]` (3자리 패딩)                        |
| 쉼표 목록 (`7, 11`) | `M = [007, 011]`                                |

### 1-3. 상태 검증

각 티켓 번호 `N`에 대해 **권위 있는 상태(authoritative state)** 를 다음 규칙으로 산출:

- `worktrees/tN`이 존재하면 → 해당 worktree 안의 `docs/tickets/v${TARGET_VERSION}/_index.md`의 상태를 사용 (feature 브랜치가 최신)
- 존재하지 않으면 → **develop의 `_index.md`** 기준 (`git show develop:docs/tickets/v${TARGET_VERSION}/_index.md`)

판정:

- `ready` → 정상 대상
- `done` → 이미 merge됨. 사용자 안내 후 **스킵**(에러 아님)
- `pending` / `in-progress` → 에러 종료:

  > ❌ 티켓 {N}은 `{상태}` 상태입니다. merge는 `ready` 상태만 가능.
  > `pending`/`in-progress`는 `/nidost:run-dev-from-ticket {N}`으로 먼저 구현을 완료하세요.

- `failed` / `skipped` → 에러 종료:

  > ❌ 티켓 {N}은 `{상태}` 상태입니다. 수동 복구 후 상태를 `ready`로 조정한 뒤 재호출하세요.

- 행 자체가 없으면 에러 종료.

검증 후 대상이 0개이면:

> ℹ️ merge할 `ready` 티켓이 없습니다.

로 안내하고 정상 종료.

---

## STEP 2: 의존 순 정렬

### 2-1. 위상 정렬

`M`을 `_index.md` 의존 그래프 기준으로 위상 정렬. 결과가 `M'`.

### 2-2. 외부 의존 확인

`M'`의 각 티켓 의존 중 `M'`에 포함되지 않은 것이 있으면, 1-3과 동일한 **권위 있는 상태(authoritative state)** 규칙(worktree 존재 시 worktree 기준, 아니면 develop의 `_index.md` 기준)으로 상태를 산출한 뒤 판정:

- `done` → OK (이미 develop에 반영)
- `ready`, `pending`, `in-progress` → **에러**:

  > ❌ 티켓 {N} merge 불가. 의존 티켓 `{X}`의 상태가 `{상태}`입니다.
  > 의존 티켓을 먼저 `done`으로 만든 뒤 재시도하세요.
  >
  > - `ready`이면 이번 `merge-ticket` 호출에 포함하거나 먼저 실행
  > - `pending`이면 `run-dev-from-ticket`으로 구현 후 merge

---

## STEP 3: 티켓별 순차 merge

`M'`를 순서대로 순회. 각 티켓에 대해 3-1 ~ 3-3 수행.

### 3-1. 메타 복원

`_index.md`에서 해당 행의 `제목`, `세그먼트`, `worktree`를 읽어 `TITLE`, `SEGMENT`, `WORKTREE`로 보관. `WORKTREE`가 `-`이면 비정상 상태(run-dev-from-ticket이 기록했어야 함) → 에러 종료 및 사용자 안내.

feature 브랜치 이름은 worktree 내부에서 조회:

```bash
BRANCH=$(git -C "${WORKTREE}" branch --show-current)
test -n "$BRANCH" || { echo "❌ 티켓 ${N} worktree에서 브랜치 복원 실패"; exit 1; }
```

### 3-2. worktree 청결 확인

사용자가 리뷰·수정 중 커밋하지 않은 변경을 남기지 않았는지 확인:

```bash
test -z "$(git -C "${WORKTREE}" status --porcelain)" || {
  echo "⚠️ worktree ${WORKTREE}에 uncommitted 변경 있음. 해당 worktree에서 commit/stash 후 재실행"
  exit 1
}
```

실패 시 이 티켓 처리 중단 + 나머지 처리 중단(상태는 그대로 `ready` 유지).

### 3-3. done 마킹 + squash merge

먼저 **worktree 안에서** `_index.md`의 해당 행을 최종 상태로 수정·커밋한다. 이 커밋은 이후 squash merge에 포함되어 develop에는 별도의 `_index.md` 갱신 커밋이 남지 않는다.

```bash
(cd "${WORKTREE}" && \
  # docs/tickets/v${TARGET_VERSION}/_index.md의 해당 행을 상태=done, worktree=- 로 수정
  git add "docs/tickets/v${TARGET_VERSION}/_index.md" && \
  git commit -m "chore(t${N}): mark done")
```

그 다음 develop으로 squash merge. 티켓 타입 prefix는 티켓 파일 frontmatter의 `type` 또는 제목 접두사 기준 — Feature → `feat`, Bugfix → `fix`, Refactor → `refactor`, Chore/Infra → `chore`.

```bash
cd "{프로젝트 루트}"
git checkout develop

git merge --squash "$BRANCH"
git commit -m "$(cat <<EOF
${PREFIX}(t${N}): ${TITLE}

{선택: 티켓 AC 요약 또는 완료 요약}
EOF
)"

COMMIT_HASH=$(git rev-parse --short HEAD)   # 보고용

git worktree remove "${WORKTREE}"
git branch -D "$BRANCH"
```

결과: develop에는 "구현 + `_index.md` 최종 상태(done·worktree:-)"가 한 커밋으로 합쳐져 남는다. 별도의 상태 갱신 커밋은 만들지 않는다. 완료 커밋 해시는 `_index.md`에 기록하지 않고 보고에만 사용한다.

**conflict 처리**: `git merge --squash`가 conflict를 내면:

- `git merge --abort` 또는 staged 변경 파기(`git reset --hard HEAD`)로 develop을 원복
- worktree·브랜치 보존 (이미 worktree 안에는 done 마킹 커밋이 들어가 있으나 문제없음 — 충돌 해소 후 재시도 시 그대로 흡수됨)
- develop의 `_index.md`는 변경 없음 (해당 티켓은 여전히 `ready`로 표시됨)
- 사용자 안내:

  > ❌ 티켓 {N} merge conflict
  >
  > - worktree: `${WORKTREE}` (보존)
  > - 브랜치: `${BRANCH}` (보존, done 마킹까지 커밋됨)
  >
  > 복구:
  >
  > 1. worktree에서 `git rebase develop` 또는 `git merge develop`으로 충돌 해소 후 커밋
  > 2. 본 스킬 재호출 (`/nidost:merge-ticket {N}`)
  >
  > 이후 티켓 merge는 중단되었습니다.

- 해당 티켓 이후 `M'` 처리 중단.

---

## STEP 4: 완료 보고

```
✅ merge 완료 — v{TARGET_VERSION}

처리 대상 (M'):  {번호 목록} (총 N개)
Merge 성공:      {번호 목록} (M개, 커밋: {해시 목록})
중단 (conflict): {있으면 번호와 원인}

상태 SSOT: docs/tickets/v{TARGET_VERSION}/_index.md

다음 단계:
  - 남은 ready 있음 → /nidost:merge-ticket <NNN | all>
  - 남은 pending 있음 → /nidost:run-dev-from-ticket {번호 | v{버전}}
  - 전체 done → /nidost:segment-close
```

---

## 주의사항

- **ready만 merge**: `pending`/`in-progress`/`failed`/`skipped`는 이 스킬 밖에서 처리. 상태 강제 변경 금지
- **의존 우선**: `M'` 내 외부 의존이 `done`이 아니면 중단. 의존 무시한 merge는 develop 히스토리를 망가뜨림
- **conflict 시 develop 원복**: 부분 merge 상태로 develop을 남기지 않는다. abort/reset으로 깨끗한 상태 복구 후 중단
- **단일 책임**: 이 스킬은 `ready → done` 전이만 수행. 구현·검증·재실행은 `run-dev-from-ticket`의 소관
- **`_index.md` 수정 범위**: `상태`·`worktree` 두 컬럼만 (완료 커밋 컬럼은 스키마에서 제거됨). 제목·세그먼트·SCR·의존 등 스키마 정보는 절대 수정 금지
- **`_index.md` 커밋 위치**: done 마킹은 worktree 내부(feature 브랜치)에서 커밋한 뒤 squash merge로 develop에 반영된다. develop에 별도의 상태 갱신 커밋을 생성하지 않는다
- **worktree 삭제 실패 시**: `git worktree remove`가 실패하면 `git worktree prune` 또는 `--force`를 사용자에게 안내. 스킬이 `--force`를 자동 적용하지 않는다(데이터 손실 방지)
- **재호출 안전**: `done` 티켓이 인자에 섞여 있으면 스킵하고 계속. 이미 처리된 항목을 다시 처리하지 않는다

---

## 언어/톤

한국어. 진행 상황은 `[N/M] 티켓 {N} {제목} — merge {커밋해시}` 형식으로 간결히.
