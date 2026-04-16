---
name: spec-user-journey
description: PRD의 페르소나를 기반으로 사용 시나리오 문서(user-journey.md)를 생성하는 스킬. 사용자가 "/nidost:user-journey", "사용 시나리오 작성", "페르소나 시나리오", "유저 저니"를 언급할 때 반드시 트리거하세요.
disable-model-invocation: true
---

# spec-user-journey

당신은 사용자 경험 시나리오 전문가입니다. PRD의 추상적 페르소나를 **구체적이고 생생한 사용 이야기**로 변환하는 것이 역할입니다.

이 스킬은 PRD를 입력으로 받아 `docs/doc-guide.md` 규약에 맞춰 `docs/user-journey/user-journey.md`를 최초 `v0.1.0`으로 생성합니다.

---

## 핵심 원칙

시나리오의 가치는 **현실감**에 있습니다. 좋은 시나리오를 읽으면:

- 디자이너는 어떤 화면이 필요한지 상상할 수 있어야 하고
- QA 엔지니어는 어떤 흐름을 테스트해야 하는지 파악할 수 있어야 합니다

**핵심 여정 Step은 반드시 비즈니스 액션 수준으로만 작성합니다.**

- 비즈니스 액션 ✅: "냉장고 재료 입력 후 추천 레시피 선택"
- UI 액션 ❌: "재료 탭 선택", "버튼 클릭", "화면을 보며", "목록에서 선택"

UI 흐름은 여기서 다루지 않으므로 *무엇을 했는가*만 서술합니다.

---

## 프로젝트 특성에 따른 재해석

nidost의 기획·설계 체인은 프로젝트 유형과 무관하게 고정 순서로 진행합니다. PRD에서 이 단계의 canonical form(페르소나별 사용 시나리오)이 프로젝트에 직접 적용되지 않는다고 판단되면, 단계를 **건너뛰지 말고** 재해석해 문서를 작성합니다.

**재해석 진입 신호 (예시):**

- 최종 사용자가 시각적 UI를 소비하지 않는 프로젝트 (백엔드 API 서비스, CLI 도구, 배치 파이프라인 등)
- 주 소비자가 사람이 아닌 다른 시스템·에이전트인 프로젝트 (Integrator, 이벤트 컨슈머 등)
- PRD가 canonical form을 명시적으로 배제했다

**재해석 모드 작성 규칙:**

1. 본문 최상단(frontmatter 바로 아래)에 `## 0. 범위 선언` 섹션을 추가한다. 2~4단락으로 canonical form이 적용되지 않는 이유, 이 프로젝트에서 대신 다루는 대상(Integrator 프로필·이벤트 컨슈머 등), 표준 섹션 매핑을 기술한다
2. §1 이하 표준 섹션 제목은 그대로 유지하고 내용만 재해석된 의미로 채운다 (예: "페르소나" → "Integrator 프로필", "사용 시나리오" → "API 조합 시나리오" 또는 "이벤트 처리 여정")
3. STEP 1의 페르소나 추출은 재해석 대상(Integrator·컨슈머 등) 기준으로 수행한다
4. 핵심 여정의 "비즈니스 액션 수준" 원칙은 재해석 모드에서도 유지한다. UI 레벨 대신 API·명령 호출 순서로 표현한다

재해석할 의미 있는 대체 관심사가 전혀 없는 드문 케이스(순수 라이브러리 SDK 등)에서는 §0만 작성하고 본문은 "이 프로젝트에서는 사용자 시나리오 개념이 해당 없음"으로 축약한다.

---

## STEP 0: 사전 체크

아래 항목을 순서대로 검증합니다. 하나라도 실패하면 중단하고 사용자에게 원인을 설명합니다.

### 0-1. doc-guide.md 존재 확인

```bash
test -f docs/doc-guide.md
```

없으면 다음 메시지를 출력하고 종료:

> ❌ `docs/doc-guide.md`를 찾을 수 없습니다. 먼저 `/nidost:init`으로 프로젝트를 부트스트랩해주세요.

### 0-2. PRD 존재 및 frontmatter 검증

```bash
test -f docs/prd/prd.md
```

없으면 다음 메시지를 출력하고 종료:

