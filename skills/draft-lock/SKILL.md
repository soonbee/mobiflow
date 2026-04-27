---
name: draft-lock
description: Working 상태인 draft 산출물(`docs/ui-drafts/`)을 commit + tag로 Lock하는 유틸리티 스킬. 사용자가 `/nidost:draft-lock` 슬래시 커맨드로 명시 호출할 때만 실행되며 자연어 언급으로 자동 트리거되지 않는다.
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(test:*)
  - Bash(awk:*)
  - Bash(grep:*)
  - Bash(git status:*)
  - Bash(git symbolic-ref:*)
  - Bash(git show-ref:*)
  - Bash(git checkout:*)
  - Bash(git rev-parse:*)
  - Bash(git tag:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git add:*)
  - Bash(git commit:*)
---

# draft-lock

Working 상태인 draft 산출물(`docs/ui-drafts/`)을 **Lock**으로 전환합니다. 이 스킬은 `git commit` + `git tag draft/v<버전>`을 수행하는 유틸리티입니다. 시안 작성·수정 로직은 포함하지 않으며, 오직 버전 확정(Lock)만 담당합니다.

draft phase는 단일 산출물·단일 태그 구조이므로 spec-lock과 달리 카테고리 스캔·일괄 모드가 없습니다. 본 스킬은 항상 `docs/ui-drafts/` 하나만 처리합니다.

상세한 라이프사이클은 `draft-phase.md`, draft-build STEP 6-2, draft-revise STEP 4를 참조하세요.

---

## 핵심 원칙

- **Lock만 담당**: 시안 내용 생성·수정은 `draft-build` / `draft-revise`에서. 본 스킬은 git commit + tag만 수행
- **이미 Lock된 버전에는 재실행 금지**: 태그 중복 방지. PATCH 변경이 있으면 aesthetic.md `version`을 PATCH 증가시킨 뒤 재호출
- **단일 태그 단위**: spec-lock의 카테고리 분리와 달리 draft는 통합 태그(`draft/v<버전>`) 하나로 lock
- **CHANGELOG·INDEX 책임 경계**: 누락·불일치 시 경고만, 본 스킬이 대신 작성하지 않음
- **원격 push 금지**: 사용자가 필요할 때 수동으로 `git push --tags`

---

## STEP 0: 사전 체크

### 0-1. 작업 브랜치 확인

`docs/doc-guide.md`의 「작업 라인」을 따릅니다. 현재 브랜치가 `main`이면 `develop`으로 자동 이동합니다. 이외 브랜치는 그대로 진행합니다.

```bash
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ "$CURRENT_BRANCH" = "main" ]; then
  if ! git show-ref --verify --quiet refs/heads/develop; then
    echo "❌ develop 브랜치가 없습니다. /nidost:init으로 먼저 부트스트랩해주세요."
    exit 1
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ main 브랜치에 미커밋 변경이 있어 develop으로 이동할 수 없습니다."
    echo "   변경을 commit·stash·discard 중 하나로 처리한 뒤 다시 호출해주세요."
    exit 1
  fi
  git checkout develop
  echo "ℹ️ draft 작업을 위해 develop 브랜치로 이동했습니다."
fi
```

### 0-2. git 저장소 확인

```bash
git rev-parse --is-inside-work-tree
```

실패하면:

> ❌ 현재 디렉토리가 git 저장소가 아닙니다. Lock은 git commit + tag 작업을 포함하므로 저장소 내에서만 동작합니다.

### 0-3. draft 산출물 존재 확인

```bash
test -d docs/ui-drafts
test -f docs/ui-drafts/_shared/aesthetic.md
```

없으면 종료:

> ❌ `docs/ui-drafts/` 또는 `_shared/aesthetic.md`를 찾을 수 없습니다. 먼저 `/nidost:draft-build`로 시안을 빌드해주세요.

---

## STEP 1: 상태 검사

### 1-1. 버전 추출

`_shared/aesthetic.md` frontmatter에서 `version:` 필드를 읽어 `{VERSION}`에 보관:

```bash
VERSION=$(awk '/^version:/ {print $2; exit}' docs/ui-drafts/_shared/aesthetic.md)
```

추출 실패(빈 값) → 종료:

> ❌ `docs/ui-drafts/_shared/aesthetic.md` frontmatter에서 `version` 필드를 찾지 못했습니다. (필수 필드 `title`, `version`, `updated`, `viewports` 확인)

### 1-2. 태그 중복 확인

```bash
git tag --list "draft/v${VERSION}" | grep -q .
```

태그 이미 존재(Lock 상태) → 종료:

> ℹ️ `docs/ui-drafts/` v{VERSION}은 이미 Lock 상태입니다. 새 변경이 있다면 `_shared/aesthetic.md`의 `version`을 PATCH로 올린 뒤 다시 실행하세요.

태그 부재(Working 상태) → STEP 2로 진입.

---

## STEP 2: CHANGELOG·INDEX 무결성 확인

```bash
test -f docs/ui-drafts/CHANGELOG.md
grep -qE "^## *${VERSION}([^0-9.]|$)" docs/ui-drafts/CHANGELOG.md
test -f docs/ui-drafts/INDEX.md
```

누락 또는 불일치 시 경고 후 사용자 판단에 맡깁니다 (본 스킬이 대신 작성하지 않음):

> ⚠️ `docs/ui-drafts/CHANGELOG.md` 또는 `INDEX.md`에 v{VERSION} 항목이 누락되었거나 버전이 일치하지 않습니다.
>
> 1. 그래도 Lock 진행
> 2. 종료 (CHANGELOG·INDEX 보완 후 재실행)

선택 1 → STEP 3 진행. 그 외 → 종료.

