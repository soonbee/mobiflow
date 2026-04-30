---
name: init
description: 빈 디렉토리에서 nidost 워크플로우용 프로젝트를 부트스트랩하는 스킬. docs/doc-guide.md, docs/INDEX.md 등 프로젝트 골격을 생성한다. 사용자가 `/nidost:init` 슬래시 커맨드로 명시 호출할 때만 실행되며 자연어 언급으로 자동 트리거되지 않는다.
disable-model-invocation: true
---

# init

빈 디렉토리에 git-flow 브랜치 전략과 최소 스캐폴딩(README, Makefile, .gitignore, docs/doc-guide.md)을 생성합니다. 앱/DB/프레임워크 선택은 이 스킬이 관여하지 않으며, 이후 `spec-prd`, `spec-*` 단계에서 결정됩니다.

---

## STEP 0: 사전 체크 (빈 디렉토리 검증)

현재 디렉토리에 파일/디렉토리가 하나라도 있으면 즉시 중단합니다. `.git`이 이미 존재하는 경우도 중단 대상입니다.

```bash
if [ -n "$(ls -A . 2>/dev/null)" ]; then
  echo "❌ 현재 디렉토리가 비어 있지 않습니다. init은 빈 디렉토리에서만 실행됩니다."
  ls -la
  exit 1
fi
```

중단 시 사용자에게 현재 디렉토리 상태를 보고하고, 다른 디렉토리에서 재실행하도록 안내합니다.

---

## STEP 1: 프로젝트 이름 컨펌

현재 디렉토리 이름을 기본값으로 삼고, kebab-case 변환본과 비교해 선택지를 구성합니다.

```bash
DEFAULT_NAME=$(basename "$PWD")
# 영문 소문자 + kebab-case 정규화 (공백/언더스코어/대문자 처리)
KEBAB_NAME=$(echo "$DEFAULT_NAME" | tr '[:upper:] _' '[:lower:]--' | sed 's/[^a-z0-9-]//g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
```

`AskUserQuestion` 툴로 프로젝트 이름을 묻습니다. 선택지는 `DEFAULT_NAME`과 `KEBAB_NAME`의 관계에 따라 달라집니다.

**case A: `KEBAB_NAME`이 `DEFAULT_NAME`과 다른 경우** (디렉토리명이 kebab-case가 아님)

- question: "프로젝트 이름을 무엇으로 할까요?"
- header: "프로젝트명"
- options:
  1. label: "{KEBAB_NAME}" — description: "디렉토리명을 kebab-case로 정리"
  2. label: "{DEFAULT_NAME}" — description: "디렉토리명을 그대로 사용"

**case B: `KEBAB_NAME`이 `DEFAULT_NAME`과 같은 경우** (이미 kebab-case)

- question: "프로젝트 이름을 `{DEFAULT_NAME}`으로 사용할까요?"
- header: "프로젝트명"
- options:
  1. label: "{DEFAULT_NAME} 사용" — description: "현재 디렉토리 이름 그대로 사용"
  2. label: "다른 이름 입력" — description: "선택 후 원하는 이름을 자유 입력"

두 경우 모두, 사용자가 자동 추가되는 **"Other"** 항목을 선택하면 자유 입력값을 그대로 `PROJECT_NAME`으로 채택합니다. case B의 두 번째 옵션이 선택되면 후속 프롬프트로 자유 입력을 유도합니다.

사용자 응답을 `PROJECT_NAME`으로 확정합니다.

---

## STEP 2: 템플릿 복사

이 스킬의 `templates/` 디렉토리에서 파일을 프로젝트 루트로 복사합니다. 스킬 디렉토리 경로는 실행 시점에 파악합니다 (예: Claude Code 플러그인의 skill 경로).

| 템플릿 원본                         | 복사 대상                          | 비고                          |
| ----------------------------------- | ---------------------------------- | ----------------------------- |
| `templates/doc-guide.md`            | `docs/doc-guide.md`                | `docs/` 디렉토리 함께 생성    |
| `templates/project.config.yaml`     | `docs/project.config.yaml`         | `{{PROJECT_NAME}}` 치환       |
| `templates/spec-backlog.md`         | `docs/spec-backlog.md`             | refine phase active 백로그    |
| `templates/spec-backlog-archive.md` | `docs/spec-backlog-archive.md`     | refine phase archive 백로그   |
| `templates/README.md`               | `README.md`                        | `{{PROJECT_NAME}}` 치환       |
| `templates/Makefile`                | `Makefile`                         | 그대로 복사                   |
| `templates/gitignore`               | `.gitignore`                       | 이름만 `.`을 붙여 복사        |

복사 후 플레이스홀더를 치환합니다:

```bash
# macOS와 Linux 호환
sed -i.bak "s/{{PROJECT_NAME}}/${PROJECT_NAME}/g" README.md && rm README.md.bak
sed -i.bak "s/{{PROJECT_NAME}}/${PROJECT_NAME}/g" docs/project.config.yaml && rm docs/project.config.yaml.bak
```

---

## STEP 3: Git 초기화 및 git-flow 브랜치 생성

```bash
git init -b main
git add .
git commit -m "chore: initial commit"

# develop 브랜치 생성 후 main 복귀
git checkout -b develop
git checkout main
```

원격 저장소 연결은 하지 않습니다. 사용자가 필요할 때 직접 `git remote add origin <url>`을 수행합니다.

**브랜치 전략:**

```
main       ← 프로덕션 릴리즈. 직접 커밋 금지.
develop    ← 통합 브랜치. 모든 feature가 여기로 머지.
feature/*  ← 티켓 단위 개발 브랜치 (from develop)
release/*  ← 릴리즈 준비 브랜치 (from develop → main+develop 머지)
hotfix/*   ← 긴급 수정 브랜치 (from main → main+develop 머지)
```

---

## 완료 보고

모든 단계 완료 후 아래 형식으로 보고합니다:

```
✅ nidost init 완료

  프로젝트:   {PROJECT_NAME}
  브랜치:     main, develop (git-flow)
  생성 파일:
    - .gitignore
    - Makefile
    - README.md
    - docs/doc-guide.md
    - docs/project.config.yaml
    - docs/spec-backlog.md
    - docs/spec-backlog-archive.md

다음 스킬: nidost:spec-prd
```

---

## 주의사항

- 이 스킬은 **빈 디렉토리에서만** 동작합니다. 기존 프로젝트 마이그레이션은 지원하지 않습니다.
- 앱 스캐폴딩(`apps/mobile`, `apps/backend` 등), DB 셋업(`db/`), CI 워크플로우(`.github/workflows/`)는 생성하지 않습니다. 각각 해당 단계의 전용 스킬이 담당합니다.
- `docs/doc-guide.md`는 사용자 프로젝트의 문서 규칙이며, 필요 시 이 파일을 직접 수정하여 조정할 수 있습니다. 이후 `spec-prd` 등 문서를 작성하는 스킬은 이 파일을 참조합니다.
- git 명령 실패 시 에러 메시지와 원인을 설명하고 수동 해결 방법을 안내합니다.
