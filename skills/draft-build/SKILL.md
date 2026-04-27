---
name: draft-build
description: draft phase의 시안 빌드 오케스트레이터. spec(ui-design + design-tokens)을 입력받아 시안 트리(docs/ui-drafts/)를 빌드한다. 디렉토리 유무로 신규/갱신 자동 분기, 갱신이면 spec diff에서 변경 화면만 추려 부분 재빌드. 사용자가 `/nidost:draft-build` 슬래시 커맨드로 명시 호출할 때만 실행되며 자연어 언급으로 자동 트리거되지 않는다.
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
  - Bash(git show:*)
  - Bash(ls:*)
  - Bash(cd:*)
  - Bash(mkdir:*)
  - Bash(cp:*)
  - Bash(node:*)
  - Bash(npm install:*)
  - Bash(npm run:*)
  - Bash(npx playwright:*)
  - Bash(sleep:*)
  - Bash(kill:*)
---

# draft-build

draft phase의 메인 오케스트레이터. spec 문서(`ui-design.md`, `design-tokens.md`)를 기반으로 `docs/ui-drafts/` 트리를 빌드하고, 리뷰 통과 후 화면별 스크린샷을 캡처한다.

오케스트레이터는 본 문서의 STEP을 순서대로 따르며, 각 STEP에서 지정된 서브에이전트(`screen-builder`, `screen-auditor`)를 호출한다.

---

## 핵심 원칙

- **단일 산출물**: draft phase의 결과는 `docs/ui-drafts/` 트리 하나. Lock(commit + tag)은 본 스킬이 수행하지 않고 사용자 또는 `spec-lock`에 위임한다.
- **conventions가 SSOT**: 작성·리뷰 규약은 모두 `draft-conventions` 스킬이 정의. 본 스킬은 호출 흐름만 지휘하고 규약을 중복 정의하지 않는다.
- **병렬 격리**: `single-scr` 모드의 screen-builder는 자기 SCR 외 파일을 수정하지 않는다 (conventions §3 권한 매트릭스).
- **viewports는 버전 경계에서만 변경**: `_shared/aesthetic.md` frontmatter의 `viewports:`는 draft 버전 내 불변. 변경 필요 시 새 버전.
- **캡처 실패 ≠ 빌드 실패**: HTTP 서버 경유 필수(`data-include` 탓). Playwright/캡처가 실패해도 빌드·리뷰 산출물은 유효. draft 내부 리뷰는 `INDEX.html` 라이브 iframe이 primary view이고 PNG는 보조 산출물.

---

## STEP 0: 사전 체크

### 0-1. 필수 선행 문서 Lock 확인

`docs/ui-design/ui-design.md`와 `docs/design-tokens/design-tokens.md`가 모두 존재하고 Lock 상태여야 한다.

```bash
for CAT in ui-design design-tokens; do
  test -f docs/${CAT}/${CAT}.md || { echo "❌ docs/${CAT}/${CAT}.md 없음"; exit 1; }
  VERSION=$(awk '/^version:/ {print $2; exit}' docs/${CAT}/${CAT}.md)
  git tag --list "doc/${CAT}/v${VERSION}" | grep -q . && echo "${CAT}: locked v${VERSION}" || echo "${CAT}: working v${VERSION}"
done
```

- 둘 중 하나라도 Lock이 아님 → 사용자에게 안내 후 선택:
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

§0이 있지만 재해석된 인터페이스(CLI 명령 트리, API 문서 페이지 등)가 명시된 경우는 그대로 진행. 시안은 그 인터페이스를 정적 HTML로 시각화한다.

### 0-3. 모드 결정 (greenfield | update | rebuild)

```bash
test -d docs/ui-drafts
```

| 상태                                | 모드                          | 동작                           |
| ----------------------------------- | ----------------------------- | ------------------------------ |
| 디렉토리 없음                       | `greenfield`                  | 신규 빌드 (전체 화면)          |
| Working (통합 태그 `draft/v*` 없음) | `update` 또는 `rebuild`       | 사용자 선택                    |
| Lock 태그 존재                      | `rebuild` (새 버전) 또는 종료 | 사용자 선택                    |

**Working 상태 프롬프트**:

> ℹ️ `docs/ui-drafts/`가 Working 상태입니다.
>
> 1. 이어서 갱신 (영향 화면만 재빌드) → `update`
> 2. 전체 재빌드 (덮어씀) → `rebuild`
> 3. 종료

