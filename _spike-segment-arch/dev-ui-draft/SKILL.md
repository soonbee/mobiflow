---
name: dev-ui-draft
description: HTML+CSS+JS만으로 정적 UI 시안(draft)을 작성하는 가이드. 공통 자산(_shared)과 화면별 자유 합성의 이분법, partial 인클루드 패턴, 상태·변형 표현 규약을 다룬다. UI 시안 제작, 화면 목업 작성 시 사용한다.
---

# dev-ui-draft

정적 HTML/CSS/JS로 디자인 시안을 만들 때의 작성 규약. 시안은 후속 dev phase의 시각 SSOT가 되므로, 명세 충실도와 디자인 일관성을 동시에 만족해야 한다.

빌드 도구·노드 모듈·외부 프레임워크 없이 브라우저에서 파일을 열기만 하면 동작하는 정적 산출물을 만든다.

---

## 핵심 원칙

- **시각 SSOT**: 시안은 후속 구현(`with-ui-draft`)이 그대로 따를 시각 진실. 상태·변형이 명세에 있으면 시안에서 빠짐없이 시연 가능해야 한다
- **정적 자체 완결성**: 빌드 단계 없음. `index.html`을 더블클릭(또는 간단한 정적 서버)만으로 모든 시안이 동작
- **공통화는 구조에만, 패턴은 자유**: 아래 「공통화 이분법」에 따른다 — 이 스킬의 가장 중요한 규칙
- **외부 의존 최소화**: 폰트만 CDN 허용. 그 외 라이브러리·아이콘 세트는 인라인 SVG 또는 emoji-free CSS로 해결

---

## 공통화 이분법

화면 간 "공통 요소"는 두 종류로 갈리며 다루는 방식이 다르다.

| 종류 | 예시 | 처리 |
|---|---|---|
| **A. 구조적 공통 (Structural)** | 헤더, 탭바, 푸터, 사이드바, 모달 컨테이너, 토스트 컨테이너 | `_shared/partials/` 한 파일로 만들고 모든 화면이 그대로 import |
| **B. 패턴 공통 (Pattern)** | 버튼, 카드, 인풋, 배지, 칩, 페이지 그리드 | 공통 컴포넌트로 추출하지 않음. 각 화면에서 토큰만 따라 자유 합성 |

**판정 기준 한 줄**: "모든 화면에서 시각적으로 동일하지 않으면 사용자가 혼란을 느끼는가?" Yes → A (partial). No → B (자유).

### 왜 이렇게 나누는가

A는 "디자인 결정"이 아니라 **정보 아키텍처**다. iOS 앱의 탭바, Notion의 사이드바가 화면마다 다르면 그건 창의성이 아니라 결함이다. 따라서 A를 강제해도 창의성은 0만큼 깎인다.

B는 화면별 합성이 결과물의 정성적 인상을 결정하는 영역이다. 같은 "Primary 버튼"이라도 랜딩 페이지의 거대한 CTA와 설정 화면의 작은 저장 버튼은 시각적 무게가 달라야 좋다. B를 컴포넌트로 강제하면 정성 평가가 명백히 떨어진다.

### 회색지대 처리

| 요소 | 분류 | 이유 |
|---|---|---|
| 모바일 phone shell (viewport 프레임·status-bar·home-indicator·safe-area) | **A (강제)** | 기기 에뮬레이션. 화면마다 다르면 "다른 폰으로 찍은 느낌"이라는 결함으로 읽힘. 창의 영역은 shell 내부이지 shell 자체가 아님 |
| 모달 컨테이너 (오버레이·닫기 버튼 위치) | A | 골격은 동일해야 |
| 모달 내부 콘텐츠 | B | 자유 |
| 토스트·스낵바 컨테이너 | A | 포지션·타이밍 동일해야 |
| 빈 상태·에러 일러스트 | B (가이드는 aesthetic.md에 텍스트로) | 시각 자유 |
| 폼 인풋 시각 | B | 화면 맥락에 맞게 |
| 페이지 그리드 (max-width·gutter) | tokens.css 변수로, 적용은 화면별 자유 | 토큰 레벨 |

