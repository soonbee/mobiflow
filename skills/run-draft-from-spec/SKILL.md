---
name: run-draft-from-spec
description: spec 문서를 기반으로 정적 UI 시안을 생성하는 draft phase의 단일 세그먼트 플레이북. ui-design·design-tokens가 Lock된 후 docs/ui-drafts/ 트리를 빌드한다. /nidost:run-draft-from-spec으로 직접 실행하거나 spec-ui-design 완료 시 lifecycle 안내를 통해 진입한다.
---

# run-draft-from-spec

draft phase의 단일 세그먼트 플레이북. spec 문서(ui-design.md, design-tokens.md)를 기반으로 `docs/ui-drafts/` 트리를 빌드한다.

오케스트레이터는 이 문서의 단계를 순서대로 따르며, 각 단계에서 지정된 서브에이전트를 호출한다.

---

## 사전 체크 (STEP 0)

### 0-1. 필수 선행 문서 존재 및 Lock 확인

`docs/ui-design/ui-design.md`와 `docs/design-tokens/design-tokens.md`가 모두 존재하고 Lock 상태여야 한다.

```bash
for CAT in ui-design design-tokens; do
  test -f docs/${CAT}/${CAT}.md || { echo "❌ docs/${CAT}/${CAT}.md 없음"; exit 1; }
  VERSION=$(awk '/^version:/ {print $2; exit}' docs/${CAT}/${CAT}.md)
  git tag --list "doc/${CAT}/v${VERSION}" | grep -q . && echo "${CAT}: locked v${VERSION}" || echo "${CAT}: working v${VERSION}"
done
```

- 둘 다 Lock 아님 → 사용자에게 안내 후 종료:
  > ⚠️ `{카테고리}`가 Working 상태입니다. draft 작성 전 `/nidost:spec-lock {카테고리}`로 Lock하는 것을 권장합니다.
  >
  > 1. 지금 Lock
  > 2. Working 상태 그대로 진행 (재현성 약화)
  > 3. 종료
- 파일 자체가 없으면 종료. spec phase 완료를 먼저 권유

추출한 버전을 `{UI_DESIGN_VERSION}`, `{DT_VERSION}`로 보관.

### 0-2. ui-design.md §0 범위 선언 점검

ui-design.md 본문 상단에 `## 0. 범위 선언`이 있고 "이 프로젝트에서는 사용자 인터페이스가 해당 없음" 류의 A2형 스킵이 명시되면 종료:

> ℹ️ 이 프로젝트는 ui-design.md §0에 따라 시각 UI를 갖지 않습니다. draft phase는 해당 없음.

§0이 있지만 재해석된 인터페이스(CLI 명령 트리, API 문서 페이지 등)가 명시된 경우는 그대로 진행한다. 시안은 그 인터페이스를 정적 HTML로 시각화한다.

### 0-3. 기존 ui-drafts/ 상태 분기

```bash
test -d docs/ui-drafts
```

- **없음 → 신규 빌드**: STEP 1로 진행
- **있음 + 통합 태그 `draft/v*` 없음 (Working)**:
  > ℹ️ `docs/ui-drafts/`가 Working 상태입니다.
  >
  > 1. 이어서 갱신 (특정 화면만 재빌드)
  > 2. 전체 재빌드 (덮어씀)
  > 3. 종료
- **있음 + Lock 태그 존재**:
  > ⚠️ `docs/ui-drafts/`가 Lock 상태입니다 ({기존 태그}).
  >
  > 1. 새 버전 작성 (덮어쓰며 새 Working 진입)
  > 2. 종료

선택 1·2에 따라 빌드 범위를 결정.

---

## STEP 1 — Stage 1: 공통 자산 빌드 (직렬, 1회)

서브에이전트 `eng-ui-draft`를 1회 호출하여 `docs/ui-drafts/_shared/`를 빌드한다.

