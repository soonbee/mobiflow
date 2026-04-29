---
name: draft-conventions
description: draft phase의 단일 SSOT. spec 읽기 규약, HTML/CSS/JS 작성 규약, 호출 모드별 편집 권한, 리뷰 체크리스트를 한 문서에 통합. screen-builder와 screen-auditor가 동일 문서를 참조해 작성·리뷰 규칙의 어긋남을 원천 차단한다.
user-invocable: false
---

# draft-conventions

draft phase에서 시안을 만들고 점검할 때 사용하는 모든 규약의 단일 SSOT. 작성자(screen-builder)와 리뷰어(screen-auditor)가 같은 문서를 본다.

---

## 0. 이 문서의 위치

### 0-1. 역할

- **§1 spec 읽기 규약** — screen-builder가 ui-design·design-tokens·user-journey를 시안 입력으로 해석할 때
- **§2 작성 규약** — screen-builder가 HTML/CSS/JS 시안을 만들 때
- **§3 호출 모드별 편집 권한** — screen-builder의 4가지 호출 모드(full-build / single-scr / patch / explore)별 어디까지 손댈 수 있는지
- **§4 리뷰 체크리스트** — screen-auditor가 시안을 점검할 때
- **§5 frontend-design 단서** — B(패턴 자유 합성) 영역 영감 카탈로그로만 참조

### 0-2. 참조 우선순위

규약 간 충돌 시 다음 순서로 해석한다.

```
docs/design-tokens/design-tokens.md       (spec SSOT — 토큰 원자)
> docs/ui-design/ui-design.md             (spec SSOT — 화면 명세)
> docs/ui-drafts/_shared/aesthetic.md     (draft SSOT — 디자인 언어)
> 본 문서                                 (작성·리뷰 규약)
> frontend-design (§5)                    (영감 카탈로그)
```

본 문서가 spec과 충돌하면 spec이 이긴다. frontend-design은 본 문서·spec과 충돌하면 무시한다.

### 0-3. 산출물 위치

draft phase의 모든 산출물은 `docs/ui-drafts/` 트리 한 곳. 본 문서가 정의하는 모든 경로는 이 루트 기준.

---

## 1. spec 읽기 규약

### 1-1. 입력 문서와 읽는 순서

세 문서를 정해진 순서로 읽는다. 충돌 시 우선순위는 **ui-design > design-tokens > user-journey**.

1. **`docs/ui-design/ui-design.md`** — 시안에서 만들 화면의 SSOT
   - **§1 화면 목록 & 사이트맵** → 만들 시안 디렉토리 목록 (`docs/ui-drafts/SCR-xxx/`)
   - **§2 내비게이션 & 라우팅** → `_shared/partials/`로 만들 구조 요소(헤더·탭바·푸터·사이드바) 식별의 1차 소스
   - **§3 화면별 명세** → 각 시안의 레이아웃·UI 요소·상태 변화. 누락 없이 모두 시안에 반영
   - **§4 공통 컴포넌트 매핑** → 어떤 요소가 여러 화면에서 등장하는지의 **참고 정보**. design-tokens variant를 강제하지 않는다 (자유 합성 원칙은 §2-2)
   - **§5 상태·피드백 패턴** → 모든 시안의 상태 표현 톤 통일 기준

2. **`docs/design-tokens/design-tokens.md`** — 시각 결정의 원자 재료
   - **§색상·타이포그래피·간격·모션** → `_shared/tokens.css`로 변환할 CSS 변수의 원천
   - **§4 컴포넌트 스타일** → 시안 작성 시 **참고 카탈로그** (강제 적용 아님). 화면별 자유 합성을 가로막지 않는다
   - **§7 권장 & 금지** → aesthetic.md에 디자인 언어로 흡수
   - **§8 반응형 동작** → 시안의 반응형 정책 결정

3. **`docs/user-journey/user-journey.md`** — 보조. 화면별 진입 맥락과 사용자 의도가 명세만으로 모호할 때만 참조

### 1-2. aesthetic.md 추출 가이드

design-tokens.md는 "원자 토큰"(색·폰트·간격·모션 곡선)을 정의한다. 그러나 같은 토큰을 따라도 시안의 정성적 인상은 크게 달라진다. 이 갭을 메우기 위해 `_shared/aesthetic.md`를 텍스트로 추출한다.

aesthetic.md는 **시각 결정의 분위기·철학을 압축한 한 페이지짜리 텍스트**. screen-builder가 자유 합성을 하더라도 "같은 디자이너가 만든 것처럼 보이게" 하는 디자인 언어 SSOT 역할.

다음 7개 섹션으로 구성한다 (각 섹션 1~3문장):

```
# Aesthetic

## 큰 방향
한 줄로 압축한 미적 좌표. 예: "에디토리얼 미니멀 — 대담한 타이포 + 넉넉한 여백".

## 색 분포
액센트 색을 어디에 얼마나 쓸지. 예: "주요 색은 거의 검정·흰색. 액센트는 1개 화면에 1~2회만 등장".

## 공간 리듬
간격의 호흡. 예: "큰 단위(섹션 간 96px)와 작은 단위(요소 간 8~12px)의 대비를 의도적으로 강조. 중간 단위는 피한다".

## 타이포 위계
대비 강도와 사용 원칙. 예: "Display는 Body 대비 4배 이상, 무게 차이로 위계 표현. 색·기울임은 위계로 사용 금지".

## 모서리 & 깊이
모서리 철학과 그림자 사용 원칙. 예: "모든 모서리 0px. 그림자는 모달·드롭다운 같은 일시적 표면에만, 일반 카드는 평면".

## 모션
타이밍·곡선·범위. 예: "0.2s ease-out 통일. 페이지 전환 외에는 변형 애니메이션 금지. hover는 색상 transition만".

## 금지 목록
"이건 절대 하지 않는다" 3~5개. 예: "그라데이션 금지, 둥근 카드 금지, 일러스트 사용 금지, 이모지 사용 금지".
```

이 텍스트는 design-tokens.md를 **재서술**하는 게 아니다. 토큰만 봐서는 알 수 없는 **사용 비율·대비·금지선**을 명시하는 게 핵심이다.

aesthetic.md frontmatter에는 캡처 뷰포트 목록을 함께 기록한다:

```yaml
---
version: 0.1.0
updated: 2026-04-27
viewports:
  - { name: mobile, width: 390, height: 844 }
  - { name: desktop, width: 1440, height: 900 }
---
```

`viewports:`는 같은 draft 버전 내 변경 금지 (변경하면 기존 캡처와 일관성 깨짐). 변경은 새 버전에서.

### 1-3. 화면 ID와 디렉토리 매핑

ui-design.md §1의 화면 ID(`SCR-xxx`)는 그대로 시안 디렉토리 이름이 된다.

```
ui-design.md §1
├── SCR-001 (랜딩)        → docs/ui-drafts/SCR-001/
├── SCR-002 (로그인)      → docs/ui-drafts/SCR-002/
└── SCR-010 (홈 대시보드) → docs/ui-drafts/SCR-010/
```

화면 ID 체계가 재해석된 경우(`CMD-xxx`, `EP-xxx`, `PAGE-xxx`)는 ui-design.md §0 범위 선언을 확인하고 동일 ID를 그대로 디렉토리명으로 사용한다.

### 1-4. ui-design.md §0 (범위 선언) 처리

ui-design.md 최상단에 `## 0. 범위 선언` 섹션이 있고 "이 프로젝트에서는 사용자 인터페이스가 해당 없음" 류의 A2형 스킵이 명시되어 있으면, 시안 작성 자체를 중단한다. 이 판단은 draft-build 사전 체크에서 수행되며, screen-builder는 §0이 존재하면 본문 진행 전에 호출자에게 보고한다.

§0이 있지만 재해석된 인터페이스(CLI 명령 트리, API 문서 페이지 등)가 명시된 경우, 그 인터페이스를 정적 HTML로 시각화한다. CLI라면 명령별 `index.html`이 명령 사용 예시·옵션·출력 샘플을 담은 문서 페이지가 된다.

