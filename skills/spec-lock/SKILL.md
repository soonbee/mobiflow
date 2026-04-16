---
name: spec-lock
description: Working 상태 spec 문서를 스캔해 일괄 또는 선택적으로 commit + tag로 Lock하는 유틸리티 스킬. 사용자가 "/nidost:spec-lock", "문서 확정", "문서 Lock", "버전 확정", "커밋 + 태그"를 언급할 때 반드시 트리거하세요.
---

# spec-lock

Working 상태인 spec 문서들을 스캔해 **Lock**으로 전환합니다. 이 스킬은 `git commit` + `git tag doc/<카테고리>/v<버전>`를 수행하는 유틸리티입니다. 문서 작성·수정 로직은 포함하지 않으며, 오직 버전 확정(Lock)만 담당합니다.

기본 동작은 **전체 스캔 모드**(인자 없이 호출)로, `docs/`의 모든 spec 문서를 자동으로 파악해 Working 상태인 것들을 리스트로 보여주고 사용자가 한 번에 선택할 수 있게 합니다. 인자로 특정 카테고리를 지정하면 **단일 모드**로 동작합니다.

상세한 수명 주기·프로토콜은 `docs/doc-guide.md`의 「문서 수명 주기」, 「Working 상태 편집 규칙」을 참조하세요.

---

## 지원 카테고리

`prd`, `user-journey`, `architecture`, `design-tokens`, `ui-design`, `db-design`, `api-design`

---

## STEP 0: 사전 체크

### 0-1. doc-guide.md 존재 확인

```bash
test -f docs/doc-guide.md
```

없으면:

> ❌ `docs/doc-guide.md`를 찾을 수 없습니다. 먼저 `/nidost:init`으로 프로젝트를 부트스트랩해주세요.

### 0-2. git 저장소 확인

```bash
git rev-parse --is-inside-work-tree
```

실패하면:

> ❌ 현재 디렉토리가 git 저장소가 아닙니다. Lock은 git commit + tag 작업을 포함하므로 저장소 내에서만 동작합니다.

---

## STEP 1: 모드 결정

### 1-1. 인자 확인

사용자가 카테고리를 인자로 제공했는지 확인합니다.

- **인자 있음 (예: `/nidost:spec-lock prd`)** → 단일 모드로 STEP 2A 진입. 인자가 지원 카테고리 외 값이면 에러 후 종료.
- **인자 없음 (예: `/nidost:spec-lock`)** → 전체 스캔 모드로 STEP 2B 진입.

---

## STEP 2A: 단일 모드 (인자로 카테고리 지정된 경우)

지정된 카테고리 하나만 Lock 대상으로 간주합니다.

### 2A-1. 상태 검사

아래 검사를 순서대로 수행해 상태를 판별합니다:

```bash
test -f docs/{CATEGORY}/{CATEGORY}.md
VERSION=$(awk '/^version:/ {print $2; exit}' docs/{CATEGORY}/{CATEGORY}.md)
git tag --list "doc/{CATEGORY}/v${VERSION}" | grep -q .
```

- **파일 없음** → 종료:
  > ❌ `docs/{CATEGORY}/{CATEGORY}.md`를 찾을 수 없습니다. 먼저 `/nidost:spec-{CATEGORY}` 스킬을 실행해 문서를 생성해주세요.
- **frontmatter 손상** → 종료:
  > ❌ `docs/{CATEGORY}/{CATEGORY}.md`의 frontmatter가 doc-guide 규격에 맞지 않습니다. (필수 필드 `title`, `version`, `updated` 확인)
- **태그 이미 존재 (Lock 상태)** → 종료:
  > ℹ️ `docs/{CATEGORY}/{CATEGORY}.md` v{VERSION}은 이미 Lock 상태입니다. 새 변경이 있다면 spec-{CATEGORY} 스킬로 새 버전 Working에 진입하거나, 파일의 version을 PATCH로 올린 뒤 다시 실행하세요.
