---
name: use-expo-sdk55
description: Expo SDK 55 기반 React Native 개발 가이드. expo-router 4.x 기반 라우팅, expo-dev-client, new architecture, RN 0.74 API 패턴, 빌드·배포 주의사항. dev-from-ticket이 stack-resolver 매칭 시 expo-sdk55-unistyles3 프로파일을 통해 로드.
---

# use-expo-sdk55

Expo SDK 55 환경에서 코드를 작성할 때의 API 패턴과 주의사항. RN 0.74 + expo-router 4.x + new architecture 기준.

## 라우팅 (expo-router 4.x)

파일 기반 라우팅. `app/` 디렉토리가 라우트 트리.

```
app/
  _layout.tsx          최상위 레이아웃 (Stack/Tabs root)
  index.tsx            "/" 라우트
  (tabs)/              그룹 라우트 (URL에 노출 X)
    _layout.tsx        탭 레이아웃
    home.tsx           "/home"
    profile.tsx        "/profile"
  product/
    [id].tsx           동적 라우트 "/product/123"
  +not-found.tsx       404 핸들러
```

### 네비게이션

```typescript
import { useRouter, Link } from 'expo-router';

// 선언형
<Link href="/product/123">상세</Link>

// 명령형
const router = useRouter();
router.push('/product/123');
router.back();
router.replace('/login');   // 스택 교체 (뒤로가기 차단)
```

### 파라미터

```typescript
import { useLocalSearchParams } from 'expo-router';

const { id } = useLocalSearchParams<{ id: string }>();
```

`useGlobalSearchParams`는 stale 값 주의. 가능하면 `useLocalSearchParams` 사용.

### Layout 분기

`app/_layout.tsx`에서 인증 가드, splash 처리, theme provider 배치. 내부 라우트는 layout이 wrap한 환경을 가정.

## new architecture

SDK 55는 기본적으로 new architecture(Fabric + TurboModules) 활성화. 영향:

- 일부 네이티브 모듈은 `interop layer` 없으면 동작 X. 호환 모듈만 사용
- `Alert.prompt` 같은 일부 API 동작 차이 가능
- 성능 향상 (특히 대량 리스트, 애니메이션)

native module 추가 시 SDK 55 호환성 확인. 미호환이면 alternative 또는 별도 인프라 티켓.

## 환경 변수

`expo-constants`로 build-time 환경 변수 접근:

```typescript
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

`process.env.EXPO_PUBLIC_*` prefix는 클라이언트에 노출되므로 secrets 금지.

## expo-dev-client

개발 빌드는 expo-dev-client 사용 (Expo Go 아님). custom native code 포함 가능.

- 네이티브 모듈 추가 시 `npx expo prebuild --clean` 후 dev 빌드 재생성
- iOS: `npx expo run:ios`, Android: `npx expo run:android`

## 빌드 종류

| 종류 | 용도 |
|---|---|
| dev (expo-dev-client) | 일상 개발 |
| preview (internal distribution) | QA·내부 공유 |
| production | 스토어 배포 |

EAS Build 설정은 `eas.json`. 본 스킬은 빌드 인프라를 만들지 않으며 scaffolder가 심은 설정을 사용.

## smoke 통과를 위한 주의

`npm run smoke:min`(metro-load cold-require)이 잡는 흔한 함정:

1. **모듈 평가 순서**: top-level에서 native API 호출(예: `Linking.parseInitialURLAsync()`)이 import만으로 실행되면 native bridge 미준비로 크래시. 핸들러 안으로 이동
2. **circular import**: `app/components/A.tsx` ↔ `app/components/B.tsx` 순환 import 시 평가 순서에 따라 undefined 발생. 공통 의존을 별도 파일로 추출
3. **Unistyles configure 순서**: `use-unistyles3` 참조

## 하지 않는 것

- 네이티브 코드 직접 수정 (`ios/`, `android/`) — Expo prebuild가 관리
- Expo SDK 다운그레이드/업그레이드 — 별도 인프라 티켓
- `eas.json` 빌드 프로필 추가 — 별도 인프라 티켓

## 참조

- 공식 문서: https://docs.expo.dev/versions/v55.0.0/
- expo-router: https://docs.expo.dev/router/introduction/
- 본 프로젝트의 scaffolder: `skills/expo-sdk55-unistyles-stack/`
