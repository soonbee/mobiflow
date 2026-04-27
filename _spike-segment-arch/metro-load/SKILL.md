---
name: metro-load
description: Expo 프로젝트의 Metro 모듈 그래프를 cold-state로 require하여 Level 1 평가 크래시(예: StyleSheet.create가 configure 전에 실행됨)를 감지하는 smoke 게이트. dev-segment-app-ui·dev-segment-feature의 2-2 검증 단계에서 metro-load-checker 에이전트를 통해 실행된다.
user-invocable: false
---

# metro-load

## 목적

Expo(React Native) 프로젝트에서 module-evaluation-order 버그를 티켓 단계에서 자동 감지. `tsc`·`lint`가 못 잡는 **런타임 import 평가 시점의 throw**를 Jest 환경의 cold-require로 재현한다. 이 스킬 자체는 방법을 기술하지 않고, 프로젝트가 만족해야 하는 **계약**만 정의한다.

## 범위 (Scope)

- **포함 (Level 1)**: route/entry 모듈 require 시점의 throw 감지
- **제외**: 앱 실제 기동·렌더·네비게이션·제스처·E2E → Level 2(Maestro), Level 3(Detox) 별도 스킬 영역
- **스택**: Expo/Metro 전용. 웹·Node 다른 스택은 별도 스킬을 만든다 (이름 예: `vite-load`, `webpack-load`)

## 계약 (Project Contract)

프로젝트 `package.json`에 다음 스크립트가 정의되어야 한다:

```json
"scripts": {
  "metro-load-check": "<Level 1 smoke runner>"
}
```

### 계약 조건 (전부 충족 필요)

1. **Runtime**: Jest 또는 동등한 Node runtime에서 실행
2. **Cold state**: 각 require 이전에 모듈 캐시를 초기화 (`jest.resetModules()` 등). 이전 require의 side-effect가 다음 case에 남으면 안 됨
3. **Coverage**: 프로젝트의 모든 route/entry 모듈을 require (예: `app/**/*.{ts,tsx}`)
4. **Independence**: 한 파일의 require 실패가 다른 파일 검증을 차단하지 않아야 함 (`test.each` 또는 동등 패턴)
5. **No implicit side-effect preloading**: 테스트 코드가 `@/theme/unistyles` 같은 configure 관련 모듈을 **명시적으로 선행 import하지 않아야 함** — 프로덕션 cold-boot를 재현하기 위함
6. **Exit code**: 성공 0, 실패 비-0
7. **Time budget**: 30초 이내 권장. 60초 초과는 게이트 실패로 간주

### 실패 로그 형식 (권장)

에이전트가 파싱하기 쉽도록 실패 로그에 **파일 경로 + 에러 메시지 1줄**을 포함할 것. Jest 기본 출력으로 충족.

## 실행 경로

오케스트레이터 playbook의 "2단계 검증"에서 다음 순서로 호출된다:

1. 2-1. `static-fixer` (lint + typecheck)
2. **2-2. `metro-load-checker` 에이전트 호출** ← 이 지점
3. 3-1. `reviewer-*` (코드 품질 + AC)

2-2는 2-1 성공 후에만 실행한다 (정적 오류가 남아 있으면 smoke도 의미 없음).

## 실패 처리

`metro-load-check` 실패는 reviewer Must-Fix와 동일하게 **루프 A**에 편입된다:

- 1-1(`eng-*`)로 복귀
- 에이전트가 반환한 실패 로그를 `eng-*` 프롬프트의 컨텍스트로 전달
- 최대 3회 반복 (playbook 공통 상한)

## 계약 미충족 프로젝트

`package.json`에 `metro-load-check` 스크립트가 없으면 에이전트는 **contract-missing 실패**로 보고하고 루프 A에 편입된다. 복구 경로:

- `nidost:init`(또는 동등 부트스트랩)의 Expo 템플릿으로 smoke 스캐폴드 설치 *(향후 별도 작업)*
- 또는 수동 셋업: `jest`·`jest-expo` devDep + 테스트 파일 + `package.json` 스크립트 추가. 구체 절차는 프로젝트 `docs/dev/metro-load.md` 또는 `CLAUDE.md` 참조

## 변형·확장 금지 (Never)

- **Level 상승 금지**: 이 스킬에 Maestro·Detox·렌더 검증을 추가하지 말 것. 그 범위는 별도 스킬 영역
- **스택 혼입 금지**: 웹·Node 전용 검증 로직을 이 스킬에 분기로 끼워 넣지 말 것. 각 스택은 독립 스킬
- **에이전트의 코드 수정 금지**: 수정은 루프 A 복귀 후 `eng-*`의 책임. 에이전트는 실행·보고만

## 참조

- 에이전트 정의: `agents/metro-load-checker.md`
- 통합 playbook: `skills/dev-segment-app-ui/SKILL.md`, `skills/dev-segment-feature/SKILL.md`
