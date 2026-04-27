---
name: run-draft-from-spec
description: Lock된 ui-design·design-tokens를 기반으로 `docs/ui-drafts/` 정적 UI 시안 번들(공통자산·화면별 HTML·스크린샷)을 빌드·검수·캡처하는 draft phase 오케스트레이터. 사용자가 "/nidost:run-draft-from-spec", "draft 빌드", "UI 시안 작성", "ui-drafts 생성"을 언급할 때 반드시 트리거하세요.
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
  - Bash(ls:*)
  - Bash(cd:*)
  - Bash(mkdir:*)
  - Bash(cp:*)
  - Bash(python3:*)
  - Bash(node:*)
  - Bash(npm install:*)
  - Bash(npm run:*)
  - Bash(npx playwright:*)
  - Bash(sleep:*)
  - Bash(kill:*)
---

# run-draft-from-spec

draft phase의 단일 세그먼트 플레이북. spec 문서(ui-design.md, design-tokens.md)를 기반으로 `docs/ui-drafts/` 트리를 빌드하고 리뷰 통과 후 화면별 스크린샷을 캡처한다.

오케스트레이터는 이 문서의 STEP을 순서대로 따르며, 각 STEP에서 지정된 서브에이전트를 호출한다.

---

## 핵심 원칙

- **단일 산출물**: draft phase의 결과는 `docs/ui-drafts/` 트리 하나. Lock(commit + tag)은 본 스킬이 수행하지 않고 사용자 또는 `spec-lock`에 위임한다.
- **프레임·셸 규약은 dev-ui-draft가 SSOT**: 프레임 규약, `phone-shell.css`·`status-bar`·`home-indicator` 레퍼런스 구현, Stage 2 편집 권한 표는 `dev-ui-draft` 스킬에서 정의. 본 스킬은 포인터만 전달한다.
- **병렬 격리**: Stage 2 에이전트는 자기 `SCR-xxx/` 외 파일을 수정하지 않는다.
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

| 상태                                | 모드                          | 동작                  |
| ----------------------------------- | ----------------------------- | --------------------- |
| 디렉토리 없음                       | `greenfield`                  | 신규 빌드 (전체 화면) |
| Working (통합 태그 `draft/v*` 없음) | `update` 또는 `rebuild`       | 사용자 선택           |
| Lock 태그 존재                      | `rebuild` (새 버전) 또는 종료 | 사용자 선택           |

**Working 상태 프롬프트**:

> ℹ️ `docs/ui-drafts/`가 Working 상태입니다.
>
> 1. 이어서 갱신 (특정 화면만 재빌드) → `update`
> 2. 전체 재빌드 (덮어씀) → `rebuild`
> 3. 종료

**Lock 상태 프롬프트**:

> ⚠️ `docs/ui-drafts/`가 Lock 상태입니다 ({기존 태그}).
>
> 1. 새 버전 작성 (덮어쓰며 새 Working 진입) → `rebuild`
> 2. 종료

결정된 `{MODE}`를 오케스트레이터 메모리에 보관. 이후 STEP 1~2에서 분기.

### 0-4. 캡처 뷰포트 결정

STEP 5(스크린샷 캡처)가 사용할 뷰포트 목록을 결정하고 오케스트레이터 메모리에 `{VIEWPORTS}` YAML로 보관.

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

## STEP 1: Stage 1 — 공통 자산 빌드 (직렬, 1회)

서브에이전트 `eng-ui-draft`를 1회 호출해 `docs/ui-drafts/_shared/`를 빌드한다.

- **호출 모드**: Stage 1 (`_shared/`만 빌드)
- **입력**: `docs/ui-design/ui-design.md`, `docs/design-tokens/design-tokens.md`
- **수행 내용**:
  - `_shared/tokens.css` — design-tokens → CSS 변수 평탄화
  - `_shared/aesthetic.md` — 7개 섹션(큰 방향·색 분포·공간 리듬·타이포 위계·모서리·모션·금지 목록) + frontmatter `viewports:` 포함
  - `_shared/partials/` — ui-design.md §2 내비게이션 기반 구조 partial(header/tabbar/footer/sidebar/모달 컨테이너). 각 partial과 동명 `.css` 함께 생성
  - mobile 뷰포트 포함 시: `_shared/partials/phone-shell.css`, `status-bar.{html,css}`, `home-indicator.{html,css}`, `_shared/templates/scr-mobile.html`
  - web 뷰포트 포함 시: `_shared/templates/scr-web.html`
  - `_shared/includer.js`
