---
name: domain-app-ui
description: React Native(Expo) 모바일 앱 UI 구현 보편 원칙. 모바일 환경에서 놓치기 쉬운 Safe Area, 터치 타겟, 키보드 처리, 스크롤, 플랫폼 분기, 상태별 UI 등을 빠짐없이 반영한다. dev-from-ticket이 domain=ui + scope.runtime=react-native-expo일 때 로드 지시.
---

# domain-app-ui

모바일 앱 UI 구현의 보편 원칙. 스택 무관(Unistyles·NativeWind·StyleSheet 어느 것을 쓰든 적용). 스택별 특화는 `use-*` 스킬이 보완.

## 모바일 고유 처리

### Safe Area

노치, 상태바, 홈 인디케이터 영역을 침범하면 콘텐츠가 가려진다. 화면의 최상위 레이아웃에서 Safe Area를 처리한다. `SafeAreaView`, `useSafeAreaInsets`, 또는 프로젝트에서 사용하는 방식을 따른다.

#### 책임 분담 매트릭스

한 화면이 두 종류의 SafeArea 책임을 동시에 가질 수 있다. 어느 한쪽이 다른 쪽을 흡수한다고 가정하지 말 것 — 둘 다 가지면 둘 다 챙긴다.

| 위치 | 처리 방식 | 대상 inset |
|---|---|---|
| 라우트 진입점 (`app/.../index.tsx` 등) | `SafeAreaView edges={[...]}` (또는 stack 패턴 — 예: Unistyles 3은 `rt.insets.top`) | 화면 전체의 top/bottom |
| 화면 내 sticky 하단 바 (batch-action bar 등) | `useSafeAreaInsets().bottom`을 자체 padding 가산 (또는 `rt.insets.bottom`) | bottom |
| 화면 내 floating toast / FAB | 동일하게 자체 inset 가산 | bottom |
| 모달/시트 내부 푸터 | 동일 | bottom |

#### placeholder → 실구현 교체 규칙

라우트 진입점 파일을 통째로 다시 쓰지 말 것. **가드 래퍼는 보존하고 본문만 교체**한다.

```tsx
// 잘못된 교체 — 라우트 파일 본문 통째로 한 줄 컴포넌트 호출로 대체
return <FridgeView ... />;   // SafeAreaView가 함께 사라짐 (회귀)

// 올바른 교체 — 가드 래퍼 보존
return (
  <SafeAreaView style={styles.container} edges={['top']}>
    <FridgeView ... />
  </SafeAreaView>
);
```

새 화면 컴포넌트가 SafeArea를 내부에서 처리한다고 주장하지 말 것. 라우트 파일만 보고 그 보장이 검증 가능해야 한다(라우트는 모달 presentation·중첩·플랫폼 분기의 진입점이므로 라우트 단위 가드가 자연스러운 위치).

#### iOS 모달 자동 padding 함정

`presentation: 'modal'` 페이지시트는 SafeArea 처리 없이도 노치 아래에 안착하여 iOS 시뮬레이터에서는 정상으로 보인다. 그러나 Expo SDK 55+의 Android는 `edge-to-edge`가 default이므로 동일 화면이 상태바·내비게이션바 뒤로 침범한다. **iOS 시뮬레이터 단독 시각 검증을 SafeArea 검증으로 착각 금지** — 두 플랫폼 모두에서 확인한다.

### 터치 타겟

모바일에서 손가락으로 탭하기 때문에 터치 영역이 충분해야 한다. 시각적으로 작은 아이콘 버튼이라도 최소 44×44pt의 터치 영역을 확보한다. `hitSlop`이나 패딩으로 처리할 수 있다.

### 키보드

텍스트 입력이 있는 화면에서 키보드가 올라오면 입력 필드가 가려질 수 있다. `KeyboardAvoidingView` 등으로 레이아웃이 키보드에 반응하도록 처리한다. 화면 하단에 입력 필드나 버튼이 있는 경우 특히 주의.

### 스크롤

화면 내용이 뷰포트를 넘을 수 있는 경우 반드시 스크롤 가능하게 구현한다. 고정 레이아웃으로 구현하면 작은 기기나 큰 폰트 설정에서 콘텐츠가 잘린다.

- 일반 콘텐츠: `ScrollView`
- 동적 리스트 데이터: `FlatList` 또는 `SectionList` (대량 데이터의 성능을 위해)

### 플랫폼 차이

iOS와 Android에서 시각적·동작적 차이가 있는 부분은 `Platform.OS`로 분기 처리한다. 대표적으로:

- 그림자: iOS는 `shadowColor/shadowOffset/shadowOpacity/shadowRadius`, Android는 `elevation`
- 날짜/시간 피커, 권한 요청 흐름 등 네이티브 UI 요소

## 모든 UI 상태 구현

데이터를 표시하는 화면은 happy path만 구현하면 불완전하다. 최소한 아래 네 가지 상태를 구현한다.

