---
name: draft-revise
description: draft-build 완료 후 dev phase 진입 전 시안 수정·비교를 처리하는 라우터. 자연어 요청을 L1 in-scope / L1 token-tweak / L1-explore / L2 token-shape / L3 requirement 5분류로 라우팅하고, L1·L1-explore는 자체 처리, L2·L3은 spec phase로 escalate한다. 사용자가 `/nidost:draft-revise` 슬래시 커맨드로 명시 호출할 때만 실행되며 자연어 언급으로 자동 트리거되지 않는다.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - Bash(test:*)
  - Bash(awk:*)
  - Bash(grep:*)
  - Bash(git tag:*)
  - Bash(git diff:*)
  - Bash(ls:*)
  - Bash(cd:*)
  - Bash(mkdir:*)
  - Bash(rm:*)
  - Bash(cp:*)
  - Bash(python3:*)
  - Bash(node:*)
  - Bash(npm run:*)
  - Bash(sleep:*)
  - Bash(kill:*)
---

# draft-revise

draft-build로 시안이 만들어진 뒤, 사용자가 dev phase 진입 전에 추가 손질·비교를 원할 때 진입점이 되는 오케스트레이터.

본 스킬의 본질은 **분류와 라우팅**. 자연어 요청을 5개 레벨로 나눠 적절한 처리 경로로 보낸다.

---

## 진입 조건

- `docs/ui-drafts/` 존재 + 최소 1회 빌드 완료 (`_shared/aesthetic.md` 존재로 판정)
- spec(`ui-design.md`, `design-tokens.md`) 모두 존재

조건 미충족 시 종료:

> ⚠️ draft-revise는 draft-build로 시안이 한 번 만들어진 뒤에 사용합니다.
> 먼저 `/nidost:draft-build`로 시안을 빌드해주세요.

---

## 핵심 원칙

- **분류는 항상 사용자 1회 확인 게이트**. 자동 분류만으로 진행하지 않는다 (잘못 분류 시 spec 우회 위험)
- **spec 직접 수정의 범위 한정**:
  - L2 (토큰 형태 변경) → `design-tokens.md` 단일 문서 patch + spec-lock(MINOR) 호출까지 본 스킬이 수행 (다른 spec 문서는 건드리지 않음)
  - L3 (요구사항 변경) → 본 스킬은 직접 수정하지 않고 spec phase 정식 재진입을 권유
- **explore는 임시 산출물** — 결정 게이트 + 미선택 자동 폐기. 라이프사이클이 닫혀야 INDEX가 깨끗하게 유지됨
- **conventions가 SSOT**: 본 스킬도 작성·리뷰 규약은 `draft-conventions`를 따른다. 호출하는 screen-builder·screen-auditor가 그 규약을 본다

---

## STEP 1: 사용자 입력 수집·정규화

### 1-1. 자연어 요청 수집

사용자가 본 스킬을 트리거할 때 함께 보낸 자연어 요청을 1차 입력으로 받는다. 비어 있거나 모호하면 묻는다:

> 어떤 부분을 수정하고 싶으신가요? 자유롭게 적어주세요. 여러 항목이면 모두 한 번에 적어도 됩니다.

### 1-2. 정규화

자연어를 다음 슬롯으로 추출:

```yaml
requests:
  - intent: "버튼 색을 더 진하게"
    target: SCR-001 또는 전체 또는 미상
    aspect: color | size | spacing | layout | content | state | flow | other
    multi_compare: false   # "여러 안 보고 싶다"의 신호 있으면 true
  - ...
```

- **intent**: 사용자 표현 그대로 보존
- **target**: 사용자가 화면을 명시했으면 SCR id, "전체"·"모든 화면"이면 ALL, 명시 없으면 unknown
- **aspect**: 변경 성격 분류
- **multi_compare**: "비교", "여러 개", "A안/B안", "vs" 같은 신호 감지

### 1-3. 사용자에게 추출 요약 확인

> 요청 정리:
> 1. {intent} (target: SCR-001, aspect: color)
> 2. {intent} (target: 전체, aspect: spacing, 비교 요청)
>
> 맞나요? 빠진 부분이나 정정할 부분이 있으면 알려주세요.

확인 후 STEP 2로.

---

## STEP 2: 레벨 분류

각 request를 다음 5개 레벨 중 하나로 분류.