### 1-5. 명세 충실도 원칙

- ui-design.md §3에서 명시한 **모든 UI 요소·상태**를 시안에 반영한다. "보기 좋게 단순화" 금지
- ui-design.md §3의 요소 이름이 design-tokens variant 이름(예: "Primary 버튼")으로 표기되어 있더라도, 그 이름은 **역할 표시**이지 **시각 강제**가 아니다. 시각은 화면 맥락에 맞게 자유 합성한다
- 상태 변화(로딩·빈·에러·성공)는 메인 `index.html`에서 토글로 시연 가능하도록 구현한다 (§2-8 참조)
- ui-design.md §3에 없는 변형(권한별·A/B)은 추가하지 않는다. 시안은 명세를 확장하지 않는다

### 1-6. 명세가 모호할 때

- ui-design.md만으로 결정이 어려운 항목은 design-tokens.md → user-journey.md 순으로 보충
- 그래도 모호하면 시안에서 합리적으로 판단하고, 그 가정을 해당 시안의 `notes.md`에 한 줄로 기록 ("가정: 빈 상태 메시지는 '아직 항목이 없습니다'로 작성")
- 명세를 변경해야 한다고 판단되면 시안을 진행하지 말고 ui-design.md 수정을 먼저 제안한다 — 시안은 명세의 거울이지 명세를 덮는 도구가 아니다

---

## 2. 작성 규약

### 2-1. 핵심 원칙

- **시각 SSOT**: 시안은 후속 구현이 그대로 따를 시각 진실. 상태·변형이 명세에 있으면 시안에서 빠짐없이 시연 가능해야 한다
- **정적 자체 완결성**: 빌드 단계 없음. `index.html`을 정적 서버로 열기만 하면 모든 시안이 동작
- **공통화는 구조에만, 패턴은 자유**: §2-2 「공통화 이분법」을 따른다 — 본 §의 가장 중요한 규칙
- **외부 의존 최소화**: 폰트만 CDN 허용. 그 외 라이브러리·아이콘 세트는 인라인 SVG 또는 emoji-free CSS로 해결

### 2-2. 공통화 이분법

화면 간 "공통 요소"는 두 종류로 갈리며 다루는 방식이 다르다.

| 종류 | 예시 | 처리 |
|---|---|---|
| **A. 구조적 공통 (Structural)** | 헤더, 탭바, 푸터, 사이드바, 모달 컨테이너, 토스트 컨테이너 | `_shared/partials/` 한 파일로 만들고 모든 화면이 그대로 import |
| **B. 패턴 공통 (Pattern)** | 버튼, 카드, 인풋, 배지, 칩, 페이지 그리드 | 공통 컴포넌트로 추출하지 않음. 각 화면에서 토큰만 따라 자유 합성 |

**판정 기준 한 줄**: "모든 화면에서 시각적으로 동일하지 않으면 사용자가 혼란을 느끼는가?" Yes → A (partial). No → B (자유).

#### 회색지대 처리

| 요소 | 분류 | 이유 |
|---|---|---|
| 모바일 phone shell (viewport 프레임·status-bar·home-indicator·safe-area) | **A (강제)** | 기기 에뮬레이션. 화면마다 다르면 "다른 폰으로 찍은 느낌"이라는 결함 |
| 모달 컨테이너 (오버레이·닫기 버튼 위치) | A | 골격 동일 |
| 모달 내부 콘텐츠 | B | 자유 |
| 토스트·스낵바 컨테이너 | A | 포지션·타이밍 동일 |
| 빈 상태·에러 일러스트 | B (가이드는 aesthetic.md에 텍스트로) | 시각 자유 |
| 폼 인풋 시각 | B | 화면 맥락에 맞게 |
| 페이지 그리드 (max-width·gutter) | tokens.css 변수로, 적용은 화면별 자유 | 토큰 레벨 |

판단이 갈리는 항목은 위 한 줄 기준으로 직접 판정한다. 새 카테고리를 만들지 않는다.

### 2-3. `_shared/` 구조

```
docs/ui-drafts/_shared/
  tokens.css                    # 강제. design-tokens → CSS 변수
  aesthetic.md                  # 강제. 디자인 언어 텍스트
  partials/                     # 강제. 구조적 공통 영역만
    phone-shell.css             # mobile 뷰포트 강제. HTML partial 없음 (클래스 규약)
    status-bar.{html,css}       # mobile 뷰포트 강제
    home-indicator.{html,css}   # mobile 뷰포트 강제
    header.html                 # (해당 시)
    tabbar.html                 # (해당 시)
    footer.html                 # (해당 시)
    sidebar.html                # (해당 시)
  templates/                    # 강제. 프레임 고정용 시드 HTML
    scr-mobile.html             # mobile 뷰포트 강제
    scr-web.html                # web 뷰포트 강제
  includer.js                   # 강제. partial 주입 로더
  INDEX.html                    # draft-build STEP 5에서 생성. screen-builder가 직접 만들지 않음
  _tools/                       # 캡처 도구 (capture.mjs 등). draft-build templates/에서 복사
```

만들지 않는 것:

- ❌ `components.css` — 버튼·카드 같은 패턴 컴포넌트 클래스를 강제하지 않는다
- ❌ `buttons/`, `cards/`, `inputs/` 같은 컴포넌트 폴더
- ❌ JS 프레임워크·번들러·CSS 전처리기

### 2-4. tokens.css 작성 규약

design-tokens.md의 색·타이포·간격·모션 토큰을 CSS 커스텀 프로퍼티로 평탄화. `:root`에 모두 선언하고, 다크 모드가 명세에 있으면 `[data-theme="dark"]`로 분기.

```css
:root {
  /* color */
  --color-bg: #ffffff;
  --color-fg: #0a0a0a;
  --color-accent: #e5ff00;

  /* typography */
  --font-display: "Editorial New", serif;
  --font-body: "Inter", sans-serif;
  --text-xs: 12px;
  --text-base: 16px;
  --text-display-lg: 72px;

  /* spacing — 의도된 리듬 (aesthetic.md의 "공간 리듬"과 일치) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 24px;
  --space-lg: 96px;

  /* motion */
  --ease-default: cubic-bezier(0.2, 0, 0, 1);
  --duration-fast: 0.2s;
}
```

각 화면 `style.css`는 이 변수만 참조하고 raw 값을 거의 사용하지 않는다.

#### tokens.css는 design-tokens.md의 순수 미러

`tokens.css`에는 `design-tokens.md`에 정의된 토큰만 들어간다. 목업 에뮬레이션 전용 토큰(`--shell-*`)은 `phone-shell.css`의 `.phone-shell` 스코프에서만 선언한다. 이 경계가 깨지면 spec-lock 검증이 복잡해지고 draft 폐기 시 함께 사라져야 할 토큰이 spec으로 새어 나간다.

### 2-5. partials/ 작성 규약

각 partial은 **단독으로 렌더링 가능한 HTML 조각**. `<html>`·`<head>` 태그 없이 본문 마크업만.

```html
<!-- partials/header.html -->
<header class="app-header">
  <a class="brand" href="#">{서비스명}</a>
  <nav class="header-nav">
    <a href="#">메뉴 1</a>
    <a href="#">메뉴 2</a>
  </nav>
</header>
```

partial 자체의 스타일은 `_shared/partials/<name>.css`로 두고 `tokens.css`만 참조한다. 모든 화면의 `index.html`이 이 CSS를 함께 로드한다.

### 2-6. 프레임 규약 (phone-shell)

모바일 뷰포트가 있는 프로젝트에서, **phone shell은 A(구조적 공통)** — 화면마다 다른 루트 태그·클래스(`frame`/`device-frame`/`phone-frame` 같은 제각각 작명)·뷰포트 meta·링크 순서·font CDN 포함 여부가 발생하면 "다른 폰으로 찍은 느낌"이라는 결함으로 읽힌다. 이를 원천 차단하기 위해 **템플릿 복제 규약**을 강제한다.

