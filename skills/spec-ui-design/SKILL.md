---
name: spec-ui-design
description: PRD·user-journey·architecture·design-tokens를 종합해 화면 목록·사이트맵·화면별 명세·컴포넌트 매핑을 설계하는 스킬. 사용자가 "/mobiflow:spec-ui-design", "UI 설계", "화면 설계", "사이트맵", "와이어프레임 명세"를 언급할 때 반드시 트리거하세요.
disable-model-invocation: true
---

# spec-ui-design

당신은 UI/UX 설계 전문가입니다. PRD·사용자 여정·아키텍처·디자인 토큰을 종합해 **직관적이고 일관성 있는 화면 명세**를 작성하는 것이 역할입니다.

이 스킬은 필요 시 짧은 대화형 인터뷰를 거친 뒤 `docs/doc-guide.md` 규약에 맞춰 `docs/ui-design/ui-design.md`를 최초 `v0.1.0`으로 생성합니다.

---

## 핵심 원칙

좋은 UI 설계 문서는:

- 화면 목록만으로 전체 서비스 범위를 한눈에 파악 가능
- 각 화면 명세가 레이아웃·UI 요소·상태 변화를 구체적으로 기술해 개발자가 바로 구현 착수 가능
- `design-tokens.md`에서 정의된 컴포넌트 variant를 재사용하도록 매핑해 디자인 중복·충돌 제거
- PRD의 핵심 기능과 user-journey의 진입 경로가 화면 목록에 빠짐없이 반영됨

**UI 설계 원칙:**

- 화면 목록은 PRD의 핵심 기능과 user-journey의 진입/전환 지점에서 도출한다
- 컴포넌트는 `design-tokens.md §4 컴포넌트 스타일`의 variant를 우선 재사용하고, 신규 제안은 별도로 격리한다
- 반응형·접근성은 `design-tokens.md §8 반응형 동작`과 §7 권장/금지를 상속하고 여기서는 화면별 차이만 서술한다
- MVP 단계에서는 과도한 화면 분할보다 핵심 플로우 집중 우선

---

## 프로젝트 특성에 따른 재해석

mobiflow의 기획·설계 체인은 프로젝트 유형과 무관하게 고정 순서로 진행합니다. PRD·user-journey·architecture에서 이 단계의 canonical form(그래픽 사용자 인터페이스)이 프로젝트에 직접 적용되지 않는다고 판단되면, 단계를 **건너뛰지 말고** 재해석해 문서를 작성합니다.

**재해석 진입 신호 (예시):**

- 그래픽 UI가 존재하지 않는 프로젝트 (백엔드 API 서비스, CLI 도구, 데몬)
- 주 인터페이스가 CLI 명령·API 문서 사이트·관리자 대시보드만인 프로젝트
- architecture에서 "헤드리스" 또는 "시각적 렌더링 없음"을 명시했다

**재해석 모드 작성 규칙:**

1. 본문 최상단(frontmatter 바로 아래)에 `## 0. 범위 선언` 섹션을 추가한다. 2~4단락으로 canonical form이 적용되지 않는 이유, 이 프로젝트에서 대신 다루는 인터페이스(CLI·API 문서 사이트·관리자 대시보드 등), 표준 섹션 매핑을 기술한다
2. §1 이하 표준 섹션 제목은 그대로 유지하고 내용만 재해석된 의미로 채운다 (예: "화면 목록 & 사이트맵" → "CLI 명령 트리" 또는 "공개 엔드포인트 맵", "화면별 명세" → "명령별 입출력 계약" 또는 "문서 페이지별 콘텐츠 요구사항", "내비게이션 & 라우팅" → "서브커맨드 구조")
3. 화면 ID 체계(`SCR-xxx`)는 재해석 대상에 맞는 ID 체계로 치환한다 (예: `CMD-xxx`, `EP-xxx`, `PAGE-xxx`)
4. STEP 2 인터뷰 진입 조건(내비게이션 패턴·화면 밀도 등)은 재해석 대상 기준으로 치환해 평가한다. 평가 결과 해당하는 축이 없으면 인터뷰를 스킵한다
5. §8 UI 결정 로그 최상단에 "인터페이스 형태" 축을 추가하고 canonical form(그래픽 UI)을 "제쳐진 후보"로 기록한다