| 레벨 | 정의 | 처리 경로 |
| --- | --- | --- |
| **L1 in-scope** | 화면 자유 합성 영역(B 영역)의 시각 조정 — 한 화면 한정, 토큰·구조 불변 | STEP 3-A |
| **L1 token-tweak** | 토큰 값 미세 조정 (이름·구조 불변, 값만 ±) | STEP 3-B |
| **L1-explore** | 동시 비교 N안 (색·크기·위치·UI 형태 등) | STEP 3-C |
| **L2 token-shape** | 토큰 추가/삭제·의미 변경, aesthetic.md "금지 목록"·"색 분포" 변경 | STEP 3-D |
| **L3 requirement** | 화면 추가/삭제, UI 요소·상태 추가, 사용자 플로우 변경 | STEP 3-E |

### 2-1. 분류 휴리스틱

| 신호                                                        | 추정 레벨 |
| ----------------------------------------------------------- | --------- |
| target = 단일 SCR + aspect = color/size/spacing/layout      | L1 in-scope |
| target = 전체 + aspect = color/size/spacing + 값 미세 조정  | L1 token-tweak |
| `multi_compare: true`                                       | L1-explore |
| target = 전체 + aspect = color/size/spacing + 토큰 추가·삭제·의미 변경 | L2 |
| aesthetic.md 금지 목록·색 분포 규칙 변경 요구               | L2 |
| 새 화면 추가, 새 UI 요소(버튼·필드 등) 추가, 새 상태(로딩/에러) 추가 | L3 |
| 사용자 플로우 변경, 화면 간 이동 변경                       | L3 |

휴리스틱은 **참고**일 뿐. 모호하면 STEP 2-2의 사용자 확인에서 정정한다.

### 2-2. 사용자 확인 게이트 (필수)

분류 결과를 사용자에게 제시:

> 변경 요청 분류:
>
> 1. "{intent}" → **L1 in-scope** (SCR-001 자체에서 시각 조정. 토큰·spec 변경 없음)
> 2. "{intent}" → **L1-explore** (3안 비교 후 결정)
> 3. "{intent}" → **L2 token-shape** (design-tokens.md에 새 토큰 추가 필요. spec-lock MINOR로 처리)
>
> 이대로 진행할까요? 분류가 다르다고 판단되면 알려주세요.

사용자가 분류를 정정하면 그대로 받아들인다. AI 추정보다 사용자 의도가 우선.

확인 후 각 request를 STEP 3-A~E로 라우팅.

---

## STEP 3-A: L1 in-scope

화면 자유 합성 영역만 손대는 좁은 변경.

### 3-A-1. screen-builder(patch) 호출

호출 프롬프트:

```
MODE: patch
TARGET_SCR: SCR-001
PATCH_INSTRUCTIONS:
  - "히어로 영역 CTA 버튼 색을 --color-accent로 강조"
  - "본문 첫 단락 위 여백을 한 단계 늘림"
```

screen-builder는 conventions §3-3 patch 규약에 따라 편집 가능 영역만 수정.

### 3-A-2. screen-auditor(scoped) 호출

호출 프롬프트:

```
SCOPE: scoped
SCOPE_SCRS: SCR-001
```

좁은 점검. cross-screen 일관성은 여전히 전체에 적용되지만 per-SCR 강한 판정은 SCR-001만 보고.

### 3-A-3. 결과 처리

- 수정 필요 0건 → 진행
- 수정 필요 있음 → screen-builder(patch) 재호출 (최대 2회)
- 2회 재호출 후에도 잔여 → 사용자에게 보고하고 수동 결정

### 3-A-4. CHANGELOG 갱신

`docs/ui-drafts/CHANGELOG.md`에 새 항목 추가:

```
## v0.1.1 (PATCH)

- SCR-001: 히어로 CTA 색 강조 (사용자 요청)
- SCR-001: 본문 첫 단락 위 여백 조정 (사용자 요청)
```

---

## STEP 3-B: L1 token-tweak

토큰 값 미세 조정. 이름·구조 불변, 값만 ±.

### 3-B-1. 영향 화면 산출

해당 토큰을 참조하는 SCR-xxx 목록을 grep으로 산출.

```bash
TOKEN_NAME="--color-accent"
grep -l "var(${TOKEN_NAME})" docs/ui-drafts/SCR-*/style.css
```

`{AFFECTED_SCRS}` 목록과 그 수 `{N}`을 보관.

### 3-B-2. 영향 화면 게이트 (필수)

> 토큰 변경 안내:
> - `--color-accent`: `#e5ff00` → `#d4ee00`
> - 영향 화면: 12개 (SCR-001, SCR-003, SCR-007, ...)
>
> 영향 화면이 한 번에 같이 바뀝니다. 진행할까요? (Y/n)
>
> 일부 화면만 적용하고 싶으면 L1-explore로 비교 후 결정하는 것을 권장합니다.