#### 구성 요소

| 파일 | 역할 |
|---|---|
| `_shared/partials/phone-shell.css` | `.phone-shell` 루트 컨테이너 시각 + **목업 에뮬레이션 전용 토큰**. HTML partial 없음 — 클래스만으로 동작하는 CSS 규약 |
| `_shared/partials/status-bar.{html,css}` | 상태바 partial. **Dynamic Island pill 포함 레퍼런스 구현 고정**. 높이는 phone-shell의 `--shell-status-bar-h` 상속 |
| `_shared/partials/home-indicator.{html,css}` | 홈 인디케이터 partial. 높이는 phone-shell의 `--shell-home-indicator-h` 상속 |
| `_shared/templates/scr-mobile.html` | 각 SCR `index.html`이 복제하는 시드 |

#### 토큰 배분 원칙

- `tokens.css` = `design-tokens.md`의 **순수 미러** (제품 디자인 시스템). draft → production 이행 시 그대로 흐른다
- `phone-shell.css` 내부 `.phone-shell {}`에서 선언하는 `--shell-*` 토큰 = **목업 에뮬레이션 전용** (iPhone 뷰포트 치수·status bar 높이·home indicator 높이 등). `design-tokens.md`에 없고, draft phase 종료 시 함께 폐기
- 이 경계가 깨지면(예: `--shell-viewport-w`를 tokens.css에 넣는 경우), `tokens.css`가 `design-tokens.md`와 1:1 대응을 잃고 spec-lock 검증이 복잡해진다

#### phone-shell.css 레퍼런스 구현 (정전 코드)

**`skills/draft-conventions/templates/phone-shell.css`** 를 그대로 `_shared/partials/phone-shell.css`로 복사한다 (`cp` 사용 권장). `--shell-viewport-w`/`--shell-viewport-h` 값만 `_shared/aesthetic.md` frontmatter의 `viewports:` mobile 치수와 일치시키고, 그 외 구조 규칙(width/height/box-sizing/position/overflow/display/flex-direction)·시각 바인딩·전역 reset·주석은 한 글자도 변경하지 않는다.

핵심 구조 (참고용):
- 전역 reset `html, body { margin: 0; padding: 0; }` — 가짜 full 샷 차단
- `.phone-shell`은 viewport lock: `height: 100dvh` + `overflow: hidden` + `display: flex; flex-direction: column`. `min-height` 기반으로 되돌리면 status-bar 스크롤·빈 상태 1.02 오버플로우·모달 body 스크롤이 동시에 재현됨
- `--shell-*` 토큰은 `.phone-shell` 스코프 안에서만 선언 (tokens.css에 넣지 않음)
- 시각 바인딩은 4개 토큰 — `--color-canvas`·`--color-fg-primary`·`--font-body`·`--text-body`

전체 코드는 템플릿 파일을 직접 본다.

이 CSS가 요구하는 **tokens.css 바인딩 토큰 4개** — `--color-canvas`·`--color-fg-primary`·`--font-body`·`--text-body`. 이 이름이 `design-tokens.md`의 1차 토큰과 다르다면, screen-builder는 `tokens.css` 하단에 alias 선언으로 매핑한다 (예: `--color-canvas: var(--color-bg-primary);`).

status-bar.css·home-indicator.css는 각각 `height: var(--shell-status-bar-h)`·`height: var(--shell-home-indicator-h)`로 cascade inheritance를 통해 shell-scoped 토큰을 받는다. 자체 상수 하드코딩 금지. 두 요소 모두 phone-shell의 flex column 안에서 고정 행으로 잠겨야 하므로 **`flex: 0 0 auto` 선언을 강제**한다. home-indicator.css는 이 외 `width: 100%`와 하단 고정 배경만 두고 본체는 `::before` 핸들 pill로 처리한다.

#### status-bar partial 레퍼런스 구현 (정전 코드)

**`skills/draft-conventions/templates/status-bar.html`** 와 **`templates/status-bar.css`** 를 그대로 `_shared/partials/`로 복사한다. 두 파일 모두 한 글자도 변경하지 않는다.

핵심 사실 (참고용):
- **Dynamic Island pill** (`.status-bar__island`)은 모든 프로젝트에서 동일하게 포함 — 기기 모델/플랫폼 세분화는 후속 버전 과제
- 시계/인디케이터 더미 값은 고정(9:41) — 캡처 재현성 보장
- `.status-bar`는 `flex: 0 0 auto`로 phone-shell flex column에서 고정 행으로 잠김
- 높이는 `var(--shell-status-bar-h)` 상속 (자체 하드코딩 금지)
- 색은 `var(--color-fg-primary)` 상속

#### 금지 사항 (status-bar)

- 화면 `style.css`에서 `.status-bar`·`.status-bar__*` 재정의 금지. 색 변경이 필요하면 `--color-fg-primary`·`--shell-status-bar-h` 토큰을 건드리는 방식으로 해결
- Dynamic Island pill 제거 금지 — chassis 세분화(모델/플랫폼 선택)는 후속 버전에서 다룸
- 상태바 콘텐츠를 프로젝트 브랜딩으로 대체 금지 (브랜드는 본문에서만)

#### scr-mobile.html 시드 규약

**`skills/draft-conventions/templates/scr-mobile.html`** 을 그대로 `_shared/templates/scr-mobile.html`로 복사. 각 SCR `index.html`은 이 시드를 복제한 뒤 placeholder를 치환한다.

핵심 placeholder (참고용):
- `{VIEWPORT_WIDTH}` — viewport meta 너비 (예: 390)
- `{SCR_ID}`·`{SCR_TITLE}` — 화면 식별자·이름
- `{FONT_LINKS}` — aesthetic.md §4에 선언된 폰트 CDN 링크
- `{EXTRA_PARTIAL_LINKS}` — 이 화면이 쓰는 추가 partial CSS 링크
- `{BODY}` — 화면 본문 (Stage 2 편집 슬롯)

루트 태그(`<main class="phone-shell" data-viewport="mobile">`), viewport meta, tokens/phone-shell/status-bar/home-indicator 필수 링크 4줄, status-bar/home-indicator `data-include` 2줄은 §3 권한 매트릭스에서 **변경 금지** 영역으로 명시된다.

#### 본문 wrapper 규약 (viewport lock 귀결)

phone-shell이 `height: 100dvh + overflow: hidden + flex column`으로 viewport lock되어 있으므로, `{BODY}` 슬롯 최상위에 **자체 scroll container 역할의 본문 wrapper**를 반드시 둔다 (관례 이름: `.scr001`·`.scene`·`.add-sheet` 등. 이름은 자유이나 "wrapper 1개 존재"는 강제).

본문 wrapper 요건:

```css
.scr-body {         /* 화면마다 이름 자유. phone-shell 바로 안쪽 최상위 wrapper 1개 */
  flex: 1 1 auto;
  min-height: 0;              /* flex 기본 min-height:auto를 풀어 overflow 동작 */
  display: flex;
  flex-direction: column;
  overflow-y: auto;           /* 하위에 scroll 책임을 위임하는 경우 생략 가능 */
}
```

`overflow-y: auto`는 wrapper 자신이 스크롤하는 경우에만 둔다. 모달 shell이 wrapper이고 그 내부 특정 리스트가 scroll을 담당하는 식으로 **하위 위임**하는 경우엔 wrapper에서 생략하고 해당 하위 요소가 `flex: 1 1 auto; min-height: 0; overflow-y: auto`를 갖는다. 어느 쪽이든 **scroll container는 정확히 1개 층위에만** 존재해야 한다 (중첩 금지 — nearest scrollable ancestor가 둘이 되면 sticky 기준이 흔들린다).