- **출력**: `docs/ui-drafts/_shared/` 트리

### 호출 프롬프트 필수 명시 사항

1. **"Stage 1 — Shared Assets only. Do not touch any SCR-xxx directory."**
2. 입력·출력 디렉토리 경로
3. **모드**: `{MODE}`가 `update`이면 기존 `_shared/`는 보존하고 누락분만 보충. `greenfield`·`rebuild`이면 신규/덮어쓰기.
4. **viewports 기록**: `_shared/aesthetic.md` frontmatter에 `viewports:` 배열을 포함. 값은 STEP 0-4의 `{VIEWPORTS}` YAML 그대로.
5. **프레임 규약 SSOT**: mobile 뷰포트가 포함되면 `dev-ui-draft` §「프레임 규약」, §「phone-shell.css 레퍼런스 구현」, §「status-bar partial 레퍼런스 구현」을 **정전 코드 그대로 복사**하여 적용한다. `--shell-viewport-w`/`--shell-viewport-h` 값만 `{VIEWPORTS}`의 mobile 치수와 일치시킨다. 그 외 구조 규칙은 한 글자도 변경 금지. web 뷰포트가 포함되면 `scr-web.html`도 동일 원리로 작성.
6. **INDEX.html 금지**: `_shared/INDEX.html`은 STEP 6에서 생성하므로 Stage 1에서 건드리지 말 것.

---

## STEP 2: Stage 2 — 화면별 빌드 (병렬)

ui-design.md §1 화면 목록을 파싱해 빌드 대상 SCR-xxx 목록을 만든다.

| 모드         | 빌드 범위                                                 |
| ------------ | --------------------------------------------------------- |
| `greenfield` | 전체 화면                                                 |
| `rebuild`    | 전체 화면                                                 |
| `update`     | 사용자 지정 SCR 또는 직전 STEP 3 강한 판정에서 적출된 SCR |

각 SCR-xxx마다 `eng-ui-draft`를 **병렬 호출**한다.

- **호출 모드**: Stage 2 (단일 SCR-xxx)
- **입력 (각 호출에 동일 전달)**:
  - 자기 화면의 ui-design.md §3 명세 (해당 화면 부분만)
  - `_shared/` 경로 (모든 자산 참조)
  - design-tokens.md 경로 (필요 시 직접 참조)
- **수행 내용**:
  - `dev-ui-draft` §「Stage 2 편집 권한」 표의 허용 영역만 편집. 프레임 규약(루트 태그·viewport meta·필수 링크·include 위치)은 변경·제거·순서 변경 금지.
  - 본문 wrapper 규약은 `dev-ui-draft` §「본문 wrapper 규약」을 따른다 (mobile 뷰포트 필수).
  - `docs/ui-drafts/SCR-xxx/{index.html, style.css, script.js?, notes.md, variants/?}` 생성
  - 헤더·탭바 등 구조 partial은 `data-include`로만 참조
  - variants/ 내부 HTML도 동일 템플릿 복제 규약을 따른다
  - 명세에 정의된 모든 UI 요소·상태 시연 가능하게 구현
- **출력**: `docs/ui-drafts/SCR-xxx/` 트리

병렬 호출 시 각 에이전트는 자기 SCR 디렉토리 외에는 어떤 파일도 수정하지 않는다 (eng-ui-draft 본문에 명시됨).

병렬 호출이 모두 완료되면 STEP 3로 진행.

---

## STEP 3: 리뷰 (1회)

서브에이전트 `reviewer-ui-draft`를 1회 호출한다.

- **입력**: `docs/ui-drafts/` 전체 + `docs/ui-design/ui-design.md` + `docs/design-tokens/design-tokens.md`
- **수행 내용**: 4구역 출력 (수정 필요 / 권장 / 통과 / 평론 노트)
- **출력**: 검수 보고서

스크린샷은 이 단계의 입력이 아니다 (시각 검증 별도 처리하지 않음).

