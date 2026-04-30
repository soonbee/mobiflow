---
name: refine
description: >
  refine phase 진입점. dev/verify 직후 또는 ad-hoc으로 사용자 요청을 받아 동작하는
  코드를 멀티턴 손질·보강한다. 사전·승급 게이트로 spec 영향이 큰 변경(MAJOR)을 자동
  감지·차단하고, MAJOR 항목은 docs/spec-backlog.md(active) 또는
  docs/spec-backlog-archive.md(③번 우회)로 분리 관리한다. 휴리스틱은
  doc-guide.md §「spec 영향도 판정 휴리스틱」을 SSOT로 참조. 사용자가
  `/mobiflow:refine` 슬래시 커맨드로 명시 호출할 때만 실행되며 자연어 언급으로 자동
  트리거되지 않는다.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - Skill
  - AskUserQuestion
  - Bash(test:*)
  - Bash(grep:*)
  - Bash(awk:*)
  - Bash(sed:*)
  - Bash(ls:*)
  - Bash(mkdir:*)
  - Bash(git:*)
  - Bash(npm run:*)
---

# refine

dev/verify phase 후, 사용자가 동작하는 코드를 보면서 손질·보강하는 phase의 오케스트레이터.

본 스킬의 본질은 **멀티턴 손질 + 영향도 게이트**. 자연어 요청을 받아 영향도(PATCH/MINOR/MAJOR)를 사전 판정하고, MAJOR면 차단 게이트(케이스 B/D), 진입 후 작업 중 MAJOR 신호가 나오면 즉시 중단(승급 게이트, 케이스 C). 통과한 항목은 feature 브랜치에서 멀티턴으로 손질하며, 종료 시 변경 분석 기반으로 사후 티켓을 생성한다.

---

## 진입 조건

- `develop` 브랜치 존재 (`init`이 생성)
- working tree clean (uncommitted 변경 없음)
- `docs/spec-backlog.md` + `docs/spec-backlog-archive.md` 존재 (`init`이 생성)

미충족 시 종료 안내 후 정지.

---

## 핵심 원칙

- **고정 체인 보호** — MAJOR 변경은 정식 spec phase로 escalate. 우회 옵션(③)은 권장하지 않으며 archive에 자동 추적 등록 (남용 가시화 가드레일)
- **시각 SSOT-first (D18)** — 시각 변경은 시안·토큰을 먼저 변경 (`screen-builder`/`screen-auditor` sub-agent), 사용자 시각 검토 후 코드 동기. 거부 시 코드 무손상 (매몰비용 0). draft-revise는 호출하지 않음 (오케스트레이터 충돌 회피)
- **모든 SSOT 갱신은 사용자 동의 (D19)** — 시각 SSOT는 STEP 4-A 검토 게이트, 비시각 SSOT는 STEP 6-2 미리보기·항목별 동의 게이트. 자동 patch 없음
- **휘발 방지** — 차단된 모든 MAJOR 항목은 백로그에 등록. 작업물(브랜치)도 `backlog/<bl-id>`로 보존
- **사후 티켓** — 세션 시작 시점에 티켓 없음. 종료 시 변경 분석으로 자동 생성 (audit trail)
- **단일 세션 가정** — 동시에 여러 refine 세션 진행 안 함. 워크트리 미사용 (dev server·IDE 컨텍스트 보존이 멀티턴 손질의 핵심)
- **휴리스틱 SSOT** — 영향도 판정은 `doc-guide.md` §「spec 영향도 판정 휴리스틱」 단일 참조. 본 스킬에 사본 두지 않음

---

## 입력 모드

| 형식 | 동작 |
|---|---|
| `/mobiflow:refine "<자연어 요청>"` | 인자로 받은 요청을 즉시 처리 |
| `/mobiflow:refine` | STEP 1에서 자유 입력 받음 |

---

## STEP 0: 사전 체크

```bash
git show-ref --verify --quiet refs/heads/develop || { echo "❌ develop 브랜치 없음"; exit 1; }
test -z "$(git status --porcelain)" || { echo "❌ uncommitted 변경. stash/commit 후 재실행"; exit 1; }
test -f docs/spec-backlog.md || { echo "❌ docs/spec-backlog.md 없음"; exit 1; }
test -f docs/spec-backlog-archive.md || { echo "❌ docs/spec-backlog-archive.md 없음"; exit 1; }
```

