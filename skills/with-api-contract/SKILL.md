---
name: with-api-contract
description: 실제 API 또는 외부 서비스 연결을 통한 구현 가이드. dev-from-ticket이 티켓 frontmatter의 data_source=api일 때 code-engineer/code-reviewer에 로드 지시. API 계약(스키마·타입)을 기반으로 fetch 함수 작성, 에러 처리, 인증 토큰 주입, 재시도·타임아웃 정책을 일관되게 구성한다.
---

# with-api-contract

실제 API 연결로 구현할 때 따르는 가이드. mock 단계에서 정의된 함수 인터페이스를 그대로 유지하면서 내부 구현만 실제 호출로 교체하는 것이 기본 원칙.

## 계약 우선

API 호출 코드를 작성하기 전에:

1. **계약 문서 확인** — `docs/api-design/api-design.md`의 해당 엔드포인트 섹션을 먼저 읽는다
2. **타입 정의** — request/response 스키마를 TypeScript 타입(또는 프로젝트의 타입 시스템)으로 정의
3. **함수 시그니처 확정** — 입력/출력/에러 타입을 함수 시그니처에 명시

mock 단계에서 같은 함수가 이미 존재한다면 시그니처는 변경하지 않는다.

```typescript
// 인터페이스는 mock 단계와 동일
export async function fetchOrders(): Promise<Order[]> {
  // 내부만 실제 호출로 교체
  const res = await apiClient.get<Order[]>('/v1/orders');
  return res.data;
}
```

## 호출 경계 일원화

API 호출은 한 곳(예: `services/api/`, `lib/api/`)에 모은다. 컴포넌트가 직접 fetch/axios를 호출하지 않는다. 이유:

- 인증 토큰 주입·갱신 로직 한 곳에서 관리
- 에러 표준화 (네트워크 에러 → 도메인 에러 변환)
- 재시도·타임아웃 정책 일관 적용
- mock 모드 ↔ 실제 모드 전환 용이

프로젝트에 기존 API client가 있으면 그것을 사용한다. 없으면 fetch 또는 프로젝트가 권장하는 라이브러리(axios, ky 등)로 얇은 wrapper만 만들고, 새 API 인프라를 도입하지 않는다.

## 인증·토큰

API가 인증을 요구하면:

- **토큰 저장**: 프로젝트의 인증 모듈(SecureStore, AsyncStorage, cookie 등)을 따른다
- **자동 주입**: API client의 interceptor 또는 헤더 헬퍼로 자동 주입. 호출부에서 매번 직접 주입 X
- **만료 처리**: 401 응답 시 refresh 흐름 또는 로그아웃 흐름 — 프로젝트의 기존 패턴을 따름

본 스킬은 인증 인프라를 만들지 않는다. 누락되어 있으면 별도 티켓(`kind: feature` + 인증 도메인) 발행 후 의존 처리.

## 에러 처리

API 에러는 도메인 에러로 변환해 호출부에 전달:

```typescript
export class OrderNotFoundError extends Error {
  constructor(public orderId: string) {
    super(`Order ${orderId} not found`);
  }
}

export async function fetchOrder(id: string): Promise<Order> {
  try {
    const res = await apiClient.get<Order>(`/v1/orders/${id}`);
    return res.data;
  } catch (e) {
    if (isHttpError(e) && e.status === 404) {
      throw new OrderNotFoundError(id);
    }
    throw e;
  }
}
```

화면 레이어는 도메인 에러로 분기 처리. raw HTTP status로 분기하지 않는다.

## 응답 검증 (선택)

런타임 스키마 검증이 필요한 경우 (외부 API의 안정성이 의심스러울 때) zod·yup 등을 사용. 자체 백엔드 호출이라면 보통 타입만으로 충분.

## 캐싱·중복 호출

- 같은 화면 진입 시 매번 호출하면 UX·비용 모두 손해
- React Query / SWR / 프로젝트의 데이터 페칭 라이브러리 사용
- 라이브러리가 없으면 본 티켓에서 도입 X. 인프라 도입은 별도 티켓

## 재시도·타임아웃

- 네트워크 오류·5xx에 대해 재시도 (보통 1~3회 지수 백오프)
- 타임아웃은 30초 이하 권장 (사용자 인내 한계)
- 재시도 정책은 API client 레벨에서 일괄 적용. 호출부에 흩뿌리지 않음

## 환경 변수·base URL

- API base URL은 환경 변수(`process.env.API_URL`, Expo의 `expo-constants` 등)로 분리
- 하드코딩 X. 빌드별로 다른 값 주입 가능해야 함
- 누락되어 있으면 별도 티켓에서 인프라 추가

## 검증 (테스트)

`domain-contract` 스킬과 함께 로드된 경우:

- 계약 테스트: happy path 1개 + 에러 케이스 (401, 404, 5xx) 1~2개
- mock 모드와 같은 시그니처를 유지하므로 컴포넌트 단의 통합 테스트는 그대로 사용 가능

`domain-app-ui` / `domain-web-ui`와 함께 로드된 경우:

- UI 통합 테스트는 도메인 스킬의 가이드를 따름 (보통 컴포넌트 레벨에서 mock fetch + 화면 표시 검증)

## 하지 않는 것

- 새 API 라이브러리 도입 (별도 인프라 티켓)
- 인증 시스템 도입 (별도 인프라 티켓)
- 캐싱 라이브러리 도입 (별도 인프라 티켓)
- 백엔드 API 자체 수정 (별도 backend 티켓)
