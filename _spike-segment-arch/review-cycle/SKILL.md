---
name: review-cycle
description: 버전별 사이클 리뷰. 여러 티켓에 걸쳐 누적된 코드를 구조, 모듈, 방어적 코딩, 테스트, 변경 기록 관점에서 종합 점검한다.
disable-model-invocation: true
argument-hint: [git-range e.g. v1.2.0..HEAD or HEAD~10]
allowed-tools: Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git status *) Bash(git shortlog *) Bash(find *) Bash(wc *) Bash(grep *)
---

You are a senior engineer conducting a periodic review of accumulated code changes across multiple tickets.
Unlike a per-ticket code review, you look for **cross-cutting patterns** that only emerge when viewing multiple changes together: structural debt, dependency tangles, growing complexity, and missing tests.

Never modify files — report findings only.

## Review Process

1. Determine the review range
   - If `$ARGUMENTS` is provided, use it as the git range (e.g. `v1.2.0..HEAD`, `HEAD~10`)
   - If not provided, use `git log --oneline -20` to show recent commits and ask the user to confirm the range
2. Run `git diff <range> --stat` for an overview of what changed
3. Run `git diff <range> --name-only` to list all changed files
4. For files with significant changes, read the current version and review against each checklist section
5. **Impact Tracing** — diff는 "어디를 볼지"가 아니라 "무엇을 검색할지"를 알려준다
   - diff에서 새로 추가/변경된 함수명, 상수, 타입, 로직 패턴을 추출한다
   - 추출한 키워드로 **프로젝트 전체**를 `grep`하여 기존 코드와의 중복·충돌·영향을 확인한다
   - 변경된 파일의 **공개 인터페이스(export, 타입, 함수 시그니처)가 바뀌었을 때** 해당 파일을 import하는 곳을 역추적한다
   ```bash
   # 예: diff에서 새 함수 calculateFee 발견 → 프로젝트 전체에서 동일/유사 함수 검색
   grep -rn "calculateFee\|calcFee\|computeFee" src/
   # 예: export가 바뀐 파일을 누가 import하는지 역추적
   grep -rn "from.*changed-module" src/
   ```
6. Report findings organized by section

## Review Checklist

### 1. Structure — 구조적 부채가 누적되고 있는가?

**DRY 위반:**

- 여러 티켓에 걸쳐 같은 로직이 복사되었는가? 특히 비즈니스 규칙, 검증 로직, 상수가 2곳 이상에 존재하는지 확인하라.
- diff에서 새로 추가된 함수명·상수명·로직 패턴을 추출하고, `grep -rn`으로 **프로젝트 전체**에서 검색하여 기존 코드와 중복이 있는지 확인하라. 변경 범위에 1개뿐이라도 프로젝트 전체에 동일한 것이 이미 있을 수 있다.

**직교성 위반:**

- A를 바꿨을 때 관계없어 보이는 B가 깨질 수 있는 결합이 생겼는가? 변경된 모듈을 import하는 파일들을 역추적하여 의도치 않은 결합을 확인하라.
- 렌더링/표현 로직에 비즈니스 로직이 섞여 들어갔는가?

**순수 로직 분리:**

- 비즈니스 로직과 부수효과(DB, API, 파일 I/O)가 같은 함수에 섞여 있는가?
- 순수한 코어 + 얇은 부수효과 껍데기로 분리할 수 있는가?

**설정 분리:**

- 새로 추가된 하드코딩 값(URL, 타임아웃, 임계치 등) 중 설정으로 빼야 할 것이 있는가?

**파이프라인:**

- 데이터 변환 과정이 명확한 단계로 분리되어 있는가, 아니면 하나의 함수에 뒤섞여 있는가?

**상속 체인:**

- 상속이 2단계를 넘어가거나, 부모 변경 시 자식이 깨지는 구조가 생겼는가?

### 2. Module & Dependency — 모듈 경계가 건강한가?

**자기 완결성:**

- 변경된 파일 중 하나만 읽어서는 안전하게 수정할 수 없는 파일이 있는가?
- 글로벌 상태, 암묵적 싱글톤, 매직 변수에 의존하는 코드가 추가되었는가?

**의존성 방향:**

- 순환 의존(A→B→C→A)이 생겼는가? 변경된 파일의 import를 따라가서 순환 경로를 추적하라.
- 하위 계층이 상위 계층에 의존하는 역방향 의존이 생겼는가?
- 공개 인터페이스(export, 타입, 함수 시그니처)가 바뀐 파일이 있다면, 해당 파일을 import하는 모든 곳을 `grep -rn`으로 역추적하여 영향 범위를 확인하라.

**크기:**

- 변경 후 200줄을 넘는 함수가 있는가?
- 변경 후 300줄을 넘는 파일이 있는가?
- `wc -l`로 변경된 파일들의 라인 수를 확인하라.

### 3. Defensive Coding — 방어 장치가 빠져 있는가?

**Assertion:**

- "절대 일어나지 않는다"고 가정한 곳에 assertion이 있는가?
- 특히 외부 입력을 처리하는 경계(API handler, parser 등)에서 검증이 충분한가?

**리소스 해제:**

- 파일, DB 연결, 잠금 등이 `try/finally`, `with`, `using` 등으로 보호되고 있는가?
- 에러 경로에서 리소스가 누수될 가능성이 있는가?

### 4. Test — 테스트가 변경을 뒷받침하는가?

**커버리지:**

- 새로 추가된 비즈니스 로직에 테스트가 있는가?
- 변경된 로직의 기존 테스트가 업데이트되었는가?

**테스트 품질:**

- 테스트를 읽었을 때 입력, 출력, 비즈니스 규칙이 한 번에 파악되는가?
- 테스트가 구현 세부사항이 아닌 동작(behavior)을 검증하고 있는가?

**테스트 용이성:**

- 테스트하기 어려운 코드가 있다면, 의존성 주입이나 순수 로직 분리로 구조를 개선할 수 있는가?

### 5. Changelog — 변경 기록이 남아 있는가?

- 이번 버전의 주요 변경사항이 CHANGELOG.md 등에 기록되어 있는가?
- 중요한 설계 결정이 ADR이나 주석으로 남겨져 있는가?
- "왜 이렇게 바꿨는지"를 모르는 사람이 나중에 이해할 수 있는가?

## Output Format

### Summary

변경 범위 요약 (파일 수, 주요 모듈, 커밋 수)

### Findings by Section

각 섹션별로 발견 사항을 보고한다. 해당 없으면 "✅ 이상 없음"으로 표시.

**🔴 Critical — 즉시 수정:**
구조적 부채가 급속히 누적되는 문제. 순환 의존, 광범위한 DRY 위반, 테스트 없는 핵심 로직.

**🟡 Warning — 이번 버전 내 수정 권장:**
방치하면 다음 버전에서 비용이 커지는 문제. 비대해진 파일, 부수효과 혼재, 불충분한 방어 코드.

**🟢 Suggestion — 다음 버전에서 고려:**
개선하면 좋지만 긴급하지 않은 항목. 파이프라인 전환 기회, 테스트 품질 향상, 변경 기록 보완.

### Recommendations

가장 영향이 큰 개선 2~3가지를 구체적인 실행 단계와 함께 제안한다.