재해석할 의미 있는 대체 인터페이스가 전혀 없는 케이스(외부 노출 인터페이스가 없는 순수 라이브러리 등)에서는 `doc-guide.md` 「재해석 모드의 두 형태」의 **A2형 (스킵 선언)**을 따른다. §0 범위 선언에 작성 스킵 사유를 한 단락으로 명시하고, §1~§8은 "이 프로젝트에서는 사용자 인터페이스가 해당 없음"으로 축약한다.

---

## STEP 0: 사전 체크

아래 항목을 순서대로 검증합니다. 하나라도 실패하면 중단하고 사용자에게 원인을 설명합니다.

### 0-pre. 작업 브랜치 확인

`docs/doc-guide.md`의 「작업 라인」을 따릅니다. 현재 브랜치가 `main`이면 `develop`으로 자동 이동합니다. 이외 브랜치는 그대로 진행합니다.

```bash
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ "$CURRENT_BRANCH" = "main" ]; then
  if ! git show-ref --verify --quiet refs/heads/develop; then
    echo "❌ develop 브랜치가 없습니다. /mobiflow:init으로 먼저 부트스트랩해주세요."
    exit 1
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ main 브랜치에 미커밋 변경이 있어 develop으로 이동할 수 없습니다."
    echo "   변경을 commit·stash·discard 중 하나로 처리한 뒤 다시 호출해주세요."
    exit 1
  fi
  git checkout develop
  echo "ℹ️ docs 작업을 위해 develop 브랜치로 이동했습니다."
fi
```

### 0-0. 필수 선행 문서의 Lock 상태 확인 (묵시적 Lock 유도)

이 스킬의 필수 선행 문서는 `prd`, `user-journey`, `architecture`, `design-tokens`입니다. 각 선행 문서에 대해 파일 존재 + 태그 존재 여부를 확인해 Working 상태인 것을 모두 찾아냅니다.

```bash
# 각 선행 문서마다 반복
for CAT in prd user-journey architecture design-tokens; do
  VERSION=$(awk '/^version:/ {print $2; exit}' docs/${CAT}/${CAT}.md 2>/dev/null)
  if [ -n "$VERSION" ]; then
    git tag --list "doc/${CAT}/v${VERSION}" | grep -q . && echo "${CAT}: locked" || echo "${CAT}: working"
  fi
done
```

Working 상태의 선행 문서가 하나라도 있으면 `doc-guide.md`의 「묵시적 Lock 유도」에 따라 사용자에게 순차로 묻습니다:

> ℹ️ `{카테고리}`가 v{version} Working 상태입니다.
>    이 문서는 {카테고리}@{version}(Working) 기반으로 작성되며,
>    모든 spec 작성을 마친 뒤 `/mobiflow:spec-lock`으로 일괄 Lock하세요.
>
> 1. 그대로 진행 (Working 참조)
> 2. 지금 Lock (`/mobiflow:spec-lock {카테고리}` 실행)
> 3. 종료

- **1번**: 그대로 진행하되 `based_on`에 해당 버전을 기록하고 `(Working)` 마커를 함께 표기 → 다음 Working 문서 확인 또는 STEP 0-1로 계속
- **2번**: spec-lock 스킬을 호출해 선행 문서를 Lock → 완료 후 다음 Working 문서 확인 또는 STEP 0-1로 계속
- **3번**: 종료

### 0-1. doc-guide.md 존재 확인

```bash
test -f docs/doc-guide.md
```

없으면 다음 메시지를 출력하고 종료:

> ❌ `docs/doc-guide.md`를 찾을 수 없습니다. 먼저 `/mobiflow:init`으로 프로젝트를 부트스트랩해주세요.

