---
name: compile-project-config
description: docs/ 스펙 문서(architecture·ui-design 등)와 디스크 상태에서 docs/project.config.yaml을 컴파일하는 단방향 컴파일러 스킬. 사용자가 `/mobiflow:compile-project-config` 슬래시 커맨드로 명시 호출할 때만 실행되며 자연어 언급으로 자동 트리거되지 않는다.
disable-model-invocation: true
---

# compile-project-config

`docs/`(인간 결정 SSOT)에서 `docs/project.config.yaml`(기계 판독 fact view)을 컴파일하는 단방향 컴파일러 스킬입니다. spec phase 결정의 *근거*는 markdown에 남기되, AI agent·CI·툴이 query하는 *라우팅 키*는 별도 YAML로 노출합니다.

```
docs/architecture/architecture.md §3   ┐                              docs/project.config.yaml
docs/ui-design/ui-design.md §0        ├─→ compile-project-config →┐
디스크 스캔 (package.json, lockfile)   ┘                            └→ Makefile (mobiflow:scope-includes 블록만)
기존 project.config.yaml (보존 필드)                                (단일 commit)
```

산출물은 두 개로 한정: (1) `docs/project.config.yaml` 전체, (2) 루트 `Makefile`의 `# >>> mobiflow:scope-includes >>>` 블록. 두 출력 모두 같은 입력(`repo.scopes.*.path`)에서 파생되므로 함께 갱신·commit 합니다.

---

## 핵심 원칙

- **단방향**: `docs/` → 컴파일 산출물(`docs/project.config.yaml` + `Makefile` marker 블록). 역방향 금지. 사용자가 산출물을 직접 편집해 docs와 어긋나게 하면 다음 컴파일에서 docs 기준으로 덮어쓰기.
- **idempotent**: 변경 필요 없으면 "drift 없음"으로 즉시 종료. 매번 안전하게 호출 가능.
- **사용자 검토 게이트**: write 모드는 항상 diff 표시 후 사용자 confirm. 자동 commit은 confirm 후에만.
- **commit 분리**: 컴파일 결과는 별도 commit (`chore(config): recompile from docs/`). spec-lock 커밋이나 다른 변경과 섞지 않음.
- **보존 필드**: docs에서 도출 불가능한 필드(`tooling.formatter`, `tooling.test_runner` 등)는 기존 config 값을 보존. 사용자 편집 우선.
- **단일 책임**: 본 스킬은 docs를 **읽기만** 한다. 절대 수정하지 않음. 컴파일 산출물은 두 개로 한정: `docs/project.config.yaml`과 루트 `Makefile`의 `# >>> mobiflow:scope-includes >>>` 블록. 그 외 파일은 staging하지 않음.

---

## STEP 0: 사전 체크

아래 항목을 순서대로 검증합니다. 하나라도 실패하면 중단하고 사용자에게 원인을 설명합니다.

### 0-1. doc-guide.md 존재 확인

```bash
test -f docs/doc-guide.md
```

없으면 종료:

> ❌ `docs/doc-guide.md`를 찾을 수 없습니다. 먼저 `/mobiflow:init`으로 프로젝트를 부트스트랩해주세요.

### 0-2. git 저장소 확인

```bash
git rev-parse --is-inside-work-tree
```

실패하면 종료:

> ❌ 현재 디렉토리가 git 저장소가 아닙니다. 컴파일러는 commit을 생성하므로 저장소 내에서만 동작합니다.

### 0-3. architecture.md 존재 확인

```bash
test -f docs/architecture/architecture.md
```

없으면 종료:

> ❌ `docs/architecture/architecture.md`가 없습니다. compile-project-config는 architecture가 작성된 후에 의미가 있습니다 (repo 토폴로지·스택 결정의 SSOT). 먼저 `/mobiflow:spec-architecture`를 실행하세요.

### 0-4. project.config.yaml 존재 확인 (init 산출물)

```bash
test -f docs/project.config.yaml
```

없으면 종료 (init이 누락된 상태):

> ❌ `docs/project.config.yaml`이 없습니다. `/mobiflow:init`이 생성해야 하는 파일입니다. init을 다시 실행하거나 수동으로 템플릿을 복사하세요.

### 0-5. 루트 Makefile + marker 블록 존재 확인

```bash
test -f Makefile \
  && grep -q "# >>> mobiflow:scope-includes >>>" Makefile \
  && grep -q "# <<< mobiflow:scope-includes <<<" Makefile
```

실패하면 종료:

> ❌ 루트 `Makefile`이 없거나 `mobiflow:scope-includes` marker 블록이 누락됐습니다. `init`이 생성한 형태로 복원하세요(`skills/init/templates/Makefile` 참고). 본 스킬은 marker 블록 안만 재생성하므로 두 marker 라인이 모두 필요합니다.