PRD frontmatter에서 현재 버전 추출 → `{CURRENT_VERSION}` (예: `v1.0`). 백로그 등록 status 표기와 사후 티켓 디렉토리에 사용.

기존 `refine/wip/*` 브랜치가 남아 있으면 안내:

> ⚠️ 진행 중인 refine 세션이 보입니다: {브랜치 목록}
> 단일 세션 원칙에 따라 정리 후 재실행을 권장합니다.

사용자가 진행 강행을 명시하면 다음 STEP으로.

---

## STEP 1: 사용자 요청 파싱·분리 판정 (케이스 D 포함)

### 1-1. 자연어 요청 수집

사용자가 본 스킬을 트리거할 때 함께 보낸 자연어 요청을 1차 입력으로 받는다. 비어 있으면 묻는다:

> 어떤 부분을 손보고 싶으신가요? 자유롭게 적어주세요. 여러 항목이면 한 번에 적어도 됩니다.

### 1-2. 분리 필요 판정

다음 중 하나라도 해당하면 분리 필요:

- 명시적 다중 항목 (`그리고`, `또`, 번호 매김 `1.`·`2.` 등)
- 단일 요구지만 여러 화면·여러 spec 카테고리에 영향이 갈리는 광범위한 요구
- 영향도가 일관되지 않을 가능성 (일부 PATCH, 일부 MAJOR 등)

분리 불필요면 단일 항목 1개로 STEP 2 진입.

### 1-3. 항목별 영향도 판정·표 제시 (분리 필요 시)

각 항목을 분리하고 `doc-guide.md` §「spec 영향도 판정 휴리스틱」을 적용해 영향도를 판정. 표로 사용자에게 제시:

> 요청을 다음과 같이 분리·판정했습니다:
>
> | # | 요구사항             | 영향도 | 영향 spec               |
> |---|---------------------|-------|------------------------|
> | 1 | 친구 초대 화면 추가  | MAJOR | ui-design, user-journey |
> | 2 | 알림 설정 토글 추가  | MINOR | ui-design               |
> | 3 | 색상 차분하게 변경   | PATCH | design-tokens           |
>
> 분리/판정에 이의가 있으면 정정해주세요. 진행 방향도 알려주세요:
> - 묶어서 한 세션 (예: "2·3번 묶어 진행, 1번은 백로그")
> - 일부만 진행 (예: "3번만 진행")
> - 항목별 다른 처리

### 1-4. 사용자 응답 처리

- **분리/판정 정정 요청** → 1-3 재실행 (왕복 무제한 — 합의가 핵심)
- **진행 방향 확정** →
  - 진행 항목 묶음 → STEP 2 진입 (게이트 일괄 적용)
  - 미선택 항목 → 자동 백로그 등록 (active, `source: refine-pre-gate`, `status: pending`). 사용자가 명시적으로 "이건 빼"라고 거부한 항목만 등록 제외 (휘발 방지가 기본값)

진행 항목이 0개면 STEP 8(완료 보고)로 직행.

---

## STEP 2: 사전 게이트 (케이스 B)

### 2-1. PATCH/MINOR 항목 → 진입

별도 게이트 없이 STEP 3으로 진입.

### 2-2. MAJOR 항목 → 공통 3지선다 게이트

각 MAJOR 항목에 대해 「공통 절차: 게이트 3지선다 UX」 수행.

선택 결과 처리:

- **① 백로그만 등록** → 「공통 절차: 백로그 항목 등록」 (active, `source: refine-pre-gate`, `partial_work: null`) + 해당 항목 종료
- **② 범위를 좁혀 다시** → 해당 항목 종료. 백로그 등록 없음 (사용자가 곧 새 요청을 할 거라 가정)
- **③ 인라인 진행** ⚠ → 「공통 절차: 인라인 spec patch」 (사전 게이트 모드) + 해당 항목 STEP 3 진입

진행 항목이 모두 ①·②로 빠지면 STEP 8(완료 보고)로 직행.

---

## STEP 3: 컨텍스트 합성·브랜치 생성

### 3-1. scope·domain·data_source 결정

dev phase 티켓 frontmatter에 해당하는 정보를 사전에 가지고 있지 않으므로 본 STEP에서 결정.