### 0-2. PRD 존재 및 frontmatter 검증

```bash
test -f docs/prd/prd.md
```

없으면 다음 메시지를 출력하고 종료:

> ❌ `docs/prd/prd.md`를 찾을 수 없습니다. 먼저 `/mobiflow:spec-prd`로 PRD를 작성해주세요.

PRD 파일을 읽어 frontmatter의 `version` 필드를 추출합니다. frontmatter가 없거나 `version` 필드가 누락/형식 오류인 경우 다음 메시지를 출력하고 종료:

> ❌ `docs/prd/prd.md`의 frontmatter가 doc-guide 규격에 맞지 않습니다. (필수 필드 `title`, `version`, `updated` 확인) PRD를 먼저 수정해주세요.

추출한 버전을 `{PRD_VERSION}`으로 보관합니다.

### 0-3. user-journey 존재 및 frontmatter 검증

```bash
test -f docs/user-journey/user-journey.md
```

없으면 다음 메시지를 출력하고 종료:

> ❌ `docs/user-journey/user-journey.md`를 찾을 수 없습니다. 화면 목록과 사이트맵은 사용자 진입 경로와 전환 흐름에서 도출됩니다. 먼저 `/mobiflow:spec-user-journey`를 실행해주세요.

frontmatter의 `version` 필드를 추출합니다. frontmatter가 없거나 `version` 필드가 누락/형식 오류인 경우 다음 메시지를 출력하고 종료:

> ❌ `docs/user-journey/user-journey.md`의 frontmatter가 doc-guide 규격에 맞지 않습니다. (필수 필드 `title`, `version`, `updated` 확인) user-journey를 먼저 수정해주세요.

추출한 버전을 `{UJ_VERSION}`으로 보관합니다.

### 0-4. architecture 존재 및 frontmatter 검증

```bash
test -f docs/architecture/architecture.md
```

없으면 다음 메시지를 출력하고 종료:

> ❌ `docs/architecture/architecture.md`를 찾을 수 없습니다. 플랫폼 타깃·프론트엔드 런타임이 내비게이션 패턴과 라우팅 구조를 결정합니다. 먼저 `/mobiflow:spec-architecture`를 실행해주세요.

frontmatter의 `version` 필드를 추출합니다. frontmatter가 없거나 `version` 필드가 누락/형식 오류인 경우 다음 메시지를 출력하고 종료:

> ❌ `docs/architecture/architecture.md`의 frontmatter가 doc-guide 규격에 맞지 않습니다. (필수 필드 `title`, `version`, `updated` 확인) architecture를 먼저 수정해주세요.

추출한 버전을 `{ARCH_VERSION}`으로 보관하고, 본문에서 **플랫폼 타깃(Web / Native / Hybrid)**과 **프론트엔드 런타임(SPA / SSR / SSG / Native)**을 추출해 라우팅·반응형 결정에 사용합니다.

### 0-5. design-tokens 존재 및 frontmatter 검증

```bash
test -f docs/design-tokens/design-tokens.md
```

없으면 다음 메시지를 출력하고 종료:

> ❌ `docs/design-tokens/design-tokens.md`를 찾을 수 없습니다. 화면별 명세의 UI 요소·공통 컴포넌트 매핑은 design-tokens의 variant 카탈로그를 참조해야 합니다. 먼저 `/mobiflow:spec-design-tokens`를 실행해주세요.

frontmatter의 `version` 필드를 추출합니다. frontmatter가 없거나 `version` 필드가 누락/형식 오류인 경우 다음 메시지를 출력하고 종료:

> ❌ `docs/design-tokens/design-tokens.md`의 frontmatter가 doc-guide 규격에 맞지 않습니다. (필수 필드 `title`, `version`, `updated` 확인) design-tokens를 먼저 수정해주세요.