### 루프 분기

STEP 3 결과의 **수정 필요 (🔴)** 항목을 분석해 다음 분기 중 하나를 선택.

#### 분기 A: 수정 필요 없음

→ STEP 4 (스크린샷 캡처)로 진행

#### 분기 B: 수정 필요 항목이 특정 화면(들)에만 있음

- 영향 범위: 해당 SCR-xxx만
- 복귀: STEP 2 (해당 화면들만 병렬 재호출) → STEP 3 재수행
- 컨텍스트: 강한 판정 항목을 해당 SCR의 `eng-ui-draft` 호출 프롬프트에 전달

#### 분기 C: 수정 필요 항목이 `_shared` 변경을 요구

다음 중 하나라도 해당: `tokens.css` 누락·오류 / `aesthetic.md` 7개 섹션 누락 / 구조 partial 누락·일관성 결함 / `includer.js` 누락

- 영향 범위: 전체
- 복귀: STEP 1 → STEP 2 (전체 화면) → STEP 3
- 컨텍스트: 강한 판정 항목을 Stage 1 `eng-ui-draft` 프롬프트에 전달

#### 권장 (🟡)·평론 노트 (📝)

자동 재빌드 트리거가 아니다. STEP 6 완료 보고에 그대로 포함.

#### 루프 상한

- 분기 B와 C 합산 최대 **3회**
- 상한 초과 시 잔여 강한 판정 항목과 평론 노트를 사용자에게 보고 후 수동 판단 요청

---

## STEP 4: 화면 스크린샷 캡처

리뷰 통과(분기 A) 직후 1회 실행. 캡처 매트릭스는 항상 전체 화면 × 전체 variants × `{VIEWPORTS}`의 카르테시안 곱.

각 (screen, variant, viewport)마다 **뷰포트 샷**을 기본 1장, 스크롤 비율(`scrollHeight / viewport.height`)이 1.1 초과면 **풀 샷**을 추가 1장. 비율이 5를 넘으면 풀 샷은 뷰포트 높이 × 5로 컷. 뷰포트 샷이 primary, 풀 샷이 secondary(접지 콘텐츠 완결성 보조).

### 4-1. 캡처 도구 준비

`docs/ui-drafts/_shared/_tools/`에 아래 3개 파일이 없으면 본 스킬의 `templates/`에서 **내용 수정 없이 그대로 복사**해 생성한다 (갱신 시 보존).

| 산출 경로                     | 템플릿 원본                                         |
| ----------------------------- | --------------------------------------------------- |
| `_shared/_tools/capture.mjs`  | `skills/run-draft-from-spec/templates/capture.mjs`  |
| `_shared/_tools/package.json` | `skills/run-draft-from-spec/templates/package.json` |
| `_shared/_tools/.gitignore`   | `skills/run-draft-from-spec/templates/.gitignore`   |

`includer.js`와 동일한 "정전 코드, 그대로 사용" 원칙.

#### 의존성 설치 (1회 또는 누락 시)

```bash
cd docs/ui-drafts/_shared/_tools
npm install
npx playwright install chromium
```

설치 실패 시 STEP 4 전체 skip + 사용자 안내. 빌드+리뷰 산출물은 캡처 없이도 유효.

### 4-2. HTTP 서버 기동

`data-include` partial 인클루더가 `file://`에서 동작하지 않으므로 정적 HTTP 서버를 임시 기동한다.

```bash
cd docs/ui-drafts && python3 -m http.server 8765 >/tmp/ui-drafts-http.log 2>&1 &
SERVER_PID=$!
sleep 1
```

캡처 종료 후 항상 `kill $SERVER_PID` (오류 발생 시에도 trap으로 보장).

### 4-3. 캡처 실행

```bash
node docs/ui-drafts/_shared/_tools/capture.mjs \
  --base-url http://localhost:8765 \
  --shots-root docs/ui-drafts
```

리뷰 통과 후이므로 부분 캡처 의미 없음 → 항상 전체 캡처. (사용자가 lifecycle에서 "캡처만 재시도" 선택 시에도 전체 재캡처)

### 4-4. 결과 수집