판단이 갈리는 항목은 위 한 줄 기준으로 직접 판정한다. 새 카테고리를 만들지 않는다.

---

## `_shared/` 구조

```
docs/ui-drafts/_shared/
  tokens.css                    # 강제. design-tokens → CSS 변수
  aesthetic.md                  # 강제. 디자인 언어 텍스트
  partials/                     # 강제. 구조적 공통 영역만
    phone-shell.css             # mobile 뷰포트가 있을 때 강제. HTML 파트너 없음 (클래스 규약)
    status-bar.{html,css}       # mobile 뷰포트가 있을 때 강제
    home-indicator.{html,css}   # mobile 뷰포트가 있을 때 강제
    header.html                 # (해당 시)
    tabbar.html                 # (해당 시)
    footer.html                 # (해당 시)
    sidebar.html                # (해당 시)
  templates/                    # 강제. 프레임 고정용 시드 HTML. Stage 2가 cp로 복제
    scr-mobile.html             # mobile 뷰포트가 있을 때 강제
    scr-web.html                # web 뷰포트가 있을 때 강제
  includer.js                   # 강제. partial 주입 로더
```

만들지 않는 것:

- ❌ `components.css` — 버튼·카드 같은 패턴 컴포넌트 클래스를 강제하지 않는다
- ❌ `buttons/`, `cards/`, `inputs/` 같은 컴포넌트 폴더
- ❌ JS 프레임워크·번들러·CSS 전처리기

### tokens.css 작성 규약

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

### partials/ 작성 규약

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

### 프레임 규약 (phone shell 템플릿 복제)

모바일 뷰포트가 있는 프로젝트에서, **phone shell은 A(구조적 공통)** — 화면마다 다른 루트 태그·클래스(`frame`/`device-frame`/`phone-frame` 같은 제각각 작명)·뷰포트 meta·링크 순서·font CDN 포함 여부가 발생하면 "다른 폰으로 찍은 느낌"이라는 결함으로 읽힌다. 이를 원천 차단하기 위해 **템플릿 복제 규약**을 강제한다.

#### 구성 요소

| 파일 | 역할 |
|---|---|
| `_shared/partials/phone-shell.css` | `.phone-shell` 루트 컨테이너 시각 + **목업 에뮬레이션 전용 토큰**. HTML partial 없음 — 클래스만으로 동작하는 CSS 규약 |
| `_shared/partials/status-bar.{html,css}` | 상태바 partial. **Dynamic Island pill 포함 레퍼런스 구현 고정**(아래 §「status-bar partial 레퍼런스 구현」). 높이는 phone-shell의 `--shell-status-bar-h` 상속 |
| `_shared/partials/home-indicator.{html,css}` | 홈 인디케이터 partial. 높이는 phone-shell의 `--shell-home-indicator-h` 상속 |
| `_shared/templates/scr-mobile.html` | 각 SCR `index.html`이 복제하는 시드 |

#### 토큰 배분 원칙

- `tokens.css` = `design-tokens.md`의 **순수 미러** (제품 디자인 시스템). draft → production 이행 시 그대로 흐른다.
- `phone-shell.css` 내부 `.phone-shell {}`에서 선언하는 `--shell-*` 토큰 = **목업 에뮬레이션 전용** (iPhone 뷰포트 치수·status bar 높이·home indicator 높이 등). `design-tokens.md`에 없고, draft phase 종료 시 함께 폐기.
- 이 경계가 깨지면(예: `--shell-viewport-w`를 tokens.css에 넣는 경우), `tokens.css`가 `design-tokens.md`와 1:1 대응을 잃고 spec-lock 검증이 복잡해진다.

#### phone-shell.css 레퍼런스 구현

정전 코드 — Stage 1 에이전트는 아래를 그대로 사용한다. `--shell-*` 값은 `_shared/aesthetic.md` frontmatter의 `viewports:`와 일치시키되, 구조 규칙은 한 글자도 바꾸지 않는다.