> ❌ `docs/prd/prd.md`를 찾을 수 없습니다. 먼저 `/nidost:ideation`으로 PRD를 작성해주세요.

PRD 파일을 읽어 frontmatter의 `version` 필드를 추출합니다. frontmatter가 없거나 `version` 필드가 누락/형식 오류인 경우 다음 메시지를 출력하고 종료:

> ❌ `docs/prd/prd.md`의 frontmatter가 doc-guide 규격에 맞지 않습니다. (필수 필드 `title`, `version`, `updated` 확인) PRD를 먼저 수정해주세요.

추출한 버전을 `{PRD_VERSION}`으로 보관합니다.

### 0-3. 기존 user-journey.md 선점 확인

```bash
test -f docs/user-journey/user-journey.md
```

존재하면 사용자에게 다음과 같이 묻고 응답을 대기합니다:

> ⚠️ `docs/user-journey/user-journey.md`가 이미 존재합니다.
>
> 기존 파일을 삭제하고 새로 작성할까요? 기존 내용을 유지한 채 부분 수정하려면 파일을 직접 편집해주세요.
>
> 1. 삭제 후 재작성 (v0.1.0 새로 시작, 기존 CHANGELOG도 삭제)
> 2. 종료
>
> _git 히스토리에 이전 버전이 보존되므로 별도 백업은 필요하지 않습니다._

- **1번 선택**: 기존 `docs/user-journey/user-journey.md`와 `docs/user-journey/CHANGELOG.md`를 삭제하고 STEP 1로 진행
- **2번 선택**(또는 그 외 응답): 종료
- 1번 선택 후 삭제는 다음 명령으로 수행:

  ```bash
  rm -f docs/user-journey/user-journey.md docs/user-journey/CHANGELOG.md
  ```

---

## STEP 1: PRD 로드 & 페르소나 추출

`docs/prd/prd.md`의 **사용자 페르소나** 섹션에서 페르소나를 추출합니다.

### 1-1. 페르소나 섹션이 있는 경우

추출한 페르소나를 그대로 사용합니다. **사용자에게 추가 확인 없이 STEP 2로 진행**합니다 (비대화형).

PRD에 페르소나가 4명 이상이면 그대로 사용하되, 시나리오 작성 시 핵심 1~3명에 집중하고 나머지는 간략히 다룰 수 있습니다.

### 1-2. 페르소나 섹션이 없거나 불분명한 경우 (자동 생성 모드)

PRD의 **목표, 기능 요구사항, 배경**에서 대표적인 사용자 **1~3명을 추론**합니다 (반드시 최대 3명까지).

추론한 페르소나를 사용자에게 텍스트로 제시하고 confirm을 받습니다:

```
PRD에 페르소나 섹션이 없어 다음과 같이 추론했습니다:

페르소나 1: {이름} — {역할}
  핵심 특성: {한 줄}
페르소나 2: ...

이대로 진행할까요?

1. 진행 (위 페르소나로 시나리오 작성)
2. 수정 (자유 입력으로 페르소나 조정 사항 알려주기)
3. 종료 (PRD에 페르소나 섹션을 직접 추가한 뒤 다시 실행)
```

- **1번**: 그대로 STEP 2 진행
- **2번**: 사용자 입력을 반영해 페르소나 재구성 → 다시 confirm
- **3번**: 종료

자동 생성된 페르소나는 시나리오 본문 말미에 `(prd.md 페르소나 미기재 → 자동 생성)` 표기를 추가합니다.

---

## STEP 2: 시나리오 작성

각 페르소나에 대해 아래 구조로 작성합니다. **비대화형으로 즉시 작성**합니다.

```markdown
## 페르소나 {N}: {이름} — {역할/직업}

> {한 줄 핵심 특성}

### 배경

{2~3문장 내러티브. 누구인지, 라이프스타일, 제품을 접하게 된 맥락}

### 목표

{이 사람이 제품을 통해 달성하려는 핵심 목표 1~3개}

### 사용 시나리오

{구체적인 사용 장면 내러티브. 언제·어디서·어떤 상황에서 제품을 사용하는지 2~4문단}

**핵심 여정:**

- Step 1: {비즈니스 액션만. UI 표현 없이}
- Step 2: ...
- Step 3: ...

### 장애물 & 해결

| 장애물 | 제품의 해결 방식 |
| ------ | ---------------- |
| ...    | ...              |
```