- **Working 상태 확인됨** → 대상 리스트 `[{CATEGORY}@{VERSION}]`로 STEP 3로 진입

---

## STEP 2B: 전체 스캔 모드 (인자 없음)

### 2B-1. 전 카테고리 상태 스캔

7개 카테고리를 순회하며 각각의 상태를 판별합니다:

```bash
for CAT in prd user-journey architecture design-tokens ui-design db-design api-design; do
  if [ -f "docs/${CAT}/${CAT}.md" ]; then
    VERSION=$(awk '/^version:/ {print $2; exit}' "docs/${CAT}/${CAT}.md")
    if [ -n "$VERSION" ]; then
      if git tag --list "doc/${CAT}/v${VERSION}" | grep -q .; then
        echo "${CAT}@${VERSION} locked"
      else
        echo "${CAT}@${VERSION} working"
      fi
    else
      echo "${CAT} frontmatter-broken"
    fi
  else
    echo "${CAT} missing"
  fi
done
```

각 카테고리를 세 범주로 분류:

- **Working**: Lock 대상
- **Locked**: 정보 표시만
- **Missing / Broken**: 정보 표시만, Lock 대상 아님

### 2B-2. 스캔 결과 요약 표시

사용자에게 전체 상태를 보여줍니다:

```
📋 spec 문서 상태 스캔 결과

Working (Lock 가능):
  1. prd                v0.1.0
  2. user-journey       v0.1.0
  3. architecture       v0.2.0

Locked:
  - (없음)

미작성:
  - design-tokens, ui-design, db-design, api-design

Frontmatter 손상:
  - (없음)
```

Working 리스트가 **비어 있으면** 종료:

> ℹ️ Lock할 문서가 없습니다. 모든 spec 문서가 이미 Lock 상태이거나 아직 작성되지 않았습니다.

### 2B-3. 사용자 선택

Working 리스트가 있으면 아래 선택지를 제시합니다:

```
어떻게 진행하시겠어요?

1. 모두 Lock (Working 문서 전부를 순서대로 처리)
2. 선택 Lock (번호로 선택, 예: "1,3")
3. 하나씩 확인 (각 문서마다 yes/no 확인)
4. 종료
```

- **1번**: Working 전체를 대상 리스트로
- **2번**: 사용자 입력 파싱 (쉼표로 구분된 번호 또는 범위) → 해당 항목들만 대상 리스트로
- **3번**: Working 전체를 대상 후보로 하되, STEP 3에서 각각 확인 플래그 ON
- **4번**(또는 그 외): 종료

---

## STEP 3: Lock 루프 수행

대상 리스트(`[{CATEGORY}@{VERSION}, ...]`)를 순서대로 처리합니다. 처리 순서는 의존 그래프를 따르는 아래 고정 순서를 사용합니다 (상위 문서가 먼저 Lock되도록):

```
prd → user-journey → architecture → design-tokens → db-design → api-design → ui-design
```

대상 리스트에 없는 카테고리는 건너뜁니다. STEP 2B-3에서 "3. 하나씩 확인"을 선택한 경우 각 항목마다 STEP 3-2의 확인 프롬프트에서 진행 여부를 물어봅니다.

### 3-1. 개별 문서 Lock 처리 (루프 내부)

각 `{CATEGORY}@{VERSION}` 항목에 대해 다음을 수행합니다:

#### 3-1-1. CHANGELOG·INDEX 무결성 확인

```bash
test -f docs/{CATEGORY}/CHANGELOG.md
grep -q "^## {VERSION}" docs/{CATEGORY}/CHANGELOG.md
grep -qE "\| *{VERSION}" docs/INDEX.md
```

누락 또는 불일치 시 경고 후 사용자 판단에 맡깁니다:

> ⚠️ {CATEGORY}의 CHANGELOG.md 또는 INDEX.md에 v{VERSION} 항목이 누락되었거나 버전이 일치하지 않습니다.
>
> 1. 그래도 Lock 진행
> 2. 이 문서는 건너뛰기 (다음 대상으로)
> 3. 전체 중단

