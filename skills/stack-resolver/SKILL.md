---
name: stack-resolver
description: >
  docs/project.config.yaml의 scope 키를 받아 매칭되는 stack-profile을 찾고,
  프로파일이 선언한 use-* 스킬 목록을 반환한다. dev-from-ticket이 STEP 3-3에서 호출.
  순수 함수 — config·profiles를 읽기만 하고 사이드 이펙트 없음.
user-invocable: false
allowed-tools:
  - Read
  - Glob
  - Bash(test:*)
  - Bash(ls:*)
---

# stack-resolver

dev phase의 스택 라우팅 전담 스킬. 한 가지 일만 한다 — `scope` 키를 받아 그 scope에 매칭되는 프로파일을 찾고, 프로파일이 선언한 `use-*` 스킬 목록을 반환.

## 책임 / 비책임

### 책임

- `docs/project.config.yaml`에서 지정 scope의 스택 사실을 읽음
- `profiles/*.yaml` 중 매칭되는 프로파일 1개 결정
- 프로파일의 `skills:` 목록 반환 (use-* 만)
- 매칭 실패·중복 시 명확한 에러 + 진단 정보 출력

### 비책임

- `domain-*`, `with-*`, `review-*` 결정 → `dev-from-ticket` 책임
- config drift 검출·수정 → `compile-project-config` 책임
- scope 자동 추론 → `ticket` 스킬 작성 시점 책임
- 스택 scaffolding → `expo-sdk55-unistyles-stack` 등의 책임

본 스킬은 **순수 함수**: 동일 입력 → 동일 출력. 사이드 이펙트 없음.

---

## 입력

### 명시 인자

| 인자 | 형식 | 필수 |
|---|---|---|
| `scope` | 문자열 (`repo.scopes`의 키) | ✓ |

호출 예: `Skill: stack-resolver(scope=mobile)`

### 암묵 입력 (디스크 읽기)

- `docs/project.config.yaml` — scope의 스택 사실
- `skills/stack-resolver/profiles/*.yaml` — 매칭 후보 풀

---

## 출력 형식

YAML 블록으로 반환. 호출자는 `status` 필드로 분기.

### 성공 (`status: ok`)

```yaml
status: ok
scope: mobile
profile: expo-sdk55-unistyles3
skills:
  - use-expo-sdk55
  - use-unistyles3
warnings: []
```

### 매칭 실패 — 지원되지 않는 스택 (`status: not-found`)

```yaml
status: not-found
scope: mobile
detected:
  runtime: react-native-expo
  framework: expo
  framework_version: ^54         # 본 프로파일들 중 일치 없음
  styling: unistyles
  styling_version: ^3
candidates_checked: 3
suggestions:
  - "프로파일 expo-sdk54-unistyles3 추가 (skills/stack-resolver/profiles/)"
  - "config의 framework_version을 ~55로 변경 후 /nidost:compile-project-config 재실행"
```

### 매칭 중복 (`status: ambiguous`)

```yaml
status: ambiguous
scope: mobile
matched_profiles:
  - expo-sdk55-unistyles3
  - expo-sdk55-strict
note: "프로파일 match 조건이 중복됩니다. profile match 블록을 좁혀 1:1로 만드세요."
```

### scope 키 없음 (`status: invalid`)

```yaml
status: invalid
scope: mobile
reason: "config.repo.scopes에 'mobile' 키 없음"
available_scopes: [backend, web]
```

---

## 프로파일 YAML 스키마

`skills/stack-resolver/profiles/<id>.yaml`:

```yaml
id: expo-sdk55-unistyles3        # 파일명과 일치 (확장자 제외)

match:                           # 모든 필드가 scope 사실과 일치해야 함
  runtime: react-native-expo     # 정확 일치
  framework: expo                # 정확 일치
  framework_version: ~55         # semver 호환 — 메이저 매칭
  styling: unistyles             # 정확 일치
  styling_version: ^3            # 메이저 매칭
  # language: ts                 # optional. 생략 시 와일드카드

skills:                          # 활성화 시 로드할 use-* 스킬
  - use-expo-sdk55
  - use-unistyles3
```

### 매칭 규칙

| 필드 타입 | 매칭 방식 |
|---|---|
| 문자열 (`runtime`, `framework`, `styling`, `language`) | 정확 일치 (case-sensitive) |
| 버전 범위 (`framework_version`, `styling_version`) | semver — 메이저 일치 |
| profile에 생략된 필드 | 어떤 값이든 매칭 (와일드카드) |
| config에 없는 필드 | profile이 그 필드를 요구하면 매칭 실패 |

### 버전 매칭 (메이저 비교)