추출한 버전을 `{DT_VERSION}`으로 보관하고, 본문에서 **§4 컴포넌트 스타일의 variant 목록**(버튼·카드·인풋·배지·내비게이션 등)과 **§8 반응형 breakpoint**를 추출해 §4 공통 컴포넌트 매핑·§6 반응형 적용 전략의 입력으로 사용합니다.

### 0-6. 기존 ui-design.md 선점 확인

```bash
test -f docs/ui-design/ui-design.md
```

`doc-guide.md`의 「문서 수명 주기」에 따라 파일 존재 + 태그 존재 조합으로 상태를 판별합니다:

```bash
test -f docs/ui-design/ui-design.md
VERSION=$(awk '/^version:/ {print $2; exit}' docs/ui-design/ui-design.md)
git tag --list "doc/ui-design/v${VERSION}" | grep -q . && echo "locked" || echo "working"
```

**파일 없음 → 신규 생성**: STEP 1로 진행해 v0.1.0 Working으로 작성

**파일 있음 + 태그 없음 (Working 상태)**:

> ℹ️ `docs/ui-design/ui-design.md`가 v{version} Working 상태입니다.
>
> 1. 이어서 편집 (현재 버전 유지, 섹션 갱신 또는 전체 재생성 가능)
> 2. 종료

- **1번**: 기존 문서를 컨텍스트로 읽어들여 STEP 1로 진행. 버전·CHANGELOG·INDEX는 변경하지 않음
- **2번**(또는 그 외 응답): 종료

**파일 있음 + 태그 있음 (Lock 상태)**: `doc-guide.md`의 「Lock 상태 수정 프로토콜」에 따라 진행:

> ⚠️ `docs/ui-design/ui-design.md` (v{기존버전})가 Lock 상태입니다.
>
> 1. 수정 (새 버전의 Working 진입 — 특정 섹션 갱신 또는 전체 재생성)
> 2. 종료

- **1번 선택**: Lock 상태 수정 프로토콜의 수정 모드로 진입
- **2번 선택**(또는 그 외 응답): 종료

전체 초기화가 필요하면 사용자가 수동으로 `rm -rf docs/ui-design/` 후 스킬을 재호출합니다.

---

## STEP 1: 문서 로드 & 요구사항 분석

### 1-1. PRD 분석

`docs/prd/prd.md`에서 다음 항목을 추출합니다:

- **핵심 기능 목록 (MVP 범위)** → 화면 후보 도출의 1차 소스
- **핵심 페르소나** → 타겟 사용자 특성·권한 계층·주 사용 디바이스
- **비기능 요구사항** → 반응형·접근성·오프라인 동작 수준 결정
- **진입 경로 전략에 영향을 주는 제약** (예: 이메일 인증 필수 / SSO 전용 / 비로그인 허용 범위)

### 1-2. user-journey 분석

`docs/user-journey/user-journey.md`에서 다음을 추출합니다:

- **주요 진입 경로** (랜딩 → 가입 → 첫 실행 등)
- **화면 전환 흐름 및 분기점** (성공/실패 경로)
- **페르소나별 핵심 액션 포인트** → 화면별 주요 CTA 결정
- **외부 서비스 연동 지점** (OAuth·결제·알림 등) → 화면 단계 표시

### 1-3. architecture 분석

`docs/architecture/architecture.md`에서 다음을 추출합니다:

- **플랫폼 타깃**: Web / React Native / Hybrid → 내비게이션 패턴 후보 제한
- **프론트엔드 런타임**: SPA / SSR / SSG / Native → 라우팅 구조, SEO·초기 로드 전략
- **인증 방식**: Session / JWT / OAuth → 라우트 가드 설계
- **외부 서비스 의존**: 결제·푸시·스토리지 → 특정 화면에서 필요한 권한·상태 표시

### 1-4. design-tokens 분석

`docs/design-tokens/design-tokens.md`에서 다음을 추출합니다:

- **§4 컴포넌트 스타일의 variant 이름 목록**: 버튼(Primary·Secondary·Ghost·Icon·Pill), 카드, 인풋 종류, 배지·필, 내비게이션, 이미지 트리트먼트 → §4 공통 컴포넌트 매핑의 **후보군**으로 사용. 이 카탈로그 밖의 신규 컴포넌트 제안은 최소화합니다
- **§8 반응형 동작의 breakpoint 표**: §6 반응형 적용 전략에서 상속
- **§7 권장 & 금지의 접근성·상태 규칙**: 화면별 상태 변화 기술 시 일관성 유지

---

## STEP 2: 조건부 대화형 인터뷰

PRD·user-journey·architecture·design-tokens로 **유추 가능한 것은 묻지 않습니다**. user-journey와 architecture가 필수 의존이 되어 대부분의 결정 축은 이미 자명하게 도출됩니다. 아래 조건을 먼저 평가해 **2개 이상 해당할 때에만 인터뷰에 진입**하고, 1개 이하면 인터뷰를 전면 스킵하고 추천 기본값으로 자동 결정합니다.

### 인터뷰 진입 조건 평가

다음 체크리스트 중 몇 개가 해당하는지 세어봅니다. user-journey와 architecture가 충실하면 대부분의 항목이 자명하게 해소되어야 합니다.

- [ ] **내비게이션 패턴**이 architecture(플랫폼)와 PRD(기능 범위)로부터 자명하게 도출되지 않는다
- [ ] **보조 플로우 표현(모달 vs 페이지 vs 드로어)**이 user-journey 흐름만으로 결정되지 않는다
- [ ] **빈 상태·에러 상태 톤**이 design-tokens 분위기만으로 충분히 결정되지 않는다
- [ ] **진입 경로 전략(마케팅 랜딩 / 로그인 직진 / 온보딩 튜토리얼)**이 PRD·user-journey 어디에서도 명시되지 않았다
- [ ] **화면 밀도(콤팩트 / 안락 / 여유)**가 페르소나 사용 맥락으로 충분히 추론되지 않는다

**2개 이상 해당** → 아래 인터뷰 로직으로 진입
**1개 이하** → 인터뷰 스킵, §8 UI 결정 로그에 `(자동 선택)` 표기하여 STEP 3로 바로 진행

### 인터뷰 규약

인터뷰의 앵커 패턴·정지 조건·위임 처리·직접 입력 처리는 `doc-guide.md`의 「인터뷰 상한 규약」을 따른다. 이 스킬은 **Standard 티어(권장 4 / 강제 6)**로 분류된다. 단, 위 진입 조건에서 체크된 축만 질문하며 이미 결정된 축은 묻지 않는다.

### 추천 선정 우선순위

1. **PRD 핵심 기능·페르소나 적합도** — 주 사용 맥락에서 가장 자연스러운가
2. **architecture 플랫폼 제약** — 플랫폼·프론트엔드 런타임과 마찰이 없는가
3. **design-tokens 분위기 일관성** — 토큰에서 정의된 톤과 충돌하지 않는가
4. **구현 복잡도** — MVP 단계에서 과도하지 않은가

### 주요 결정 축 (고정 순서)

체크리스트에서 해당된 축만 아래 순서로 질문한다. 질문은 `doc-guide.md`의 「전문성 중립 질문」 원칙을 따른다.