**Lock 상태 프롬프트**:

> ⚠️ `docs/ui-drafts/`가 Lock 상태입니다 ({기존 태그}).
>
> 1. 새 버전 작성 (덮어쓰며 새 Working 진입) → `rebuild`
> 2. 종료

결정된 `{MODE}`를 오케스트레이터 메모리에 보관. 이후 STEP 1~3에서 분기.

### 0-4. 캡처 뷰포트 결정

STEP 4(스크린샷 캡처)가 사용할 뷰포트 목록을 결정하고 오케스트레이터 메모리에 `{VIEWPORTS}` YAML로 보관.

#### 결정 우선순위

1. **`update` 모드**: 기존 `_shared/aesthetic.md` frontmatter의 `viewports:` 배열 그대로 재사용 (변경 금지 — 일관성 깨짐)
2. **`greenfield`·`rebuild` 모드**: 아래 신호를 순차 검사
   - `docs/ui-design/ui-design.md` frontmatter 또는 §0의 `platform:` (`mobile` | `web` | `both`)
   - `docs/design-tokens/design-tokens.md`의 브레이크포인트 토큰 (예: `--bp-mobile`, `--bp-tablet`, `--bp-desktop`)
   - ui-design.md §3 화면 명세 본문의 viewport 힌트 (예: "390 기준", "responsive desktop")
3. 신호 부재 → 사용자 확인 프롬프트:
   > 캡처 뷰포트 신호를 spec 문서에서 찾지 못했습니다. 기본값으로 진행할까요?
   >
   > 1. 모바일 단일 (390×844)
   > 2. 데스크톱 단일 (1440×900)
   > 3. 모바일+데스크톱 페어
   > 4. 직접 입력 (이름·너비·높이)

#### 결정 결과 형식

```yaml
viewports:
  - { name: mobile, width: 390, height: 844 }
  - { name: desktop, width: 1440, height: 900 }
```

- 단일 뷰포트: 뷰포트 샷 `screenshots/default.png`, 풀 샷 `screenshots/default.full.png`
- 멀티 뷰포트: `screenshots/default.{name}.png`, `screenshots/default.full.{name}.png`
- 풀 샷은 스크롤 비율(`scrollHeight / viewport.height`)이 1.1 초과일 때만 생성. 5 초과면 뷰포트 높이 × 5로 컷(truncated)

---

## STEP 1: 영향 화면 산출 (`update` 모드만)

`greenfield` / `rebuild` 모드는 본 STEP을 건너뛴다 (전체 빌드).

`update` 모드일 때만 spec diff를 분석해 어떤 화면을 재빌드할지 결정한다.

### 1-1. spec 변경 검출

직전 draft의 기준 spec 버전을 `_shared/aesthetic.md` frontmatter 또는 `CHANGELOG.md` 마지막 항목에서 읽는다 (기록되어 있다면). 기록이 없으면 git log에서 마지막 `draft/v*` 태그 시점의 spec 버전을 추출.

```bash
# 예시: 마지막 draft tag 시점의 ui-design 버전
LAST_DRAFT_TAG=$(git tag --list "draft/v*" --sort=-v:refname | head -1)
PREV_UI=$(git show ${LAST_DRAFT_TAG}:docs/ui-design/ui-design.md 2>/dev/null | awk '/^version:/ {print $2; exit}')
PREV_DT=$(git show ${LAST_DRAFT_TAG}:docs/design-tokens/design-tokens.md 2>/dev/null | awk '/^version:/ {print $2; exit}')
```

현재 spec 버전과 비교해 변경분이 있는 카테고리를 `{CHANGED_SPEC_CATS}`에 보관.

### 1-2. 영향 범위 매핑

다음 룰로 영향 범위를 결정한다.

| 변경 카테고리·위치                                  | 영향 범위                |
| --------------------------------------------------- | ------------------------ |
| `design-tokens.md` 변경 (어느 토큰이든)             | **전체** (`_shared` 포함) |
| `ui-design.md` §1 (화면 목록) — 화면 추가/삭제      | **전체**                 |
| `ui-design.md` §2 (내비게이션) 변경                 | **전체** (`_shared/partials`) |
| `ui-design.md` §3 SCR-xxx 본문 변경                 | 해당 SCR-xxx만           |
| `ui-design.md` §4·§5 (공통 컴포넌트·상태 패턴) 변경 | **전체**                 |