```css
/* _shared/partials/phone-shell.css
 *
 * 모바일 phone shell 규약. 화면 style.css에서 .phone-shell 속성 재정의 금지.
 * --shell-* = 목업 에뮬레이션 전용 토큰 (tokens.css에 넣지 않음, draft 폐기 시 함께 사라짐).
 * design token (--color-*, --font-*, --text-*) 참조는 tokens.css에서 해결.
 *
 * 전역 reset: 브라우저 기본 body margin(8px × 2 = 16px)이 document.scrollHeight에
 * 덧씌워져 모든 빈 상태 화면에서 scroll ratio가 1.02로 부풀고 capture.mjs의
 * SCROLL_RATIO_THRESHOLD(1.1) 경계 화면에 가짜 full 샷이 생성된다. phone-shell이
 * "body 전체 = 뷰포트 1:1"을 전제하므로 전역 reset은 스코프 규약을 깨지 않는 구조적 필수.
 */

html, body {
  margin: 0;
  padding: 0;
}

.phone-shell {
  /* --- 목업 에뮬레이션 전용 토큰 --- */
  --shell-viewport-w: 390px;          /* aesthetic.md viewports.width와 일치 */
  --shell-viewport-h: 844px;          /* aesthetic.md viewports.height와 일치 */
  --shell-status-bar-h: 44px;
  --shell-home-indicator-h: 34px;
  --shell-safe-top: var(--shell-status-bar-h);
  --shell-safe-bottom: var(--shell-home-indicator-h);

  /* --- 구조 규칙 (viewport lock · 변경 금지) ---
   * 모바일 앱 목업은 뷰포트에 고정되어 body는 스크롤하지 않는다. status-bar·home-indicator는
   * flex 고정 행으로 잠그고, 본문 wrapper가 유일한 scroll container가 되게 한다. min-height로
   * 풀어주면 (1) status-bar가 본문과 함께 밀림 (2) 빈 상태에서도 1.02 오버플로우 (3) 모달/시트가
   * body 전체를 스크롤함 — 세 증상이 동시에 재현된다.
   */
  width: 100%;
  height: 100vh;
  height: 100dvh;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  /* --- 시각 바인딩 (tokens.css의 design token 참조) --- */
  background: var(--color-canvas);
  color: var(--color-fg-primary);
  font-family: var(--font-body);
  font-size: var(--text-body, 15px);
  line-height: 1.5;
}
```

이 CSS가 요구하는 **tokens.css 바인딩 토큰 4개** — `--color-canvas`·`--color-fg-primary`·`--font-body`·`--text-body`. 이 이름이 `design-tokens.md`의 1차 토큰과 다르다면, Stage 1 에이전트는 `tokens.css` 하단에 alias 선언으로 매핑한다 (예: `--color-canvas: var(--color-bg-primary);`).

status-bar.css·home-indicator.css는 각각 `height: var(--shell-status-bar-h)`·`height: var(--shell-home-indicator-h)`로 cascade inheritance를 통해 shell-scoped 토큰을 받는다. 자체 상수 하드코딩 금지. 두 요소 모두 phone-shell의 flex column 안에서 고정 행으로 잠겨야 하므로 **`flex: 0 0 auto` 선언을 강제**한다 (과거 `position: sticky` 권고는 폐기 — flex column stacking이 더 단순하고 확실하게 동작). home-indicator.css는 이 외 `width: 100%`와 하단 고정 배경만 두고 본체는 `::before` 핸들 pill로 처리한다.

#### status-bar partial 레퍼런스 구현

정전 코드 — Stage 1은 아래를 그대로 사용한다. **Dynamic Island pill**은 모든 프로젝트에서 동일하게 포함된다 (기기 모델/플랫폼 세분화는 후속 버전에서 개선). 시계/인디케이터 더미 값은 고정(9:41)으로 둬서 캡처 재현성을 보장한다.

