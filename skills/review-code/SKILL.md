---
name: review-code
description: 티켓 단위 코드 품질 점검 체크리스트. 네이밍, 타입, 에러 처리, 가독성, 중복, 성능, 검사 우회 탐지 등을 다룬다. dev-from-ticket이 domain=contract일 때 code-reviewer Part A의 핵심 체크리스트로 로드 지시.
---

# review-code

티켓 단위 코드 품질 점검. `code-reviewer`의 Part A에서 적용. 비-UI 코드(API 핸들러, 비즈니스 로직, 유틸리티, 데이터 레이어 등)의 품질을 본다.

UI 코드 리뷰는 `review-ui-common` + `review-ui-app`/`review-ui-web` 조합이 담당. 본 스킬은 **non-UI 코드 전용**이지만 일부 항목(네이밍, 타입, 검사 우회 탐지)은 모든 도메인에 적용.

**파일을 수정하지 않는다.**

## Review Process

1. 변경된 파일 식별 (`git diff develop..HEAD --name-only`)
2. 변경 내용 확인 (`git diff develop..HEAD`)
3. 영향 추적: 변경된 export·시그니처를 `grep -rn`으로 역추적
4. 아래 체크리스트 적용
5. 우선순위별 (🔴/🟡/pass) 발견 사항 보고

## Review Checklist

### 1. 시그니처와 타입

- **함수 시그니처**: 입력·출력 타입이 명시되어 있는가? `any` 또는 implicit any 등장하지 않는지
- **에러 타입**: throw 또는 reject되는 에러가 타입으로 표현되거나 클래스로 정의되어 있는지
- **public API 경계**: export된 심볼의 시그니처가 명확한지. internal 헬퍼는 export 안 함
- **불변조건**: 함수의 사전조건·사후조건이 주석 또는 assertion으로 명시

### 2. 검사 우회 탐지 (R2 위반 — 항상 🔴)

diff에서 다음 패턴이 **새로 추가**되었으면 🔴:

- `eslint-disable*`, `eslint-disable-next-line`
- `@ts-ignore`, `@ts-expect-error`
- `as any`, `as unknown as <T>`로 타입 우회
- `tsconfig.json` / `.eslintrc*`에서 규칙 disable

이미 존재하던 것은 별도 (사전 존재). 본 티켓에서 추가된 것만 R2 위반.

### 3. 에러 처리

- **에러 무시**: `try/catch`에서 catch 블록이 비어있거나 단순 `console.log`만 있는지
- **에러 변환**: 외부 에러(HTTP, DB)를 도메인 에러로 변환했는가, 아니면 raw 에러를 그대로 호출자에 전달했는지
- **부분 실패**: 여러 작업 중 일부 실패 시 처리 (트랜잭션·롤백·재시도)
- **사용자 노출 메시지**: 사용자에게 보여지는 에러 메시지가 적절한지 (스택 트레이스 노출 X)

### 4. 가독성

- **네이밍**: 함수/변수 이름이 역할을 드러내는가. `data`, `result`, `temp` 같은 모호한 이름 지양
- **함수 길이**: 50줄 넘는 함수는 분리 후보. 200줄 넘으면 🔴
- **중첩 깊이**: 4단계 이상 nested if/loop는 추출 또는 early return으로 평탄화
- **주석**: WHAT보다 WHY. 코드가 자명한데 주석이 중복되는 건 지적

### 5. 중복 (DRY)

- **함수 중복**: diff에서 새 함수와 유사한 기존 함수를 `grep`으로 검색
- **상수 중복**: 동일 값(URL, 타임아웃, 매직 넘버)이 여러 곳에 하드코딩되었는지
- **로직 패턴 중복**: 비슷한 if/switch 분기가 반복되는지

### 6. 모듈 경계

- **순환 의존**: 변경된 파일의 import 따라가서 순환 경로 추적
- **의존 방향**: 하위 계층이 상위 계층에 의존하는 역방향 발생 안 하는지
- **공개 인터페이스 변경**: 시그니처가 바뀐 파일을 import하는 곳 모두 영향 확인

### 7. 부수효과 분리

- **순수 로직 vs IO**: 비즈니스 로직과 부수효과(DB, API, 파일)가 같은 함수에 섞이지 않았는지
- **순수한 코어 + 얇은 부수효과 껍데기** 구조 권장

### 8. 테스트 동반 (domain-contract와 함께 작업한 경우)

- **계약 테스트 존재**: 새 함수에 대한 계약 테스트(happy + 일부 엣지) 작성됨
- **테스트가 동작 검증**: 구현 세부사항이 아니라 입력→출력의 동작을 검증
- **테스트 파일 네이밍**: 프로젝트 컨벤션 준수 (`*.contract.test.ts` 등)

### 9. 성능 (의심 시만)

- **N+1 쿼리**: DB 호출이 루프 안에 있으면 batch로 묶을 수 있는지
- **불필요한 비동기**: Promise.all 가능한 곳에 sequential await
- **메모리**: 큰 배열을 메모리에 다 적재하지 않고 stream/iterator 사용 가능한지

### 10. 보안 (해당 시)

- **입력 검증**: 외부 입력(API request body, query, URL param)이 검증되는지
- **SQL/명령 인젝션**: raw SQL이나 shell 명령에 사용자 입력이 직접 들어가지 않는지
- **Secrets 노출**: 환경 변수가 클라이언트 노출되지 않는지

## 출력 통합

`code-reviewer` 에이전트가 본 체크리스트 결과를 Part A로 통합:

```yaml
part_a:
  items:
    - severity: 🔴 | 🟡
      area: "검사 우회 (R2 위반) / 에러 처리 / 네이밍 / 타입 / 중복 / 보안 / ..."
      message: "구체적 설명"
      file: path/to/file.ts
      line: N
```

### Severity 가이드

- **🔴**: 검사 우회 (R2 위반), 보안 취약점, 타입 unsafety, 200줄 초과 함수, 데이터 무결성 위협
- **🟡**: 네이밍 개선, 중복, 모듈 경계 모호, 작은 부수효과 누수
- **pass**: 발견 사항 없음