`{AFFECTED_SCRS}` 목록과 `{SHARED_AFFECTED}` 불리언으로 정리.

### 1-3. 사용자 확인

변경 화면이 많거나 전체 영향이면 사용자에게 확인:

> spec 변경 분석 결과:
> - design-tokens v{PREV_DT} → v{DT_VERSION}: {N}개 토큰 변경
> - ui-design v{PREV_UI} → v{UI_DESIGN_VERSION}: §3 변경 화면 {SCR-001, SCR-005}
>
> 영향 범위: _shared 전체 + 12개 SCR 재빌드. 진행할까요? (Y/n)

사용자가 거절하면 종료.

영향이 단일 SCR 1~2개면 확인 생략 가능 (자동 진행).

---

## STEP 2: screen-builder 호출

`{MODE}`와 `{AFFECTED_SCRS}`·`{SHARED_AFFECTED}`에 따라 분기.

### 2-1. 호출 매트릭스

| MODE       | _shared 영향 | screen-builder 호출 |
| ---------- | ------------ | ------------------- |
| greenfield | —            | `full-build` 1회    |
| rebuild    | —            | `full-build` 1회    |
| update     | true         | `full-build` 1회    |
| update     | false        | `single-scr` × N (병렬) |

### 2-2. full-build 호출

호출 프롬프트 필수 명시 사항:

1. 첫 줄에 `MODE: full-build`
2. 입력 spec 경로 (`docs/ui-design/ui-design.md`, `docs/design-tokens/design-tokens.md`)
3. 출력 루트 (`docs/ui-drafts/`)
4. **viewports YAML** (STEP 0-4의 `{VIEWPORTS}`)
5. **build mode**: `fresh` | `rebuild` | `update-shared` (caller가 결정)
6. **draft-conventions 준수** — §2-6 phone-shell 레퍼런스 구현은 정전 코드 그대로 복사. `--shell-viewport-w`/`--shell-viewport-h`만 viewports 값에 맞춤
7. **`_shared/INDEX.html`은 만들지 말 것** (STEP 5에서 생성)
8. **`_shared/_tools/`는 건드리지 말 것** (STEP 4에서 templates/ 복사)

### 2-3. single-scr 호출 (병렬)

`{AFFECTED_SCRS}` 각 SCR-xxx마다 screen-builder를 **병렬 호출**.

호출 프롬프트 필수 명시 사항:

1. 첫 줄에 `MODE: single-scr`
2. `{TARGET_SCR}` (SCR id)
3. 자기 화면의 ui-design.md §3 명세 (해당 화면 부분만)
4. `_shared/` 경로 (읽기 전용)
5. `viewports` YAML
6. **격리 규칙**: 자기 SCR 디렉토리 외 어떤 파일도 수정 금지

병렬 호출이 모두 완료되면 STEP 3로 진행.

---

## STEP 3: screen-auditor 호출

서브에이전트 `screen-auditor`를 1회 호출.

### 3-1. 호출 프롬프트

- **scope**: `full` (greenfield/rebuild) 또는 `scoped`(update — `{AFFECTED_SCRS}` 전달)
- 입력: `docs/ui-drafts/` + `docs/ui-design/ui-design.md` + `docs/design-tokens/design-tokens.md`
- 출력: 4구역 보고서 (수정 필요 / 권장 / 통과 / 평론 노트)

스크린샷은 본 STEP의 입력이 아니다.

### 3-2. 루프 분기

🔴 **수정 필요** 항목을 분석해 다음 중 하나를 선택.

#### 분기 A: 수정 필요 없음

→ STEP 4 (스크린샷 캡처)로 진행.

#### 분기 B: 수정 필요 항목이 특정 화면(들)에만 있음

- 영향 범위: 해당 SCR-xxx만
- 복귀: STEP 2-3 (해당 화면들만 `single-scr` 병렬 재호출) → STEP 3 재수행
- 컨텍스트: 강한 판정 항목을 해당 SCR의 호출 프롬프트에 전달

#### 분기 C: 수정 필요 항목이 `_shared` 변경을 요구

다음 중 하나라도 해당: `tokens.css` 누락·오류 / `aesthetic.md` 7개 섹션 누락 / 구조 partial 누락·일관성 결함 / `includer.js` 누락 / 프레임 규약 일관성 결함 (mobile)

- 영향 범위: 전체
- 복귀: STEP 2-2 (`full-build`, `update-shared`) → STEP 3
- 컨텍스트: 강한 판정 항목을 `full-build` 호출 프롬프트에 전달