- **보유 스킬**: frontend-design, with-ui-spec, dev-ui-draft
- **호출 모드**: Stage 1 (`_shared/`만 빌드)
- **입력**: `docs/ui-design/ui-design.md`, `docs/design-tokens/design-tokens.md`
- **수행 내용**:
  - `_shared/tokens.css` — design-tokens → CSS 변수 평탄화
  - `_shared/aesthetic.md` — 7개 섹션(큰 방향·색 분포·공간 리듬·타이포 위계·모서리·모션·금지 목록)
  - `_shared/partials/` — ui-design.md §2 내비게이션을 보고 구조 partial(header/tabbar/footer/sidebar/모달 컨테이너) 생성. 각 partial과 동명 `.css` 함께 생성
  - `_shared/includer.js` — `dev-ui-draft`의 30줄 레퍼런스 구현 그대로
- **출력**: `docs/ui-drafts/_shared/` 트리

호출 프롬프트에 다음 명시:
- "Stage 1 — Shared Assets only. Do not touch any SCR-xxx directory."
- 입력 문서 경로
- 산출 디렉토리 경로
- "프로젝트가 갱신 모드(0-3 선택 1)인 경우 기존 _shared/는 보존하고 누락분만 보충"

---

## STEP 2 — Stage 2: 화면별 빌드 (병렬)

ui-design.md §1 화면 목록을 파싱해 빌드 대상 SCR-xxx 목록을 만든다.

- 신규 빌드: 전체 화면
- 갱신(특정 화면만 재빌드): 사용자 지정 SCR 또는 직전 STEP 3 강한 판정에서 적출된 SCR
- 전체 재빌드: 전체 화면

각 SCR-xxx마다 `eng-ui-draft`를 **병렬 호출**한다.

- **보유 스킬**: frontend-design, with-ui-spec, dev-ui-draft
- **호출 모드**: Stage 2 (단일 SCR-xxx)
- **입력 (각 호출에 동일하게 전달)**:
  - 자기 화면의 ui-design.md §3 명세 (해당 화면 부분만)
  - `_shared/` 경로 (모든 자산 참조)
  - design-tokens.md 경로 (필요 시 직접 참조)
- **수행 내용**:
  - `docs/ui-drafts/SCR-xxx/{index.html, style.css, script.js?, notes.md, variants/?}` 생성
  - 헤더·탭바 등 구조 partial은 `data-include`로만 참조
  - 명세에 정의된 모든 UI 요소·상태 시연 가능하게 구현
- **출력**: `docs/ui-drafts/SCR-xxx/` 트리

병렬 호출 시 각 에이전트는 자기 SCR 디렉토리 외에는 어떤 파일도 수정하지 않는다 (eng-ui-draft 본문에 명시됨).

병렬 호출이 모두 완료되면 STEP 3로 진행.

---

## STEP 3 — 리뷰 (1회)

서브에이전트 `reviewer-ui-draft`를 1회 호출한다.

- **보유 스킬**: review-ui-draft
- **모델**: sonnet
- **입력**: `docs/ui-drafts/` 전체 + `docs/ui-design/ui-design.md` + `docs/design-tokens/design-tokens.md`
- **수행 내용**:
  - 4구역 출력 (수정 필요 / 권장 / 통과 / 평론 노트)
- **출력**: 검수 보고서

---

## 루프 분기

STEP 3 결과의 **수정 필요 (🔴)** 항목을 분석해 다음 분기 중 하나를 선택한다.

### 분기 A: 수정 필요 없음

- 종료 조건 만족 → STEP 4 (완료 보고)로 진행

### 분기 B: 수정 필요 항목이 특정 화면(들)에만 있음

- 영향 범위: 해당 SCR-xxx만
- 복귀 단계: STEP 2 (해당 화면들만 병렬 재호출)
- 컨텍스트: 강한 판정 항목을 해당 SCR의 `eng-ui-draft` 호출 프롬프트에 전달
- 재실행 후 STEP 3 재수행

### 분기 C: 수정 필요 항목이 _shared 변경을 요구

다음 중 하나라도 해당:
- `_shared/tokens.css` 누락·오류
- `_shared/aesthetic.md` 7개 섹션 누락
- 구조 partial 누락 또는 일관성 결함
- includer.js 누락