```html
<!-- _shared/partials/status-bar.html -->
<header class="status-bar" aria-hidden="true">
  <span class="status-bar__time">9:41</span>
  <span class="status-bar__island"></span>
  <span class="status-bar__indicators">
    <svg class="status-bar__icon" viewBox="0 0 18 12" aria-hidden="true">
      <rect x="0"  y="8" width="3" height="4"  rx="0.7"/>
      <rect x="5"  y="5" width="3" height="7"  rx="0.7"/>
      <rect x="10" y="2" width="3" height="10" rx="0.7"/>
      <rect x="15" y="0" width="3" height="12" rx="0.7"/>
    </svg>
    <svg class="status-bar__icon" viewBox="0 0 16 12" aria-hidden="true">
      <path d="M8 10.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm0-3.8c1.5 0 2.9.6 3.9 1.7l-1.1 1.1a4 4 0 0 0-5.6 0L4.1 8.1A5.4 5.4 0 0 1 8 6.4zm0-3.8c2.6 0 4.9 1 6.6 2.7l-1.1 1.1a7.7 7.7 0 0 0-11 0L1.4 5.1A9.2 9.2 0 0 1 8 2.6z"/>
    </svg>
    <span class="status-bar__battery"></span>
  </span>
</header>
```

```css
/* _shared/partials/status-bar.css */
.status-bar {
  position: relative;
  height: var(--shell-status-bar-h);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;               /* phone-shell flex column에서 고정 행으로 잠금 */
  font-size: 15px;
  font-weight: 600;
  color: var(--color-fg-primary);
  font-variant-numeric: tabular-nums;
}

.status-bar__time {
  z-index: 1;
  letter-spacing: 0.2px;
}

.status-bar__island {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 126px;
  height: 37px;
  background: #000;
  border-radius: 999px;
  pointer-events: none;
}

.status-bar__indicators {
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-bar__icon {
  width: 16px;
  height: 11px;
  fill: currentColor;
}

.status-bar__battery {
  position: relative;
  display: inline-block;
  width: 26px;
  height: 12px;
  border: 1px solid currentColor;
  border-radius: 3px;
  box-sizing: border-box;
}

.status-bar__battery::before {
  content: "";
  position: absolute;
  inset: 1.5px;
  width: calc(100% - 3px);
  background: currentColor;
  border-radius: 1px;
  transform-origin: left center;
  transform: scaleX(0.8);
}

.status-bar__battery::after {
  content: "";
  position: absolute;
  right: -2px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 5px;
  background: currentColor;
  border-radius: 0 1px 1px 0;
}
```

#### 금지 사항 (status-bar)

- 화면 `style.css`에서 `.status-bar`·`.status-bar__*` 재정의 금지. 색 변경이 필요하면 `--color-fg-primary`·`--shell-status-bar-h` 토큰을 건드리는 방식으로 해결
- Dynamic Island pill 제거 금지 — chassis 세분화(모델/플랫폼 선택)는 후속 버전에서 다룸
- 상태바 콘텐츠를 프로젝트 브랜딩으로 대체 금지 (브랜드는 본문에서만)

#### scr-mobile.html 시드 규약

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width={VIEWPORT_WIDTH}, initial-scale=1, viewport-fit=cover" />
  <title>{SCR_ID} · {SCR_TITLE}</title>

  <!-- Fonts (aesthetic.md §4에 선언된 것만) -->
  {FONT_LINKS}

  <!-- 필수 로드 순서: tokens → phone-shell → status-bar → home-indicator → (추가 partial) → 화면 style -->
  <link rel="stylesheet" href="/_shared/tokens.css" />
  <link rel="stylesheet" href="/_shared/partials/phone-shell.css" />
  <link rel="stylesheet" href="/_shared/partials/status-bar.css" />
  <link rel="stylesheet" href="/_shared/partials/home-indicator.css" />
  <!-- {EXTRA_PARTIAL_LINKS} : 이 화면이 쓰는 추가 partial CSS만 여기에 삽입 -->

  <link rel="stylesheet" href="./style.css" />
  <script src="/_shared/includer.js" defer></script>
  <script src="./script.js" defer></script>
