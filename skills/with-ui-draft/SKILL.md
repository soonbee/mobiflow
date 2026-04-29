---
name: with-ui-draft
description: 디자인 시안(HTML/CSS, 스크린샷, notes.md)을 해석하여 코드로 충실히 옮기기 위한 가이드. dev-from-ticket이 티켓 frontmatter의 scr 필드 존재 시 code-engineer/code-reviewer에 로드 지시. 디자인 시안 기반 구현, 시안 충실도 점검 시 사용한다.
---

# with-ui-draft

디자인 시안을 읽고 코드로 옮길 때, 충실도를 유지하기 위한 가이드.

## 시안 구성 요소와 읽는 순서

디자인 시안은 세 가지 소스로 구성된다. 각각의 역할이 다르므로 적절한 순서로 활용한다.

1. **notes.md** — 디자인 의도, 상태별 UI 명세, 주의사항. 구현 판단의 근거가 되는 정보이므로 가장 먼저 확인한다.
2. **HTML/CSS** — 구체적인 수치(간격, 색상, 타이포그래피, 레이아웃 구조)를 추출하는 용도.
3. **스크린샷** — 완성형 참고 이미지. HTML/CSS에서 놓친 디테일을 보완한다.

세 소스 간 충돌이 있으면 notes.md > HTML/CSS > 스크린샷 순으로 우선한다.

## 디자인 충실도

시안의 수치를 그대로 사용한다. "보기 좋게" 반올림하거나 보정하지 않는다.

- padding, margin, gap, border-radius, font-size, line-height, color 등 시안에서 추출한 값을 그대로 적용
- 프로젝트에 디자인 토큰(theme, colors, typography 등)이 존재하면 토큰을 사용. 토큰에 없는 값이 시안에 있으면 시안의 값을 직접 사용
- 시안이 모호하거나 값을 추출하기 어려운 부분은 합리적으로 판단하되, 가정한 내용을 주석이나 구현 요약에 기록

## 웹 시안 → 네이티브 변환 시 자주 빠지는 함정

시안이 HTML/CSS로 작성됐으나 구현이 React Native·Flutter 등 네이티브일 때, 코드 수치는 일치해 보여도 실제 렌더가 시안과 다른 경우가 반복된다. 빌드·테스트는 통과하므로 사람의 시각 검수 전엔 발견되지 않는다.

### `currentColor`는 RN/네이티브에서 미동작
시안의 `<svg stroke="currentColor">`를 그대로 옮기면 부모 텍스트 색을 상속하지 않고 기본값(검정 또는 투명)으로 렌더된다. 모든 SVG에 명시적으로 색상 prop을 전달한다 (`stroke={theme.colors.xxx}`). 테스트는 SVG를 mock하므로 이 결함을 못 잡는다.

### CSS `grid-template-columns: 1fr auto 1fr` → flex 등가물
RN에 grid가 없으므로 단순 `flexDirection: 'row'`로 옮기면 좌·우 자식 폭 차이만큼 가운데 자식이 시각적 중앙에서 이탈한다. 좌·우 자식에 똑같이 `flex: 1`을, 가운데 자식엔 flex 없음(auto)으로 두어야 시각적 중앙이 보장된다 (헤더 패턴에서 빈번).

### CSS `@keyframes` 애니메이션은 자동 동작 X
RN에서 키프레임은 `Animated.loop(Animated.timing(...))` 또는 reanimated `useAnimatedStyle` + `withRepeat`로 명시적으로 구동해야 한다. 시안의 shimmer/progress bar 등은 정적 렌더로 떨어지기 쉽다.

## notes.md 활용

notes.md에 포함될 수 있는 정보와 구현 시 활용 방법:

- **뷰포트**: 기준 해상도 확인. 레이아웃 비율 판단의 근거
- **디자인 의도**: 레이아웃/간격/색상 결정의 이유. 임의 변경하지 않는 근거
- **상태별 UI**: 빈 상태, 로딩, 에러 등 각 상태의 디자인. 반드시 구현할 목록으로 취급
- **주의사항**: 플랫폼별 차이, 기술적 주의점. 놓치기 쉬우므로 구현 중 수시로 참조

## 시안 경로 규약

티켓 frontmatter `scr: [SCR-007]`이면 다음 경로 참조:

```
docs/ui-drafts/SCR-007/
  index.html       — 정적 시안 본문
  style.css        — 시안 스타일
  notes.md         — 디자인 의도·상태 명세
  captures/        — 스크린샷 (있으면)
  variants/        — 상태별·explore variants (있으면)
```

복수 SCR(`scr: [SCR-002, SCR-003]`)이면 각각 디렉토리 모두 참조.

## scr 필드 없는 UI 작업

`scr=[]` 또는 필드 자체 생략(`domain=ui`인데 시안 없음, 예: 공통 컴포넌트·토큰 변경) 시 본 스킬은 호출자에 의해 로드되지 않음. 그런 작업은 `domain-app-ui`/`domain-web-ui`의 일반 가이드만 따른다.