#### 권장(🟡)·평론 노트(📝)

자동 재빌드 트리거가 아니다. STEP 6 완료 보고에 그대로 포함.

#### 루프 상한

- 분기 B와 C 합산 최대 **3회**
- 상한 초과 시 잔여 강한 판정 항목과 평론 노트를 사용자에게 보고 후 수동 판단 요청

---

## STEP 4: 화면 스크린샷 캡처

리뷰 통과(분기 A) 직후 1회 실행. 캡처 매트릭스는 항상 (해당 화면) × (전체 variants) × `{VIEWPORTS}`의 카르테시안 곱.

`update` 모드는 `{AFFECTED_SCRS}` 화면만 캡처. 그 외는 전체 화면 캡처.

각 (screen, variant, viewport)마다 **뷰포트 샷**을 기본 1장, 스크롤 비율(`scrollHeight / viewport.height`)이 1.1 초과면 **풀 샷**을 추가 1장. 비율이 5를 넘으면 풀 샷은 뷰포트 높이 × 5로 컷.

### 4-1. 캡처 도구 준비

`docs/ui-drafts/_shared/_tools/`에 아래 3개 파일이 없으면 본 스킬의 `templates/`에서 **내용 수정 없이 그대로 복사**해 생성한다 (갱신 시 보존).

| 산출 경로                     | 템플릿 원본                                    |
| ----------------------------- | ---------------------------------------------- |
| `_shared/_tools/capture.mjs`  | `skills/draft-build/templates/capture.mjs`     |
| `_shared/_tools/preview.mjs`  | `skills/draft-build/templates/preview.mjs`     |
| `_shared/_tools/package.json` | `skills/draft-build/templates/package.json`    |
| `_shared/_tools/.gitignore`   | `skills/draft-build/templates/.gitignore`      |

`includer.js`와 동일한 "정전 코드, 그대로 사용" 원칙.

#### 의존성 설치 (1회 또는 누락 시)

```bash
cd docs/ui-drafts/_shared/_tools
npm install
npx playwright install chromium
```

설치 실패 시 STEP 4 전체 skip + 사용자 안내. 빌드+리뷰 산출물은 캡처 없이도 유효.

### 4-2. HTTP 서버 기동

`data-include` partial 인클루더가 `file://`에서 동작하지 않으므로 정적 HTTP 서버를 임시 기동. `_tools/preview.mjs`를 헤드리스 모드로 백그라운드 실행하면 8765부터 자동으로 빈 포트로 폴백되어 `make preview`나 다른 캡처와 충돌해도 회피된다. 바인딩한 포트는 `--port-file`이 가리키는 파일에 기록되며, 후속 STEP에서 `$PORT`로 읽어 쓴다 (python3 의존성 제거).

```bash
PORT_FILE=/tmp/ui-drafts-http.port
node docs/ui-drafts/_shared/_tools/preview.mjs --no-open --port-file "$PORT_FILE" \
  >/tmp/ui-drafts-http.log 2>&1 &
SERVER_PID=$!
sleep 0.5
for i in 1 2 3 4 5 6; do test -s "$PORT_FILE" && break; sleep 0.5; done
PORT=$(awk 'NR==1' "$PORT_FILE")
```

캡처 종료 후 항상 `kill $SERVER_PID` (오류 발생 시에도 trap으로 보장). `$SERVER_PID`와 `$PORT`는 STEP 4-3과 같은 셸 세션을 공유한다 (분리 실행 시 orchestrator가 두 값을 캐리).

### 4-3. 캡처 실행

```bash
node docs/ui-drafts/_shared/_tools/capture.mjs \
  --base-url "http://localhost:${PORT}" \
  --shots-root docs/ui-drafts
```

`update` 모드는 `--scope` 인자로 `{AFFECTED_SCRS}` 전달 (capture.mjs가 해당 화면만 캡처). 그 외는 전체 캡처.

### 4-4. 결과 수집

스크립트 stdout을 파싱해 ok/fail 수와 각 샷의 `ratio`, `full=<none|full|truncated>`를 집계. 실패 항목은 화면 ID·variant·viewport·원인을 표로 보관해 STEP 6 완료 요약에 반영.

`full=truncated`는 "5× 뷰포트 높이 상한 적용". 결함이 아니므로 실패로 집계하지 않고 요약 비고에 표기만.

---

## STEP 5: 메타 산출물 생성