</head>
<body>
  <main class="phone-shell" data-viewport="mobile" aria-label="{SCR_TITLE}">
    <div data-include="/_shared/partials/status-bar.html"></div>

    <!-- ===== BODY START — Stage 2는 이 슬롯만 채움 ===== -->
    {BODY}
    <!-- ===== BODY END ===== -->

    <div data-include="/_shared/partials/home-indicator.html"></div>
  </main>
</body>
</html>
```

#### Stage 2 편집 권한

| 영역 | 편집 가능 여부 |
|---|---|
| `<title>`, `aria-label`, `{SCR_ID}` · `{SCR_TITLE}` 자리 | 필수 교체 |
| `{BODY}` 슬롯 (BODY START ~ BODY END 사이) | 필수 교체 — 화면 본문. **자체 scroll container 요건 준수** (아래 §「본문 wrapper 규약」) |
| `{EXTRA_PARTIAL_LINKS}` 자리 | 추가 허용 (modal-header 등 이 화면이 쓰는 partial CSS 링크만 삽입). 제거 금지 |
| `<main class="phone-shell" data-viewport="mobile">` 루트 태그 | **변경 금지** (태그·클래스·속성 전부) |
| 뷰포트 meta | **변경 금지** |
| tokens/phone-shell/status-bar/home-indicator 링크 4줄 | **제거·순서 변경 금지** |
| status-bar / home-indicator `data-include` 2줄 | **변경 금지** |

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

#### 금지 사항 (프레임)

- 화면 `style.css`에서 `.phone-shell`·`.frame`·`.device-frame` 같은 루트 컨테이너 클래스에 치수·라운드 코너·배경 재정의 **금지**. phone-shell.css가 단일 소스.
- 화면 `style.css`에서 `.phone-shell`의 `height`·`overflow`·`display`·`flex-direction`를 `min-height`·`visible`·`block` 등으로 되돌리는 재정의 **금지**. viewport lock을 깨는 즉시 status-bar 스크롤·빈 상태 1.02 오버플로우·모달 body 스크롤이 동시에 재현된다.
- 루트 요소에 `<div>` 대신 `<main>` 사용 강제 (위 템플릿대로). 자체 `<main>`을 본문에 추가로 만들지 않는다.
- `width=device-width` 대신 고정 뷰포트 너비(`width=390` 등)를 쓴다 — 드래프트는 기기 에뮬레이션이므로 반응형 시뮬레이션 대상이 아니다.
- `{BODY}` 슬롯에 scroll container(`flex: 1 1 auto; min-height: 0; overflow-y: auto`)를 두지 않는 것 **금지** — viewport lock 구조에서 본문 overflow의 유일한 소화 경로이기 때문.

웹 뷰포트(`scr-web.html`)도 같은 원리로 운용한다. 템플릿 슬롯·편집 권한·금지 사항을 웹 컨텍스트(뷰포트 프레임 없음, max-width 컨테이너·상단 글로벌 헤더 등)에 맞춰 정의하되, **"프레임은 A, 템플릿 복제로 강제"** 원칙은 동일하다.

### includer.js 레퍼런스 구현

`data-include` 속성이 있는 요소를 fetch한 partial로 치환하는 30줄짜리 로더. 그대로 사용한다.

```js
// _shared/includer.js
(async function () {
  const targets = document.querySelectorAll("[data-include]");
  await Promise.all(
    Array.from(targets).map(async (el) => {
      const url = el.getAttribute("data-include");
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        el.outerHTML = await res.text();
      } catch (e) {
        el.outerHTML = `<div style="padding:8px;background:#fee;color:#900">[include 실패: ${url}] ${e.message}</div>`;
      }
    })
  );
  document.dispatchEvent(new Event("partials:loaded"));
})();
```

`file://` 프로토콜에서는 fetch가 막히므로 시안 검토 시에는 정적 서버(예: `python3 -m http.server`)를 띄우고 본다. notes.md에 명시한다.