대응:
- 영향 범위: 전체
- 복귀 단계: STEP 1 → STEP 2 (전체 화면) → STEP 3
- 컨텍스트: 강한 판정 항목을 Stage 1 `eng-ui-draft` 프롬프트에 전달

### 권장 (🟡)·평론 노트 (📝)

자동 재빌드 트리거가 아니다. STEP 4 완료 보고에 그대로 포함하여 사용자에게 전달.

### 루프 상한

- 분기 B와 C 합산 최대 **3회**
- 상한 초과 시 잔여 강한 판정 항목과 평론 노트를 사용자에게 보고하고 수동 판단을 요청

---

## STEP 4 — 완료 보고 및 산출물 정리

### 4-1. INDEX.md 작성/갱신

`docs/ui-drafts/INDEX.md` 생성:

```markdown
# UI Drafts Index

| 화면 ID | 디렉토리 | 변형 수 | 비고 |
| --- | --- | --- | --- |
| SCR-001 | [SCR-001/](SCR-001/) | 0 | 랜딩 |
| SCR-002 | [SCR-002/](SCR-002/) | 1 | variants/admin.html |

## 공통 자산
- [_shared/tokens.css](_shared/tokens.css)
- [_shared/aesthetic.md](_shared/aesthetic.md)
- [_shared/partials/](_shared/partials/)

## 검토 방법
정적 서버를 시안 루트에서 실행 후 브라우저에서 확인.
```bash
cd docs/ui-drafts && python3 -m http.server 8000
```
http://localhost:8000/SCR-001/index.html
```

### 4-2. CHANGELOG.md 작성/갱신

```markdown
# UI Drafts Changelog

## 0.1.0 ({YYYY-MM-DD})
- 초안 작성 (ui-design v{UI_DESIGN_VERSION}, design-tokens v{DT_VERSION} 기반)
- 화면 N개, 공통 partial M개
```

갱신인 경우 새 항목 추가.

### 4-3. _shared/aesthetic.md frontmatter

`_shared/aesthetic.md` 최상단에 frontmatter:

```yaml
---
title: UI Drafts Aesthetic
version: 0.1.0
based_on:
  - ui-design@{UI_DESIGN_VERSION}
  - design-tokens@{DT_VERSION}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---
```

이 frontmatter가 통합 Lock 태그(`draft/v0.1.0`)의 버전 기준이 된다.

### 4-4. 완료 요약 출력

```
✅ UI Drafts v0.1.0 작성 완료

  공통 자산:    docs/ui-drafts/_shared/
  화면 시안:    docs/ui-drafts/SCR-xxx/ × N개
  INDEX:        docs/ui-drafts/INDEX.md
  CHANGELOG:    docs/ui-drafts/CHANGELOG.md

  기준 ui-design:    v{UI_DESIGN_VERSION}
  기준 design-tokens: v{DT_VERSION}

  강한 판정: 0건 | 권장: N건 | 평론 노트: N건

검토 방법:
  cd docs/ui-drafts && python3 -m http.server 8000
  http://localhost:8000/SCR-001/index.html

다음 phase: dev (dev-segment-router로 진입)
```

권장·평론 노트가 있으면 요약 아래에 그대로 인용.

### 4-5. Lifecycle 프롬프트

> draft phase가 완료되었습니다.
>
> 1. Lock (`git commit` + `git tag draft/v{VERSION}`)
> 2. Working 상태 유지 (추가 화면 작성 또는 수동 편집 예정)
> 3. dev phase로 바로 진입 (`/nidost:run-app-ui-from-draft` 또는 dev-segment-router)

선택 1: commit + tag 안내. 직접 수행하지 않고 사용자에게 위임 (spec-lock 패턴과 동일).

---

## 주의사항

- Stage 2 병렬 호출 시 각 에이전트가 자기 SCR 외 파일을 절대 수정하지 않도록 프롬프트에 명시
- 갱신 모드에서 기존 `_shared/`를 함부로 덮어쓰지 않음 — 누락분만 보충
- 평론 노트는 자동 재빌드 트리거가 아님 (사람 판단 게이트)
- 본 스킬은 Lock(commit + tag)을 직접 수행하지 않는다. 사용자 또는 별도 명령에 위임