자동 추정 시도:
- 사용자 요청에 명시된 화면/모듈 → `docs/project.config.yaml`의 `repo.scopes`에서 매칭
- 명시 없으면 `AskUserQuestion`으로 사용자에게 선택지 제시 (config의 scope 키 + "기타" 옵션)

`scope` 확정 후:
- 도메인: `domain-app-ui` / `domain-web-ui` / `domain-contract` 중 결정 (dev-from-ticket STEP 3-3-b 표 동일)
- `data_source`: UI 화면 변경 + mock 사용이면 `mock`, 실제 API 호출이면 `api`, contract면 `none`

세션 도중 scope가 바뀌어야 한다면 새 세션을 시작하는 게 맞다 (현 세션은 ②번 종료 후 재요청).

### 3-2. engineer_context 합성

```
stack_skills = stack-resolver(scope).skills
engineer_context = stack_skills ∪ {domain_skill} ∪ with_skills
```

`with_skills`는 dev-from-ticket STEP 3-3-c 표 동일:
- 사용자가 시안을 명시 참조 → `with-ui-draft`
- `data_source=mock` → `with-mock-data`
- `data_source=api` → `with-api-contract`

### 3-3. slug 추출·브랜치 생성

진행 항목의 첫 항목(또는 단일 항목)의 사용자 원문에서 핵심 명사구를 2~3 단어 kebab-case로 추출:

- "마이페이지 버튼 간격 좀 좁혀줘" → `button-spacing`
- "빈 상태 메시지 추가" → `empty-state`

```bash
SLUG="button-spacing"
BRANCH="refine/wip/${SLUG}"

# 충돌 시 -2, -3 접미사
COUNTER=2
while git show-ref --verify --quiet "refs/heads/${BRANCH}"; do
  BRANCH="refine/wip/${SLUG}-${COUNTER}"
  COUNTER=$((COUNTER + 1))
done

git checkout -b "$BRANCH" develop
```

워크트리는 사용하지 않는다.

---

## STEP 4: 멀티턴 손질 루프

세션 본체. 변경 유형(시각/비시각/혼합)에 따라 흐름이 분기되며, 각 항목 완료 후 사용자 확인을 거쳐 다음 라운드로 들어간다. 작업 중 MAJOR 신호가 감지되면 STEP 5(승급 게이트)로 빠진다.

### 4-0. 변경 유형 분류

각 진행 항목에 대해:

| 신호 | 변경 유형 |
|------|----------|
| 색·간격·copy·레이아웃·UI 요소·상태 등 시안에 반영되는 변경 | 시각 |
| 비즈니스 로직, API 호출, DB 쿼리, 내부 리팩터, 성능 개선 | 비시각 |
| 둘 다 영향 | 혼합 |

draft가 없는 프로젝트(CLI/백엔드, `docs/ui-drafts/` 부재)는 자동 비시각으로 분류.

분류 모호 시 사용자에게 한 번 확인.

### 4-A. 시각 변경 흐름 (draft-first, D18)

코드를 만지기 전에 시안·토큰을 먼저 변경해 사용자 시각 검토 후 코드 동기. 사용자 거부 시 코드 무손상으로 항목 종료(매몰비용 0).

#### 4-A-1. 좁은 분류 (screen-builder 모드 결정)

| 신호                                                      | 모드          |
|-----------------------------------------------------------|---------------|
| 단일 SCR + 영역별 시각 조정 (토큰 무관)                    | `patch`       |
| 토큰 값 미세 조정 (이름·구조 불변, 값만 ±)                  | `token-tweak` |
| 토큰 추가/삭제·의미 변경, aesthetic 금지 목록 변경 (MINOR)  | `token-shape` |

`draft-revise`는 호출하지 않는다 (오케스트레이터 충돌 회피, D18). draft phase의 atomic sub-agent인 `screen-builder` / `screen-auditor`를 직접 호출.

#### 4-A-2. screen-builder 호출

```
Task: screen-builder
  프롬프트:
    - 작업 디렉토리: <repo_root> (현재 브랜치 = ${BRANCH})
    - MODE: ${mode}              # patch / token-tweak / token-shape
    - TARGET_SCR: ${SCR_ID}       # patch 모드일 때
    - PATCH_INSTRUCTIONS: "<자연어 요청 또는 구체 instruction>"
    - 토큰 변경 시: tokens.css + design-tokens.md 동기 갱신 +
      영향 화면 재캡처 (draft-conventions 규약 준수)
```