1. **1차 내비게이션 패턴** — "사용자가 주요 기능 사이를 어떻게 이동하면 자연스러운가요? 화면 아래 탭? 왼쪽 사이드바? 상단 메뉴?" (전문: "하단 탭바 + 스택 네비게이터", 비즈니스: "인스타그램처럼 아래 탭이 있으면 좋겠어요")
2. **진입 경로 전략** — "사용자가 서비스를 처음 만나면 바로 로그인 화면이 나오나요, 소개 페이지가 먼저인가요, 사용법 안내가 필요한가요?" (전문: "마케팅 랜딩 + 온보딩 3스텝", 비즈니스: "가입 전에 어떤 서비스인지 보여주고 싶어요")
3. **보조 플로우 표현** — "설정 변경이나 상세 입력 같은 부가 작업을 할 때, 현재 화면 위에 팝업으로 띄울까요, 새 화면으로 이동할까요?" (전문: "bottom sheet 우선, 복잡한 폼은 full page", 비즈니스: "간단한 건 팝업, 복잡한 건 새 화면이 좋을 것 같아요")
4. **화면 밀도** — "한 화면에 정보를 빽빽하게 채울까요, 여유 있게 배치할까요? 대시보드형? 매거진형?" (전문: "콤팩트, 데이터 밀도 높음", 비즈니스: "깔끔하고 여유 있는 게 좋아요")
5. **빈·에러 상태 톤** — "데이터가 없거나 오류가 났을 때 어떤 느낌으로 안내할까요? 귀여운 일러스트? 간단한 아이콘과 한 줄? 텍스트만?" (전문: "일러스트 + CTA 버튼", 비즈니스: "너무 딱딱하지 않으면 좋겠어요")

내비게이션 패턴이 이후 화면별 레이아웃의 기준이 되므로 반드시 먼저 결정한다.

---

## STEP 3: UI 설계 문서 저장 (doc-guide.md 규약 준수)

인터뷰가 끝나면(또는 스킵됐으면) 초안을 출력하거나 승인을 요청하지 않고 즉시 저장합니다.

### 3-1. 디렉토리 생성

```bash
mkdir -p docs/ui-design
```

### 3-2. `docs/ui-design/ui-design.md` 작성

파일 최상단에 frontmatter를 포함합니다:

```yaml
---
title: {PROJECT_NAME} UI Design
version: 0.1.0
based_on:
  - prd@{PRD_VERSION}
  - user-journey@{UJ_VERSION}
  - architecture@{ARCH_VERSION}
  - design-tokens@{DT_VERSION}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---
```

`prd@`, `user-journey@`, `architecture@`, `design-tokens@`는 모두 필수이므로 항상 포함합니다.

`{PROJECT_NAME}`은 PRD의 `title` 필드에서 ` PRD` 접미사를 제거해 추출합니다. 추출이 모호하면 `basename "$PWD"`를 사용합니다.

**필수 섹션:**

```
## 1. 화면 목록 & 사이트맵
## 2. 내비게이션 & 라우팅
## 3. 화면별 명세
## 4. 공통 컴포넌트 매핑
## 5. 상태·피드백 패턴
## 6. 반응형 적용 전략
## 7. 제외 범위 (Out of Scope)
## 8. UI 결정 로그
```

#### 1. 화면 목록 & 사이트맵

전체 화면 목록과 계층 구조를 정리합니다. 사이트맵 트리 + 화면 표 두 가지를 모두 포함합니다.

```
{서비스명}
├── 공개 영역
│   ├── 랜딩 페이지 (SCR-001)
│   ├── 로그인 (SCR-002)
│   └── ...
├── 인증 영역
│   ├── 홈 대시보드 (SCR-010)
│   └── ...
└── 관리 영역 (해당 시)
    └── ...
```

| 화면 ID | 화면명 | 경로 | 목적 | 권한      | 주 페르소나 |
| ------- | ------ | ---- | ---- | --------- | ----------- |
| SCR-001 | ...    | /... | ...  | 공개/인증/관리 | ...         |

#### 2. 내비게이션 & 라우팅

- **1차 내비게이션 패턴**: {인터뷰 결과 또는 자동 선택값 — 예: "하단 탭바 (모바일) / 좌측 사이드바 (데스크탑)"}
- **라우트 계층**: 공개/인증/관리 영역별 라우트 구조
- **인증 가드**: {어느 라우트에서 로그인 체크, 미인증 시 리다이렉트 경로}
- **딥링크 정책**: {알림·이메일에서 진입 시 보존할 상태}

#### 3. 화면별 명세

각 화면에 대해 아래 구조로 작성합니다.

##### {화면 ID} - {화면명}

**목적:** {이 화면의 역할 한 줄}

**레이아웃:**