---

## 화면 빌드 규약

각 화면은 다음 구조.

```
docs/ui-drafts/SCR-001/
  index.html       # 필수. 메인 시안 단일 진입점
  style.css        # 필수. 이 화면 전용 스타일 (tokens.css만 참조)
  script.js        # 선택. 인터랙션 시연
  notes.md         # 필수. 의도·상태·변형 매핑
  variants/        # 선택. 큰 변형만 (아래 「변형 처리」)
    admin.html
```

### index.html 골격

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>SCR-001 - 화면명</title>
    <link rel="stylesheet" href="../_shared/tokens.css" />
    <link rel="stylesheet" href="../_shared/partials/header.css" />
    <link rel="stylesheet" href="../_shared/partials/tabbar.css" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body data-state="default">
    <div data-include="../_shared/partials/header.html"></div>

    <main>
      <!-- 화면 본문. 자유 합성 영역 -->
    </main>

    <div data-include="../_shared/partials/tabbar.html"></div>

    <script src="../_shared/includer.js"></script>
    <script src="./script.js" defer></script>
  </body>
</html>
```

partial 영역은 `data-include` 한 줄로만 참조한다. **partial을 복붙해서 화면 안에 박아 넣지 않는다** — 그러면 일관성 보장이 깨진다.

### 상태 시연 (로딩·빈·에러·성공)

ui-design.md §3에 명시된 모든 상태를 메인 `index.html`에서 시연한다. `data-state` 속성 + CSS로 분기하되, **상태 전환은 URL query parameter(`?state=`)로 구동**한다. 시안 HTML에 dev-only 토글 버튼을 넣지 않는다.

```
index.html               → default
index.html?state=loading  → 로딩
index.html?state=empty    → 빈
index.html?state=error    → 에러
```

```css
.wrapper[data-state="loading"] .content { display: none; }
.wrapper[data-state="loading"] .skeleton { display: block; }
.wrapper[data-state="empty"]   .content { display: none; }
.wrapper[data-state="empty"]   .empty   { display: flex; }
/* ... */
```

```js
// script.js — URL query param으로 상태 적용
var s = new URLSearchParams(location.search).get("state");
if (s) document.querySelector("[data-state]").dataset.state = s;
```

INDEX.html 갤러리에서 상태별 iframe을 나란히 배치하면 클릭 없이 모든 상태를 한눈에 비교할 수 있다. 캡처 도구(capture.mjs)도 URL만 바꿔 상태별 스크린샷을 자동 생성한다.

### 변형 처리 (variants/)

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

---

## notes.md 작성 규약

각 화면 디렉토리의 `notes.md`는 후속 `with-ui-draft`가 가장 먼저 읽는 문서다 (with-ui-draft 우선순위: notes.md > HTML/CSS > 스크린샷).

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
| 로딩 | index.html?state=loading | .skeleton 영역 |
| 빈   | index.html?state=empty   | .empty 영역 |
| 에러 | index.html?state=error   | .error 영역 |

## 변형
| 파일 | 조건 | 차이 |
| --- | --- | --- |
| index.html | 기본 (권한=member) | 메인 시안 |
| variants/admin.html | 권한=admin | 관리 메뉴 추가, 헤더 우측 알림 배지 |

## 가정
- {ui-design.md에 없어 시안에서 가정한 항목 1줄씩}

## 검토 방법
1. `python3 -m http.server` 또는 다른 정적 서버를 시안 루트에서 실행
2. http://localhost:8000/SCR-001/index.html 접속
3. URL에 `?state=loading`, `?state=empty` 등을 붙여 각 상태 확인
```

---

## 금지 사항

