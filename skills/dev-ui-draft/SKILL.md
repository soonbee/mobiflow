---
name: dev-ui-draft
description: HTML+CSS+JS만으로 정적 UI 시안(draft)을 작성하는 가이드. 공통 자산(_shared)과 화면별 자유 합성의 이분법, partial 인클루드 패턴, 상태·변형 표현 규약을 다룬다. UI 시안 제작, 화면 목업 작성 시 사용한다.
disable-model-invocation: true
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
  tokens.css          # 강제. design-tokens → CSS 변수
  aesthetic.md        # 강제. 디자인 언어 텍스트
  partials/           # 강제. 구조적 공통 영역만
    header.html
    tabbar.html       # (해당 시)
    footer.html       # (해당 시)
    sidebar.html      # (해당 시)
  includer.js         # 강제. partial 주입 로더
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

### 상태 토글 (로딩·빈·에러·성공)

ui-design.md §3에 명시된 모든 상태를 메인 `index.html`에서 시연한다. `<body data-state="...">` 속성 토글 + CSS로 분기.

```html
<!-- 상단에 시연용 토글 (시안 검토자 전용 UI, 실제 구현 대상 아님) -->
<div class="state-toggle" aria-hidden="true">
  <button data-set-state="default">기본</button>
  <button data-set-state="loading">로딩</button>
  <button data-set-state="empty">빈</button>
  <button data-set-state="error">에러</button>
</div>
```

```css
body[data-state="loading"] .content { display: none; }
body[data-state="loading"] .skeleton { display: block; }
body[data-state="empty"]   .content { display: none; }
body[data-state="empty"]   .empty   { display: flex; }
/* ... */
```

```js
// script.js (상태 토글)
document.querySelectorAll("[data-set-state]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.body.dataset.state = btn.dataset.setState;
  });
});
```

state-toggle 영역은 `notes.md`에 "검토용 UI, 구현 대상 아님" 명시.

### 변형 처리 (variants/)

다음 케이스만 별도 파일로 분리. 그 외는 메인 `index.html`의 토글로 시연.

| 케이스 | 처리 |
|---|---|
| 인터랙션 단계 (drawer 닫힘/열림, modal 표시/숨김) | `index.html` 안에서 토글 |
| 상태 (로딩·빈·에러·성공) | `index.html`의 `data-state` 토글 |
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
| 상태 | 토글 방법 | 시연 위치 |
| --- | --- | --- |
| 기본 | data-state="default" (기본값) | 본문 그대로 |
| 로딩 | 상단 토글 → "로딩" | .skeleton 영역 |
| 빈   | 상단 토글 → "빈"   | .empty 영역 |
| 에러 | 상단 토글 → "에러" | .error 영역 |

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
3. 상단 상태 토글로 모든 상태 확인
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
- [ ] ui-design.md §3에 명시된 모든 UI 요소·상태가 시안에 존재
- [ ] state-toggle은 `aria-hidden="true"`로 표시되고 notes.md에 검토용임을 명시
- [ ] style.css에 raw 색상·간격 값 거의 없음 (tokens.css 변수만 참조)
- [ ] notes.md의 「변형」 표가 variants/ 디렉토리 파일과 정확히 매칭