스크립트 stdout을 파싱해 ok/fail 수와 각 샷의 `ratio`, `full=<none|full|truncated>`를 집계. 실패 항목은 화면 ID·variant·viewport·원인을 표로 보관해 STEP 6 완료 요약과 lifecycle 프롬프트에 반영.

`full=truncated`는 "5× 뷰포트 높이 상한 적용"을 의미. 결함이 아니므로 실패로 집계하지 않고 요약 비고에 표기만.

---

## STEP 5: 완료 보고 및 산출물 정리

### 5-1. 메타 문서 생성

INDEX.md(사람 검토용 마크다운)와 INDEX.html(브라우저 갤러리 진입점)을 둘 다 생성.

#### 5-1-a. INDEX.md 작성/갱신

템플릿: `skills/run-draft-from-spec/templates/INDEX.md`. 표의 화면 행은 ui-design.md §1 목록과 `docs/ui-drafts/SCR-*/variants/` 스캔 결과로 채운다. 캡처가 일부/전부 실패한 화면은 스크린샷 셀에 `⚠️` 마커 추가.

#### 5-1-b. INDEX.html 생성/재생성

`docs/ui-drafts/_shared/INDEX.html`을 매번 재생성(덮어쓰기). "정전 코드" 원칙 — 템플릿의 placeholder만 치환한다.

**동기화 불변식**: `SCR-xxx/` 트리가 변경되면(수동 편집 포함, STEP 2 파이프라인 외에서 발생한 경우도) INDEX.html은 변경 직후 재생성되어야 한다. 오케스트레이터는 본 STEP 5-1-b를 단독으로 호출하여 동기화를 맞춘다. STEP 1→4 선행은 전제 조건이 아니다.

**템플릿**:

- 셸 + 스크립트: `skills/run-draft-from-spec/templates/INDEX.html`
- SCR 섹션 + mockup 조각: `skills/run-draft-from-spec/templates/INDEX-section.html`

**역할**:

- **라이브 iframe 갤러리**. 각 SCR의 default + 모든 variant를 device chassis로 감싸 한 페이지에 나열. variant figcaption에 ↗ 오픈 링크를 런타임 주입
- PNG 캡처는 INDEX에서 빠진다. INDEX는 PNG 링크를 노출하지 않고 라이브 iframe으로만 화면을 보여준다
- chassis는 **단일 iPhone 스타일로 고정**. 기기 세분화는 후속 버전 과제
- 섹션 nav(`.section-rail`)는 ≥1024px에서 우측 fixed rail, 그 외 상단 inline wrap. 링크는 DOM(`main .scr[id]`)에서 스크립트가 런타임 생성 (SCR 추가 시 수동 동기화 불필요)

**입력 파싱**:

- `ui-design.md` §1 → 화면 ID + 제목 (`{SCR}`, `{TITLE}`)
- `_shared/aesthetic.md` frontmatter `viewports:` → 첫 번째 viewport가 iframe 렌더 기준(`{PRIMARY_VP}`). `mobile`이면 chassis 적용, 그 외는 `device-frame-plain`
- 각 `SCR-xxx/variants/*.html` 스캔 → iframe 목업 추가
- **각 `SCR-xxx/style.css`의 `[data-state="<name>"]` 셀렉터 스캔** → default 외 상태마다 `?state=<name>` iframe 목업 추가. 이를 통해 INDEX.html 갤러리에서 모든 상태를 나란히 비교 가능

**iframe 규칙**:

- src: `/{SCR}/index.html`, `/{SCR}/index.html?state=<name>`, 또는 `/{SCR}/variants/{stem}.html` (절대 경로, 서버 루트 = `docs/ui-drafts/`)
- width/height: `{PRIMARY_VP.width}` × `{PRIMARY_VP.height}` (고정 픽셀)
- `loading="lazy"` 필수
- `title` 속성: `{SCR} {LABEL}`

**치환 규칙**:

- `{REL}` / `{LABEL}`: default는 `index.html` / `default`, 상태는 `index.html?state=<name>` / `<name>`, variant는 `variants/{stem}.html` / `{stem}`
- `{SCROLL_BADGE}`: 해당 SCR에 `default.full*.png`가 하나라도 있으면 `<span class="badge">scroll</span>`, `full=truncated`면 `<span class="badge">scroll · truncated</span>`. 없으면 빈 문자열
- `{VP_LIST}` / `{PRIMARY_VP_NAME}`: `{VIEWPORTS}` 전개값
- variant별 ↗ 오픈 링크는 스크립트가 런타임 주입하므로 템플릿에 선기록 금지

