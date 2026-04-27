---
name: review-ui-app
description: 모바일 앱 UI 코드 리뷰. Safe Area, 네이티브 인터랙션 패턴, 제스처 충돌, 메모리/렌더링 성능, 오프라인 대응, 플랫폼별 분기 등 모바일 앱에 특화된 항목을 점검한다. React Native, SwiftUI, Jetpack Compose, Flutter 등 모바일 앱 UI 코드 리뷰 시 common-ui-review와 함께 사용하라. 앱 UI 리뷰, 모바일 리뷰, 네이티브 앱 리뷰 요청 시 이 스킬을 사용하라.
---

# App UI Review

모바일 앱(iOS/Android)에 특화된 UI 코드 리뷰 항목을 다룬다.
common-ui-review의 공통 항목을 먼저 적용한 뒤, 이 스킬의 모바일 특화 항목을 추가로 점검한다.

파일을 수정하지 않는다. 발견 사항만 보고한다.

## Review Process

1. common-ui-review 체크리스트를 먼저 수행한다
2. 사용 중인 프레임워크(React Native, SwiftUI, Jetpack Compose, Flutter 등)를 식별한다
3. 아래 모바일 특화 체크리스트를 추가로 점검한다
4. 우선순위별로 통합 보고한다

## Mobile-Specific Checklist

### 1. 화면 크기와 Safe Area — 기기 다양성 대응

모바일 기기는 노치, 다이나믹 아일랜드, 홈 인디케이터, 폴더블 디스플레이 등 웹에는 없는 물리적 제약이 있다. Safe Area를 무시하면 UI 요소가 노치 뒤에 가려지거나 하단 제스처 바와 겹친다.

- **Safe Area 적용**: 상단/하단 콘텐츠가 Safe Area를 존중하는가?

```jsx
// React Native — Bad
<View style={{ flex: 1 }}>
  <Header />
</View>

// React Native — Good
<SafeAreaView style={{ flex: 1 }}>
  <Header />
</SafeAreaView>

// 또는 react-native-safe-area-context 사용
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

```swift
// SwiftUI — Good: 기본적으로 Safe Area를 존중
// .ignoresSafeArea()를 사용할 때 의도적인지 확인
```

- **다양한 화면 비율**: SE(4.7") ~ Pro Max(6.7") 등 다양한 기기에서 레이아웃이 정상인가? 고정 높이가 작은 기기에서 잘리지 않는가?
- **폴더블/태블릿**: 폴더블 기기의 접힘 영역(hinge area)이나 태블릿의 넓은 화면을 고려하는가? (해당 시)
- **가로/세로 모드**: orientation 변경을 지원하는 앱이라면 전환 시 레이아웃이 올바르게 재배치되는가?
- **다이나믹 타입/폰트 스케일링**: 시스템 설정에서 글꼴 크기를 키웠을 때 레이아웃이 깨지지 않는가? 고정 높이 컨테이너에 텍스트가 잘리지 않는가?

### 2. 네이티브 인터랙션 패턴 — 플랫폼 사용자 기대 준수

iOS와 Android 사용자는 각 플랫폼에서 익숙한 인터랙션 패턴을 기대한다. 이를 무시하면 "이상하게 느껴지는" 앱이 된다.

**iOS 패턴:**

- 좌에서 우 스와이프로 뒤로 가기(swipe back)가 동작하는가?
- 네비게이션은 push/pop 스타일인가?
- 바텀 시트, 액션 시트가 iOS 스타일을 따르는가?
- 스크롤 시 바운스(rubber-banding) 효과가 자연스러운가?
- 대형 타이틀(large title)이 적절히 사용되고 있는가? (해당 시)

**Android 패턴:**

- 시스템 백 버튼/제스처가 올바르게 동작하는가?
- Material Design 3의 패턴을 따르고 있는가? (FAB, Top App Bar, Bottom Navigation 등)
- 리플 효과가 터치 피드백으로 적용되어 있는가?
- Predictive Back 제스처를 지원하는가? (Android 14+)

**크로스 플랫폼 프레임워크 (React Native, Flutter 등):**

- 플랫폼별 기대에 맞게 UI가 분기되어 있는가? 예를 들어 날짜 선택 시 iOS는 wheel picker, Android는 calendar를 기대한다.
- 기본 컴포넌트가 플랫폼에 맞게 렌더링되는가?

### 3. 제스처 처리 — 충돌 없는 터치 인터랙션

모바일 앱에서는 스크롤, 스와이프, 드래그, 핀치 등 여러 제스처가 동시에 존재한다. 제스처 간 우선순위가 명확하지 않으면 사용자가 의도한 동작과 다른 결과가 발생한다.

- **제스처 충돌**: 수평 스와이프 가능한 카드가 수직 스크롤 리스트 안에 있을 때, 의도한 방향으로만 반응하는가?
- **제스처 우선순위**: 중첩된 제스처의 우선순위가 명시적으로 설정되어 있는가?

```jsx
// React Native — Bad: 제스처 충돌 가능
<ScrollView>
  <Swipeable>  {/* 스크롤과 스와이프가 충돌 */}
    <CardContent />
  </Swipeable>
</ScrollView>

// React Native — Good: 제스처 핸들러로 명시적 관리
<GestureDetector gesture={composedGesture}>
  <Animated.View>
    <CardContent />
  </Animated.View>