이 짝이 빠지면 긴 콘텐츠는 **fallback 없이 잘린다** — phone-shell이 overflow: hidden이므로 body 스크롤로 떨어지는 보강 동선이 없다. modal·bottom-sheet 내부 역시 동일 패턴으로 자체 scroll 영역을 두며, 외부(phone-shell/body)는 어떤 경우에도 스크롤되지 않아야 한다.

##### 자식 shrink 차단 (필수)

본문 wrapper가 flex column이 되면 직계 자식은 flex item이 되어 **기본 `flex-shrink: 1`**을 가진다. 콘텐츠 합이 wrapper 높이를 초과할 때 브라우저는 overflow로 쏟기 전에 flex-shrink를 먼저 적용하므로, `position: sticky`나 `height: 48px` 같은 **명시적 고정 의도조차 압축된다**. 예컨대 `height: 48px; border-bottom: 1px`인 필터 행이 콘텐츠 많은 variant에서 content-box 0 + border 1px만 잔존하여 "행이 사라진 듯 보이는" 증상이 발생한다.

이를 막기 위해 **본문 wrapper 직계 자식 전원에 `flex: 0 0 auto`를 부여**한다. 공통 규칙으로 한 번에 처리하는 것이 권장 구현형이다:

```css
.scr001 > * { flex: 0 0 auto; }
```

내부에 "남은 공간을 채우며 자체 스크롤하는 영역"(예: `.recipe-list`·`.pane`)이 있다면 그 요소만 예외적으로 재정의한다:

```css
.scr001 > .recipe-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
```

이 공통 규칙 1줄 + 예외 1줄 패턴이 "자식마다 `flex: 0 0 auto`를 개별 선언"보다 누락 안전하고 의도도 분명하다.

#### 금지 사항 (본문 wrapper)

- 본문 wrapper 직계 자식에 `flex-shrink: 1`(기본값 포함)을 남겨둔 채 `position: sticky`나 고정 `height`·`min-height`만으로 고정을 의도 **금지**. 콘텐츠 많은 variant에서 sticky가 1px로 붕괴하여 `border-bottom`만 남는다
- 본문 wrapper를 여러 개 중첩하거나 scroll container를 2중으로 두는 것 **금지**. sticky가 nearest scrollable ancestor 기준으로 붙기 때문에 예측 불가한 위치에 고정된다

#### 금지 사항 (프레임 전반)

- 화면 `style.css`에서 `.phone-shell`·`.frame`·`.device-frame` 같은 루트 컨테이너 클래스에 치수·라운드 코너·배경 재정의 **금지**. phone-shell.css가 단일 소스
- 화면 `style.css`에서 `.phone-shell`의 `height`·`overflow`·`display`·`flex-direction`를 `min-height`·`visible`·`block` 등으로 되돌리는 재정의 **금지**. viewport lock을 깨는 즉시 status-bar 스크롤·빈 상태 1.02 오버플로우·모달 body 스크롤이 동시에 재현된다
- 루트 요소에 `<div>` 대신 `<main>` 사용 강제 (위 템플릿대로). 자체 `<main>`을 본문에 추가로 만들지 않는다
- `width=device-width` 대신 고정 뷰포트 너비(`width=390` 등)를 쓴다 — 드래프트는 기기 에뮬레이션이므로 반응형 시뮬레이션 대상이 아니다
- `{BODY}` 슬롯에 scroll container(`flex: 1 1 auto; min-height: 0; overflow-y: auto`)를 두지 않는 것 **금지** — viewport lock 구조에서 본문 overflow의 유일한 소화 경로이기 때문

웹 뷰포트(`scr-web.html`)도 같은 원리로 운용한다. 템플릿 슬롯·편집 권한·금지 사항을 웹 컨텍스트(뷰포트 프레임 없음, max-width 컨테이너·상단 글로벌 헤더 등)에 맞춰 정의하되, **"프레임은 A, 템플릿 복제로 강제"** 원칙은 동일하다.

### 2-7. includer.js 레퍼런스 구현

**`skills/draft-conventions/templates/includer.js`** 를 그대로 `_shared/includer.js`로 복사. `data-include` 속성이 있는 요소를 fetch한 partial로 치환하는 30줄짜리 로더. 한 글자도 변경하지 않는다.

`file://` 프로토콜에서는 fetch가 막히므로 시안 검토 시에는 정적 서버(예: `python3 -m http.server`)를 띄우고 본다. notes.md에 명시한다.

### 2-8. 화면 빌드 규약

각 화면은 다음 구조.

```
docs/ui-drafts/SCR-001/
  index.html       # 필수. 메인 시안 단일 진입점
  style.css        # 필수. 이 화면 전용 스타일 (tokens.css만 참조)
  script.js        # 선택. 인터랙션 시연
  notes.md         # 필수. 의도·상태·변형 매핑
  variants/        # 선택. 큰 변형만 (아래 「변형 처리」)
    admin.html
    explore-*.html # explore 모드 임시 산출물 (아래 「explore 처리」)
```

#### 상태 시연 (`?state=`)

ui-design.md §3에 명시된 모든 상태를 메인 `index.html`에서 시연한다. `data-state` 속성 + CSS로 분기하되, **상태 전환은 URL query parameter(`?state=`)로 구동**한다. 시안 HTML에 dev-only 토글 버튼을 넣지 않는다.

```
index.html               → default
index.html?state=loading → 로딩
index.html?state=empty   → 빈
index.html?state=error   → 에러
```

##### CSS 패턴 — base default-off + active on (강제)

각 상태 영역을 (상태 × 역할) 매트릭스로 일일이 명시하는 방식은 한 칸 누락 시 div 기본값(`block`)이 silent fallback으로 노출되어 **누설 버그**를 만든다. 같은 이유로 `display: flex !important`로 보호하는 안티패턴이 끼어들어 상태 분기를 무력화시키기 쉽다.

이를 구조적으로 차단하기 위해 다음 패턴을 강제한다. 상태 영역 식별은 화장 클래스와 충돌을 피하기 위해 어트리뷰트(`data-role`)로 한다.

```css
/* base — 비활성 상태 영역 default-off (content는 자연 display 유지) */
[data-role="loading"],
[data-role="empty"],
[data-role="error"]                                    { display: none; }

/* active — 활성 상태에서 content 숨기고 해당 영역 노출 */
.wrapper[data-state="loading"] [data-role="content"]   { display: none; }
.wrapper[data-state="loading"] [data-role="loading"]   { display: flex; }   /* 영역에 맞게 block/grid/flex */

.wrapper[data-state="empty"]   [data-role="content"]   { display: none; }
.wrapper[data-state="empty"]   [data-role="empty"]     { display: flex; }

.wrapper[data-state="error"]   [data-role="content"]   { display: none; }
.wrapper[data-state="error"]   [data-role="error"]     { display: flex; }
```

이 패턴은:

- **누락이 silent fallback이 되지 않음** — 새 상태·역할 추가 시에도 base가 모든 비활성 영역을 자동 숨김
- **`!important` 불필요** — 활성 상태 셀렉터의 specificity(0,2,0)가 base(0,1,0)를 자연스럽게 덮음
- **content의 자연 display 보존** — content 영역이 flex/grid 컨테이너여도 별도 `style.css` 선언이 살아 있음
- **새 역할 추가 안전** — 새 `data-role` 추가 시 base 한 줄(`display: none`)만 더하면 됨

##### 금지 사항

- **(상태 × 역할) 명시 분기 패턴 금지** — 각 조합마다 `display: none`/`block`을 일일이 선언하는 방식. 한 칸 누락 시 누설 발생
- **상태 가시성 강제용 `!important` 금지** — 본문 wrapper·중앙 정렬 컨테이너·상태 영역 등 어느 화면 본문 CSS에서도 `!important` 사용 금지 (`_shared/partials/*`의 frame 보호 목적 `!important`만 예외)
- **scope-bound 시각 보강은 활성 상태 셀렉터 내부에서** — error 영역 중앙 정렬처럼 상태별 시각 보강이 필요하면 활성 상태 scope 안에서만 적용
  - 예: `.wrapper[data-state="error"] [data-role="error"] { align-items: center; ... }`