marker 라인이 둘 이상이거나 순서가 뒤바뀌어 있으면 같은 메시지로 중단합니다 (사용자가 의도적으로 손댄 흔적이므로 자동 정정 금지).

---

## STEP 1: 모드 결정

### 1-1. 인자 파싱

- 인자 `--check` → check 모드 (read-only, 종료 코드로 신호)
- 인자 없음 → write 모드 (갱신 + diff + confirm + commit)
- 그 외 인자 → 에러 후 종료:

  > ❌ 알 수 없는 인자입니다. 사용법: `/mobiflow:compile-project-config` 또는 `/mobiflow:compile-project-config --check`

---

## STEP 2: 입력 수집

### 2-1. docs/ 파싱 (LLM 추출)

각 입력 문서에서 구조화된 fact를 추출합니다. prose 형식이 많아 정규식 휴리스틱 대신 본 스킬의 LLM이 직접 읽고 구조화합니다.

| 입력 파일 | 추출 대상 | 매핑 |
| --- | --- | --- |
| `docs/prd/prd.md` (frontmatter `title`) | 프로젝트 정체성 | `project.name` (` PRD` 접미사 제거) |
| `docs/architecture/architecture.md` §3 리포지토리 구조 | 트리·디렉토리 책임 | `repo.layout`, `repo.scopes.*.path`, `repo.shared` |
| `docs/architecture/architecture.md` §2 기술 스택 표 | 레이어별 기술 | `repo.scopes.*.runtime`, `framework`, `framework_version`, `styling`, `styling_version`, `language` |
| `docs/architecture/architecture.md` §9 기술 결정 로그 | 부가 결정 | 위 §2 추출 보강 (배포 타깃, 백엔드 스택 등) |
| `docs/ui-design/ui-design.md` §0 범위 선언 + frontmatter `based_on` | UI 유무 | `phases.draft.enabled` (A2형 스킵 감지 시 false) |
| `docs/architecture/architecture.md` 프론트엔드 런타임 결정 | 플랫폼 | `phases.draft.platforms` |
| 모든 `docs/<cat>/<cat>.md` 파일 존재 + §0 A2형 감지 | 활성 상태 | `docs.<cat>.status` (active / skipped) |

**`project.type` 합성 규칙** (architecture 결정에서 도출, 별도 PRD 질문 없음):

- 프론트엔드 런타임 있음 + 백엔드 스택 있음 → `app` (또는 `hybrid` 시 명시)
- 백엔드만 있음 → `service`
- 프론트엔드만 있고 백엔드 없음 → `app` (클라이언트 완결형)
- 재해석 모드 (architecture §0 라이브러리·SDK) → `library`
- 재해석 모드 (architecture §0 CLI 도구) → `cli`
- 모호한 경우 → `unknown` 유지 + 경고 표시

**A2형 스킵 감지 규칙**:

각 spec 문서의 §0 범위 선언 본문에서 다음 패턴 중 하나라도 매칭하면 `skipped`로 분류:

- "이 프로젝트에서는 ... 해당 없음"
- "작성을 스킵"
- "외부 인터페이스 없음"
- "시각·출력 표현 없음"
- 그 외 명백한 스킵 선언 표현 (LLM 판단)

§0이 없으면 `active`로 간주.

### 2-2. 디스크 스캔

| 소스 | 추출 |
| --- | --- |
| `pnpm-lock.yaml` 존재 | `tooling.package_manager: pnpm` |
| `package-lock.json` 존재 | `tooling.package_manager: npm` |
| `yarn.lock` 존재 | `tooling.package_manager: yarn` |
| `bun.lockb` 또는 `bun.lock` 존재 | `tooling.package_manager: bun` |
| `package.json` `packageManager` 필드 | `tooling.package_manager_version` |
| `.nvmrc` 또는 `package.json` `engines.node` | `tooling.node_version` |
| `apps/*` 또는 `packages/*` 디렉토리 실존 | `repo.scopes.*.path` 디스크 정합성 검증 |
| 각 scope의 `package.json` `dependencies` | `framework_version` 검증 (docs와 비교) |

**디스크-docs 충돌 처리:**

- docs는 pnpm인데 yarn.lock 존재 → 경고 표시, **docs 우선**으로 채움
- docs는 `apps/mobile`인데 디스크엔 `apps/app` → 경고 표시, **docs 우선**으로 채움 + 사용자 결정 안내
- 자동 수정 금지. 어느 쪽이 정답인지는 사용자가 판단.