### 5-2. CHANGELOG.md 작성/갱신

템플릿: `skills/run-draft-from-spec/templates/CHANGELOG.md`. 갱신인 경우 새 항목 추가.

### 5-3. \_shared/aesthetic.md frontmatter 갱신

템플릿: `skills/run-draft-from-spec/templates/aesthetic-frontmatter.yaml`.

`viewports:`는 STEP 1에서 이미 기록되어 있어야 한다. 본 단계에서는 `version`·`updated`만 갱신하며 `viewports`는 변경 금지 (변경하면 기존 캡처와 일관성 깨짐). 이 frontmatter가 통합 Lock 태그(`draft/v0.1.0`)의 버전 기준.

### 5-4. 루트 Makefile `preview` target 관리

사용자가 `make preview` 한 번으로 INDEX 갤러리를 띄울 수 있게 프로젝트 루트 `Makefile`에 target을 보장한다. cd/prefix 마찰 제거가 목적.

**템플릿 스니펫**: `skills/run-draft-from-spec/templates/Makefile`

```makefile
preview:
	npm --prefix docs/ui-drafts/_shared/_tools run preview

.PHONY: preview
```

(들여쓰기는 Tab 필수 — Makefile 문법)

**정책** (사용자 소유 루트 Makefile 파괴 방지):

1. **루트 `Makefile` 없음** → 템플릿을 그대로 복사
2. **루트 `Makefile` 있고 `^preview:` 라인 없음** → 템플릿 내용을 파일 끝에 append (앞에 빈 줄 1개 보장). 완료 보고에 "루트 Makefile에 `preview` target 추가됨" 1줄 언급
3. **루트 `Makefile` 있고 `^preview:` 이미 존재** → 건드리지 않음. 기존 target이 동작한다고 간주하고 완료 보고는 그대로 `make preview` 안내

**체크**:

```bash
test -f Makefile && grep -q '^preview:' Makefile && echo "exists" || echo "absent-or-no-target"
```

`update` 모드에서도 동일 정책 (누락 시 보충, 존재 시 보존).

### 5-5. 완료 요약 출력

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
  (또는 cd docs/ui-drafts && python3 -m http.server 8765
   → http://localhost:8765/_shared/INDEX.html)

다음 phase: dev (dev-segment-router로 진입)
```

권장·평론 노트가 있으면 요약 아래에 그대로 인용. 캡처 실패가 있으면 실패 표(화면·variant·viewport·원인)도 함께 출력.

### 5-6. Lifecycle 프롬프트

기본:

> draft phase가 완료되었습니다.
>
> 1. Lock (`git commit` + `git tag draft/v{VERSION}`)
> 2. Working 상태 유지 (추가 화면 작성 또는 수동 편집 예정)
> 3. dev phase로 바로 진입 (`/nidost:dev-segment-app-ui` 또는 dev-segment-router)

캡처 실패 F>0인 경우 옵션 추가:

> 4. 캡처만 재시도 (build/review는 건드리지 않고 STEP 4만 다시 실행)

- 선택 1: commit + tag 안내. 직접 수행하지 않고 사용자에게 위임 (spec-lock 패턴과 동일)
- 선택 4: STEP 4만 재실행

---

## 주의사항

- **Stage 2 격리**: 병렬 호출 시 각 에이전트가 자기 SCR 외 파일 절대 수정 금지 (프롬프트에 명시)
- **update 모드 보존**: 기존 `_shared/` (capture.mjs 포함) 덮어쓰지 않고 누락분만 보충
- **평론 노트는 사람 판단 게이트**: 자동 재빌드 트리거가 아님
- **캡처 = HTTP 필수**: `data-include` 탓에 `file://` 금지. 서버 루트 = `docs/ui-drafts/`. `INDEX.html`도 이 전제로 절대 경로 사용
- **viewports 버전 불변**: `_shared/aesthetic.md` frontmatter의 `viewports:`는 같은 draft 버전 내 변경 금지. 변경은 새 버전에서
