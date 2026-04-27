---
name: use-unistyles3
description: Unistyles 3 기반 스타일링. StyleSheet.create를 react-native-unistyles에서 import하고, rt.insets/rt.screen/theme 등 Unistyles 3 API를 활용한다. React Native 스타일링, 테마, Safe Area, 키보드 처리, 반응형 레이아웃 구현 시 사용한다.
---

# Use Unistyles 3

React Native 프로젝트에서 Unistyles 3을 사용할 때의 API 패턴과 주의사항.

코드를 작성하기 전에, 이 스킬 파일 기준 상대 경로 `reference/index.md`에 있는 Unistyles 3 API 레퍼런스를 읽는다. index가 안내하는 파일 중 작업에 필요한 것을 선택적으로 읽되, **`reference/core.md`는 항상 읽는다.**

## 핵심 규칙

`StyleSheet.create()`는 반드시 `react-native-unistyles`에서 import한다. `react-native`의 StyleSheet를 사용하면 Unistyles 기능(테마, 런타임 값 등)이 동작하지 않는다.

```typescript
// correct
import { StyleSheet } from 'react-native-unistyles'

// wrong - Unistyles 기능 사용 불가
import { StyleSheet } from 'react-native'
```

## Unistyles가 대체하는 패턴

Unistyles 3은 흔히 사용되는 여러 RN 패턴을 자체 API로 대체한다. Unistyles가 제공하는 방식을 사용하면 별도 라이브러리 없이 일관되게 처리할 수 있다.

### Safe Area

`react-native-safe-area-context`의 `SafeAreaView`나 `useSafeAreaInsets` 대신, StyleSheet 콜백의 `rt.insets`를 사용한다.

```typescript
const styles = StyleSheet.create((theme, rt) => ({
  container: {
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
  },
}))
```

### 키보드 회피

`KeyboardAvoidingView` 대신, `rt.insets.ime`를 사용한다. 키보드가 올라오면 값이 자동으로 변경된다.

```typescript
const styles = StyleSheet.create((theme, rt) => ({
  input: {
    paddingBottom: rt.insets.ime,
  },
}))
```

### 반응형 사이징

`Dimensions`나 `useWindowDimensions()` 대신, `rt.screen`을 사용한다. 화면 회전이나 리사이즈에 자동 반응한다.

```typescript
const styles = StyleSheet.create((theme, rt) => ({
  hero: {
    height: rt.screen.height * 0.4,
  },
}))
```

### 테마

`StyleSheet.create`의 첫 번째 인자로 `theme`에 접근한다. 컴포넌트 코드에서 테마 값이 필요한 경우가 아니면 `useUnistyles()` 훅을 사용하지 않는다. `useUnistyles()`는 서드파티 컴포넌트에 테마 값을 전달해야 할 때만 사용한다.

```typescript
const styles = StyleSheet.create((theme) => ({
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.heading,
  },
}))
```

## 스타일 병합

스타일을 합칠 때는 반드시 배열 문법을 사용한다. Unistyles 스타일 객체를 스프레드(`...`)하면 런타임 바인딩이 깨진다.

```typescript
// correct
<View style={[styles.base, styles.active]} />

// wrong - 런타임 바인딩 손실
<View style={{ ...styles.base, ...styles.active }} />
```

## 플랫폼별 그림자

그림자는 iOS와 Android에서 다르게 동작한다. 양쪽 모두 적용해야 크로스 플랫폼에서 일관된 결과를 얻는다.

```typescript
shadow: {
  // iOS
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  // Android
  elevation: 3,
}
```