반환: 변경 파일 목록·재캡처 화면 목록.

#### 4-A-3. screen-auditor 호출

```
Task: screen-auditor
  프롬프트:
    - SCOPE: scoped
    - SCOPE_SCRS: ${변경 화면 목록}
```

🔴 강한 판정 발견 → 4-A-2 재호출 (최대 2회). 2회 후에도 잔여 시 사용자 보고하고 4-A-4로 진행 (감수하고 진행할지 결정).

#### 4-A-4. 사용자 시각 검토 게이트

> 시안 변경이 적용되었습니다. dev server에서 확인해주세요:
>
>   make preview (또는 http://localhost:8765/_shared/INDEX.html)
>
> 변경 화면: ${SCR 목록}
> 토큰 변경: ${변경 내역}  (있을 때)
>
> 다음을 골라주세요:
> ① 좋다 — 코드 동기 진행 (4-B)
> ② 다른 안 시도 — 어떻게 조정할지 알려주세요 (4-A-2 재호출)
> ③ 원래대로 — 시안 변경 reset + 이 항목 종료 (코드 무손상, 매몰비용 0)

#### 4-A-5. 사용자 응답 처리

- **①** → 4-B 진입 (code-engineer가 합의된 시안에 맞춰 코드 동기)
- **②** → 4-A-2 재호출 (조정 사항 받아서)
- **③** → 시안 변경 reset
  ```bash
  git checkout -- docs/ui-drafts/ docs/design-tokens/
  ```
  해당 항목 종료. 다른 진행 항목 있으면 그쪽으로, 없으면 STEP 6
- **screen-builder가 처리 못 하는 큰 변경 신호** (예: 새 SCR 추가 필요) → STEP 5 (승급 게이트)

### 4-B. 비시각 변경 / 코드 동기 (code-engineer)

#### 4-B-1. code-engineer 호출

```
Task: code-engineer
  프롬프트:
    - 작업 디렉토리: <repo_root> (현재 브랜치 = ${BRANCH})
    - 진행 항목 목록 (STEP 1·2의 결과)
    - 시각 변경에서 온 호출이면: 합의된 시안 변경 내역 + "시안에 맞춰 코드 동기"
    - 비시각이면: 자연어 요청 그대로
    - "Skill tool로 다음을 차례로 invoke: ${engineer_context}"
    - 변경 후 npm run smoke 통과까지 책임 (내부 상한 3회)
    - 금지: lint disable, @ts-ignore, @ts-expect-error, as any
    - 보고 직전 모든 변경을 commit + working tree clean 검증
```

반환: 변경 파일 목록·핵심 결정·smoke 통과 상태.

`status=escalated`(smoke 상한 도달) 시 사용자에게 보고하고 4-B-3 응답 라우팅으로.

#### 4-B-2. 사용자 확인

> 변경 적용 완료. 결과를 확인해주세요 (dev server hot reload).
>
> - 추가 수정 → 자유롭게 요청
> - 마무리 → "이걸로 됐다"
> - 중단 → "그만"

#### 4-B-3. 응답 라우팅

- **추가 수정 요청** → 4-0 재진입 (변경 유형 재분류 후 4-A 또는 4-B)
- **MAJOR 신호 감지** (작업 결과 spec 변경이 필요해진 경우 등) → STEP 5
- **"이걸로 됐다"** → STEP 6
- **"그만"** → 브랜치를 그대로 두고 종료. 백로그 자동 등록은 안 함 (사용자 명시 의사 반영)

### 4-C. 혼합 변경

시각 변경분을 먼저 4-A로 합의한 뒤, 4-B에서 코드 동기 + 비시각 변경분을 함께 처리. 즉 시각이 항상 선두.

---

## STEP 5: 승급 게이트 (케이스 C)

작업 중 MAJOR 신호 감지 시 즉시 진입. 「공통 절차: 게이트 3지선다 UX」 수행.

선택 결과 처리:

- **① 백로그+브랜치 보존** →
  ```bash
  # bl-id는 「공통 절차: 백로그 항목 등록」 호출 직후 부여
  git branch -m "$BRANCH" "backlog/<bl-id>"
  # 원격이 설정되어 있으면 보존을 위해 push (선택, 원격 없으면 로컬 보존만)
  git remote get-url origin >/dev/null 2>&1 && git push -u origin "backlog/<bl-id>"
  ```
  「공통 절차: 백로그 항목 등록」 (active, `source: refine-escalation`, `partial_work: backlog/<bl-id>`) + 종료
- **② 범위를 좁혀 다시** → ①과 동일한 브랜치/백로그 보존 + 종료. 사용자가 좁힌 범위로 새 세션 시작 시 `partial_work` 참고 가능
- **③ 인라인 진행** ⚠ → 「공통 절차: 인라인 spec patch」 (승급 게이트 모드) + STEP 4 복귀 (현재 브랜치 그대로)

---

## STEP 6: 세션 종료

### 6-1. 영향도 최종 판정

`git diff develop..HEAD --name-only` 분석:

- spec 문서(`docs/<카테고리>/<카테고리>.md`) 변경 있음 → MINOR
- 토큰값(`tokens.css`·`design-tokens.md` PATCH) 변경 → PATCH
- 코드만 변경 → PATCH

사전 게이트의 추정과 다를 수 있다. 실제 변경이 SSOT.

### 6-2. 비시각 SSOT 영향 분석·동의 게이트 (D19)

시각 SSOT(`design-tokens.md` / `tokens.css` / `ui-drafts/SCR-*`)는 STEP 4-A에서 사용자 검토를 거쳐 이미 처리됐으므로 본 STEP에서 다시 묻지 않는다. **비시각 SSOT**가 영향을 받았는지 분석하고, 영향이 있으면 항목별 미리보기·동의 게이트를 거쳐 patch한다.

#### 6-2-a. 영향 후보 산출

| SSOT 후보 | 자동 미리보기·동의 | 사용자 직접 검토만 |
|-----------|------------------|--------------------|
| `ui-design.md` (단일 항목 추가/수정) | ✓ | |
| `db-design.md` / `api-design.md` (도메인 필드 영향) | | ✓ (보수적 — 자동 patch X) |
| `architecture.md` / `user-journey.md` | (보통 MAJOR라 사전 차단됨, 도달 시) | ✓ |

`git diff` + 코드 분석으로 도메인/필드/UI 요소 변경을 식별하고 영향 가능 SSOT를 후보로 산출.

#### 6-2-b. 미리보기·항목별 동의 게이트

각 자동 미리보기 가능 SSOT에 대해:

> 변경 영향 분석 — 아래 SSOT가 갱신될 필요가 있습니다:
>
> [N/M] docs/ui-design/ui-design.md  (MINOR bump)
>    위치: §<섹션>
>    변경 미리보기:
>    ─ <구체적 추가/수정 내용>
>    버전: v{prev} → v{next}
>    적용? (Y/n)
>
> ... (다른 항목)
>
> 각 항목 또는 전체 일괄 (A) / 모두 거부 (N) 가능

직접 검토만 가능한 SSOT는 patch하지 않고 안내만:

> ⚠ 추가 검토 권유 (자동 patch 안 함):
> - docs/db-design/db-design.md — <변경 후보>
>
> 본 스킬은 도메인 모델·API 변경을 자동 patch하지 않습니다. 직접 확인 후 별도 spec 작업이 필요한지 판단해주세요.

#### 6-2-c. 동의된 항목 patch + Lock 재발급

동의된 SSOT만 inline patch + frontmatter `version` bump + `updated` 갱신. 그 후 Lock 권유 (자동 X — `draft-revise` 정책과 동일):

> {카테고리} v{prev} → v{next} (MINOR)로 갱신되었습니다.
>
> 1. 지금 Lock (`/mobiflow:spec-lock {카테고리}`)
> 2. 추가 수정 후 한 번에 Lock
> 3. 종료 (Working 유지)

### 6-3. 사후 티켓 생성

다음 번호 N 결정:

```bash
LAST_N=$(ls docs/tickets/v${CURRENT_VERSION}/*.md 2>/dev/null \
  | grep -E '/[0-9]+\.md$' | sed 's/.*\///;s/\.md$//' | sort -n | tail -1)
N=$((LAST_N + 1))
```

티켓 파일 `docs/tickets/v${CURRENT_VERSION}/${N}.md` 생성. frontmatter:

```yaml
---
title: "<진행 항목 요약>"
kind: polish | bugfix | refactor   # 잠정 — 잔여 결정 사항
scope: ${scope}
domain: ${domain}
data_source: ${data_source}
created: <오늘 날짜>
source: refine
based_on:
  - branch: ${BRANCH}
---
```

본문은 변경 사유·변경 파일·간략 AC. 사후 audit 용도이므로 dev 티켓처럼 상세하지 않아도 됨.

`_index.md`에 새 행 append (dev 티켓과 동일 형식, `상태: ready` 또는 squash merge 직후 `done`).

---

## STEP 7: squash merge → develop

```bash
git checkout develop
git merge --squash "$BRANCH"

# kind에 따른 prefix
case "$KIND" in
  polish|bugfix) PREFIX="fix" ;;
  refactor)      PREFIX="refactor" ;;
  *)             PREFIX="chore" ;;
esac

git commit -m "$(cat <<EOF
${PREFIX}(t${N}): ${TITLE}

refine 세션. {진행 항목 요약}
EOF
)"

git branch -D "$BRANCH"
```

승급 게이트 ① 또는 ②로 종료된 경우 본 STEP은 스킵 (브랜치는 `backlog/<bl-id>`로 이미 보존됨).

---

## STEP 8: 완료 보고

### 정상 완료 시

```
✅ refine 세션 완료

  진행 항목:    {N}건
  - 코드 변경:  {파일 목록}
  - spec 변경:  {목록}  (MINOR였을 경우)
  - 사후 티켓:  docs/tickets/v{버전}/{N}.md (kind: {polish/bugfix/refactor})

  squash commit: {hash}

다음 단계:
  - 추가 손질: /mobiflow:refine
  - spec Lock (필요 시): /mobiflow:spec-lock <카테고리>
```

### 게이트 차단으로 종료 시 (사전 ①·②, 승급 ①·②)

```
⚠️ refine 세션이 중단되었습니다 (MAJOR 차단)

  차단 항목: {N}건
  - 백로그 등록: docs/spec-backlog.md (id: bl-XXX, ...)
  - 보존 브랜치: backlog/bl-XXX  (승급 게이트 ① 또는 ② 발동 시)

다음 단계:
  - 다음 spec 라운드 검토: /mobiflow:spec-prd 시작 시 백로그 사용
  - 범위를 좁혀 재요청: /mobiflow:refine "<좁힌 요청>"
```

### ③ 인라인 진행 발동 시 (정상 완료에 추가 안내)

```
⚠️ ③ 인라인 spec patch 적용

  변경 spec: {카테고리} v{prev} → v{next}
  archive 등록: docs/spec-backlog-archive.md (id: bl-XXX, status: inline-resolved-v{버전})

  ☞ 정식 spec phase 인터뷰를 거치지 않은 변경입니다. 다음 spec 라운드 회고에서
    archive 항목을 검토해주세요.
```

---

## 공통 절차

### 게이트 3지선다 UX

사전 게이트(STEP 2)와 승급 게이트(STEP 5)가 공유. 근거 명시 + 3지선다:

> 이 변경은 spec 재진입이 필요해 보입니다.
>
> 영향: {예: ui-design (MAJOR), user-journey (MINOR)}
> 근거: {예: '친구 초대 화면' = 새 라우트 추가}
>
> 어떻게 진행할까요?
> ① 백로그만 등록하고 종료 (다음 spec 라운드 검토 대기)
> ② 범위를 좁혀 다시 요청 (이 세션 종료, 작은 단위로 재요청)
> ③ 현재 세션에서 spec 문서를 직접 수정한 뒤 작업 진행
>    ⚠ 권장하지 않음 — 정식 spec phase의 인터뷰·검증 단계를 건너뜀

이의 제기 옵션은 두지 않는다. 잘못된 판정의 회복 경로는 ②번 "범위를 좁혀 다시 요청".

### 백로그 항목 등록

- `pending` 상태 → active(`docs/spec-backlog.md`)
- 그 외 상태(`accepted-v*` / `rejected` / `superseded` / `inline-resolved-v*`) → archive(`docs/spec-backlog-archive.md`)

신규 ID 부여: 두 파일 통합 max(`bl-XXX`) + 1, zero-padded 3자리.

항목은 markdown 헤더(`## bl-XXX`) + yaml fenced block 형식으로 append. 예:

````markdown
## bl-042

```yaml
created: 2026-04-29
source: refine-pre-gate
request: "마이페이지에 친구 초대 화면 추가"
reason: "새 화면 추가 → spec-ui-design 재진입 필요"
affected_specs: [ui-design, user-journey]
partial_work: null
spec_patches: null
status: pending
decided_at: null
decided_reason: null
```
````

승급 게이트 ① 발동 시 `partial_work`에 `backlog/bl-042` 같은 브랜치 ref 기록.

archive 직행(③) 시:

```yaml
source: refine-pre-gate-bypass | refine-escalation-bypass
status: inline-resolved-v<현재 버전>
spec_patches: ["ui-design v1.2.0 → v1.3.0"]
decided_at: <오늘 날짜>
decided_reason: "사용자 ③ 인라인 진행 선택"
```

### 인라인 spec patch (③ 발동)

1. 영향받은 spec 문서의 inline patch 내용을 사용자에게 미리보기 제시 (D19 — 어디·무엇·어떻게)
2. 사용자 동의 후 patch 적용. 인터뷰·결정 로그·재해석 검토는 스킵하지만 변경 내용은 사용자가 검토한 상태
3. frontmatter `version` MINOR bump (예: `1.2.0` → `1.3.0`) + `updated` 필드 갱신
4. 「공통 절차: 백로그 항목 등록」 archive 직행 항목 추가 (위 형식, `spec_patches` 채움)
5. spec-lock 처리:
   - **사전 게이트 ③** → 자동 수행 (작업 시작 전 spec이 안정 상태여야 하므로)
   - **승급 게이트 ③** → 사용자 명시 동의 (이미 작업 중이라 잔여 영향 검토 필요)
6. 사전 게이트 ③ → 그 후 STEP 3으로 진입 / 승급 게이트 ③ → STEP 4 복귀

사용자가 미리보기 단계(1)에서 거부하면 ③ 진행 취소 → 다시 3지선다 (①·②) 중 선택받음.

---

## 잔여 결정 사항 (사용 중 보강)

- `kind` enum: 기존 `feature/bugfix/refactor/chore`에 `polish` 추가할지, `bugfix`로 흡수할지 (현재 잠정 `polish` 추가)
- 같은 세션 내 승급 게이트 2회 이상 발동 처리 (현재: 1회 후 강제 종료가 안전)
- ③번 누적 모니터링 — "지난 버전에 ③번 5회 이상" 시 자동 회고 권유 등 추가 가드레일 필요 여부
- 사후 티켓 생성 실패 시 fallback (현재: 사용자에게 수동 작성 요청)

---

## 주의사항

- **워크트리 사용 안 함** — feature 브랜치만. dev server·IDE 컨텍스트 보존이 멀티턴 손질의 핵심
- **단일 세션** — 동시에 여러 refine 세션 진행 안 함. 같은 시점에 여러 `refine/wip/*` 브랜치 존재하면 정리 후 재실행
- **백로그 항목 영구 보존** — 어떤 status에 도달해도 삭제 금지. 정리 스킬(별도 작업)이 archive 분리하더라도 항목 자체는 보존
- **③번 우회 자제** — 권장하지 않음 표시 + archive 자동 추적 등록은 가드레일이지 면죄부가 아님. 누적되면 다음 spec 라운드 회고에서 검토 압력
- **MAJOR 휴리스틱 SSOT** — `doc-guide.md` §「spec 영향도 판정 휴리스틱」 단일 참조. 본 스킬에 사본 두지 않음
- **사후 티켓 위치** — `docs/tickets/v{버전}/`에 dev 티켓과 함께. `kind` 필드로 구분
- **이의 제기 옵션 없음** — 잘못된 판정 회복 경로는 ② "범위를 좁혀 다시 요청". 출시 후 사용자 마찰 신호 보이면 재도입 검토
- **Lock 자동/수동 정책** — MINOR 시 spec-lock은 사용자 동의(권유). 사전 게이트 ③의 spec-lock만 자동 (작업 시작 전 안정 필요)

---

## 언어/톤

한국어. 진행 상황은 `[refine] {STEP 이름}` 형식으로 간결히. 게이트 분기·사용자 응답 처리는 명시적으로 노출.