---

## STEP 3: 변경 diff 표시 + commit message 생성

### 3-1. 변경 diff 표시

```bash
git diff --stat docs/ui-drafts/
```

변경 사항이 없으면 "이미 커밋됨, 태그만 추가" 메모. 있으면 diff 요약을 사용자에게 표시.

### 3-2. CHANGELOG 블록 추출

CHANGELOG.md의 `## {VERSION}` 블록 본문을 추출 (제목 라인 제외, 블록 끝의 공백 라인은 트림):

```bash
awk -v ver="${VERSION}" '
  /^## / {
    if (in_block) exit
    in_block = ($0 ~ "^## " ver "([^0-9.]|$)")
    next
  }
  in_block { print }
' docs/ui-drafts/CHANGELOG.md
```

### 3-3. Subject·Body 생성 (영어)

커밋 메시지는 Subject·Body 모두 **영어**로 작성합니다. CHANGELOG 파일의 원본 언어(통상 한국어)는 유지되며, 커밋 시점에만 번역을 수행합니다.

1. **Subject**: 추출된 블록을 읽고 **영어 imperative 형태의 짧은 subject**를 직접 생성
   - Conventional Commits 스타일 (동사 원형으로 시작, 소문자, 마침표 없음)
   - 50자 이내 권장
   - 여러 불릿이면 대표 변경 하나로 요약
   - 버전 문자열을 subject에 포함하지 않음 (태그에 이미 인코딩됨)

   예시:
   - `- 초안 작성` → `draft initial ui drafts`
   - `- SCR-001 히어로 색 강조` → `tweak SCR-001 hero accent`
   - `- 토큰 갱신 --color-accent` → `tweak --color-accent token`
   - Breaking 변경은 `!` 접미사 사용: `docs(draft)!: rebuild on tokens v0.3.0`

2. **Body**: 추출된 블록의 **각 불릿을 영어로 번역**해 Body를 구성. 원본의 불릿 구조(순서·들여쓰기·섹션 소제목)는 그대로 유지하고 내용만 영어로 옮김. **CHANGELOG.md 파일 자체는 수정하지 않음** — 원본 언어 유지.

3. **Fallback**: CHANGELOG 블록이 비어있거나 추출 실패 시
   - Subject: `lock v{VERSION}`
   - Body: (생략)

4. **최종 메시지 구조**:
   ```
   docs(draft): {SUBJECT}

   {BODY}
   ```

---

## STEP 4: commit + tag 수행

### 4-1. 커밋·태그 명령

Body가 있는 경우:

```bash
git add docs/ui-drafts/
git commit -m "docs(draft): {SUBJECT}" -m "{BODY}"
git tag -a draft/v{VERSION} -m "docs(draft): {SUBJECT}" -m "{BODY}"
```

Body가 없는 경우 (fallback):

```bash
git add docs/ui-drafts/
git commit -m "docs(draft): lock v{VERSION}"
git tag -a draft/v{VERSION} -m "docs(draft): lock v{VERSION}"
```

커밋할 변경이 없으면 `git commit`은 건너뛰고 tag만 수행.

### 4-2. 실패 처리

commit·tag 명령이 실패하면 원인 메시지를 사용자에게 그대로 보여주고 종료:

> ⚠️ Lock 실패: {error message}
>
> 변경을 검토한 뒤 다시 실행해주세요.

부분 성공(commit은 됐는데 tag가 실패) 시 사용자가 수동으로 tag만 추가할 수 있도록 안내:

```bash
git tag -a draft/v{VERSION} -m "docs(draft): {SUBJECT}"
```

---

## STEP 5: 완료 보고

```
✅ draft-lock 완료

  docs/ui-drafts/ → draft/v{VERSION} ({commit hash})

  기준 spec:
    - ui-design v{UI_DESIGN_VERSION}
    - design-tokens v{DT_VERSION}

다음 단계:
  - 원격 push가 필요하면: git push && git push --tags
  - 다음 phase: /nidost:compile-project-config → dev-segment-router
```

`{UI_DESIGN_VERSION}`·`{DT_VERSION}`은 `_shared/aesthetic.md` frontmatter `based_on:` 항목에서 추출:

```bash
awk '/^based_on:/,/^[a-z_]+:/' docs/ui-drafts/_shared/aesthetic.md \
  | awk '/ui-design@/ {sub(/.*ui-design@/, ""); print; exit}'
awk '/^based_on:/,/^[a-z_]+:/' docs/ui-drafts/_shared/aesthetic.md \
  | awk '/design-tokens@/ {sub(/.*design-tokens@/, ""); print; exit}'
```

추출 실패 시 해당 줄은 생략하고 보고만 출력.

---

## 주의사항

- 이 스킬은 **Lock만 담당**합니다. 시안 내용 생성·수정은 `draft-build` / `draft-revise`에서 수행하세요.
- 이미 Lock된 버전에는 재실행되지 않습니다 (태그 중복 금지). 추가 변경은 `_shared/aesthetic.md`의 `version`을 PATCH 증가시킨 뒤 다시 호출.
- 원격 저장소 push는 수행하지 않습니다. 사용자가 필요할 때 수동으로 push.
- CHANGELOG·INDEX가 누락·불일치 상태면 경고 후 사용자 판단에 맡깁니다. 본 스킬이 대신 작성하지 않습니다 (책임 경계).
- git 작업 디렉토리의 다른 경로(`docs/ui-drafts/` 외)는 건드리지 않습니다. `git add`는 `docs/ui-drafts/`만 수행.

---

## 언어/톤

한국어. 짧고 명확하게. 에러·경고 메시지는 원인과 복구 방법을 함께 표시합니다.