#### 3-1-2. 변경 diff 표시

```bash
git diff --stat docs/{CATEGORY}/ docs/INDEX.md
```

변경 사항이 없으면 "이미 커밋됨, 태그만 추가" 메모. 있으면 diff 요약 표시.

#### 3-1-3. 커밋 메시지 생성

커밋 메시지는 Subject·Body 모두 **영어**로 작성합니다. CHANGELOG 파일의 원본 언어(통상 한국어)는 유지되며, 커밋 시점에만 번역을 수행합니다.

1. **CHANGELOG 블록 추출**: CHANGELOG.md의 `## {VERSION}` 블록 본문을 추출합니다 (제목 라인 제외, 블록 끝의 공백 라인은 트림). 이 블록은 Subject·Body 생성의 원재료입니다:

   ```bash
   awk -v ver="{VERSION}" '
     /^## / {
       if (in_block) exit
       in_block = ($0 ~ "^## " ver "([^0-9.]|$)")
       next
     }
     in_block { print }
   ' docs/{CATEGORY}/CHANGELOG.md
   ```

2. **Subject 생성**: 추출된 블록을 읽고, **영어 imperative 형태의 짧은 subject**를 직접 생성합니다. 규칙:
   - Conventional Commits 스타일 (동사 원형으로 시작, 소문자, 마침표 없음)
   - 50자 이내 권장
   - 여러 불릿이면 대표 변경 하나로 요약하거나 상위 개념으로 묶기
   - 버전 문자열을 subject에 포함하지 않음 (태그에 이미 인코딩됨)

   예시:
   - `- 초안 작성` → `draft initial version`
   - `- 성능 지표 섹션 추가` → `add performance metrics section`
   - `- 오타 수정, 문구 다듬기` → `fix typos and polish wording`
   - `- Breaking: 데이터 모델 재설계` → `redesign data model` (breaking change는 `!` 접미사 사용: `docs(prd)!: redesign data model`)

3. **Body 생성**: 추출된 블록의 **각 불릿을 영어로 번역**해 Body를 구성합니다. 원본의 불릿 구조(순서·들여쓰기·섹션 소제목)는 그대로 유지하고 내용만 영어로 옮깁니다. **CHANGELOG.md 파일 자체는 수정하지 않습니다** — 원본 언어 유지.

   예시 (원본 CHANGELOG 블록 → Body):

   원본:
   ```
   - 초안 작성
   - 페르소나 2종 정의
   ```

   Body:
   ```
   - draft initial content
   - define two personas
   ```

4. **Fallback**: CHANGELOG 블록이 비어있거나 추출 실패 시
   - Subject: `lock v{VERSION}`
   - Body: (생략)

5. **최종 메시지 구조**:
   ```
   docs({CATEGORY}): {SUBJECT}

   {BODY}
   ```

#### 3-1-4. 확인 (선택 모드에 따라)

- **일괄 모드 (STEP 2B-3의 1/2번)**: 확인 없이 진행. 다만 최초 1회에 한해 전체 요약 프롬프트:

  ```
  아래 순서로 Lock을 진행합니다:
    - prd@0.1.0 → "docs(prd): draft initial version"
    - user-journey@0.1.0 → "docs(user-journey): draft user journey"
    - architecture@0.2.0 → "docs(architecture): add auxiliary components"

  1. 진행
  2. 종료
  ```

- **개별 확인 모드 (STEP 2B-3의 3번 또는 STEP 2A 단일 모드)**: 각 항목마다 확인:

  ```
  {CATEGORY}@{VERSION} Lock 준비됨
    Subject: docs({CATEGORY}): {SUBJECT}
    Body:    (CHANGELOG v{VERSION} 블록 본문, N줄)
    Tag:     doc/{CATEGORY}/v{VERSION} (annotated; 커밋 메시지와 동일)

  1. 진행
  2. Subject 수정 (자유 입력, 영어 imperative 권장)
  3. 건너뛰기
  4. 전체 중단
  ```