lockfile이 하나도 없으면 (초기 단계) `tooling.package_manager`는 기존 config 값 또는 비워둠.

### 2-3. 루트 Makefile marker 블록 로드

`Makefile`을 읽고 `# >>> mobiflow:scope-includes >>>` 다음 줄부터 `# <<< mobiflow:scope-includes <<<` 직전 줄까지의 내용을 메모리에 보관합니다. 빈 블록(라인 0개)도 정상. STEP 4 diff 비교에 사용.

### 2-4. 기존 config 로드

`docs/project.config.yaml`을 읽어 보존 대상 필드를 추출합니다:

| 보존 필드 | 이유 |
| --- | --- |
| `tooling.formatter` | docs/에서 도출 불가, 사용자 결정 |
| `tooling.linter` | 동상 |
| `tooling.test_runner` | 동상 |
| `tooling.type_checker` | 동상 |
| `phases.dev.segments_available` | 사용자 수동 관리 영역 |
| `project.domain_language` | init이 결정, 이후 변경 시 사용자 직접 편집 |
| schema_version `1`에 명시되지 않은 미지 필드 | 보존 + 경고 표시 ("schema_version과 일치하지 않는 필드 발견") |

---

## STEP 3: 새 산출물 빌드

### 3-1. 새 config 빌드

병합 규칙 (우선순위 순):

1. docs/에서 도출된 필드 → docs 기준 (덮어쓰기)
2. 디스크 스캔 결과 → docs와 충돌 시 경고 후 docs 우선
3. 기존 config의 보존 필드 → 그대로 유지
4. 빈 placeholder (`{}`) → 추출 결과로 채움
5. 키 정렬·주석 → 템플릿(`skills/init/templates/project.config.yaml`)과 일관되게 유지

빌드 결과는 메모리상에 새 YAML 트리로 보관합니다. 아직 파일에 쓰지 않습니다.

### 3-2. 새 Makefile marker 블록 빌드

새 config의 `repo.scopes` 각 항목에 대해 `-include <path>/Makefile.targets` 한 줄을 생성, scope **키 알파벳순** 정렬. 정규화 규칙:

- `path: .` (flat 레이아웃) → `-include Makefile.targets`
- 그 외 모든 path → `-include <path>/Makefile.targets` (path 끝의 `/`는 제거)
- `repo.scopes`가 비어 있으면 빈 블록(0줄)

결과 예시:

```make
-include apps/backend/Makefile.targets
-include apps/mobile/Makefile.targets
```

이 블록만 메모리에 보관. 아직 Makefile에 쓰지 않습니다.

---

## STEP 4: diff 계산 및 분기

두 산출물 모두 비교:

1. `docs/project.config.yaml`: 현재 파일 vs 새 YAML 트리(STEP 3-1)
2. 루트 `Makefile`의 marker 블록: 현재 내용(STEP 2-3) vs 새 블록(STEP 3-2)

둘 중 **하나라도 다르면 drift**로 간주합니다. 둘 다 동일하면 drift 없음.

```bash
diff <(현재 docs/project.config.yaml) <(새 빌드 결과)
diff <(현재 Makefile marker 블록 내용) <(새 marker 블록 내용)
```

### 4-A. drift 없음 (diff 비어있음)

**check 모드**:

```
✅ docs/project.config.yaml drift 없음
```

종료 코드 `0`으로 종료.

**write 모드**:

```
✅ docs/project.config.yaml은 docs/와 일치합니다. 변경 없음.
```

파일 갱신·commit 없이 종료.

### 4-B. drift 있음 (diff 존재)

#### 4-B-1. check 모드

drift 항목을 표 형식으로 출력합니다. **파일 갱신·commit 안 함**.

```
❌ drift 감지

  필드                              현재                새 값
  ────                              ────                ────
  repo.scopes.mobile.path           apps/mobile         apps/app
  phases.draft.platforms            [mobile]            [mobile, web]
  docs.api-design.status            active              skipped

  Makefile (mobiflow:scope-includes):
    - -include apps/mobile/Makefile.targets
    + -include apps/app/Makefile.targets

경고:
  - 디스크에 apps/app/이 존재하지 않음 (architecture.md §3과 불일치)

갱신: /mobiflow:compile-project-config (인자 없이)
```

config·Makefile 둘 중 한쪽만 변경된 경우 해당 섹션만 표시. 종료 코드 `1`로 종료. CI에서 `compile-project-config --check || exit 1` 패턴 사용 가능.

#### 4-B-2. write 모드

drift 항목 + 경고 표시 후 사용자 confirm:

