---
name: dev-segment-app-ui
description: UI 디자인 시안 기반 모바일 앱 UI 개발 세그먼트 플레이북. dev-segment-router가 app-ui를 반환했을 때 이 스킬을 로드하여 구현-검증-리뷰 플로우를 실행한다.
user-invocable: false
---

# dev-segment-app-ui

UI 디자인 시안을 기반으로 React Native(Expo) 모바일 앱 UI를 구현하는 세그먼트 플레이북.

본 playbook은 `run-dev-from-ticket`이 `Skill` tool로 load해 사용한다. **오케스트레이터(부모 스킬)가** 1-1 → 1-2 → 2-1 → 2-2 → 3-1을 **순서대로**, **각 단계마다 별도의 `Task` 호출**로 실행한다. 단계 통합·생략 금지(특히 1-1 `eng-app-ui`에 formatter·static-fixer·reviewer 책임을 떠넘기지 마라). 루프 A는 3-1 종료 후 오케스트레이터가 판정한다.

---

## 1단계: 구현

### 1-1. eng-app-ui

서브에이전트 `eng-app-ui`를 호출하여 UI를 구현한다.

- **입력**: 티켓 내용, 디자인 시안 경로
- **수행 내용**:
  - 디자인 시안(HTML/CSS, 스크린샷, notes.md)을 해석한다
  - React Native(Expo) + Unistyles 3으로 UI를 구현한다
  - mock 데이터를 사용하여 화면을 완성한다
- **출력**: 구현된 컴포넌트/스크린 파일

### 1-2. formatter

서브에이전트 `formatter`를 호출하여 코드를 정리한다.

- **수행 내용**: Prettier, ESLint --fix 등 자동 포매팅 실행
- **출력**: 포매팅 완료된 코드

---

## 2단계: 검증

### 2-1. static-fixer

서브에이전트 `static-fixer`를 호출하여 정적 분석 오류를 수정한다.

- **수행 내용**: ESLint, TypeScript 타입 체크 오류 감지 및 자동 수정
- **출력**: 오류 수정 결과 (수정 건수, 잔여 오류 목록)

### 2-2. metro-load-checker (Expo 프로젝트)

서브에이전트 `metro-load-checker`를 호출하여 Metro 모듈 로드 smoke를 실행한다. 2-1이 통과한 뒤에만 실행한다.

- **수행 내용**: 프로젝트가 선언한 `metro-load-check` 계약 실행 (Level 1 cold-require). module-evaluation-order 크래시(예: Unistyles `StyleSheet.create`가 `configure` 전 실행) 감지
- **계약 정의 SSOT**: `skills/metro-load/SKILL.md`
- **출력**: `pass` / `fail` + 실패 시 파일별 에러 목록
- **계약 미충족 (contract-missing)**: Expo 프로젝트에서 스크립트가 없으면 루프 A 편입. app-ui 세그먼트는 기본적으로 Expo로 간주

---

## 3단계: 리뷰

### 3-1. reviewer-app-ui

서브에이전트 `reviewer-app-ui`를 호출하여 **UI 품질(Part A) + 티켓 AC(Part B)** 를 한 번에 점검한다.

- **수행 내용**:
  - Part A — 공통 UI(레이아웃, 타이포, 컬러, 간격, 상태 처리) + 모바일 특화(터치 영역, Safe Area, 스크롤, 네이티브 관례)
  - Part B — 티켓 `## Acceptance Criteria`·`## 완료 기준` 충족 여부, 누락·엣지케이스·조건부 노출·파일 스코프 점검
- **출력**: Part A / Part B가 분리된 리뷰 피드백 (각 파트별 수정 필요/권장/통과 + 최종 합산)

#### 리뷰어 호출 시 필수 컨텍스트 (러너 책임)

리뷰어가 Part B(AC 점검)를 수행하려면 **티켓 파일 경로가 반드시 전달**되어야 한다. 오케스트레이터는 서브에이전트 프롬프트에 아래를 포함한다:

> 티켓 파일: `docs/tickets/v{TARGET_VERSION}/{N}.md`
> 이 티켓의 `## Acceptance Criteria`와 `## 완료 기준`을 기준으로 Part B를 작성하라.

티켓 경로가 누락되면 리뷰어는 Part B를 스킵하고 경고를 남기므로, 러너는 호출 전 경로 유효성을 확인한다.

---

## 루프 조건

오케스트레이터는 리뷰 완료 후 아래 조건을 평가하고, 해당 시 구현 단계로 복귀한다.

### 루프 A: 검증·리뷰 피드백 루프

- **조건**: 다음 중 하나라도 해당:
  - static-fixer(2-1) 잔여 오류 존재
  - metro-load-checker(2-2) `fail` (smoke / contract-missing / install / budget 모두)
  - reviewer-app-ui(3-1) Part A 또는 Part B 🔴 수정 필요 항목 존재
- **복귀**: → 1-1. eng-app-ui
- **컨텍스트**: 각 단계의 실패 메시지(정적 오류 목록·metro-load 로그·리뷰 Part A·B 피드백)를 모두 수집해 eng-app-ui에 전달
- **재실행 범위**: 1-1 → 1-2 → 2-1 → 2-2 → 3-1 (전체 재실행)

### 루프 상한

- 최대 **3회** 반복
- 상한 초과 시 잔여 피드백을 사용자에게 보고하고 수동 판단을 요청한다
