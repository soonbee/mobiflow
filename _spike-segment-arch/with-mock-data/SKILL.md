---
name: with-mock-data
description: 프론트엔드 UI 개발 시 실제 백엔드 없이 mock 데이터로 개발하기 위한 가이드. API 호출을 하드코딩 데이터로 대체하고, 나중에 실제 구현으로 교체하기 쉬운 구조를 만든다. 백엔드 없이 UI 개발, mock 데이터 사용, 프론트 단독 개발 요청 시 사용한다.
---

# With Mock Data

이 스킬이 로드되면 모든 외부 의존성(API 호출, DB, 인증 등)을 mock 데이터로 대체하여 구현한다.

## 모킹 경계

mock은 외부 의존성과의 경계에서 한다. 컴포넌트 내부가 아니라, 데이터를 가져오는 함수 단위로 대체한다.

```typescript
// mock 대상: 이 함수의 내부 구현
// 컴포넌트는 이 함수를 호출할 뿐, mock인지 실제인지 모른다
export async function fetchOrders(): Promise<Order[]> {
  // 실제 구현 시: return api.get('/orders')
  return MOCK_ORDERS;
}
```

컴포넌트 안에 mock 데이터를 직접 넣지 않는다. 컴포넌트는 항상 데이터를 "가져오는" 함수를 호출하는 구조여야 나중에 함수 내부만 교체하면 된다.

## 비동기 시그니처 유지

mock 함수도 `async`로 선언한다. 동기 함수로 만들면 실제 API로 교체할 때 호출부 전체를 수정해야 한다.

```typescript
// correct - 교체 시 함수 내부만 변경
export async function fetchUser(id: string): Promise<User> {
  return MOCK_USERS.find((u) => u.id === id) ?? MOCK_USERS[0];
}

// wrong - 교체 시 호출부도 전부 async로 변경 필요
export function fetchUser(id: string): User {
  return MOCK_USERS.find((u) => u.id === id) ?? MOCK_USERS[0];
}
```

## mock 데이터 분리

mock 데이터는 컴포넌트 파일과 분리한다. 프로젝트에 기존 패턴이 있으면 따르고, 없으면 mock 함수와 같은 파일 또는 가까운 위치에 둔다.

```typescript
// data/orders.mock.ts
export const MOCK_ORDERS: Order[] = [
  { id: '1', title: '주문 A', status: 'confirmed', ... },
  { id: '2', title: '주문 B', status: 'pending', ... },
]
```

## 타입 기반 mock 데이터

API 설계 문서가 있으면 응답 스키마를 기반으로 타입을 정의하고, mock 데이터를 해당 타입에 맞춘다. 타입과 mock 데이터의 구조가 일치해야 실제 API 연결 시 UI가 깨지지 않는다.

설계 문서가 없으면 화면에 표시되는 데이터를 기반으로 타입을 추론하되, 추론한 사실을 기록한다.

## 상태별 mock

UI의 다양한 상태(정상, 빈 데이터, 에러)를 개발하려면 mock도 해당 상태를 재현할 수 있어야 한다. 간단한 방식으로 전환 가능하게 한다.

```typescript
type MockScenario = "success" | "empty" | "error";
const CURRENT: MockScenario = "success";

export async function fetchOrders(): Promise<Order[]> {
  if (CURRENT === "error") throw new Error("Network error");
  if (CURRENT === "empty") return [];
  return MOCK_ORDERS;
}
```

## 간결하게 유지

외부 mock 라이브러리(msw 등)는 사용하지 않는다. 하드코딩 데이터를 반환하는 함수만으로 충분하다. mock 인프라를 만드는 데 시간을 쓰지 않는다.