#### 3-1-5. 커밋 + 태그 수행

Body가 있는 경우:

```bash
git add docs/{CATEGORY}/ docs/INDEX.md
git commit -m "docs({CATEGORY}): {SUBJECT}" -m "{BODY}"
git tag -a doc/{CATEGORY}/v{VERSION} -m "docs({CATEGORY}): {SUBJECT}" -m "{BODY}"
```

Body가 없는 경우 (fallback):

```bash
git add docs/{CATEGORY}/ docs/INDEX.md
git commit -m "docs({CATEGORY}): lock v{VERSION}"
git tag -a doc/{CATEGORY}/v{VERSION} -m "docs({CATEGORY}): lock v{VERSION}"
```

커밋할 변경이 없으면 `git commit`은 건너뛰고 tag만 수행.

#### 3-1-6. 실패 처리

commit/tag 명령이 실패하면 현재 항목을 실패 리스트에 기록하고, 사용자에게 계속할지 묻습니다:

```
⚠️ {CATEGORY}@{VERSION} Lock 실패: {error message}

1. 다음 문서로 계속
2. 전체 중단
```

### 3-2. 루프 진행 표시

각 항목 처리 후 진행 상황 표시:

```
[2/3] user-journey@0.1.0 Lock 완료 ✓
```

---

## STEP 4: 완료 보고

```
✅ nidost spec-lock 완료

  처리 결과:
    Lock 완료 (N개):
      - prd@0.1.0 → doc/prd/v0.1.0 ({commit hash})
      - user-journey@0.1.0 → doc/user-journey/v0.1.0 ({commit hash})
      - architecture@0.2.0 → doc/architecture/v0.2.0 ({commit hash})

    건너뜀 (M개):
      - (없음)

    실패 (K개):
      - (없음)

다음 단계:
  - 원격 push가 필요하면: git push && git push --tags
  - 다음 스킬: {남은 미작성 카테고리 기반 추천, 예: nidost:spec-design-tokens}
```

### 다음 스킬 제안 규칙

Lock 완료된 문서들과 의존 그래프를 비교해, 지금 시작 가능한 스킬을 제안합니다:

- 필수 의존이 모두 Lock 상태이면서 아직 작성되지 않은 카테고리 → 시작 가능
- 우선순위: 체인 순서 (user-journey → architecture → design-tokens → ui-design → db-design → api-design)
- 여러 개 가능하면 최상위 하나만 표시하고 "외 N개 병렬 가능" 안내

---

## 주의사항

- 이 스킬은 **Lock만 담당**합니다. 문서 내용 생성·수정은 각 spec 스킬에서 수행하세요.
- 이미 Lock된 버전에는 재실행되지 않습니다 (태그 중복 금지). PATCH 변경은 version을 PATCH 증가시킨 뒤 다시 호출.
- 원격 저장소 push는 수행하지 않습니다. 사용자가 필요할 때 수동으로 push.
- CHANGELOG·INDEX가 누락·불일치 상태면 경고 후 사용자 판단에 맡깁니다. 스킬이 대신 작성하지 않습니다 (책임 경계).
- git 작업 디렉토리의 다른 경로(docs 외)는 건드리지 않습니다. `git add`는 대상 카테고리 경로와 INDEX.md만 수행.
- 일괄 모드에서 중간 실패 시 부분 완료 상태로 종료 가능. 완료 보고에서 성공/실패/건너뜀을 분리해 표시.

---

## 언어/톤

한국어. 짧고 명확하게. 에러·경고 메시지는 원인과 복구 방법을 함께 표시합니다. 일괄 처리 중에는 진행 상황(`[N/M]`)을 실시간으로 보여 사용자가 전체 흐름을 파악할 수 있게 합니다.