| profile match | config | 결과 |
|---|---|---|
| `~55` | `~55` | ✓ |
| `~55` | `^55` | ✓ (메이저 동일) |
| `~55` | `55.0.0` | ✓ |
| `~55` | `55.2.1` | ✓ |
| `~55` | `^54` | ✗ (메이저 불일치) |
| `^3` | `~3.5` | ✓ |
| `^3` | `^4` | ✗ |

핵심 규칙: **메이저 버전이 같으면 매칭**. 마이너·패치 차이 허용. 정교한 semver intersect는 추후 도입.

### 프로파일 lint 검사 (`skills:` 항목 검증)

`profiles/*.yaml`을 로드하는 시점에 각 프로파일에 대해:

```
for each item in profile.skills:
  if not item.startswith("use-"):
    error: "프로파일 skills는 use-* 만 허용. {profile_id}의 {item} 위반"
    → 해당 프로파일을 매칭 후보에서 제외
```

위반 시 진단 메시지 출력 + 매칭에서 제외.

---

## STEP 0: 사전 체크

### 0-1. config 존재

```bash
test -f docs/project.config.yaml
```

없음:

```yaml
status: invalid
reason: "docs/project.config.yaml 없음. /nidost:compile-project-config 실행 필요"
```

### 0-2. profiles 디렉토리

```bash
test -d skills/stack-resolver/profiles && ls skills/stack-resolver/profiles/*.yaml 2>/dev/null | head -1
```

없음 또는 yaml 파일 0개:

```yaml
status: invalid
reason: "skills/stack-resolver/profiles/ 비어있음. 최소 1개 프로파일 필요."
```

---

## STEP 1: scope 추출

### 1-1. config 로드

`docs/project.config.yaml`을 파싱해 `config.repo.scopes` 추출.

### 1-2. scope 키 검증

```
if scope not in config.repo.scopes:
  return status: invalid + available_scopes 보고
```

### 1-3. scope 사실 추출

```
scope_facts = config.repo.scopes[scope]
# 예: { runtime: react-native-expo, framework: expo,
#       framework_version: ~55, styling: unistyles,
#       styling_version: ^3, language: ts, ... }
```

---

## STEP 2: 프로파일 매칭

### 2-1. profiles 전체 로드

```
profiles = []
for each yaml file in skills/stack-resolver/profiles/:
  load file
  validate skills lint (use-* 검사)
  if valid: profiles.append(profile)
```

### 2-2. 각 profile에 대해 매칭 시도

```
matched = []
for profile in profiles:
  match = true
  for key, value in profile.match.items():
    if key not in scope_facts:
      match = false; break
    if is_version_field(key):
      if not major_version_match(value, scope_facts[key]):
        match = false; break
    else:
      if value != scope_facts[key]:
        match = false; break
  if match:
    matched.append(profile)
```

`is_version_field(key)`: `framework_version`, `styling_version` 등 `*_version` 패턴.

`major_version_match(a, b)`: 두 semver range에서 메이저 버전 추출 후 동일 여부 확인.

### 2-3. 결과 분기

```
if len(matched) == 0:
  return status: not-found + detected (scope_facts) + candidates_checked + suggestions
elif len(matched) == 1:
  return status: ok + profile + skills
else:
  return status: ambiguous + matched_profiles 목록
```

---

## STEP 3: 출력

YAML 블록으로 4가지 status 중 하나 출력. 호출자가 파싱.

```yaml
status: ok | not-found | ambiguous | invalid
...
```

---

## 새 프로파일 추가

새 스택을 지원하려면 `skills/stack-resolver/profiles/<id>.yaml` 추가:

체크리스트:

- [ ] `id`는 파일명과 일치
- [ ] `match:` 블록의 키가 `config.repo.scopes.<scope>`에 존재하는 키
- [ ] `skills:` 목록이 모두 `use-*` 접두어
- [ ] 해당 use-* 스킬들이 실제로 존재 (또는 동시 생성)
- [ ] 기존 프로파일과 match 블록 unique (중복 금지)
- [ ] (선택) 동일 스택을 다루는 scaffolder가 있으면 함께 갱신 검토

---

## 주의사항

- 본 스킬은 config·profiles를 **읽기만** 한다. 절대 수정 X (단방향 invariant)
- 호출자는 `status` 필드를 반드시 확인. `ok`가 아니면 진행 금지
- 프로파일 lint 위반은 매칭 후보에서 제외 + 진단 출력. 자동 수정 X
- 매칭 실패는 abort 신호. 호출자가 티켓을 `skipped` 처리해야 함
- scope 자동 추론은 본 스킬 책임 아님 — `ticket` 스킬 또는 호출자가 처리
- profiles/는 동적 인덱싱 — 추가만 하면 즉시 반영. 별도 등록 절차 없음

---

## 언어/톤

출력은 YAML 구조화. 진단 메시지는 한국어. suggestions는 사용자가 다음 행동을 결정할 수 있도록 구체적으로.