### 5-1. INDEX.md 작성/갱신

템플릿: `skills/draft-build/templates/INDEX.md`. 표의 화면 행은 ui-design.md §1 목록과 `docs/ui-drafts/SCR-*/variants/` 스캔 결과로 채운다. 캡처가 일부/전부 실패한 화면은 스크린샷 셀에 `⚠️` 마커 추가.

### 5-2. INDEX.html 생성/재생성

`docs/ui-drafts/_shared/INDEX.html`을 매번 재생성(덮어쓰기). "정전 코드" 원칙 — 템플릿의 placeholder만 치환한다.

**동기화 불변식**: `SCR-xxx/` 트리가 변경되면(수동 편집 포함, STEP 2 파이프라인 외에서 발생한 경우도) INDEX.html은 변경 직후 재생성되어야 한다. 본 STEP 5-2는 단독 호출 가능 — STEP 1~4 선행은 전제 조건이 아니다.

**템플릿**:

- 셸 + 스크립트: `skills/draft-build/templates/INDEX.html`
- SCR 섹션 + mockup 조각: `skills/draft-build/templates/INDEX-section.html`

**역할**:

- **라이브 iframe 갤러리**. 각 SCR의 default + 모든 variant + explore를 device chassis로 감싸 한 페이지에 나열
- explore 산출물(`__explore` 마커가 있는 파일·`tokens.explore-*.css` 오버레이)은 임시 섹션에 별도 표시 (예: 노란 배지 "결정 후 폐기"). draft-revise의 결정 게이트 통과 후 INDEX 재생성 시 자동 사라짐
- PNG 캡처는 INDEX에서 빠진다 — 라이브 iframe만
- chassis는 단일 iPhone 스타일로 고정 (기기 세분화는 후속 버전)
- 섹션 nav(`.section-rail`)는 ≥1024px에서 우측 fixed rail, 그 외 상단 inline wrap. 링크는 DOM(`main .scr[id]`)에서 스크립트가 런타임 생성

**입력 파싱**:

- `ui-design.md` §1 → 화면 ID + 제목 (`{SCR}`, `{TITLE}`)
- `_shared/aesthetic.md` frontmatter `viewports:` → 첫 번째 viewport가 iframe 렌더 기준(`{PRIMARY_VP}`). `mobile`이면 chassis 적용, 그 외는 `device-frame-plain`
- 각 `SCR-xxx/variants/*.html` 스캔 → iframe 목업 추가
- 각 `SCR-xxx/style.css`의 `[data-state="<name>"]` 셀렉터 스캔 → default 외 상태마다 `?state=<name>` iframe 추가
- 각 `SCR-xxx/style.css`의 `[data-explore="<name>"]` 셀렉터 스캔 → `?explore=<name>` iframe을 임시 섹션에 추가
- `_shared/tokens.explore-*.css` 스캔 → `?tokens=explore-<name>` 분기를 임시 섹션에 추가

**iframe 규칙**:

- src: `/{SCR}/index.html`, `/{SCR}/index.html?state=<name>`, `/{SCR}/index.html?explore=<name>`, `/{SCR}/index.html?tokens=explore-<name>`, 또는 `/{SCR}/variants/{stem}.html`
- width/height: `{PRIMARY_VP.width}` × `{PRIMARY_VP.height}` (고정 픽셀)
- `loading="lazy"` 필수
- `title` 속성: `{SCR} {LABEL}`

**치환 규칙**:

- `{REL}` / `{LABEL}`: default는 `index.html` / `default`, 상태는 `index.html?state=<name>` / `<name>`, variant는 `variants/{stem}.html` / `{stem}`, explore는 `index.html?explore=<name>` 또는 `index.html?tokens=explore-<name>` / `explore: <name>`
- `{SCROLL_BADGE}`: 해당 SCR에 `default.full*.png`가 하나라도 있으면 `<span class="badge">scroll</span>`, `full=truncated`면 `<span class="badge">scroll · truncated</span>`. 없으면 빈 문자열
- `{VP_LIST}` / `{PRIMARY_VP_NAME}`: `{VIEWPORTS}` 전개값
- variant별 ↗ 오픈 링크는 스크립트가 런타임 주입하므로 템플릿에 선기록 금지

### 5-3. CHANGELOG.md 작성/갱신

템플릿: `skills/draft-build/templates/CHANGELOG.md`. 갱신인 경우 새 항목 추가.