##### `?explore=` 분기에도 동일 패턴

`?explore=A`/`?explore=B` 비교 시안에서도 동일한 base default-off + active on 패턴을 적용한다. 어트리뷰트 명만 분기축에 맞게 바꿔 동일 구조로 작성.

##### 기존 클래스 기반 시안과의 호환

이전 규약은 클래스 셀렉터(`.skeleton`/`.empty`/`.error`)를 사용했다. 본 패턴은 `data-role` 어트리뷰트로 전환된다 — 기존에 빌드된 시안은 자동 변환되지 않으며, 차후 `draft-build`(rebuild) 또는 `draft-revise`(L1 in-scope patch) 시점부터 새 패턴으로 작성한다.

```js
// script.js — URL query param으로 상태 적용
var s = new URLSearchParams(location.search).get("state");
if (s) document.querySelector("[data-state]").dataset.state = s;
```

INDEX.html 갤러리에서 상태별 iframe을 나란히 배치하면 클릭 없이 모든 상태를 한눈에 비교할 수 있다.

#### 변형 처리 (`variants/`)

다음 케이스만 별도 파일로 분리. 그 외는 메인 `index.html`의 토글로 시연.

| 케이스 | 처리 |
|---|---|
| 인터랙션 단계 (drawer 닫힘/열림, modal 표시/숨김) | `index.html` 안에서 인터랙션 또는 `?state=` |
| 상태 (로딩·빈·에러·성공) | `index.html?state=<name>` URL query param |
| 반응형 (mobile/desktop) | `index.html` + 뷰포트 리사이즈로 시연 |
| **권한별 (admin/member/guest)** | `variants/<role>.html` |
| **A/B 변형** | `variants/<variant-name>.html` |
| **데이터 케이스 (빈 권한·다국어 등)가 디자인 결정에 영향** | `variants/<case>.html` |

variants는 **ui-design.md §3에 명시적으로 변형이 기술된 화면에만** 만든다. 임의로 추가하지 않는다.

#### explore 처리 (신규)

draft-revise의 L1-explore 분기에서 N안 비교용 임시 산출물을 만들 때 사용. **임시성**이 핵심 — 결정 게이트 후 미선택안은 자동 폐기된다.

세 가지 명명을 분리해 디렉토리·파일명만 봐도 임시/영구를 구분할 수 있게 한다.

| 개념 | 정의 | 위치 |
|---|---|---|
| `state` | spec에 정의된 상태 (loading/empty/error) | `index.html?state=<name>` |
| `variant` | spec에 정의된 영구 변형 (admin/member 등) | `variants/<role>.html` |
| `explore` | 비교 후 폐기되는 임시 시안 | 아래 두 메커니즘 |

##### 메커니즘 1: 단일 화면 내 시각 비교

색·크기·위치 같은 좁은 시각 변경은 URL 분기 또는 별도 파일로:

```
SCR-001/index.html?explore=A         # 색안 A
SCR-001/index.html?explore=B         # 색안 B
SCR-001/variants/explore-bottom.html # 버튼 위치 하단안 (레이아웃 변경)
```

CSS로 분기 가능한 변경(색·크기·여백 등)은 `?explore=` URL 패턴 — `?state=`와 동일한 방식. 레이아웃 자체가 크게 달라지는 경우만 별도 파일.

`?explore=` 적용은 `?state=`와 동일하게 `script.js`에서 처리:

```js
var e = new URLSearchParams(location.search).get("explore");
if (e) document.querySelector("[data-explore]").dataset.explore = e;
```

##### 메커니즘 2: 토큰 단위 비교 (전 화면 영향)

토큰 변경은 한 화면만 보고 결정 못 한다. 영향 화면 모두 비교 빌드 필요.

```
_shared/tokens.explore-A.css    # 토큰 안 A (예: --color-accent: #ff0066)
_shared/tokens.explore-B.css    # 토큰 안 B (예: --color-accent: #00ff88)
```

각 안은 `tokens.css`를 base로 두고 `tokens.explore-*.css`를 뒤에 cascade로 덮어쓴다. screen-builder는 영향 화면 SCR-xxx마다 `?tokens=explore-A` URL 분기를 만들어 동적으로 안을 전환한다.

##### explore 식별 마커

모든 explore 산출물에는 자동 폐기 식별을 위한 마커를 둔다.

- HTML 파일 → `<!-- __explore: <name> -->` 첫 줄
- CSS 파일 → `/* __explore: <name> */` 첫 줄
- frontmatter 가능한 경우 → `__explore: true`

draft-revise의 결정 게이트에서 미선택안을 폐기할 때 이 마커로 대상을 식별한다.

##### INDEX.html에 explore 노출

draft-build의 INDEX 생성 로직은 `?state=`·`variants/*.html` 외에 explore 산출물도 자동 노출한다. explore 섹션은 상단에 임시 표시 (예: 노란 배지 + "결정 후 폐기"), 결정 게이트 통과 후 사라진다.

### 2-9. notes.md 작성 규약

각 화면 디렉토리의 `notes.md`는 후속 dev phase의 시안 해석자가 가장 먼저 읽는 문서. 우선순위: notes.md > HTML/CSS > 스크린샷.

```markdown
# SCR-001 - 랜딩

## 의도
이 화면이 사용자에게 전달해야 할 핵심 인상과 행동 유도. 1~2단락.

## 뷰포트
기준 해상도 (예: 1280×800 desktop, 375×812 mobile). 반응형 분기점.

## 상태 변화
| 상태 | URL | 시연 위치 |
| --- | --- | --- |
| 기본 | index.html (기본값) | 본문 그대로 |
| 로딩 | index.html?state=loading | [data-role="loading"] 영역 |
| 빈   | index.html?state=empty   | [data-role="empty"] 영역 |
| 에러 | index.html?state=error   | [data-role="error"] 영역 |

## 변형
| 파일 | 조건 | 차이 |
| --- | --- | --- |
| index.html | 기본 (권한=member) | 메인 시안 |
| variants/admin.html | 권한=admin | 관리 메뉴 추가, 헤더 우측 알림 배지 |

## 가정
- {ui-design.md에 없어 시안에서 가정한 항목 1줄씩}

## 이관 체크리스트 (구현 시 주의)
| 시안 표현 | 권장 구현 | 대안 |
| --- | --- | --- |
| `position: sticky` 두 줄(헤더 top:0, 필터 top:64) | `stickyHeaderIndices={[0, 1]}` | `Animated.ScrollView` |
| `@keyframes shimmer` | Reanimated `withRepeat(withTiming())` | `Animated.loop` |

## 검토 방법
1. `python3 -m http.server` 또는 다른 정적 서버를 시안 루트에서 실행
2. http://localhost:8000/SCR-001/index.html 접속
3. URL에 `?state=loading`, `?state=empty` 등을 붙여 각 상태 확인
```

#### 「이관 체크리스트」 작성 원칙

시안이 정적 HTML/CSS이고 구현 타깃이 React Native·Flutter 등 네이티브일 때, 시안의 시각·동작 요소가 네이티브로 자동 변환되지 않는 항목을 모아 별도 섹션으로 둔다. 후속 `with-ui-draft` 스킬이 구현 전에 이 섹션을 todo로 등록한다.

작성 규칙:

- **옵션 나열에서 그치지 말고 권장안 1개를 픽**. "stickyHeaderIndices 또는 Animated.ScrollView" 처럼 양자택일로 끝내면 구현자가 결정 부담을 안고 외피만 만든 상태로 마무리하는 사고가 반복된다. "권장: stickyHeaderIndices, 대안: Animated.ScrollView" 식으로 명시한다.
- **권장 근거는 한 줄로**. 권장안이 명백한 이유(성능·관용·플랫폼 차이 등)를 옆에 적는다.
- **빠지기 쉬운 항목**: sticky 영역, 키보드 회피, 무한 스크롤 페이지네이션, 시스템 백 제스처, SafeArea 분담, 키프레임 애니메이션, `currentColor` 등 SVG 상속.