- **로딩 중**: 데이터를 가져오는 동안 보여줄 UI (ActivityIndicator, Skeleton 등)
- **데이터 있음**: 정상 상태
- **데이터 없음 (빈 상태)**: 결과가 없을 때 안내 메시지나 일러스트
- **에러**: 데이터 로딩 실패 시 안내와 재시도 가능한 UI

상태별 디자인이 별도로 지정되어 있으면 그대로 따르고, 없더라도 기본적인 상태별 UI는 구현한다.

## 기존 코드 활용

새 컴포넌트를 만들기 전에 프로젝트에 이미 존재하는 공통 컴포넌트를 확인하고 재사용한다. Button, Input, Text, Card, Modal 등 공통으로 쓰이는 컴포넌트가 `components/`, `components/ui/`, `components/common/` 등에 있을 수 있다.

기존 화면이 있다면 그 화면의 패턴(폴더 구조, 파일 명명, 스타일링 방식, 상태 관리)을 따른다. 컨벤션이 없는 영역은 프로젝트의 전반적인 스타일과 일관되게 결정하고, 무엇을 왜 그렇게 결정했는지 기록한다.

## 데이터 타입 먼저 정의

화면에서 사용하는 데이터의 타입을 먼저 정의한다. 타입을 먼저 정의하면 컴포넌트의 props가 명확해지고, mock 데이터를 만들거나 실제 API를 연결할 때 구조가 일관된다.

## 디자인 토큰 사용

색상, 간격, 폰트 크기, 그림자 등은 디자인 토큰(theme, design system 변수)을 사용한다. 시안에 토큰화 가능한 값이면 토큰을 그대로 참조한다.

토큰에 정의되지 않은 값이 시안에 등장하면 — **raw 값으로 두지 말고 새 토큰을 추가한 뒤 사용한다.** 예: `gap: 6`이 토큰에 없고 시안에 등장한다면 `theme.spacing.chipRowGapCompact: 6`을 추가한 뒤 참조. 같은 raw 값이 여러 컴포넌트에 흩어지면 디자인 변경 시 전수 검색이 필요해진다.

매직 넘버·하드코딩 색상은 `review-design-tokens` 단계에서 지적될 수 있으므로 처음부터 피한다.

## 시안 참조 (with-ui-draft 동시 로드 시)

`with-ui-draft`이 함께 로드되어 있으면 그 가이드를 따라 시안을 해석. 본 스킬은 시안과 무관한 모바일 보편 원칙을 다룸. 두 스킬은 보완 관계.

## no-op prop 금지

동작을 *활성화*하는 의미가 강한 prop에 빈 배열·`null`·`false` 같은 무력화 값을 **리터럴로 직접 작성하지 않는다**. 필요 없으면 prop 자체를 제거.

식별 기준 (둘 다 만족 시 적용):

- **이름 패턴**: `*Indices`, `enable*`, `*Enabled`, `sticky*`, `*Visible`, `keyboard*` 등 동작 활성화 의미가 강한 네이밍
- **값 형태**: 코드에 *직접 작성된* 리터럴(`[]`, `null`, `false`, `0`). 런타임 변수·prop 전달은 해당 없음

대표적인 자기-모순 패턴:

```tsx
// ❌ 외피만 만들고 활성화 누락 — 동작이 무력화됨
<FlatList stickyHeaderIndices={[]} ... />
<FlatList data={[]} renderItem={() => null} ListHeaderComponent={...} />
<KeyboardAvoidingView enabled={false} ... />

// ✅ 동작이 필요 없으면 prop 자체 제거
<FlatList data={items} renderItem={renderItem} />
```

`data={items}` (items가 빈 배열일 수 있음), `disabled={false}` 같은 일반적 prop은 해당 없음 — 위 두 기준을 동시에 만족할 때만 플래그 대상이다.

## scaffolding 비활성 명시

위 「no-op prop 금지」를 위반하는 코드가 *의도된 비활성*인 경우(점진적 구현·feature flag·다음 티켓 분리 등) 한 줄 주석으로 **사유와 활성화 시점**을 명시한다. 주석이 없으면 review가 "미완"으로 간주한다.

```tsx
// ✅ 의도된 비활성을 주석으로 명시
<FlatList
  stickyHeaderIndices={[]} // TODO(t14): enable after sectioning header
  ...
/>
```

이 규칙은 정당한 점진 구현은 통과시키고, "본인도 비어있는 줄 모르는" 잠복 미완 코드만 잡아낸다.

## 하지 않는 것

이 스킬의 범위는 UI 구현이다. 아래 항목은 별도 단계에서 처리한다.

- 실제 API 연결, 비즈니스 로직 (`with-api-contract` / `domain-contract`가 다룸)
- lint / type error 수정 (smoke가 잡음)
- 성능 최적화 (memo, useCallback 등은 명백히 필요한 경우만)
- 요청되지 않은 기능이나 화면 추가