```
📋 변경 사항

  docs/project.config.yaml:
    repo.scopes.mobile.path           apps/mobile  →  apps/app
    phases.draft.platforms            [mobile]     →  [mobile, web]
    docs.api-design.status            active       →  skipped

  Makefile (mobiflow:scope-includes):
    - -include apps/mobile/Makefile.targets
    + -include apps/app/Makefile.targets

경고:
  - 디스크에 apps/app/이 존재하지 않음 (architecture.md §3과 불일치)

적용하시겠습니까?

1. 적용 + 별도 commit (권장)
2. 적용만, commit은 사용자가 수동 (다른 변경과 묶기 위함)
3. 취소
```

- **1번**: 파일 갱신(둘 다) + `git add docs/project.config.yaml Makefile` + 별도 commit (변경된 파일만 staging — Makefile 블록이 동일하면 Makefile은 staging 안 함)
- **2번**: 파일 갱신만, staging·commit 없음
- **3번**(또는 그 외): 종료, 파일 변경 없음

Makefile 갱신은 marker 블록 안만 in-place 교체. marker 라인 자체와 블록 바깥 내용은 절대 건드리지 않음.

##### 1번 commit 형식

```bash
git add docs/project.config.yaml Makefile   # 실제 변경된 파일만
git commit -m "chore(config): recompile from docs/" -m "{변경 항목 요약}"
```

Body는 변경 항목을 한 줄씩 나열:

```
chore(config): recompile from docs/

- repo.scopes.mobile.path: apps/mobile → apps/app
- phases.draft.platforms: [mobile] → [mobile, web]
- docs.api-design.status: active → skipped
- Makefile scope-includes: apps/mobile → apps/app
```

---

## STEP 5: 완료 보고

### 5-1. drift 없음 케이스

```
✅ compile-project-config 완료

  모드:           {check | write}
  결과:           drift 없음
```

### 5-2. write 모드 + 사용자가 적용 선택 케이스

```
✅ compile-project-config 완료

  모드:           write
  결과:           drift 감지 → 갱신 + commit
  갱신 파일:      docs/project.config.yaml, Makefile
  변경 항목 (4):
    - repo.scopes.mobile.path
    - phases.draft.platforms
    - docs.api-design.status
    - Makefile scope-includes

  경고 (1):
    - 디스크에 apps/app/이 존재하지 않음

  commit:         {hash} chore(config): recompile from docs/

다음 단계:
  - 디스크 정합성: apps/mobile → apps/app 디렉토리 정리 필요
  - draft/dev phase 작업 재개
```

`갱신 파일:` 라인에는 실제로 변경된 산출물만 표시(둘 다 / 하나만 / 없음). `commit:` 라인은 1번을 선택했을 때만 표시. 2번이면 `staged: {갱신된 파일들} (commit 미수행)` 표시.

### 5-3. check 모드 + drift 감지 케이스

STEP 4-B-1의 출력으로 갈음하고, 별도 STEP 5 보고는 생략 (이미 표시됨). 종료 코드 `1`.

---

## 주의사항

- 본 스킬은 docs를 **읽기만** 한다. 절대 수정하지 않는다 (단방향 invariant).
- 산출물은 `docs/project.config.yaml`과 루트 `Makefile`의 marker 블록 두 개로 한정. 그 외 파일은 staging하지 않는다 — 의도치 않은 파일이 commit에 포함되지 않도록.
- Makefile의 marker 블록 **바깥**(다른 타깃, `help::`, 사용자 추가 라인 등)은 절대 건드리지 않는다. marker 두 라인 자체도 보존. 사용자가 marker 블록 안에 수동 추가한 라인은 다음 컴파일에서 docs 기준으로 덮어써짐 (단방향 원칙).
- LLM 추출 결과는 비결정적이므로 사용자 confirm을 항상 거친다. 자동 confirm 옵션 없음.
- 디스크-docs 정합성 위반은 경고만, 자동 수정 금지. 사용자가 어느 쪽이 정답인지 판단해야 한다.
- `--check` 모드는 종료 코드 1을 반환. CI에서 `compile-project-config --check || fail` 패턴.
- 본 스킬은 spec-lock과 독립적이다. spec-lock은 docs 커밋 + 태그만 담당하고, 본 스킬은 별도 commit으로 config를 갱신한다. 호출 순서·시점은 사용자가 결정.
- 컴파일러가 도출 불가능한 필드(`tooling.formatter` 등)는 기존 config 값을 보존한다. 첫 컴파일 시점에는 비어있을 수 있으며 사용자가 수동으로 채운다 (이후 컴파일이 보존).

---

## 언어/톤

한국어. drift 보고는 표 형식으로 한눈에 파악 가능하게. 경고는 원인과 사용자 결정 옵션을 명시. 짧고 명확하게.