사용자 거절 → 종료 (L1-explore 권유).

### 3-B-3. 자동 동기화

진행 시:

1. **`docs/ui-drafts/_shared/tokens.css` 수정** — 해당 토큰 값만 갱신
2. **`docs/design-tokens/design-tokens.md` 수정** — 같은 토큰 값 갱신 + frontmatter `version` PATCH bump (예: 0.2.3 → 0.2.4) + `updated` 필드 갱신
3. **CHANGELOG 항목** — 두 곳에 추가:
   - `docs/ui-drafts/CHANGELOG.md`: `토큰 갱신 --color-accent #e5ff00 → #d4ee00 (PATCH, 사용자 요청)`
   - `docs/design-tokens/design-tokens.md` 결정 로그 (있다면): 동일 항목

### 3-B-4. 영향 화면 재캡처

`{AFFECTED_SCRS}`에 한해 STEP 4 (draft-build STEP 4와 동일 절차) 실행:

```bash
node docs/ui-drafts/_shared/_tools/capture.mjs \
  --base-url http://localhost:8765 \
  --shots-root docs/ui-drafts \
  --scope ${AFFECTED_SCRS}
```

### 3-B-5. INDEX 재생성

draft-build STEP 5-2와 동일 절차 (단독 호출 가능).

### 3-B-6. spec-lock 권유

design-tokens.md PATCH 변경이므로:

> design-tokens가 v{prev} → v{next}로 PATCH 갱신되었습니다.
>
> 1. 지금 Lock (`/nidost:spec-lock design-tokens`)
> 2. 추가 수정 후 한 번에 Lock
> 3. 종료 (Working 유지)

사용자가 직접 결정. 본 스킬은 lock을 자동 호출하지 않는다.

---

## STEP 3-C: L1-explore

동시 비교 N안 처리. 결정 게이트 후 미선택안 자동 폐기.

### 3-C-1. 비교 안 명세 수집

사용자에게 비교할 안의 수와 각 안의 변경 내용을 묻는다 (이미 STEP 1에서 받았으면 생략):

> 몇 개 안을 비교할까요? 각 안의 변경 내용을 알려주세요.
> 예: A안 = 액센트 색 노란계열, B안 = 액센트 색 청록계열, C안 = 액센트 색 자홍계열

`{VARIANTS}` 목록 정리:

```yaml
variants:
  - name: A
    change: "--color-accent: #e5ff00"
  - name: B
    change: "--color-accent: #00f0d0"
  - name: C
    change: "--color-accent: #ff0099"
```

### 3-C-2. EXPLORE_TYPE 결정

| 신호                                          | EXPLORE_TYPE     |
| --------------------------------------------- | ---------------- |
| 단일 SCR 한정 + 토큰 참조 없는 시각 변경      | `single-screen`  |
| 토큰 값 변경 (전 화면 영향)                   | `token`          |
| 단일 SCR + 레이아웃 자체 변경                 | `single-screen` (`variants/explore-*.html` 생성) |

### 3-C-3. screen-builder(explore) 호출

```
MODE: explore
EXPLORE_TYPE: token
TARGET_SCR: (single-screen일 때만)
VARIANTS:
  - name: A
    change: ...
  - name: B
    change: ...
```

screen-builder는 conventions §3-3 explore 규약에 따라 산출물 생성:

- `single-screen` → `data-explore` 속성 + `style.css`의 `[data-explore="<name>"]` 셀렉터 또는 `variants/explore-<name>.html`
- `token` → `_shared/tokens.explore-<name>.css` + `?tokens=explore-<name>` URL 분기

모든 산출물 첫 줄에 `__explore: <name>` 마커.

### 3-C-4. INDEX 임시 재생성

draft-build STEP 5-2와 동일 절차로 INDEX.html 재생성. explore 산출물은 임시 섹션에 모음 (노란 배지 "결정 후 폐기").

### 3-C-5. 사용자 비교