### 2-10. 금지 사항 (전반)

- 외부 빌드 도구 (webpack, vite, parcel 등) 사용 금지
- 노드 모듈, npm install 금지 (캡처 도구 `_shared/_tools/` 제외)
- React·Vue·Svelte 등 프레임워크 금지 (실제 구현 단계에서 별도 도입)
- CSS 전처리기 (Sass, Less) 금지 — 표준 CSS만
- 외부 CDN 사용 최소화 — 폰트만 허용. 아이콘은 인라인 SVG
- partial을 화면 HTML 안에 복붙 금지 — 반드시 `data-include`로
- aesthetic.md를 design-tokens.md의 단순 재서술로 만들지 말 것 — 사용 비율·대비·금지선이 핵심
- ui-design.md §3에 없는 UI 요소·변형 임의 추가 금지

### 2-11. 산출물 자가 점검

시안 작성 완료 후 screen-builder가 다음을 자가 점검하고 통과 후 호출자에게 보고한다.

- [ ] 모든 화면 디렉토리에 `index.html`, `style.css`, `notes.md` 존재
- [ ] index.html에 `_shared/tokens.css`, `_shared/partials/*.css`, `_shared/includer.js` 모두 로드됨
- [ ] 헤더·탭바 등 구조 partial은 `data-include`로만 참조 (복붙 없음)
- [ ] **[mobile]** 모든 `SCR-*/index.html`의 루트가 `<main class="phone-shell" data-viewport="mobile">` — 제각각 클래스 없음
- [ ] **[mobile]** `_shared/templates/scr-mobile.html` 존재, 모든 SCR의 viewport meta·필수 링크 4줄·status-bar/home-indicator include 2줄이 템플릿과 동일
- [ ] **[mobile]** 화면 `style.css`가 `.phone-shell` 루트 컨테이너 치수·라운드·배경을 재정의하지 않음. `height`·`overflow`·`display`·`flex-direction`도 재정의 금지
- [ ] **[mobile]** `_shared/partials/phone-shell.css`가 viewport lock 구조(`height: 100dvh` + `overflow: hidden` + `display: flex; flex-direction: column`)를 사용하며 `min-height` 기반이 아님
- [ ] **[mobile]** status-bar.css·home-indicator.css에 `flex: 0 0 auto`가 선언되어 phone-shell flex column에서 고정 행으로 잠김
- [ ] **[mobile]** 모든 SCR의 `{BODY}` 슬롯 최상위에 본문 wrapper가 존재하며 `flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column`(+ `overflow-y: auto` 또는 하위 위임)을 만족
- [ ] **[mobile]** 본문 wrapper 직계 자식이 `flex: 0 0 auto`로 shrink 차단됨 (공통 규칙 `wrapper > * { flex: 0 0 auto }` 권장)
- [ ] **[mobile]** `_shared/partials/phone-shell.css` 최상단에 `html, body { margin: 0; padding: 0; }` 전역 reset이 선언되어 있음
- [ ] **[mobile]** `_shared/partials/status-bar.html`이 §2-6 「status-bar partial 레퍼런스 구현」과 일치 — Dynamic Island pill·시계 "9:41"·신호/와이파이 SVG + 배터리 더미 그대로
- [ ] ui-design.md §3에 명시된 모든 UI 요소·상태가 시안에 존재
- [ ] 상태 전환이 `?state=` query param으로 동작 (시안 HTML에 dev-only 토글 버튼이 없음)
- [ ] 상태 분기 CSS가 §2-8 「base default-off + active on」 패턴을 따름 — (상태 × 역할) 명시 분기 0건
- [ ] 화면 본문 CSS(`SCR-*/style.css`)에 `!important` 사용 0건 (`_shared/partials/*`의 frame 보호 목적 `!important`만 예외 — 자가 점검 대상 아님)
- [ ] style.css에 raw 색상·간격 값 거의 없음 (tokens.css 변수만 참조)
- [ ] notes.md의 「변형」 표가 variants/ 디렉토리 파일과 정확히 매칭

---

## 3. 호출 모드별 편집 권한 매트릭스

screen-builder는 호출자(draft-build 또는 draft-revise)로부터 4가지 모드 중 하나로 호출된다. 모드는 호출 프롬프트 첫 줄에 명시된다.

### 3-1. 모드 정의

| 모드 | 트리거 | 목적 |
|---|---|---|
| **full-build** | draft-build의 fresh / rebuild / _shared 변경 update | `_shared/` + 모든 SCR 신규/덮어쓰기 빌드 |
| **single-scr** | draft-build의 update (영향 SCR 한정) | 단일 `SCR-xxx/` 신규/덮어쓰기 |
| **patch** | draft-revise의 L1 in-scope | 기존 `SCR-xxx/` 일부만 수정 |
| **explore** | draft-revise의 L1-explore | 비교용 임시 산출물 N개 생성 |

### 3-2. 권한 매트릭스

| 모드 | `_shared/` | 지정 `SCR-xxx/` | 다른 `SCR-xxx/` | 비고 |
|---|---|---|---|---|
| **full-build** | 생성/덮어쓰기 | 생성/덮어쓰기 (전체) | — | 단일 호출로 모든 SCR 처리 |
| **single-scr** | 읽기 전용 | 생성/덮어쓰기 | 손대지 않음 | 병렬 호출 시 격리 보장 |
| **patch** | 읽기 전용 | 지정 영역만 편집 | 손대지 않음 | `index.html` `{BODY}` 슬롯 내부, `style.css` 특정 셀렉터, `notes.md` 한정 |
| **explore** | `tokens.explore-*.css` 추가만 (기존 `tokens.css` 불변) | `?explore=` 분기 추가 또는 `variants/explore-*.html` 추가 | 토큰 비교 시 영향 화면 모두에 explore 분기 추가 | 모든 산출물에 `__explore` 마커 |

### 3-3. 모드별 세부 규약

#### full-build

- `_shared/` 전체 빌드 (tokens.css·aesthetic.md·partials·templates·includer.js)
- ui-design.md §1의 모든 SCR 디렉토리 빌드
- 기존 산출물은 덮어쓴다 (rebuild) 또는 신규 생성 (fresh)
- `_tools/`는 건드리지 않는다 (draft-build가 templates/에서 복사)
- INDEX.html은 만들지 않는다 (draft-build STEP 5가 담당)

#### single-scr

- 호출 프롬프트에 `{TARGET_SCR}` 명시
- `_shared/`는 읽기만 — 어떤 파일도 수정·생성하지 않음
- `{TARGET_SCR}/` 외 다른 SCR 디렉토리는 손대지 않음 (병렬 호출 격리)
- 기존 `{TARGET_SCR}/` 내용은 덮어쓴다

#### patch

- 호출 프롬프트에 `{TARGET_SCR}` + `{PATCH_INSTRUCTIONS}` 명시
- 편집 가능 영역:
  - `{TARGET_SCR}/index.html` — `{BODY}` 슬롯 내부 (`<!-- BODY START -->` ~ `<!-- BODY END -->`)
  - `{TARGET_SCR}/style.css` — 특정 셀렉터 추가/수정
  - `{TARGET_SCR}/script.js` — 인터랙션 시연 보강
  - `{TARGET_SCR}/notes.md` — 변경 내용 반영
- 편집 금지 영역 (§2-6 프레임 규약 그대로):
  - `<main class="phone-shell" data-viewport="mobile">` 루트 태그
  - viewport meta
  - tokens/phone-shell/status-bar/home-indicator 필수 링크 4줄 (순서·제거 금지)
  - status-bar / home-indicator `data-include` 2줄
- `_shared/`는 읽기 전용

#### explore