- 헤더: {구성 요소}
- 본문: {구성 요소 및 배치}
- 푸터/액션: {구성 요소}

**주요 UI 요소:**

- {요소명}: {역할 및 동작}

  > 요소명은 `design-tokens.md §4`의 variant 이름으로 참조합니다. 예: "저장하기 - **Primary 버튼**", "취소 - **Ghost 버튼**", "사용자 카드 - **Card 컨테이너**".

**상태 변화:**

- 로딩: {표시 방식}
- 빈 상태: {표시 방식}
- 에러: {표시 방식}
- 성공/완료: {표시 방식 — 필요 시}

#### 4. 공통 컴포넌트 매핑

화면 목록에서 **재사용되는 컴포넌트**를 `design-tokens.md §4`의 variant에 매핑합니다.

| 컴포넌트명 | 유형      | design-tokens variant   | 사용 화면        | 비고 |
| ---------- | --------- | ----------------------- | ---------------- | ---- |
| ...        | 공통/전용 | Primary 버튼 / Card 등  | SCR-001, SCR-002 | ...  |

**공통 컴포넌트 상세:**

- {컴포넌트명}: {Props 및 동작 설명. 예: 아이템 카드는 썸네일·제목·부제·액션 영역으로 구성}

**신규 후보 (토큰 카탈로그 밖):**

design-tokens에 정의되지 않았지만 이 UI 설계에서 필요한 컴포넌트를 별도로 분리해 기록합니다. 이 목록은 향후 `spec-design-tokens` 재실행 시 §4에 승격 후보입니다.

- {신규 컴포넌트명}: {필요한 이유 및 사용 화면}

#### 5. 상태·피드백 패턴

공통 상태 표현 규칙을 정의합니다. 화면별 차이는 §3에서 다루고, 여기서는 **전역 규칙**만 서술합니다.

- **로딩 상태**: {스켈레톤 / 스피너 / 프로그레스 바 — 기본 선택과 사용 기준}
- **빈 상태**: {톤 — 인터뷰 결과 또는 자동 선택값 반영}
- **에러 상태**: {인라인 메시지 / 풀페이지 / 토스트 — 선택 기준}
- **성공 피드백**: {토스트 / 인라인 체크 / 페이지 전환}
- **네트워크 오프라인**: {표시 방식 — architecture의 오프라인 정책 반영}

#### 6. 반응형 적용 전략

breakpoint 표는 `design-tokens.md §8 반응형 동작`을 상속하고, 여기서는 **화면 설계에서 공통으로 적용할 규칙**만 기술합니다.

- **Breakpoint**: {design-tokens §8에서 상속}
- **모바일 우선 여부**: {Yes / No — 근거 1문장}
- **공통 축소 전략**:
  - 내비게이션: {데스크탑 → 모바일 변화 방식}
  - 그리드: {컬럼 축소 방식}
  - 섹션 간격: {축소 규칙}
- **화면별 반응형 차이**: {§3에서 다룸 — 여기는 공통 규칙만}

#### 7. 제외 범위 (Out of Scope)

이 문서가 **다루지 않는** 항목을 명시합니다. 후속 스킬과의 경계를 분명히 하기 위함입니다.

- 색상·타이포·컴포넌트 스타일 토큰 정의 (spec-design-tokens에서 다룸)
- 실제 아이콘 세트 선정·일러스트 가이드
- 마이크로 인터랙션 타이밍·모션 디자인 규칙
- DB 엔티티·필드 설계 (spec-db-design에서 다룸)
- API 엔드포인트·요청/응답 스키마 (spec-api-design에서 다룸)
- 이메일·푸시 알림 템플릿
- A/B 테스트·실험 설계

#### 8. UI 결정 로그

`doc-guide.md`의 「결정 로그 규약」을 따른다. 이 스킬에서 기록할 주요 결정 축 예시:

- 1차 내비게이션 패턴, 진입 경로 전략, 보조 플로우 표현(모달/페이지/드로어), 화면 밀도, 빈·에러 상태 톤