> 비교 시안이 준비되었습니다.
>
> 검토 방법:
>   make preview
>   (또는 http://localhost:8765/_shared/INDEX.html)
>
> 임시 섹션에서 A·B·C 안을 비교한 뒤 어느 안으로 확정할지 알려주세요. "전부 폐기"도 가능합니다.

사용자 응답 대기.

### 3-C-6. 결정 게이트 (필수)

사용자 응답 처리:

#### 케이스 1: 특정 안 선택 (예: B안)

1. **선택안 내용을 본 시안에 반영**
   - `single-screen` + 색·크기·여백 → B안 변경을 SCR의 default 시안에 적용 (L1 in-scope 동일 처리)
   - `single-screen` + 레이아웃 → `variants/explore-B.html` 내용을 `index.html`로 승격
   - `token` → B안의 토큰 값을 `tokens.css` + `design-tokens.md`에 반영 (L1 token-tweak 동일 처리, PATCH bump 포함)
2. **미선택안 폐기**
   - `__explore` 마커 있는 모든 파일 삭제 (선택안 마커는 승격 시 제거)
   - `data-explore` 속성·`[data-explore="<name>"]` 셀렉터 제거
   - `tokens.explore-*.css` 모두 삭제
   - script.js에서 explore 분기 코드 제거
3. **INDEX 재생성** — 임시 섹션 사라짐
4. **CHANGELOG 항목**:
   ```
   - L1-explore: B안 채택 (A·C 폐기). 변경: --color-accent #e5ff00 → #00f0d0
   ```

#### 케이스 2: 전부 폐기

1. 모든 explore 산출물 삭제 (위 미선택안 폐기와 동일)
2. INDEX 재생성
3. CHANGELOG 항목:
   ```
   - L1-explore: 비교 후 전체 폐기 (현 시안 유지)
   ```

#### 케이스 3: "혼합" 또는 "추가 비교"

새 비교 라운드 → STEP 3-C-1로 돌아감 (기존 explore 산출물은 사용자가 명시적으로 폐기 요청하지 않는 한 유지하되, 누적이 5안을 넘으면 정리 권유).

---

## STEP 3-D: L2 token-shape

토큰 추가/삭제·의미 변경, aesthetic.md "금지 목록"·"색 분포" 변경.

### 3-D-1. 영향 검토

design-tokens 의존 카테고리는 `ui-design`뿐 (도메인 의존 테이블). 그러나 ui-design.md 본문에서 해당 토큰을 직접 참조하는 위치가 있을 수 있으므로 grep:

```bash
grep -n "${TOKEN_NAME}" docs/ui-design/ui-design.md
```

참조 발견 시 사용자에게 안내:

> ⚠️ ui-design.md가 `${TOKEN_NAME}`를 직접 참조하고 있습니다 ({위치}).
> 토큰 형태 변경 시 ui-design.md도 함께 수정이 필요할 수 있습니다.

### 3-D-2. 사용자 확인 게이트 (필수)

> L2 변경 안내:
> - design-tokens.md 수정 (토큰 추가/삭제/의미 변경)
> - 변경 내용: {요약}
> - 처리 절차: design-tokens.md patch + frontmatter MINOR bump + spec-lock(MINOR) 호출 + draft-build 자동 재진입(update 모드)
>
> 진행할까요? (Y/n)
>
> ui-design.md도 함께 수정해야 한다면 L3로 처리하는 것을 권장합니다 (`spec phase` 정식 재진입).

거절 → 종료. L3 권유.

### 3-D-3. design-tokens.md patch

진행 시:

1. **`docs/design-tokens/design-tokens.md` 수정** — 토큰 추가/삭제/의미 변경 반영 + frontmatter `version` MINOR bump (예: 0.2.3 → 0.3.0) + `updated` 필드 갱신 + 결정 로그에 항목 추가
2. **`docs/ui-drafts/_shared/tokens.css` 동기 수정** — 동일 변경 반영

### 3-D-4. spec-lock(MINOR) 권유

design-tokens.md MINOR 변경이므로:

> design-tokens가 v{prev} → v{next} (MINOR)로 갱신되었습니다.
>
> 1. 지금 Lock (`/nidost:spec-lock design-tokens`)
> 2. 추가 수정 후 한 번에 Lock
> 3. 종료 (Working 유지)

사용자가 직접 결정. 본 스킬은 lock을 자동 호출하지 않는다 (STEP 3-B-6과 동일 정책).

### 3-D-5. draft-build 호출 안내

본 스킬은 `draft-build`를 자동 호출하지 않는다 (`draft-build`는 슬래시 커맨드 전용 — `disable-model-invocation: true`). 사용자에게 다음을 안내한 뒤 본 스킬 종료:

> design-tokens가 v{prev} → v{next}로 갱신되어 영향 화면을 재빌드해야 합니다.
> 다음 명령으로 draft phase 재진입:
>   /nidost:draft-build
>
> 디렉토리 존재 + spec 변경이 감지되어 update 모드로 분기되며, design-tokens 변경이므로 영향 범위 = 전체 (screen-builder full-build).

사용자가 슬래시 커맨드로 `draft-build`를 호출하면 다음 단계를 인계한다.

---

## STEP 3-E: L3 requirement

화면 추가/삭제, UI 요소·상태 추가, 사용자 플로우 변경.

### 3-E-1. 사용자 안내 (필수)

본 스킬은 ui-design.md를 직접 수정하지 않는다. spec phase 정식 재진입 권유.

> L3 변경 안내:
> - 요구사항 변경입니다 (화면/UI 요소/상태/플로우 추가·변경).
> - 본 스킬은 ui-design.md를 직접 수정하지 않습니다 — 의존 카테고리(api/db) 영향 검토가 필요할 수 있어 spec phase 정식 재진입을 권유합니다.
>
> 처리 절차:
> 1. `/nidost:spec-ui-design` 호출 → ui-design.md 수정 + Lock(MINOR 또는 MAJOR)
> 2. ui-design.md 변경이 api/db에 영향이 있는지 검토 (spec-ui-design이 안내)
> 3. 영향 카테고리도 함께 수정·Lock
> 4. `/nidost:draft-build` 사용자 명시 호출 (영향 화면만 재빌드 — `draft-build`는 슬래시 커맨드 전용)
>
> 지금 spec phase로 넘어갈까요? (Y → 안내 후 본 스킬 종료, N → 보류)

#### 사용자 응답 처리

- **Y** → 본 스킬 종료. 사용자에게 `/nidost:spec-ui-design` 호출 안내. 이후 spec phase 처리는 spec 스킬 체인이 담당
- **N** → 본 스킬 종료. 추후 사용자가 직접 spec phase 진입
- **"L2로 처리해도 되는 작은 변경"** → 사용자가 분류 정정. STEP 2 분류 게이트로 돌아감

### 3-E-2. 본 스킬은 여기서 종료

L3는 phase 경계를 넘는다. draft 안에서 무리하게 처리하지 않는다.

---

## STEP 4: 완료 보고

모든 request 처리 후 요약.

```
✅ draft-revise 완료

  처리된 요청: N건
  - L1 in-scope:    M건 (SCR-001, SCR-003)
  - L1 token-tweak: K건 (--color-accent, --space-md)
  - L1-explore:     P건 (B안 채택, 2건 폐기)
  - L2 token-shape: Q건 (design-tokens v0.2.3 → v0.3.0)
  - L3 requirement: R건 (spec phase로 escalate)

  변경 화면:    SCR-001, SCR-003, SCR-007 ...
  변경 토큰:    --color-accent (PATCH), --space-md (PATCH)
  폐기된 explore: 2건
  CHANGELOG:    docs/ui-drafts/CHANGELOG.md, docs/design-tokens/design-tokens.md

검토 방법:
  make preview

다음 단계:
  - 추가 수정: /nidost:draft-revise
  - draft Lock (시안 확정): /nidost:draft-lock
  - design-tokens Lock (필요 시): /nidost:spec-lock design-tokens
  - dev phase 진입: /nidost:compile-project-config → dev-segment-router
```

L3가 있으면 별도로 안내:

> L3 요청 R건은 spec phase로 escalate 되었습니다. `/nidost:spec-ui-design`으로 진입해주세요.

---

## 주의사항

- **분류 게이트 필수**: STEP 2-2의 사용자 확인을 건너뛰면 잘못 분류된 요청이 spec을 우회하거나 반대로 작은 변경이 spec phase로 떠밀린다
- **L1 token-tweak의 영향 화면 게이트**: 토큰 변경은 한 화면만 보고 결정 못 한다. 영향 N개를 보여주고 사용자 확인 받기. 이게 빠지면 무성 회귀(silent regression) 발생
- **explore의 결정 게이트 강제**: "나중에 결정"을 허용하면 explore 산출물이 무한 누적된다. 결정 또는 전체 폐기 둘 중 하나로 닫아야 한다
- **L2의 단일 문서 한정**: design-tokens.md만 patch한다. ui-design 등 다른 spec 문서는 건드리지 않는다 (그게 필요하면 L3)
- **L3는 spec phase 위임**: 본 스킬은 ui-design.md를 직접 쓰지 않는다 — 의존 카테고리 영향 검토를 위해 spec 스킬 체인을 거치는 게 안전
- **CHANGELOG 일관성**: L1·L1-explore는 `docs/ui-drafts/CHANGELOG.md`만, L1 token-tweak·L2는 `design-tokens.md` 결정 로그도 함께 갱신