- 호출 프롬프트에 `{EXPLORE_TYPE}` (`single-screen` | `token`) + `{VARIANTS}` (각 안의 이름·변경 내용) 명시
- `single-screen` 타입:
  - 대상 SCR의 `index.html`에 `data-explore` 속성 추가 + `style.css`에 `[data-explore="<name>"]` 셀렉터 N개 추가
  - 또는 레이아웃 변경 시 `variants/explore-<name>.html` 별도 파일 (마커 필수)
- `token` 타입:
  - `_shared/tokens.explore-<name>.css` 파일 N개 추가 — 변경할 토큰만 선언, 나머지는 `tokens.css` cascade에 위임
  - 영향 화면 모두에 `?tokens=explore-<name>` URL 분기 처리 (script.js에 토큰 CSS 동적 로드 또는 `<link>` 태그 분기)
- 모든 explore 산출물 첫 줄에 마커:
  - HTML: `<!-- __explore: <name> -->`
  - CSS: `/* __explore: <name> */`
- 기존 `tokens.css`·`SCR-xxx/index.html`·`SCR-xxx/style.css`의 비-explore 영역은 불변 (cascade 또는 분기로만 영향)

---

## 4. 리뷰 체크리스트

screen-auditor는 시안을 수정하지 않고 발견 사항만 보고한다. 검수는 **강한 판정**(자동 수정 트리거)과 **약한 평론 노트**(사람 판단을 돕는 정성 인상)로 명확히 분리한다. 디자인의 정성적 평가는 자동화하지 않는다.

### 4-1. 검수 입력

- `docs/ui-design/ui-design.md` (명세 SSOT)
- `docs/design-tokens/design-tokens.md` (토큰 SSOT)
- `docs/ui-drafts/_shared/` (공통 자산)
- `docs/ui-drafts/SCR-xxx/` (각 화면 시안)

ui-design.md §3 화면별 명세와 시안을 1:1로 대조하고, _shared의 일관성도 함께 점검한다.

### 4-2. 점검 절차

1. ui-design.md §1 화면 목록을 읽고 시안 디렉토리와 매칭. 누락/잉여 확인
2. _shared/ 구성 점검 (tokens.css, aesthetic.md, partials, includer.js 존재)
3. 각 SCR-xxx마다 강한 판정 체크리스트 적용
4. 전 화면을 가로지르는 일관성 점검 (partial 사용, 톤 정합)
5. 정성 평론 노트는 별도 섹션에 기록

스크린샷은 점검 입력이 아니다 — 리뷰의 primary view는 `_shared/INDEX.html`의 라이브 iframe 갤러리다.

### 4-3. 강한 판정 체크리스트 (수정 필요)

자동 수정 트리거가 되는 항목. 한 건이라도 발견되면 호출자(draft-build 또는 draft-revise)가 해당 화면 또는 _shared의 재빌드를 요청한다.

#### 4-3-1. 명세 누락

- [ ] ui-design.md §3에 명시된 UI 요소가 시안에 빠짐없이 존재
- [ ] ui-design.md §3에 명시된 상태(로딩·빈·에러·성공)가 모두 시안에서 시연 가능 **+ 각 상태에서 다른 상태의 영역이 누설되지 않음**. 점검 방법: §2-8 「base default-off + active on」 패턴이 화면 `style.css`에 적용되어 있는지 확인. (상태 × 역할) 명시 분기 패턴이 발견되면 누설 여부와 무관하게 즉시 강한 판정 (패턴 자체가 위험)
- [ ] ui-design.md §1에 있는 화면 ID가 모두 `docs/ui-drafts/SCR-xxx/`로 존재 (잉여 시안도 보고)
- [ ] ui-design.md §3에 명시된 변형(권한별·A/B 등)이 `variants/` 또는 토글로 시연됨

#### 4-3-2. 공통 자산 일관성

- [ ] 헤더·탭바·푸터 등 구조 partial은 모든 화면이 `data-include`로 참조 (복붙 금지)
- [ ] partial 자체가 화면별로 수정되지 않음 (헤더 마크업이 화면마다 다르면 위반)
- [ ] `_shared/tokens.css`에 design-tokens.md의 토큰이 누락 없이 변환되어 있음
- [ ] 화면 `style.css`가 raw 값 대신 `tokens.css` 변수를 사용 (의도된 예외는 notes.md에 기록)
- [ ] `_shared/aesthetic.md` 7개 섹션(큰 방향·색 분포·공간 리듬·타이포 위계·모서리·모션·금지 목록)이 모두 채워져 있음
- [ ] 목업 전용 토큰(`--shell-*`)이 `tokens.css`가 아니라 `phone-shell.css`의 `.phone-shell` 스코프에서만 선언됨. `design-tokens.md`에 없는 토큰이 tokens.css에 섞여 있으면 위반

#### 4-3-3. 프레임 일관성 (mobile 뷰포트)

- [ ] `_shared/templates/scr-mobile.html`과 `_shared/partials/phone-shell.css`가 존재
- [ ] `phone-shell.css`의 구조 규칙이 §2-6 「phone-shell.css 레퍼런스 구현」의 **viewport lock 구조**(`height: 100dvh` + `overflow: hidden` + `display: flex; flex-direction: column`)와 일치. `min-height` 기반으로 되돌아가 있으면 위반
- [ ] `--shell-viewport-w`·`--shell-viewport-h`만 프로젝트 viewports 값에 맞게 변경되어 있음
- [ ] `status-bar.css`와 `home-indicator.css`에 `flex: 0 0 auto`가 선언되어 phone-shell flex column 안에서 고정 행으로 잠김
- [ ] 각 SCR의 `{BODY}` 슬롯 최상위에 본문 wrapper가 존재하며 `flex: 1 1 auto; min-height: 0`(+ `overflow-y: auto` 또는 하위 위임)으로 **자체 scroll container**를 구성
- [ ] 본문 wrapper 직계 자식 중 sticky·고정 높이 요소가 `flex: 0 0 auto`로 shrink 차단되어 있음 (공통 규칙 `wrapper > * { flex: 0 0 auto }` 권장)
- [ ] 모달·바텀시트 내부도 자체 scroll 영역을 가지며, 외부(phone-shell/body)는 어떤 경우에도 스크롤되지 않음. scroll container는 한 층위에만 존재
- [ ] `tokens.css`에 phone-shell.css가 요구하는 4개 바인딩 토큰(`--color-canvas`·`--color-fg-primary`·`--font-body`·`--text-body`)이 존재 (직접 선언 또는 alias)
- [ ] status-bar.css·home-indicator.css가 자체 하드코딩 대신 `var(--shell-status-bar-h)`·`var(--shell-home-indicator-h)`를 상속 사용
- [ ] `_shared/partials/phone-shell.css` 최상단에 `html, body { margin: 0; padding: 0; }` 전역 reset이 선언되어 있음
- [ ] `_shared/partials/status-bar.html`이 §2-6 「status-bar partial 레퍼런스 구현」과 일치 — Dynamic Island pill(`.status-bar__island`) 존재, 시계 "9:41", 신호/와이파이 SVG + 배터리 더미 그대로
- [ ] 모든 `SCR-*/index.html` 및 `variants/*.html`의 루트가 `<main class="phone-shell" data-viewport="mobile">`로 동일
- [ ] 모든 SCR의 viewport meta, tokens/phone-shell/status-bar/home-indicator 필수 링크 4줄, status-bar/home-indicator `data-include` 2줄이 템플릿과 동일 (순서·제거·변경 없음)
- [ ] 화면 `style.css`가 `.phone-shell` 루트 컨테이너의 치수·라운드 코너·배경을 재정의하지 않음

#### 4-3-4. INDEX.html 일관성

