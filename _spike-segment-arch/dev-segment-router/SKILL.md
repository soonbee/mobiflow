---
name: dev-segment-router
description: >
  티켓 frontmatter의 `segment` 필드를 검증하는 스킬. 티켓 내용(시안 참조·플랫폼·SCR 필드)과의 일관성을 점검하고,
  필드가 누락된 legacy 티켓에 한해 추론으로 fallback한다. dev phase 진입 시 `run-dev-from-ticket`이
  각 티켓마다 호출한다. draft phase는 별도 진입점(`/nidost:run-draft-from-spec`)이며 이 라우터에서 처리하지 않는다.
user-invocable: false
---

# Dev Segment Router

dev phase의 **세그먼트 검증기**. `run-dev-from-ticket`이 각 티켓에 대해 호출한다.

이전 버전은 티켓 본문에서 세그먼트를 추론하는 것이 주 업무였으나, 현재 `ticket` 스킬이 frontmatter `segment` 필드를 사전 기록하므로 이 스킬의 주 업무는 **검증**이다. 필드가 누락된 legacy 티켓에만 추론 fallback이 적용된다.

---

## 입력

- 단일 티켓 파일 경로 (예: `docs/tickets/v0.1.0/7.md`)

## 세그먼트 정의

| 세그먼트  | 조건                                                    |
| --------- | ------------------------------------------------------- |
| `app-ui`  | UI 디자인 시안 존재 + 모바일 앱(React Native/Expo) 대상 |
| `feature` | UI 시안 없이 기능 구현, 리팩토링, 버그 수정, API 개발   |

---

## 판정 절차

### 1. 티켓 frontmatter 파싱

- `segment` (선언된 세그먼트, 선택)
- `scr` (SCR ID 문자열 또는 배열, 선택)

### 2. 검증 분기

#### Case A: `segment` 필드 존재

다음 일관성 규칙을 점검:

| 규칙                                                          | 위반 예시                                         | 결과       |
| ------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| `segment`가 `app-ui`면 `scr` 필드 필수                        | `segment: app-ui` + `scr` 없음                    | 🟡 warning |
| `segment: feature`면 `scr` 필드가 없어야 함                   | `segment: feature` + `scr: SCR-003`               | 🟡 warning |
| `scr`가 가리키는 `docs/ui-drafts/SCR-xxx/` 디렉토리 실제 존재 | `scr: SCR-099` + 디렉토리 없음                    | 🔴 invalid |
| 본문 「참조」 섹션의 시안 경로가 `segment`와 모순되지 않음    | `segment: feature` + 「시안: docs/ui-drafts/...」 | 🟡 warning |

- 🔴 invalid → status `invalid` 반환. 호출자(`run-dev-from-ticket`)가 이 티켓을 스킵
- 🟡 warning → status `warning` 반환하되 진행 허용. 호출자가 경고 로그로 표시

#### Case B: `segment` 필드 누락 (legacy 티켓)

다음 순서로 추론:

1. `scr` 필드 존재 → `app-ui`로 판정
2. `scr` 필드 없음 → `feature`
3. 모든 단서가 모호 → status `invalid` + "사용자 확인 필요" 메시지

---

## 출력 형식

YAML 포맷으로 출력:

```yaml
segment: { app-ui | feature }
status: { valid | warning | invalid }
warnings:
  - { 메시지1 }
  - { 메시지2 }
source: { declared | inferred }
```

예시 1 (정상):

```yaml
segment: app-ui
status: valid
warnings: []
source: declared
```

예시 2 (경고):

```yaml
segment: feature
status: warning
warnings:
  - "segment: feature인데 본문 「참조」 섹션에 시안 경로가 기재됨"
source: declared
```

예시 3 (무효):

```yaml
segment: app-ui
status: invalid
warnings:
  - "scr: SCR-099가 가리키는 docs/ui-drafts/SCR-099/가 존재하지 않음"
source: declared
```

예시 4 (legacy 추론):

```yaml
segment: app-ui
status: valid
warnings: []
source: inferred
```

---

## 주의사항

- 이 스킬은 **검증 + fallback 추론**만 담당한다. 티켓 로드·러너 호출·의존성 관리·상태 기록은 `run-dev-from-ticket`의 책임
- 티켓 파일 또는 `_index.md`를 수정하지 않는다. 출력만 반환
- legacy 티켓(구 버전 ticket 스킬로 생성)에 한해서만 추론 경로가 동작
- 추론 결과가 모호할 때 임의 결정 금지 — `invalid` + "사용자 확인 필요"로 반환
