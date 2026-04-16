# Documentation Management Guide

이 가이드는 `docs/` 디렉토리 내 설계 문서를 버전 관리하기 위한 규칙을 정의한다.
문서를 생성하거나 수정하는 모든 에이전트와 사람은 이 가이드를 따른다.

---

## 디렉토리 구조

```
docs/
├── INDEX.md                        # 문서 목록 및 현재 버전 요약
├── prd/
│   ├── prd.md                      # 최신본 (항상 현재 버전)
│   └── CHANGELOG.md                # 버전별 변경 요약
├── api-design/
│   ├── api-design.md
│   └── CHANGELOG.md
├── db-design/
│   ├── db-design.md
│   └── CHANGELOG.md
└── ...
```

### 규칙

- 문서 카테고리 하나당 하나의 디렉토리를 만든다.
- 디렉토리 이름은 kebab-case를 사용한다.
- 디렉토리 안에는 반드시 `<카테고리명>.md`, `CHANGELOG.md`를 포함한다.
- 카테고리명은 canonical form(표준 형태, 예: `db-design`, `ui-design`)을 따른다. 프로젝트 특성상 canonical form이 직접 적용되지 않는 경우 문서 내용은 재해석된 의미로 작성할 수 있으나, 파일명과 디렉토리명은 바꾸지 않는다. 재해석 시 문서 최상단에 `## 0. 범위 선언` 섹션을 두어 독자가 선입견 없이 읽도록 안내한다.

---

## Frontmatter 규격

모든 문서의 최상단에 YAML frontmatter를 작성한다.

```yaml
---
title: Payment API Design
version: 2.4.0
created: 2026-03-01
updated: 2026-04-15
---
```

### 필수 필드

| 필드      | 설명                       |
| --------- | -------------------------- |
| `title`   | 문서 제목                  |
| `version` | 현재 문서 버전 (semver)    |
| `updated` | 마지막 수정일 (YYYY-MM-DD) |

### 선택 필드

| 필드       | 설명                                       |
| ---------- | ------------------------------------------ |
| `created`  | 최초 작성일                                |
| `based_on` | 의존하는 다른 문서의 카테고리와 버전 (배열) |

`based_on`은 문서 간 의존 관계를 추적하기 위한 필드다. 형식은 `<카테고리>@<버전>` 문자열의 배열을 사용한다. 예시:

```yaml
based_on:
  - prd@0.1.0
  - architecture@0.2.0
```

의존 문서가 갱신되면 이 필드를 함께 올린다. 의존이 없는 문서(예: PRD)는 필드를 생략한다.

---

## 버전 번호 규칙

Semantic Versioning을 따른다: `MAJOR.MINOR.PATCH`

| 변경 수준                | 버전       | 예시          |
| ------------------------ | ---------- | ------------- |
| 구조 변경, 대규모 재작성 | MAJOR 증가 | 1.x.x → 2.0.0 |
| 섹션 추가, 항목 변경     | MINOR 증가 | 2.3.x → 2.4.0 |
| 오타 수정, 문구 다듬기   | PATCH 증가 | 2.4.0 → 2.4.1 |

---

## 문서 생성 절차

### 1. 디렉토리 및 파일 생성

```bash
mkdir -p docs/api-design
```

`docs/api-design/api-design.md` 파일을 생성하고, frontmatter를 작성한다:

```yaml
---
title: API Design
version: 0.1.0
created: 2026-04-15
updated: 2026-04-15
---
```

### 2. CHANGELOG.md 생성

```markdown
# API Design Changelog

## 0.1.0 (2026-04-15)

- 초안 작성
```

### 3. INDEX.md 업데이트

`docs/INDEX.md`에 새 문서 항목을 추가한다.

### 4. Git commit 및 tag

```bash
git add docs/api-design/
git commit -m "docs(api-design): v0.1.0 - 초안 작성"
git tag doc/api-design/v0.1.0 -m "초안 작성"
```

---

## 문서 수정 절차

### 1. 문서 내용 수정

본문을 수정한다.

### 2. Frontmatter 업데이트

- `version`을 변경 수준에 맞게 올린다.
- `updated`를 오늘 날짜로 변경한다.

### 3. CHANGELOG.md 업데이트 (MAJOR/MINOR 변경만)

PATCH 변경(오타, 포맷팅, 문구 다듬기)은 CHANGELOG에 기록하지 않는다. MAJOR 또는 MINOR 변경인 경우에만 CHANGELOG.md 최상단(`# 제목` 바로 아래)에 새 항목을 추가한다:

```markdown
## 2.4.0 (2026-04-15)

- 웹소켓 실시간 알림 엔드포인트 추가
- 인증 토큰 갱신 플로우 변경
```

### 4. INDEX.md 업데이트

`docs/INDEX.md`에서 해당 문서의 버전 번호와 상태를 갱신한다.

### 5. Git commit 및 tag

```bash
git add docs/api-design/
git commit -m "docs(api-design): v2.4.0 - 웹소켓 알림 엔드포인트 추가"
git tag doc/api-design/v2.4.0 -m "웹소켓 알림 엔드포인트 추가"
```

---

## Git 컨벤션

### Commit message 형식

```
docs(<카테고리>): v<버전> - <변경 요약>
```

예시:

```
docs(prd): v1.2.11 - 결제 수단 추가 요구사항 반영
docs(api-design): v2.4.0 - 웹소켓 알림 엔드포인트 추가
docs(db-design): v1.0.0 - 초기 스키마 확정
```

### Tag 형식

```
doc/<카테고리>/v<버전>
```

예시:

```
doc/prd/v1.2.11
doc/api-design/v2.4.0
doc/db-design/v1.0.0
```

### 주의사항

- 코드의 릴리스 태그(`v1.0.0`)와 문서 태그(`doc/*/v*`)는 prefix로 구분된다.
- 태그는 반드시 commit과 동시에 생성한다. 나중에 따로 찍지 않는다.
- PATCH 변경(오타, 포맷팅)도 태그를 찍는다. 태그 없는 문서 변경은 허용하지 않는다.

---

## CHANGELOG.md 작성 규칙

### 형식

```markdown
# <문서 제목> Changelog

## <버전> (<날짜>)

- 변경 내용 1
- 변경 내용 2

## <이전 버전> (<날짜>)

- 변경 내용
```

### 규칙

- MAJOR, MINOR 변경만 기록한다. PATCH 변경(오타, 포맷팅, 문구 다듬기)은 기록하지 않는다.
- 최신 버전이 파일 상단에 위치한다 (역순).
- 각 항목은 한 줄로 요약한다. 상세 내용은 본문 문서를 참조한다.
- git commit message와 동일한 내용을 쓰되, CHANGELOG에는 여러 항목을 나열할 수 있다. commit message는 대표 항목 하나만 쓴다.

---

## INDEX.md 작성 규칙

`docs/INDEX.md`는 에이전트가 문서를 탐색하는 진입점이다.

### 형식

```markdown
# Documentation Index

| 문서       | 경로                                                 | 버전   | 설명                     |
| ---------- | ---------------------------------------------------- | ------ | ------------------------ |
| PRD        | [prd/prd.md](prd/prd.md)                             | 1.2.11 | 제품 요구사항 정의서     |
| API Design | [api-design/api-design.md](api-design/api-design.md) | 2.4.0  | REST API 명세            |
| DB Design  | [db-design/db-design.md](db-design/db-design.md)     | 1.0.0  | 데이터베이스 스키마 설계 |
```

### 규칙

- 문서가 추가, 삭제, 버전 변경될 때마다 INDEX.md를 함께 갱신한다.
- 경로는 `docs/` 기준 상대 경로를 사용한다.

---

## 특정 버전 조회 방법

### 최신 버전 확인

파일을 직접 읽는다:

```bash
cat docs/api-design/api-design.md
```

### 특정 과거 버전 확인

Git tag를 사용한다:

```bash
git show doc/api-design/v2.3.1:docs/api-design/api-design.md
```

### 두 버전 간 차이 확인

```bash
git diff doc/api-design/v2.3.1 doc/api-design/v2.4.0 -- docs/api-design/api-design.md
```

### 변경 이력 요약 확인

```bash
cat docs/api-design/CHANGELOG.md
```

---

## 체크리스트

문서를 생성하거나 수정할 때, 아래 항목을 모두 확인한다:

- [ ] frontmatter의 `version`이 변경 수준에 맞게 올라갔는가?
- [ ] frontmatter의 `updated`가 오늘 날짜인가?
- [ ] MAJOR/MINOR 변경인 경우 CHANGELOG.md에 변경 항목이 추가되었는가?
- [ ] INDEX.md의 버전이 갱신되었는가?
- [ ] commit message가 `docs(<카테고리>): v<버전> - <요약>` 형식인가?
- [ ] `doc/<카테고리>/v<버전>` 태그가 생성되었는가?