- 외부 빌드 도구 (webpack, vite, parcel 등) 사용 금지
- 노드 모듈, npm install 금지
- React·Vue·Svelte 등 프레임워크 금지 (실제 구현 단계에서 별도 도입)
- CSS 전처리기 (Sass, Less) 금지 — 표준 CSS만
- 외부 CDN 사용 최소화 — 폰트만 허용. 아이콘은 인라인 SVG
- partial을 화면 HTML 안에 복붙 금지 — 반드시 `data-include`로
- aesthetic.md를 design-tokens.md의 단순 재서술로 만들지 말 것 — 사용 비율·대비·금지선이 핵심
- ui-design.md §3에 없는 UI 요소·변형 임의 추가 금지

---

## 산출물 자가 점검

시안 작성 완료 후 다음을 자가 점검하고, 통과 후 러너에 보고한다.

- [ ] 모든 화면 디렉토리에 `index.html`, `style.css`, `notes.md` 존재
- [ ] index.html에 `_shared/tokens.css`, `_shared/partials/*.css`, `_shared/includer.js` 모두 로드됨
- [ ] 헤더·탭바 등 구조 partial은 `data-include`로만 참조 (복붙 없음)
- [ ] **[mobile]** 모든 `SCR-*/index.html`의 루트가 `<main class="phone-shell" data-viewport="mobile">` — 제각각 클래스(`frame`/`device-frame`/`phone-frame`) 없음
- [ ] **[mobile]** `_shared/templates/scr-mobile.html` 존재, 모든 SCR의 viewport meta·필수 링크 4줄·status-bar/home-indicator include 2줄이 템플릿과 동일
- [ ] **[mobile]** 화면 `style.css`가 `.phone-shell` 루트 컨테이너 치수·라운드·배경을 재정의하지 않음. `height`·`overflow`·`display`·`flex-direction`도 재정의 금지 (viewport lock 파괴)
- [ ] **[mobile]** `_shared/partials/phone-shell.css`가 viewport lock 구조(`height: 100dvh` + `overflow: hidden` + `display: flex; flex-direction: column`)를 사용하며 `min-height` 기반이 아님
- [ ] **[mobile]** status-bar.css·home-indicator.css에 `flex: 0 0 auto`가 선언되어 phone-shell flex column에서 고정 행으로 잠김
- [ ] **[mobile]** 모든 SCR의 `{BODY}` 슬롯 최상위에 본문 wrapper가 존재하며 `flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column`(+ `overflow-y: auto` 또는 하위 위임)을 만족. 모달·바텀시트 내부도 동일 패턴이며 외부(phone-shell/body)는 스크롤되지 않음. scroll container는 정확히 한 층위에만 존재
- [ ] **[mobile]** 본문 wrapper 직계 자식이 `flex: 0 0 auto`로 shrink 차단됨 (공통 규칙 `wrapper > * { flex: 0 0 auto }` 권장, 내부 스크롤 영역만 `flex: 1 1 auto; min-height: 0; overflow-y: auto`로 예외 재정의). 누락 시 콘텐츠 많은 variant에서 sticky 헤더·고정 높이 행이 1px로 붕괴
- [ ] **[mobile]** `_shared/partials/phone-shell.css` 최상단에 `html, body { margin: 0; padding: 0; }` 전역 reset이 선언되어 있음. 누락 시 모든 빈 상태 화면에서 브라우저 기본 body margin 16px이 document.scrollHeight에 덧씌워져 가짜 full 샷이 생성됨
- [ ] **[mobile]** `_shared/partials/status-bar.html`이 본 스킬 §「status-bar partial 레퍼런스 구현」과 일치 — Dynamic Island pill(`.status-bar__island`) 포함, 시계 값 "9:41", 신호/와이파이 SVG + 배터리 더미 그대로
- [ ] ui-design.md §3에 명시된 모든 UI 요소·상태가 시안에 존재
- [ ] 상태 전환이 `?state=` query param으로 동작한다 (시안 HTML에 dev-only 토글 버튼이 없음)
- [ ] style.css에 raw 색상·간격 값 거의 없음 (tokens.css 변수만 참조)
- [ ] notes.md의 「변형」 표가 variants/ 디렉토리 파일과 정확히 매칭