</GestureDetector>
```

- **취소 가능한 제스처**: 삭제 스와이프 등 파괴적 동작에 대해 사용자가 취소할 수 있는가? (되돌리기, 확인 다이얼로그 등)
- **제스처 영역 크기**: 드래그 핸들, 슬라이더 등의 터치 영역이 충분히 큰가? (최소 44pt × 44pt)
- **네이티브 제스처와의 공존**: 커스텀 제스처가 시스템 제스처(edge swipe back, 상태바 탭 등)를 가로채지 않는가?

### 4. 리스트와 렌더링 성능 — 제한된 리소스에서의 최적화

모바일 기기는 메모리와 CPU가 데스크톱 대비 제한적이다. 특히 긴 리스트, 복잡한 셀, 애니메이션에서 성능 문제가 눈에 띄게 드러난다.

- **리스트 가상화**: 긴 리스트에 가상화가 적용되어 있는가?

```jsx
// React Native — Bad
<ScrollView>
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</ScrollView>

// React Native — Good
<FlashList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  estimatedItemSize={80}
/>
```

```swift
// SwiftUI — List와 LazyVStack은 기본적으로 lazy 렌더링
// ForEach 내에서 무거운 연산을 피하고 있는가 확인
```

- **이미지 캐싱**: 네트워크 이미지에 캐싱 전략이 적용되어 있는가? (FastImage, SDWebImage, Coil 등)
- **오버드로(Overdraw)**: 불투명한 뷰가 겹쳐서 같은 픽셀을 여러 번 그리고 있지 않은가? 불필요한 배경색이 중첩되어 있지 않은가?
- **메인 스레드 부하**: 무거운 연산(이미지 처리, 데이터 파싱 등)이 메인/UI 스레드에서 실행되고 있지 않은가?
- **애니메이션 프레임**: 애니메이션이 네이티브 드라이버(React Native: `useNativeDriver`, `Reanimated`)를 활용하여 JS 브리지 병목을 피하고 있는가?

### 5. 오프라인 및 불안정한 네트워크 대응

모바일 사용자는 지하철, 엘리베이터 등에서 네트워크가 끊기거나 느려지는 상황을 자주 만난다. 이때 앱이 빈 화면을 보여주거나 크래시한다면 사용자 경험이 크게 저하된다.

- **네트워크 끊김 시 UI**: 오프라인 상태에서 어떤 화면이 보이는가? 빈 화면 대신 마지막으로 로드된 데이터를 보여주거나, 명확한 오프라인 안내를 표시하는가?
- **재연결 시 동작**: 네트워크가 복구되면 자동으로 데이터를 갱신하는가? 사용자에게 알림을 주는가?
- **느린 네트워크**: 3G 수준의 느린 연결에서 타임아웃 처리가 적절한가? 무한 로딩에 빠지지 않는가?
- **낙관적 업데이트(Optimistic Update)**: 좋아요, 북마크 등 즉각적인 피드백이 필요한 동작에서 서버 응답을 기다리지 않고 UI를 먼저 반영하고 있는가?

### 6. 플랫폼별 분기 — 깔끔한 조건 처리

크로스 플랫폼 앱에서 iOS/Android 분기 코드가 산재하면 유지보수가 어려워진다. 분기가 필요한 곳에서 일관된 패턴을 사용해야 한다.

- **분기 패턴 일관성**: `Platform.OS`, `Platform.select`, `.ios.js`/`.android.js` 파일 분리 등 하나의 전략을 일관되게 사용하는가?
- **분기 최소화**: 플랫폼 차이가 실제로 필요한 곳에서만 분기하는가? 불필요한 분기가 있다면 공통화를 제안하라.
- **하드코딩된 플랫폼 값**: `Platform.OS === 'ios' ? 20 : 0` 같은 매직 넘버가 흩어져 있지 않은가? 상수로 추출하라.

```jsx
// Bad — 곳곳에 흩어진 플랫폼 분기
<View style={{ paddingTop: Platform.OS === 'ios' ? 44 : 0 }}>
<Text style={{ fontFamily: Platform.OS === 'ios' ? 'SF Pro' : 'Roboto' }}>

// Good — 테마/상수로 중앙 관리
// theme.js
export const theme = {
  statusBarHeight: Platform.select({ ios: 44, android: StatusBar.currentHeight }),
  fontFamily: Platform.select({ ios: 'SF Pro', android: 'Roboto' }),
};

// 사용처
<View style={{ paddingTop: theme.statusBarHeight }}>
<Text style={{ fontFamily: theme.fontFamily }}>
```

### 7. 앱 생명주기 — 백그라운드와 포그라운드 전환

모바일 앱은 전화, 알림, 홈 버튼 등으로 언제든 백그라운드로 전환될 수 있다. 이 전환을 고려하지 않으면 데이터 손실이나 비정상 동작이 발생한다.

- **상태 복원**: 앱이 백그라운드에서 복귀할 때 사용자가 마지막으로 보던 화면과 입력 데이터가 유지되는가?
- **타이머/인터벌**: `setInterval`, 타이머 등이 백그라운드 진입 시 정리되는가? 포그라운드 복귀 시 재시작되는가?
- **음악/영상 재생**: 미디어 재생 중 인터럽트(전화 수신 등) 처리가 되어 있는가?

## Output Format

common-ui-review와 동일한 형식을 사용한다.

**🔴 Critical**: Safe Area 미적용, 시스템 제스처 가로채기, 메인 스레드 블로킹, 기기 크래시 유발 가능한 메모리 문제
**🟡 Warning**: 네이티브 패턴 불일치, 제스처 충돌, 오프라인 상태 미처리, 이미지 캐싱 누락
**🟢 Suggestion**: 플랫폼 분기 정리, 애니메이션 최적화, 낙관적 업데이트 도입

각 항목에 대해:

- 파일명과 위치
- 현재 코드 인용
- 구체적인 개선안 제시
- 영향 범위와 긴급도 판단 근거

발견 사항이 없으면 간결하게 "이상 없음"으로 보고한다.