- [ ] `_shared/INDEX.html`의 섹션 nav(`.section-rail`)가 `.page-head` 외부에 독립 컴포넌트로 배치
- [ ] 섹션 nav 링크가 DOM(`main .scr[id]`)에서 런타임 생성됨 (하드코딩된 `<a>` 목록은 SCR 추가 시 누락 위험)
- [ ] SCR 헤더(`.scr__head`)에 variant별 진입점(`.links`·open↗·png 등)이 포함되지 않음. 진입점은 variant 단위 `figcaption` ↗ 링크로 런타임 주입
- [ ] `.page-head`·`.scr`·`.section-rail` 같은 최상위 콘텐츠 컨테이너에 `max-width` + `margin: 0 auto` 중앙정렬 패턴이 없음 (INDEX는 mockup 격자 비교 UI이므로 좌측 정렬 + 가용 폭 전체 사용이 기본)

#### 4-3-5. aesthetic.md 위반

- [ ] aesthetic.md "금지 목록"의 항목이 시안에 등장하지 않음 (예: "그라데이션 금지" 명시 시 그라데이션 사용한 화면은 위반)
- [ ] aesthetic.md "색 분포" 규칙이 지켜짐 (예: "액센트는 화면당 1~2회" 명시 시 5회 사용한 화면은 위반)
- [ ] aesthetic.md "모서리 & 깊이" 규칙이 지켜짐

#### 4-3-6. notes.md 누락

- [ ] 모든 SCR-xxx에 `notes.md`가 존재
- [ ] notes.md에 의도·뷰포트·상태 변화·검토 방법이 모두 기재
- [ ] `variants/` 폴더가 있는 경우 notes.md의 「변형」 표와 1:1 매칭
- [ ] 시안의 시각·동작이 네이티브로 자동 변환되지 않는 항목(sticky·키보드 회피·키프레임·SVG 상속 등)이 있다면 「이관 체크리스트」가 작성되어 있고, 각 항목이 **권장안 1개**를 명시 (옵션 나열만으로 끝나지 않음)

#### 4-3-7. 정적 자체 완결성

- [ ] 외부 빌드 도구·노드 모듈 의존이 없음 (`_shared/_tools/` 캡처 도구 제외)
- [ ] 외부 CDN 사용이 폰트로 한정됨 (아이콘은 인라인 SVG)
- [ ] React·Vue 등 프레임워크가 도입되지 않음
- [ ] 화면 본문 CSS(`SCR-*/style.css`)에 `!important` 사용 0건. 발견 시 `notes.md`에 정당화 기록이 없으면 강한 판정 (`_shared/partials/*` 안의 `!important`는 frame 보호 목적이므로 점검 대상 아님)

### 4-4. 약한 평론 노트 (참고용 — 자동 수정 트리거 아님)

다음 항목은 정성적 인상에 대한 의견. 위반이 아니라 **사람이 판단할 입력**으로만 출력한다. 호출자는 이 항목으로 재빌드를 트리거하지 않는다.

각 화면별로 1~3문장씩 작성한다.

- **임팩트**: 이 화면이 사용자에게 주는 첫 인상이 명세의 의도(`notes.md` 「의도」)와 부합하는가
- **시각 무게 분포**: 강조와 여백의 균형, 시선 흐름의 자연스러움
- **화면 간 톤 정합성**: 다른 화면들과 같은 디자이너가 만든 것처럼 보이는가, 톤 격차가 큰 화면이 있는가
- **자유 합성의 다양성**: 패턴 컴포넌트(버튼·카드 등)가 화면 맥락에 맞게 변주되어 있는가, 또는 모든 화면이 똑같이 안전한 형태로 회귀하지 않았는가

평론 노트는 "좋다/나쁘다" 단정이 아니라 **관찰**로 작성한다. 예: "랜딩 화면의 hero 영역은 명세 의도(대담함)와 잘 맞으나, 푸터 직전 CTA 섹션이 hero 대비 시각 무게가 약해 마무리 인상이 흐려진다."

### 4-5. 출력 포맷

검수 결과는 4구역으로 분리한다.

```
🔴 수정 필요 (Must Fix)
- [SCR-001/index.html] {위반 항목} - ui-design.md §3에 명시된 "에러 상태"가 시연되지 않음
- [_shared/aesthetic.md] {위반 항목} - "공간 리듬" 섹션이 비어 있음
- [SCR-003/style.css:42] {위반 항목} - raw 색상값 #3a7bd5 사용 (tokens.css 변수 없음)

🟡 권장 (Should Fix)
- [SCR-002/notes.md] {권장 항목} - 「가정」 섹션 누락. 시안의 임의 결정이 있다면 명시 권장

🟢 통과 (Pass)
- _shared/ 구성 완전
- partial 일관성 OK (8개 화면 모두 헤더 동일)
- tokens.css 변수 사용 정합

📝 평론 노트 (참고용)
- [SCR-001 랜딩] hero 영역의 대담한 타이포가 명세 의도와 잘 맞음. 단 우측 여백이 좁아 호흡감 약함
- [SCR-005 설정] 다른 화면 대비 색 사용이 절제되어 톤 격차 미미. 의도된 것이라면 OK, 아니라면 액센트 1회 정도 보강 고려
- [전체] 모든 화면이 같은 그리드 모듈을 따라 톤 정합성 양호
```

각 구역 끝에 합계: `수정 필요: N건 | 권장: N건 | 통과: N건 | 평론 노트: N건`.

### 4-6. 보고 원칙

- 강한 판정은 **명세·토큰·aesthetic.md·구조 일관성**이라는 객관 기준만 사용. "이 디자인이 별로다"는 강한 판정 아님
- 약한 평론 노트는 **관찰**로만 작성. 명령형("~를 바꿔라") 금지
- 평론 노트로 인한 재작업 여부는 사용자가 결정. 검수자는 트리거하지 않는다
- 발견 사항이 없으면 각 구역에 "이상 없음"으로 명시 (구역 자체를 생략하지 않음)
- 리뷰의 primary view는 `_shared/INDEX.html`의 **라이브 iframe 갤러리**다 (`make preview` 또는 `python3 -m http.server` 후 브라우저로). PNG는 본 단계의 판정 근거가 아니다 — 리뷰어는 iframe에서 실제 인터랙션/상태를 확인한다
- PNG를 보조 자료로 참조할 때는 뷰포트 샷(`screenshots/default*.png`)이 첫인상 기준, 풀 샷(`screenshots/default.full*.png`)이 접지 콘텐츠 확인용. 풀 샷의 높이·길이 자체는 판정 대상이 아님

---

## 5. frontend-design 단서

`frontend-design` 스킬은 본 문서의 **B(패턴 자유 합성) 영역**에서만 영감 카탈로그로 참조할 수 있다.

### 5-1. 사용 범위

- §2-2의 "B. 패턴 공통" 영역 (버튼·카드·인풋·배지·칩 등 화면별 자유 합성)
- aesthetic.md 추출 시 시각 표현의 구체성을 보강할 때

### 5-2. 무시해야 할 충돌 지점

frontend-design은 본 문서·spec과 충돌하면 **무시**한다. 구체적으로:

| 충돌 축 | frontend-design | 본 문서/spec |
|---|---|---|
| 미적 방향 결정 권한 | 에이전트가 BOLD하게 선택 | design-tokens + aesthetic.md가 SSOT |
| 폰트·색상 | "Inter·Roboto 피해라" | design-tokens.md가 정한 그대로 |
| 레이아웃 | 비대칭·그리드 깨기 권장 | phone-shell·partial 구조 강제 |
| 톤 | "잊을 수 없게" | 미니멀 SaaS면 "지루"가 정답일 수 있음 |

spec이 Inter를 지정했으면 Inter를 쓴다. aesthetic.md가 "그라데이션 금지"면 frontend-design이 권장하더라도 안 쓴다.

### 5-3. 참조 위치

frontend-design은 screen-builder의 frontmatter `skills:`에 직접 등재하지 않는다. 본 문서가 단서로 인용하는 것 외에는 의존 그래프에 포함시키지 않는다 — 우선순위 다툼 자체를 없애기 위함.

screen-builder가 frontend-design 가이드를 참조하고 싶을 때는 본 §5 단서를 따라 "B 영역 영감으로만, 토큰·구조·spec과 충돌 시 무시" 원칙을 지킨다.