### 5-4. \_shared/aesthetic.md frontmatter 갱신

템플릿: `skills/draft-build/templates/aesthetic-frontmatter.yaml`.

`viewports:`는 STEP 2에서 이미 기록되어 있어야 한다. 본 단계에서는 `version`·`updated`·`spec-base`(현재 spec 버전 스냅샷)만 갱신. `viewports:`는 변경 금지.

### 5-5. 루트 Makefile `preview` target 관리

사용자가 `make preview` 한 번으로 INDEX 갤러리를 띄울 수 있게 프로젝트 루트 `Makefile`에 target을 보장.

**템플릿 스니펫**: `skills/draft-build/templates/Makefile`

```makefile
preview:
	npm --prefix docs/ui-drafts/_shared/_tools run preview

.PHONY: preview
```

(들여쓰기는 Tab 필수)

**정책** (사용자 소유 루트 Makefile 파괴 방지):

1. 루트 `Makefile` 없음 → 템플릿 그대로 복사
2. 루트 `Makefile` 있고 `^preview:` 라인 없음 → 템플릿 내용을 파일 끝에 append (앞에 빈 줄 1개 보장). 완료 보고에 "루트 Makefile에 `preview` target 추가됨" 1줄 언급
3. 루트 `Makefile` 있고 `^preview:` 이미 존재 → 건드리지 않음

**체크**:

```bash
test -f Makefile && grep -q '^preview:' Makefile && echo "exists" || echo "absent-or-no-target"
```

`update` 모드에서도 동일 정책.

---

## STEP 6: 완료 보고 및 Lifecycle 프롬프트

### 6-1. 완료 요약 출력

```
✅ UI Drafts v0.1.0 작성 완료

  공통 자산:    docs/ui-drafts/_shared/
  화면 시안:    docs/ui-drafts/SCR-xxx/ × N개
  스크린샷:     K장 성공 / F건 실패  (viewports: mobile, desktop)
  INDEX:        docs/ui-drafts/INDEX.md
  CHANGELOG:    docs/ui-drafts/CHANGELOG.md

  기준 ui-design:    v{UI_DESIGN_VERSION}
  기준 design-tokens: v{DT_VERSION}

  강한 판정: 0건 | 권장: N건 | 평론 노트: N건

검토 방법:
  make preview
  (또는 cd docs/ui-drafts/_shared/_tools && npm run preview)

다음 단계: draft-revise (수정 요청 있으면) 또는 dev phase 진입
```

권장·평론 노트가 있으면 요약 아래에 그대로 인용. 캡처 실패가 있으면 실패 표(화면·variant·viewport·원인)도 함께 출력.

### 6-2. Lifecycle 프롬프트

기본:

> draft phase가 완료되었습니다.
>
> 1. Lock (`git commit` + `git tag draft/v{VERSION}`)
> 2. Working 상태 유지 (추가 화면 작성 또는 수동 편집 예정)
> 3. 시안 수정 (`/nidost:draft-revise`)
> 4. dev phase 진입 (`/nidost:compile-project-config` → `dev-segment-router`)

캡처 실패 F>0인 경우 옵션 추가:

> 5. 캡처만 재시도 (build/review는 건드리지 않고 STEP 4만 다시 실행)

- 선택 1: commit + tag 안내. 직접 수행하지 않고 사용자에게 위임 (spec-lock 패턴과 동일)
- 선택 5: STEP 4만 재실행

---

## 주의사항

- **격리**: `single-scr` 병렬 호출 시 각 screen-builder가 자기 SCR 외 파일 절대 수정 금지 (conventions §3에 명시되어 있고, 호출 프롬프트에 다시 명시)
- **update 모드 보존**: 영향 외 SCR과 `_shared/_tools/`는 덮어쓰지 않음
- **평론 노트는 사람 판단 게이트**: 자동 재빌드 트리거 아님
- **캡처 = HTTP 필수**: `data-include` 탓에 `file://` 금지. 서버 루트 = `docs/ui-drafts/`. `INDEX.html`도 이 전제로 절대 경로 사용
- **viewports 버전 불변**: `_shared/aesthetic.md` frontmatter의 `viewports:`는 같은 draft 버전 내 변경 금지. 변경은 새 버전에서
- **draft-revise와의 분담**: 본 스킬은 spec → 시안 빌드 전담. 사용자 자연어 수정 요청·레벨 분류·explore 결정 게이트는 모두 `draft-revise`의 책임
