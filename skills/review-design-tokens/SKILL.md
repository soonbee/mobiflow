---
name: review-design-tokens
description: 디자인 토큰 준수 수동 점검. 색상·간격·타이포그래피·그림자 등이 토큰을 사용하는지 diff에서 확인하고 하드코딩 값을 지적한다. dev-from-ticket이 domain=ui + tooling.token_lint=no(config) 조건일 때만 code-reviewer Part A 보강 체크리스트로 로드 지시.
---

# review-design-tokens

디자인 토큰 미준수를 diff 검토만으로 잡아내는 수동 체크리스트. **token-lint(자동 검사 도구)가 없는 프로젝트에서만** code-reviewer가 로드한다. 자동 token-lint를 보유한 프로젝트는 smoke 단계에서 잡히므로 본 스킬 불필요 (`docs/project.config.yaml`의 `tooling.token_lint` 필드가 결정).

`code-reviewer` Part A의 보강 체크리스트로 통합. 단독 출력 형식 없음.

**파일을 수정하지 않는다.**

## 토큰의 SSOT

프로젝트의 토큰 정의 위치:

- `docs/design-tokens/design-tokens.md` — 인간 결정 SSOT
- `_shared/tokens.css` (draft phase 산출물) 또는 코드 내 theme 객체 — 코드에 반영된 토큰

리뷰 시점에는 **코드 내 토큰**을 기준으로 점검 (실제 사용 가능한 값 셋). diff에서 토큰 외 값이 등장하면 의심.

## Review Checklist

### 1. 색상 (color)

- HEX/RGB 직접 입력 (`#3a7bd5`, `rgb(58, 123, 213)`) → 🔴 (의도적 raw 사용 외)
- 약어 색상명 (`'red'`, `'blue'`) → 🟡 (semantic token 권장)
- `rgba()`로 투명도 → opacity 토큰 활용 가능한지 확인
- 다크 모드 분기 시 토큰 자체가 mode-aware인지 (수동 분기 X)

```typescript
// 🔴 색상 raw
backgroundColor: '#3a7bd5'

// ✓ 토큰 사용
backgroundColor: theme.colors.primary

// 🟡 약어
color: 'red'

// ✓ 시맨틱 토큰
color: theme.colors.danger
```

### 2. 간격 (spacing)

- `padding: 13px`, `margin: 7px` 등 4px/8px 격자 어긋난 값 → 🟡 (의도 확인)
- 격자 값(`8`, `16`, `24`)이라도 토큰 미사용이면 🟡

```typescript
// 🔴 매직 넘버
padding: 13

// 🟡 격자 값이지만 raw
padding: 16

// ✓ 토큰
padding: theme.spacing.md
```

### 3. 타이포그래피

- `fontSize: 17`, `fontWeight: '600'` raw → 🔴 또는 🟡 (시안 직접 매핑 가능 시 🟡)
- `fontFamily` 직접 문자열 → 🟡 (토큰화 권장)
- `lineHeight` 임의 값 → 🟡

```typescript
// 🔴 raw
fontSize: 17, fontWeight: '600'

// ✓ 토큰
...theme.typography.bodyLarge
```

### 4. 그림자·boxShadow·elevation

- 그림자 raw 정의 (`shadowColor: '#000'`, `shadowOpacity: 0.1`, `elevation: 3`) → 🟡
- 토큰화된 elevation 시스템 권장 (`theme.elevation.card`)

### 5. 보더·반경 (border, radius)

- `borderRadius: 12` raw → 🟡
- `borderColor` 색상 토큰 미사용 → 🔴
- `borderWidth` 매직 (1.5 등) → 🟡

### 6. z-index

- 임의 큰 숫자 (`z-index: 9999`) → 🟡
- 시스템 정의 (예: `theme.zIndex.modal`) 사용 권장

## 분류 기준

### 🔴 (수정 필요)

- 색상 HEX/RGB 직접 (의도적 raw가 아닌 한)
- 시안에 있어도 토큰 가능한 값을 raw로
- borderColor 색상 토큰 미사용

### 🟡 (권장)

- 격자 값이지만 토큰 미사용
- 약어 색상명
- 그림자 raw
- borderRadius·z-index 매직 넘버

### pass (수용)

- 시안에서 추출한 raw 값을 토큰에 없는 1회성으로 사용 + notes에 기록 (with-ui-draft 규약)
- 의도적인 일회성 값 + 코드 주석 명시

## 출력 통합

```yaml
part_a:
  items:
    - severity: 🔴 | 🟡
      area: "토큰 위반 (색상 / 간격 / 타이포 / 그림자 / 보더 / z-index)"
      message: "구체적 — 어떤 raw 값이고 어떤 토큰으로 교체 가능"
      file: path/to/file
      line: N
      # 선택: 토큰 후보 제안
      suggested_token: theme.colors.primary
```

## token-lint 자동 도구가 있는 경우

`docs/project.config.yaml`에서 `tooling.token_lint: yes`이면 본 스킬은 로드되지 않음 (dev-from-ticket이 review_skills에서 제외). 자동 검사가 smoke에서 동등 점검 수행. 사용자가 새로운 token-lint 도구를 도입한 뒤 config 갱신을 잊으면 본 스킬이 중복 점검할 수 있음 — 큰 문제 아님 (false positive보다 보수적).

## 참조

- 디자인 토큰 SSOT: `docs/design-tokens/design-tokens.md`
- with-ui-draft (시안 충실도와의 관계)