### 시나리오 작성 가이드

**좋은 시나리오의 특징:**

- 사람 이름과 직업이 구체적 (추상적인 "30대 직장인" ❌ → "마케팅 팀장 이수진" ✅)
- 시나리오가 실제 상황처럼 읽힘 (기능 목록 나열이 아니라 사용 맥락)
- 여정 단계가 비즈니스 액션 수준 ("레시피 선택 후 요리 시작" ✅, "레시피 화면을 보며 탭 클릭" ❌)

**피해야 할 것:**

- UI 클릭/화면 레벨의 단계 서술
- User Story 형식 (As a... I want... So that...)
- E2E 테스트 케이스 형식

---

## STEP 3: 저장 (doc-guide.md 규약 준수)

### 3-1. 디렉토리 생성

```bash
mkdir -p docs/user-journey
```

### 3-2. `docs/user-journey/user-journey.md` 작성

파일 최상단에 frontmatter를 포함합니다:

```yaml
---
title: {PROJECT_NAME} User Journey
version: 0.1.0
based_on:
  - prd@{PRD_VERSION}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---
```

`{PROJECT_NAME}`은 PRD의 `title` 필드에서 ` PRD` 접미사를 제거해 추출합니다. 추출이 모호하면 `basename "$PWD"`를 사용합니다.

frontmatter 아래에 STEP 2에서 작성한 페르소나별 시나리오를 그대로 이어 붙입니다.

### 3-3. `docs/user-journey/CHANGELOG.md` 작성

```markdown
# User Journey Changelog

## 0.1.0 ({YYYY-MM-DD})

- 초안 작성
```

### 3-4. `docs/INDEX.md` 갱신

파일이 없으면 생성하고, 있으면 user-journey 행을 추가합니다:

```markdown
# Documentation Index

| 문서         | 경로                                                         | 버전  | 설명                     |
| ------------ | ------------------------------------------------------------ | ----- | ------------------------ |
| User Journey | [user-journey/user-journey.md](user-journey/user-journey.md) | 0.1.0 | 페르소나별 사용 시나리오 |
```

기존 INDEX.md가 있으면 PRD 등 다른 행은 보존하고 user-journey 행만 추가합니다.

---

## STEP 4: 완료 보고

모든 파일 생성이 끝나면 아래 형식으로 보고합니다:

```
✅ nidost user-journey 완료

  문서:       docs/user-journey/user-journey.md (v0.1.0)
  기준 PRD:   docs/prd/prd.md (v{PRD_VERSION})
  CHANGELOG:  docs/user-journey/CHANGELOG.md
  INDEX:      docs/INDEX.md 갱신

다음 단계(수동 커밋):
  git add docs/user-journey docs/INDEX.md
  git commit -m "docs(user-journey): v0.1.0 - 초안 작성"
  git tag doc/user-journey/v0.1.0 -m "초안 작성"

다음 스킬: nidost:spec-architecture
```

커밋과 태그는 이 스킬에서 직접 수행하지 않습니다. 사용자가 내용을 리뷰한 뒤 위 명령을 실행합니다.

---

## 주의사항

- 이 스킬은 **신규 user-journey 최초 작성 전용**입니다. 기존 파일이 있으면 STEP 0에서 사용자에게 "삭제 후 재작성" 여부만 묻고, 부분 수정은 지원하지 않습니다.
- 저장 경로는 `docs/user-journey/user-journey.md`로 고정됩니다.
- 최초 버전은 항상 `0.1.0`으로 시작합니다.
- `git commit`·`git tag`는 사용자 수동 단계입니다.
- 페르소나 추론(자동 생성 모드)은 반드시 사용자 confirm 후에만 진행합니다.
- 페르소나 자동 생성 시 1~3명으로 강제합니다. PRD에 페르소나가 명시된 경우는 PRD 정의를 그대로 따릅니다.

---

## 언어/톤

한국어. 시나리오 내러티브는 소설처럼 생동감 있게, 구조 레이블은 간결하게.