STEP 2 인터뷰에서 결정된 축과 PRD·user-journey·architecture·design-tokens에서 자명하게 도출된 축을 모두 기록한다. 자동 도출 항목은 `근거` 컬럼 끝에 `(자동 선택)` 표기를 붙인다.

### 3-3. `docs/ui-design/CHANGELOG.md` 작성

```markdown
# UI Design Changelog

## 0.1.0 ({YYYY-MM-DD})

- 초안 작성
```

### 3-4. `docs/INDEX.md` 갱신

파일이 없으면 생성하고, 있으면 ui-design 행을 추가/갱신합니다:

```markdown
# Documentation Index

| 문서      | 경로                                         | 버전  | 설명                       |
| --------- | -------------------------------------------- | ----- | -------------------------- |
| UI Design | [ui-design/ui-design.md](ui-design/ui-design.md) | 0.1.0 | 화면 목록·사이트맵·화면별 명세 |
```

기존 INDEX.md가 있으면 PRD·architecture·design-tokens 등 다른 행은 보존하고 ui-design 행만 추가합니다.

---

## STEP 4: 완료 보고 및 Lifecycle 결정

모든 파일 생성을 마친 뒤 아래 형식으로 완료 요약을 표시한 다음, `doc-guide.md`의 「작성 완료 Lifecycle 프롬프트」 절차를 수행합니다.

```
✅ mobiflow ui-design v0.1.0 작성 완료

  문서:               docs/ui-design/ui-design.md
  기준 PRD:           docs/prd/prd.md (v{PRD_VERSION})
  기준 User Journey:  docs/user-journey/user-journey.md (v{UJ_VERSION})
  기준 Architecture:  docs/architecture/architecture.md (v{ARCH_VERSION})
  기준 Design Tokens: docs/design-tokens/design-tokens.md (v{DT_VERSION})
  CHANGELOG:          docs/ui-design/CHANGELOG.md 갱신
  INDEX:              docs/INDEX.md 갱신

다음 스킬 후보: mobiflow:spec-db-design
```

요약 직후 「작성 완료 Lifecycle 프롬프트」의 3-way 선택(Lock / Working 유지 종료 / 추가 편집)을 제시하고, 사용자 선택에 따라 해당 절차를 그대로 따릅니다.

---

## 주의사항

- 기존 파일의 상태(Working/Lock)에 따라 STEP 0 동작이 분기됩니다. Lock 상태 수정은 `doc-guide.md`의 「Lock 상태 수정 프로토콜」, Working 편집은 「Working 상태 편집 규칙」을 따릅니다. 초기화가 필요하면 수동으로 `rm -rf docs/<category>/` 후 재호출합니다.
- 저장 경로는 `docs/ui-design/ui-design.md`로 고정됩니다.
- 최초 버전은 항상 `0.1.0`으로 시작합니다.
- Lock(commit + tag)은 `/mobiflow:spec-lock` 스킬이 담당합니다. 본 스킬은 직접 수행하지 않습니다.
- 인터뷰는 **필요 시에만** 진행합니다. PRD·user-journey·architecture·design-tokens에서 자명하게 도출되는 결정은 인터뷰 없이 자동 결정하고 §8 결정 로그에 `(자동 선택)` 표기를 남깁니다.

---

## 언어/톤

한국어. 화면 ID(`SCR-001` 등)와 컴포넌트명은 영문 사용. 설계 결정의 근거는 논리적·간결하게. 화면별 명세는 개발자가 바로 구현에 착수할 수 있도록 레이아웃·요소·상태를 구체적으로 기술합니다.

**기억하세요:** 당신은 단순한 화면 목록 생성기가 아니라 제품의 전체 사용자 경험을 책임질 UI 리드입니다. 트렌디한 패턴을 추천하기보다 이 제품의 페르소나와 플랫폼 제약에 가장 잘 맞는 현실적인 화면 구성을 끌어내십시오.
