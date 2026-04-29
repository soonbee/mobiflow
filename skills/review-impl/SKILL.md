---
name: review-impl
description: 티켓 AC(Acceptance Criteria) 충족 점검. 구현이 티켓 요구사항을 모두 만족하는지, 누락 항목·엣지케이스·조건부 노출이 빠지지 않았는지 검토한다. dev-from-ticket이 모든 도메인에 공통으로 code-reviewer Part B 점검 기준으로 로드 지시.
---

# review-impl

티켓의 **Acceptance Criteria**와 **완료 기준**에 선언된 요구사항이 실제 구현에 모두 반영되었는지 점검한다. `code-reviewer`의 Part B를 담당한다.

코드 품질·UI 품질 점검(Part A)과는 관점이 다르다. 여기서는 "무엇을 구현해야 했나"와 "무엇이 구현되었나"를 비교한다.

**파일을 수정하지 않는다.**

## 입력 (필수)

`code-reviewer` 에이전트의 프롬프트에 다음이 반드시 포함:

- **티켓 파일 경로** (예: `docs/tickets/v0.2.0/7.md`)
- 구현 대상 worktree (작업 디렉토리)

티켓 경로 누락 시 Part B는 `verdict: skipped` + 경고 메시지. 호출자(dev-from-ticket)가 누락 시 자동 보강.

## Review Process

1. **티켓 파싱**:
   - `## Acceptance Criteria` — 체크박스 `- [ ]` 목록 (주 파싱 대상)
   - `## 완료 기준` — 체크박스 (보조)
   - `## 파일 스코프 (Scope)` — 수정 대상·금지·신규 생성 경계
   - `## 참조 (Reference)` — 시안·명세 링크 (엣지케이스 추론 힌트)

2. **구현 변경 확인**:
   ```bash
   git diff develop..HEAD --stat
   git diff develop..HEAD --name-only
   ```

3. **AC 항목별 구현 위치 추적**: `grep -rn`으로 AC가 언급하는 키워드(API 경로, 컴포넌트명, 상태명, 메시지 등) 검색

4. **체크리스트 적용** (아래)

5. **AC 매핑 표 + 우선순위별 발견 사항 보고**

## Review Checklist

### 1. AC 매핑 — 항목별 구현 존재 여부

- `## Acceptance Criteria`의 각 체크박스가 코드·파일·테스트 중 어디에 반영되었는지 위치 특정
- 위치 특정 불가 → 미구현으로 간주
- 부분 구현(조건 일부만 충족) → 경고 분리

### 2. 누락 검출 — 티켓에 있지만 코드에 없는 것

- 티켓 명시 동작·상태·경로 중 변경분에서 발견되지 않는 항목
- 특히 놓치기 쉬운 것:
  - 에러 메시지 문구
  - 빈 상태 텍스트·이미지
  - 로딩 상태 인디케이터
  - 성공/실패 피드백 (토스트, 알림)
  - 권한·로그인 상태에 따른 분기

### 3. 엣지케이스 — AC가 암시하거나 명시한 예외 경로

- 에러 상태: 네트워크 실패, 4xx/5xx, 타임아웃
- 빈 상태: 데이터 없음, 검색 결과 없음
- 경계 케이스: 첫·마지막, 단일 항목, 최대 길이
- 상태 전이 시점: "변경 직후(서버 응답 전)"과 "재진입(새로고침) 후" 두 시점

### 4. 조건부 노출

- 로그인 여부, 권한, 플랜, 기능 플래그
- 특정 상태 한정 노출 (예: 편집 중에만, 관리자에게만)
- 플랫폼/디바이스 분기 (해당 시)

### 5. 파일 스코프 준수

- 변경분이 `## 파일 스코프 수정 대상` 안에 있는가
- `수정 금지` 경로를 건드리지 않았는가
- `신규 생성`으로 선언되지 않은 파일이 추가되지 않았는가
- 스코프 일탈은 🔴 (수정 필요)

### 6. 완료 기준 (보조)

- `## 완료 기준`의 체크박스 중 AC 외 항목(테스트, 문서화 등)은 참고로만
- smoke가 이미 담당하는 항목은 중복 지적하지 않음 (lint/type/test 통과 등)

### 7. notes.md 「이관 체크리스트」 ↔ 코드 대조 (with-ui-draft 사용 시)

티켓 frontmatter에 `scr` 필드가 있고 해당 시안의 `notes.md`에 「이관 체크리스트」(또는 "RN 이관 시 주의" 같은 동등 섹션)가 있으면, 각 항목이 코드에 실제로 반영되었는지 grep으로 대조한다.

절차:

1. notes.md 「이관 체크리스트」의 각 항목에서 **권장안 키워드** 추출 (예: `stickyHeaderIndices`, `KeyboardAvoidingView`, `withRepeat`)
2. `git diff develop..HEAD`의 추가 라인과 변경 파일에서 해당 키워드 grep
3. 매칭 결과 분류:
   - **0건**: 권장안이 코드에 반영되지 않음 → 🔴
   - **1건 이상이지만 무력화 값과 함께 사용**: `stickyHeaderIndices={[]}`, `enabled={false}` 등 리터럴 무력화 → 🔴 (의도된 비활성을 주장하는 한 줄 주석이 있으면 🟡로 완화)
   - **권장안 외 대안 사용**: notes.md가 명시한 대안(예: `Animated.ScrollView`)과 매칭되면 통과. 둘 다 아니면 🟡

이 점검은 동작·구조 가이드(sticky·키보드 회피·키프레임 애니메이션 등)에서 외피만 만들고 핵심을 빼먹는 잠복 미완을 잡아낸다. AC에 명시되지 않더라도 적용한다 — notes.md는 시안 충실도의 부속 SSOT이기 때문.

### 8. 회귀 가드 — 변경분의 *삭제 라인*에 cross-cutting 가드가 있는가

본 티켓 AC가 명시하지 않더라도, 이전 티켓이 동일 파일에서 만족시킨 cross-cutting 가드가 회귀하면 🔴. `git diff develop..HEAD`의 **삭제 라인** 중 다음 토큰이 있고 같은 hunk 또는 인접 hunk에 동등 대체가 도입되지 않았다면 회귀로 간주.

| 카테고리 | 토큰 예시 |
|---|---|
| Safe Area | `SafeAreaView`, `SafeAreaProvider`, `useSafeAreaInsets`, `rt.insets.*`, `edges={[...]}` |
| 키보드 회피 | `KeyboardAvoidingView`, `rt.insets.ime`, `keyboardVerticalOffset` |
| 접근성 | `accessibilityRole`, `accessibilityLabel`, `aria-*`, `role=` |
| 권한·인증 분기 | 권한 체크 분기, 인증 가드 컴포넌트, 로그인 분기 |
| 플랫폼 분기 | `Platform.OS`, `Platform.select`, `.ios.tsx`/`.android.tsx` 분리 |

**특히 다음 패턴은 무조건 🔴**: 라우트 진입점 파일이 통째로 짧아지며 placeholder의 가드 래퍼(`<SafeAreaView>...`)가 사라지고 본문이 한 줄 컴포넌트 호출로 교체된 경우 — placeholder→실구현 전이의 단골 회귀 형태. 새 화면 컴포넌트가 가드를 내부에서 흡수했다는 주장은 받아들이지 않는다 (라우트 파일만 보고 검증 가능해야 함, `domain-app-ui` 「책임 분담 매트릭스」 참조).

본 점검은 **현재 티켓 AC에 없더라도** 적용한다. AC 매핑(§1)은 "추가된 것"을, §7은 "그래야 하는데 안 한 것"을, 본 항은 "사라진 것"을 본다.

## 출력 통합 (code-reviewer Part B)

```yaml
part_b:
  verdict: pass | 🟡 | 🔴 | skipped
  items:
    - severity: 🔴 | 🟡
      ac_item: "AC 인용 (티켓 본문에서 그대로)"
      message: "어떻게 미충족인지 — 구체적으로"
      # 선택: 위치 단서
      file: path/to/file
```

별도 표(AC 매핑)가 보고에 도움 되면 `code-reviewer`가 출력 마지막에 첨부 가능 — 본 체크리스트의 결과를 종합해 표시.

## Severity 가이드

- **🔴**: AC 미구현 (위치 특정 불가), 핵심 동작 누락, 파일 스코프 일탈, 이관 체크리스트 권장안 미반영(§7), 회귀 가드 위반(§8)
- **🟡**: 엣지케이스 의심, 조건부 노출 불명확, 부분 구현, 이관 체크리스트 권장안 외 대안 사용(§7)
- **pass**: 모든 AC 충족 + 누락·엣지케이스 명확 + §7·§8 위반 없음
- **skipped**: 티켓 파일 경로 누락 — Part B 점검 불가

## 주의사항

- **관점 분리**: Part A(품질)와 Part B(AC)는 섞지 않는다. 같은 이슈가 두 관점에 걸리면 각각의 파트에 다른 각도로
- **구현 추적 실패 ≠ 미구현**: 키워드로 못 찾았다면 AC가 추상적일 수 있음. 위치 불명 상태로 보고하고 reviewer 판단 청함
- **티켓 수정 금지**: AC 불명확해도 티켓을 고치지 않음. 다음 티켓에서 명확화
- **smoke 중복 점검 금지**: smoke가 이미 담당하는 항목(lint/type/test)을 Part B에서 다시 점검하지 않음
